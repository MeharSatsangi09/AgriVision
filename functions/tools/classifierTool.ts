import { readFile } from "node:fs/promises";
import path from "node:path";
import { getStorage } from "firebase-admin/storage";
import jpeg from "jpeg-js";
import { PNG } from "pngjs";

// Our own trained classifier (MobileNetV2 fine-tuned on PlantVillage; see training/train_disease_classifier.ipynb).
// It runs NEXT TO Gemini and never replaces it: every failure path returns null so the main pipeline is unaffected.
// Pure-JavaScript TensorFlow.js (no native build), loaded lazily so an import problem cannot stop the function starting.

type TF = typeof import("@tensorflow/tfjs");

export const MODEL_DIR = "models/disease-classifier-v1";
// Below this the "Second opinion" is shown as uncertain. 80% chosen from a 55-photo test (see memory.md): it hides 14% of
// real PlantVillage photos but flags 63% of out-of-distribution ones (70% flagged only 32%). No threshold can catch the
// confidently-wrong cases (up to 99.9%), which is what agreesWith() below is for.
export const LOW_CONFIDENCE_THRESHOLD = 0.8;
const SIZE = 224;
const RETRY_AFTER_MS = 5 * 60_000; // don't hammer Storage if the model isn't there yet

export interface ClassifierResult {
  label: string; // raw PlantVillage class, e.g. "Tomato___Late_blight"
  crop: string; // "Tomato"
  condition: string; // "Late blight"
  confidence: number; // 0-1 (raw, kept for debugging)
  lowConfidence: boolean; // confidence < LOW_CONFIDENCE_THRESHOLD
  agreesWithGemini?: boolean; // set by runAnalysis once Gemini's diagnosis is known
  top3: { label: string; confidence: number }[]; // "Tomato – Late blight"
  model: string;
  ms: number;
}

// Where the model files come from (Storage in production, a local folder in tests).
export interface ModelSource {
  read(relPath: string): Promise<Buffer>;
}
// Reads the model from Firebase Storage. Pass the bucket explicitly (the upload event provides it) rather than
// relying on a default bucket being configured.
export const storageSource = (bucketName?: string): ModelSource => ({
  read: async (p) => (await getStorage().bucket(bucketName).file(`${MODEL_DIR}/${p}`).download())[0],
});
export const dirSource = (dir: string): ModelSource => ({ read: (p) => readFile(path.join(dir, p)) });

interface Loaded {
  tf: TF;
  model: import("@tensorflow/tfjs").LayersModel;
  labels: string[];
  name: string;
}

async function loadModel(source: ModelSource): Promise<Loaded> {
  const tf = await import("@tensorflow/tfjs");
  await tf.ready();
  const meta = JSON.parse((await source.read("labels.json")).toString("utf8"));
  const json = JSON.parse((await source.read("tfjs_layers/model.json")).toString("utf8"));
  const groups = json.weightsManifest as { paths: string[]; weights: any[] }[];
  const shards = await Promise.all(groups.flatMap((g) => g.paths).map((p) => source.read(`tfjs_layers/${p}`)));
  const all = Buffer.concat(shards);
  const weightData = all.buffer.slice(all.byteOffset, all.byteOffset + all.byteLength) as ArrayBuffer;
  const model = await tf.loadLayersModel(
    tf.io.fromMemory({ modelTopology: json.modelTopology, weightSpecs: groups.flatMap((g) => g.weights), weightData })
  );
  return { tf, model, labels: meta.labels as string[], name: String(meta.model ?? "disease-classifier") };
}

let loadPromise: Promise<Loaded | null> | null = null;
let lastFailure = 0;

// Loads once per instance and caches. Returns null (and retries later) if the model isn't available.
export function getClassifier(source: ModelSource = storageSource()): Promise<Loaded | null> {
  if (loadPromise) return loadPromise;
  if (Date.now() - lastFailure < RETRY_AFTER_MS) return Promise.resolve(null);
  loadPromise = loadModel(source).catch((err) => {
    console.warn("classifier unavailable:", String(err?.message ?? err).slice(0, 200));
    lastFailure = Date.now();
    loadPromise = null;
    return null;
  });
  return loadPromise;
}

export function resetClassifierCache() {
  loadPromise = null;
  lastFailure = 0;
}

interface Raster {
  data: Uint8Array | Buffer;
  width: number;
  height: number;
}

