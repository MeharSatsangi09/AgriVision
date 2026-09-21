import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import jpeg from "jpeg-js";
import { PNG } from "pngjs";
import { parseDiagnosis } from "../agents/diagnosisAgent";
import { LOW_CONFIDENCE_THRESHOLD, agreesWith, classifyImage, cropResize, dirSource, parseLabel, resetClassifierCache } from "../tools/classifierTool";

// Tests the classifier plumbing with a small stand-in model that has the SAME input/output signature as the
// real MobileNetV2 export (224x224x3 float 0-255 -> 38 softmax). Usage: node lib/scripts/testClassifier.js [leaf.jpg]

const fail = (m: string): never => {
  console.error("FAIL:", m);
  process.exit(1);
};
const ok = (m: string) => console.log("ok  ", m);

const LABELS = [
  "Apple___Apple_scab", "Apple___Black_rot", "Apple___Cedar_apple_rust", "Apple___healthy", "Blueberry___healthy",
  "Cherry_(including_sour)___Powdery_mildew", "Corn_(maize)___Common_rust_", "Pepper,_bell___Bacterial_spot",
  "Potato___Late_blight", "Tomato___Late_blight", "Tomato___Tomato_mosaic_virus", "Tomato___healthy",
  ...Array.from({ length: 26 }, (_, i) => `Crop${i}___Condition_${i}`),
];

async function buildFakeModel(dir: string) {
  const tf = await import("@tensorflow/tfjs");
  await tf.ready();
  const model = tf.sequential();
  model.add(tf.layers.conv2d({ inputShape: [224, 224, 3], filters: 4, kernelSize: 3, strides: 8, activation: "relu" }));
  model.add(tf.layers.globalAveragePooling2d({}));
  model.add(tf.layers.dense({ units: LABELS.length, activation: "softmax" }));
  let art: any;
  await model.save(
    tf.io.withSaveHandler(async (a) => {
      art = a;
      return { modelArtifactsInfo: { dateSaved: new Date(), modelTopologyType: "JSON" as const } };
    })
  );
  mkdirSync(path.join(dir, "tfjs_layers"), { recursive: true });
  writeFileSync(
    path.join(dir, "tfjs_layers", "model.json"),
    JSON.stringify({
      modelTopology: art.modelTopology,
      format: "layers-model",
      generatedBy: art.generatedBy,
      convertedBy: null,
      weightsManifest: [{ paths: ["group1-shard1of1.bin"], weights: art.weightSpecs }],
    })
  );
  writeFileSync(path.join(dir, "tfjs_layers", "group1-shard1of1.bin"), Buffer.from(art.weightData));
  writeFileSync(path.join(dir, "labels.json"), JSON.stringify({ model: "fake-v0", labels: LABELS }));
}

function gradientRGBA(w: number, h: number) {
  const data = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) data.set([(x * 255) / w, (y * 255) / h, 90, 255], (y * w + x) * 4);
  return { data, width: w, height: h };
}

