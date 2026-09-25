// Offline test for how the uploader uid is read from upload metadata. Run: npm run build && node lib/scripts/testUploaderUid.js
import { uploaderUid } from "../tools/uploader";

let failed = 0;
const check = (name: string, ok: boolean) => {
  console.log(`${ok ? "ok  " : "FAIL"} ${name}`);
  if (!ok) failed++;
};

check("28-char Firebase uid is accepted", uploaderUid({ uid: "aB3dE5gH7jK9mN1pQ3sT5vX7zC9f", lat: "22.5" }) === "aB3dE5gH7jK9mN1pQ3sT5vX7zC9f");
check("missing metadata -> no owner", uploaderUid(undefined) === undefined && uploaderUid({}) === undefined && uploaderUid(null) === undefined);
check("a phone number is never accepted as a uid", uploaderUid({ uid: "+911234567890" }) === undefined);
check("too short / odd characters ignored", uploaderUid({ uid: "abc" }) === undefined && uploaderUid({ uid: "a b c d e f g" }) === undefined && uploaderUid({ uid: "../../x" }) === undefined);
check("empty string ignored", uploaderUid({ uid: "" }) === undefined);
console.log(failed ? `\n${failed} FAILED` : "\nall passed");
process.exit(failed ? 1 : 0);
