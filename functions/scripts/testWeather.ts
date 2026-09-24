import { getWeatherSummary } from "../tools/weatherTool";

// Live test against real OpenWeatherMap. Usage: node --env-file=.env lib/scripts/testWeather.js [lat] [lng]
const [lat = "22.5", lng = "83.0"] = process.argv.slice(2);

getWeatherSummary(Number(lat), Number(lng)).then((summary) => {
  console.log("summary:", JSON.stringify(summary));
  if (!summary) {
    console.error("FAIL: expected a non-empty summary");
    process.exit(1);
  }
  console.log("ok   real OpenWeatherMap call succeeded");
});
