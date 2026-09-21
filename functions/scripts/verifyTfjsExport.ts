import { readFileSync } from "node:fs";
import path from "node:path";
import { dirSource, getClassifier } from "../tools/classifierTool";

// Verifies an exported TF.js model against Keras: loads <dir>/tfjs_layers + labels.json with the production loader,
// runs the fixed probe input and compares with <dir>/probe_output.json (Keras's own answer).
// Usage: node lib/scripts/verifyTfjsExport.js <dir>

const fail = (m: string): never => {
  console.error("FAIL:", m);
  process.exit(1);
};

async function main() {
  const dir = process.argv[2];
  if (!dir) fail("usage: verifyTfjsExport <dir with tfjs_layers/, labels.json, probe_output.json>");
  const expected = JSON.parse(readFileSync(path.join(dir, "probe_output.json"), "utf8")).output as number[];

  const loaded = await getClassifier(dirSource(dir));
  if (!loaded) return fail("model did not load (see the 'classifier unavailable' message above)");
  const { tf, model, labels } = loaded;
  if (labels.length !== expected.length) fail(`labels (${labels.length}) and probe output (${expected.length}) differ in length`);

  const data = new Float32Array(224 * 224 * 3);
  for (let i = 0; i < 224; i++)
    for (let j = 0; j < 224; j++) for (let k = 0; k < 3; k++) data[(i * 224 + j) * 3 + k] = (i * 7 + j * 13 + k * 29) % 256;

  const run = async () => {
    const t0 = Date.now();
    const out = model.predict(tf.tensor4d(data, [1, 224, 224, 3])) as import("@tensorflow/tfjs").Tensor;
    const probs = Array.from(await out.data());
    out.dispose();
    return { probs, ms: Date.now() - t0 };
  };

  const first = await run();
  const second = await run();
  const third = await run();

  const argmax = (a: number[]) => a.indexOf(Math.max(...a));
  const maxDiff = Math.max(...first.probs.map((p, i) => Math.abs(p - expected[i])));
  console.log(`Keras top-1 : ${labels[argmax(expected)]} (${expected[argmax(expected)].toFixed(4)})`);
  console.log(`TF.js top-1 : ${labels[argmax(first.probs)]} (${first.probs[argmax(first.probs)].toFixed(4)})`);
  console.log(`max |difference| across ${expected.length} classes: ${maxDiff.toExponential(2)}`);
  console.log(`inference time (pure-JS CPU): first ${first.ms} ms, then ${second.ms} ms, ${third.ms} ms`);

  if (argmax(first.probs) !== argmax(expected)) fail("top-1 class differs from Keras");
  if (maxDiff > 1e-3) fail(`probabilities differ from Keras by more than 1e-3 (${maxDiff})`);
  console.log("\nOK: TF.js model matches Keras");
}

main().catch((e) => fail(String(e?.stack ?? e)));
