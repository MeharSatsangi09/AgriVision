// Offline test for parsing the transliteration agent's reply. Run: npm run build && node lib/scripts/testTransliteration.js
import { parseTransliteration } from "../agents/transliterationAgent";

let failed = 0;
const check = (name: string, ok: boolean) => {
  console.log(`${ok ? "ok  " : "FAIL"} ${name}`);
  if (!ok) failed++;
};
const keys = ["firstName", "place"];
check("clean JSON", JSON.stringify(parseTransliteration('{"firstName":"आभा","place":"अलहर"}', keys)) === '{"firstName":"आभा","place":"अलहर"}');
check("code-fenced JSON", parseTransliteration('```json\n{"firstName":"आभा","place":"अलहर"}\n```', keys)?.firstName === "आभा");
check("extra keys ignored", Object.keys(parseTransliteration('{"firstName":"a","place":"b","x":"y"}', keys) ?? {}).length === 2);
check("missing key -> null", parseTransliteration('{"firstName":"आभा"}', keys) === null);
check("non-string / empty / too long -> null", parseTransliteration('{"firstName":5,"place":"b"}', keys) === null && parseTransliteration('{"firstName":"","place":"b"}', keys) === null && parseTransliteration(JSON.stringify({ firstName: "x".repeat(81), place: "b" }), keys) === null);
check("garbage / array / empty -> null", parseTransliteration("sorry I can't", keys) === null && parseTransliteration("[1,2]", keys) === null && parseTransliteration("", keys) === null);
console.log(failed ? `\n${failed} FAILED` : "\nall passed");
process.exit(failed ? 1 : 0);
