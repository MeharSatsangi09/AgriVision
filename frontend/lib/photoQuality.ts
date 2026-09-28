// Client-side, zero-cost photo checks run the instant a photo is picked, before it's ever uploaded — the
// "Photo Quality Coach". Two things are genuinely measurable from pixels alone and are checked for real:
// blur (a classic variance-of-Laplacian sharpness score) and lighting (mean brightness). "Is one leaf in
// focus and filling the frame" is NOT detected here — that needs real object detection (i.e. another Gemini
// call per photo, real cost, doubling API use on every upload just for a pre-check) — so UploadCard shows
// that as a fixed, always-visible tip instead of a claim we can't back up.
export interface QualityIssue {
  blurry: boolean;
  dark: boolean;
  bright: boolean;
}

const SAMPLE_SIZE = 220; // small + downscaled: this only has to be fast, not exact
const BLUR_THRESHOLD = 45; // variance of the Laplacian below this reads as blurry (tuned by eye, not a spec)
const DARK_THRESHOLD = 55; // mean luma 0-255
const BRIGHT_THRESHOLD = 225;

export async function assessPhotoQuality(file: File): Promise<QualityIssue | null> {
  try {
    const bmp = await createImageBitmap(file);
    const scale = SAMPLE_SIZE / Math.max(bmp.width, bmp.height);
    const w = Math.max(1, Math.round(bmp.width * scale));
    const h = Math.max(1, Math.round(bmp.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(bmp, 0, 0, w, h);
    const { data } = ctx.getImageData(0, 0, w, h);

    const gray = new Float32Array(w * h);
    let sum = 0;
    for (let i = 0, p = 0; i < data.length; i += 4, p++) {
      const luma = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      gray[p] = luma;
      sum += luma;
    }
    const mean = sum / gray.length;

    // Variance of the Laplacian (4*center - up - down - left - right): a sharp photo has strong edges and a
    // high-variance response; a blurry one is close to flat everywhere.
    let lapSum = 0;
    let lapSumSq = 0;
    let n = 0;
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const i = y * w + x;
        const lap = 4 * gray[i] - gray[i - 1] - gray[i + 1] - gray[i - w] - gray[i + w];
        lapSum += lap;
        lapSumSq += lap * lap;
        n++;
      }
    }
    const lapMean = lapSum / n;
    const variance = lapSumSq / n - lapMean * lapMean;

    return { blurry: variance < BLUR_THRESHOLD, dark: mean < DARK_THRESHOLD, bright: mean > BRIGHT_THRESHOLD };
  } catch {
    return null; // decoding failed here — compressImage/upload will surface the real error
  }
}