async function main() {
  // --- pure helpers
  const p = parseLabel("Tomato___Late_blight");
  if (p.crop !== "Tomato" || p.condition !== "Late blight") fail(`parseLabel: ${JSON.stringify(p)}`);
  const p2 = parseLabel("Corn_(maize)___Common_rust_");
  if (p2.crop !== "Corn (maize)" || p2.condition !== "Common rust") fail(`parseLabel corn: ${JSON.stringify(p2)}`);
  ok("parseLabel");

  const solid = Buffer.alloc(400 * 300 * 4);
  for (let i = 0; i < solid.length; i += 4) solid.set([10, 200, 30, 255], i);
  const s = cropResize({ data: solid, width: 400, height: 300 });
  if (s.length !== 224 * 224 * 3 || Math.abs(s[0] - 10) > 0.01 || Math.abs(s[1] - 200) > 0.01 || Math.abs(s[s.length - 1] - 30) > 0.01)
    fail("cropResize solid colour");
  ok("cropResize keeps colours and outputs 224x224x3");

  // left half red, right half blue, 400x100 -> centre square is x 150..250 -> first pixel red, last pixel blue
  const split = Buffer.alloc(400 * 100 * 4);
  for (let y = 0; y < 100; y++)
    for (let x = 0; x < 400; x++) split.set(x < 200 ? [255, 0, 0, 255] : [0, 0, 255, 255], (y * 400 + x) * 4);
  const c = cropResize({ data: split, width: 400, height: 100 });
  const last = c.length - 3;
  if (!(c[0] > 250 && c[2] < 5 && c[last] < 5 && c[last + 2] > 250)) fail("cropResize centre crop");
  ok("cropResize centre-crops to a square");

  // --- agreement with Gemini (condition names from PlantVillage vs Gemini's controlled vocabulary)
  const pairs: [string, string, boolean][] = [
    ["Late blight", "late blight", true], ["Early blight", "late blight", false], ["Healthy", "healthy", true],
    ["Healthy", "black spot", false], ["Cercospora leaf spot Gray leaf spot", "gray leaf spot", true],
    ["Tomato Yellow Leaf Curl Virus", "leaf curl virus", true], ["Tomato mosaic virus", "mosaic virus", true],
    ["Haunglongbing Citrus greening", "citrus greening", true], ["Bacterial spot", "bacterial leaf spot", true],
    ["Leaf scorch", "black spot", false] /* the rose-leaf case */, ["Late blight", "unclear", false],
    ["Spider mites Two spotted spider mite", "spider mite damage", true], ["Powdery mildew", "downy mildew", false],
    ["Apple scab", "apple scab", true], ["Black rot", "black rot", true], ["Black rot", "black spot", false],
    ["Northern Leaf Blight", "northern leaf blight", true], ["Septoria leaf spot", "leaf spot", true],
    ["Bacterial spot", "black spot", false], ["Target Spot", "bacterial spot", false], ["", "healthy", true],
  ];
  for (const [cond, gem, want] of pairs)
    if (agreesWith({ condition: cond }, gem) !== want) fail(`agreesWith("${cond}", "${gem}") should be ${want}`);
  ok(`agreesWith: ${pairs.length} classifier/Gemini name pairs (incl. rose-leaf case and "unclear")`);

  // --- agreement through the REAL Gemini-output parsing path (raw model text -> parseDiagnosis -> agreesWith).
  // Covers messy shapes a model can return: code fences, mixed case, parenthetical Latin names, a "disease" suffix,
  // a full descriptive sentence in the disease field, broken JSON.
  const j = (disease: string) => JSON.stringify({ disease, severity: "medium", confidence: 0.9, followUp: "" });
  const raw: [string, string, boolean][] = [
    [j("Early blight"), "Early blight", true],
    [["```json", j("Late blight"), "```"].join(String.fromCharCode(10)), "Late blight", true],
    [j("Tomato Late Blight (Phytophthora infestans)"), "Late blight", true],
    [j("Black spot disease"), "Leaf scorch", false], // rose leaf vs classifier's guess
    [j("Black spot disease"), "Black rot", false],
    [j("This looks like early blight based on the brown spotting pattern"), "Early blight", true],
    [j("This looks like early blight based on the brown spotting pattern"), "Late blight", false],
    [j("This looks like early blight based on the brown spotting pattern"), "Healthy", false],
    [j("healthy"), "Healthy", true],
    [j("Healthy"), "Late blight", false],
    [j("unclear"), "Late blight", false],
    [j("Spider mite damage"), "Spider mites Two spotted spider mite", true],
    [j("Leaf curl virus"), "Tomato Yellow Leaf Curl Virus", true],
    ["not json at all", "Late blight", false], // parse failure -> "unclear" -> no agreement
    ["", "Early blight", false],
  ];
  for (const [text, cond, want] of raw) {
    const disease = parseDiagnosis(text).disease;
    if (agreesWith({ condition: cond }, disease) !== want)
      fail(`parse+agree: model text ${JSON.stringify(text.slice(0, 60))} -> disease "${disease}" vs classifier "${cond}" should be ${want}`);
  }
  ok(`agreesWith through parseDiagnosis: ${raw.length} realistic/messy Gemini outputs`);

  // --- real loader against a stand-in model
  const dir = path.join(os.tmpdir(), "agrivision-fake-model");
  await buildFakeModel(dir);
  ok("built + saved stand-in model (TF.js layers format)");
  const src = dirSource(dir);
  resetClassifierCache();

  const leafPath = process.argv[2] ?? path.join(os.homedir(), "Downloads", "leaf image.jpg");
  let jpg: Buffer;
  if (existsSync(leafPath)) jpg = (await import("node:fs")).readFileSync(leafPath);
  else jpg = Buffer.from(jpeg.encode(gradientRGBA(320, 240), 85).data);

  const r1 = await classifyImage(jpg, src);
  if (!r1) fail("JPEG returned null");
  const r = r1!;
  if (!LABELS.includes(r.label)) fail("label not in labels");
  if (!(r.confidence > 0 && r.confidence <= 1)) fail("confidence out of range");
  if (r.top3.length !== 3 || !(r.top3[0].confidence >= r.top3[1].confidence && r.top3[1].confidence >= r.top3[2].confidence)) fail("top3 not sorted");
  if (r.top3.reduce((a, t) => a + t.confidence, 0) > 1.003) fail("top3 probabilities sum above 1");
  if (r.lowConfidence !== r.confidence < LOW_CONFIDENCE_THRESHOLD) fail("lowConfidence flag does not match the threshold");
  ok(`JPEG -> ${r.crop} / ${r.condition} (${(r.confidence * 100).toFixed(1)}%), top3 sorted, ${r.ms} ms`);

  const r2 = await classifyImage(jpg, src);
  if (r2!.label !== r.label || r2!.confidence !== r.confidence) fail("not deterministic");
  ok(`deterministic + cached model (second call ${r2!.ms} ms)`);

  const png = PNG.sync.write(Object.assign(new PNG({ width: 300, height: 200 }), { data: gradientRGBA(300, 200).data }));
  const r3 = await classifyImage(png, src);
  if (!r3) fail("PNG returned null");
  ok(`PNG -> ${r3!.crop} (${(r3!.confidence * 100).toFixed(1)}%)`);

  if ((await classifyImage(Buffer.from("definitely not an image"), src)) !== null) fail("garbage should be null");
  if ((await classifyImage(Buffer.concat([Buffer.alloc(4), Buffer.from("ftypheic")]), src)) !== null) fail("HEIC should be null");
  if ((await classifyImage(Buffer.from([0xff, 0xd8, 0xff, 0x00, 0x01]), src)) !== null) fail("truncated JPEG should be null");
  ok("garbage / HEIC / corrupt JPEG -> null (skipped, no throw)");

  resetClassifierCache();
  const t0 = Date.now();
  const missing = await classifyImage(jpg, dirSource(path.join(os.tmpdir(), "no-such-model-dir")));
  const again = await classifyImage(jpg, dirSource(path.join(os.tmpdir(), "no-such-model-dir")));
  if (missing !== null || again !== null) fail("missing model should give null");
  if (Date.now() - t0 > 3000) fail("missing-model retries are not throttled");
  ok("missing model -> null, and retries are throttled");

  console.log("\nall classifier checks passed");
}

main().catch((e) => fail(String(e?.stack ?? e)));
