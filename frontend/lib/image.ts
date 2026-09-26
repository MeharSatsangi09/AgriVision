// Shrinks big phone photos before upload (faster on rural networks, cheaper for Gemini).
// Falls back to the original file if the browser cannot decode it (e.g. HEIC).
// The classifier on the server only decodes JPEG and PNG, so any other format (WebP...) is always re-encoded as JPEG.
export async function compressImage(file: File, maxDim = 1600, quality = 0.85): Promise<File> {
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, maxDim / Math.max(bmp.width, bmp.height));
    const serverReadable = file.type === "image/jpeg" || file.type === "image/png";
    if (serverReadable && scale === 1 && file.size < 1.5 * 1024 * 1024) return file;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", quality));
    if (!blob || (serverReadable && blob.size >= file.size)) return file;
    return new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch {
    return file;
  }
}
