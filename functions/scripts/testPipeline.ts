import { readFileSync } from "node:fs";
import { extname } from "node:path";
import { runPipeline } from "../agents/pipeline";

// Usage: npm run test:pipeline -- <image path> [lat] [lng]
const [path, lat = "28.6", lng = "77.2"] = process.argv.slice(2);
if (!path) throw new Error("Usage: npm run test:pipeline -- <image path> [lat] [lng]");

const mime = { ".png": "image/png", ".webp": "image/webp" }[extname(path).toLowerCase()] ?? "image/jpeg";

runPipeline(readFileSync(path).toString("base64"), mime, Number(lat), Number(lng)).then((r) => {
  console.log(JSON.stringify(r, null, 2));
});
