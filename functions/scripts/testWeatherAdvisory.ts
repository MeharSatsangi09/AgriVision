import { readFileSync } from "node:fs";
import { extname } from "node:path";
import { runPipeline } from "../agents/pipeline";
import { getWeatherSummary } from "../tools/weatherTool";

// Live test: real weather + real Gemini, to confirm the Advisory Agent actually uses the weather
// signal for timing guidance (not just that both pieces work in isolation).
// Usage: node --env-file=.env lib/scripts/testWeatherAdvisory.js <image path> [lat] [lng]
const [path, lat = "30.7", lng = "76.7"] = process.argv.slice(2);
if (!path) throw new Error("Usage: npm run test:pipeline -- <image path> [lat] [lng]");

const mime = { ".png": "image/png", ".webp": "image/webp" }[extname(path).toLowerCase()] ?? "image/jpeg";

async function main() {
  const weather = await getWeatherSummary(Number(lat), Number(lng));
  console.log("weather:", weather);
  const result = await runPipeline(readFileSync(path).toString("base64"), mime, Number(lat), Number(lng), weather);
  console.log(JSON.stringify(result, null, 2));
}

main();
