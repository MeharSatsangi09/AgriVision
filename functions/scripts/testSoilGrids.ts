import { getSoilHealth } from "../tools/soilGridsTool";

// Live test against real ISRIC SoilGrids. Usage: node lib/scripts/testSoilGrids.js [lat] [lng]
const [lat = "22.5", lng = "83.0"] = process.argv.slice(2);

getSoilHealth(Number(lat), Number(lng)).then((result) => {
  console.log("result:", JSON.stringify(result));
  if (!result) {
    console.error("FAIL: expected a non-null result");
    process.exit(1);
  }
  console.log("ok   real SoilGrids call succeeded");
});