// JPEG and PNG only; anything else (HEIC, WebP...) is skipped quietly.
function decode(buf: Buffer): Raster | null {
  try {
    if (buf[0] === 0xff && buf[1] === 0xd8) return jpeg.decode(buf, { useTArray: true, maxMemoryUsageInMB: 512 });
    if (buf[0] === 0x89 && buf[1] === 0x50) return PNG.sync.read(buf);
  } catch {
    /* corrupt image */
  }
  return null;
}

// Center-crops to a square and area-averages down to SIZE x SIZE (antialiased). Returns RGB floats in 0-255.
export function cropResize(img: Raster, size = SIZE): Float32Array {
  const side = Math.min(img.width, img.height);
  const ox = Math.floor((img.width - side) / 2);
  const oy = Math.floor((img.height - side) / 2);
  const scale = side / size;
  const out = new Float32Array(size * size * 3);
  for (let ty = 0; ty < size; ty++) {
    const y0 = Math.floor(ty * scale);
    const y1 = Math.min(side, Math.max(y0 + 1, Math.ceil((ty + 1) * scale)));
    for (let tx = 0; tx < size; tx++) {
      const x0 = Math.floor(tx * scale);
      const x1 = Math.min(side, Math.max(x0 + 1, Math.ceil((tx + 1) * scale)));
      let r = 0,
        g = 0,
        b = 0;
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const i = ((oy + y) * img.width + ox + x) * 4;
          r += img.data[i];
          g += img.data[i + 1];
          b += img.data[i + 2];
        }
      }
      const n = (y1 - y0) * (x1 - x0);
      const o = (ty * size + tx) * 3;
      out[o] = r / n;
      out[o + 1] = g / n;
      out[o + 2] = b / n;
    }
  }
  return out;
}

const clean = (s: string) => s.replace(/_/g, " ").replace(/\s+/g, " ").trim();
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// "Tomato___Late_blight" -> { crop: "Tomato", condition: "Late blight" }
export function parseLabel(raw: string) {
  const [crop, condition] = raw.split("___");
  return { crop: cap(clean(crop ?? raw)), condition: cap(clean(condition ?? "")) };
}

export async function classifyImage(image: Buffer, source: ModelSource = storageSource()): Promise<ClassifierResult | null> {
  const t0 = Date.now();
  const raster = decode(image);
  if (!raster) return null;
  const loaded = await getClassifier(source);
  if (!loaded) return null;

  const { tf, model, labels, name } = loaded;
  const input = tf.tensor4d(cropResize(raster), [1, SIZE, SIZE, 3]);
  const out = model.predict(input) as import("@tensorflow/tfjs").Tensor;
  const probs = Array.from(await out.data());
  input.dispose();
  out.dispose();

  const ranked = probs.map((p, i) => ({ p, i })).sort((a, b) => b.p - a.p).slice(0, 3);
  const pretty = (i: number) => {
    const { crop, condition } = parseLabel(labels[i]);
    return condition ? `${crop} – ${condition}` : crop;
  };
  const best = parseLabel(labels[ranked[0].i]);
  return {
    label: labels[ranked[0].i],
    crop: best.crop,
    condition: best.condition,
    confidence: Math.round(ranked[0].p * 1000) / 1000,
    lowConfidence: ranked[0].p < LOW_CONFIDENCE_THRESHOLD,
    top3: ranked.map((r) => ({ label: pretty(r.i), confidence: Math.round(r.p * 1000) / 1000 })),
    model: name,
    ms: Date.now() - t0,
  };
}

// Lower-case words, with a trailing plural "s" removed ("mites" -> "mite").
const words = (s: string) =>
  s.toLowerCase().replace(/[^a-z\s]/g, " ").split(/\s+/).filter(Boolean).map((w) => (w.length > 3 ? w.replace(/s$/, "") : w));

// Does the classifier's condition match Gemini's disease name? Used as a second trust signal because softmax confidence
// alone cannot catch confidently-wrong answers on crops the model never saw. If Gemini sees no identifiable crop
// ("unclear"), the classifier cannot be right, so that counts as a disagreement.
export function agreesWith(c: Pick<ClassifierResult, "condition">, geminiDisease: string): boolean {
  const g = words(geminiDisease);
  if (!g.length || g.join(" ") === "unclear") return false;
  const k = words(c.condition || "healthy");
  const gs = g.join(" ");
  const ks = k.join(" ");
  if (gs === ks || ks.includes(gs) || gs.includes(ks)) return true;
  const shared = new Set(g.filter((w) => k.includes(w))).size;
  return shared / Math.min(new Set(g).size, new Set(k).size) >= 0.66;
}
