import { SpeechClient } from "@google-cloud/speech";

// Live test against real Cloud Speech-to-Text using Google's own public quickstart sample audio
// (gs://cloud-samples-tests/speech/brooklyn.flac) -- proves auth/billing/API-enablement actually work
// end to end, independent of the app's own WEBM_OPUS path (which needs a real mic recording to test).
// Usage: node lib/scripts/testSpeech.js

async function main() {
  const client = new SpeechClient();
  const [response] = await client.recognize({
    audio: { uri: "gs://cloud-samples-tests/speech/brooklyn.flac" },
    config: { encoding: "FLAC", sampleRateHertz: 16000, languageCode: "en-US" },
  });
  const transcript = response.results?.map((r) => r.alternatives?.[0]?.transcript).join(" ") ?? "";
  console.log("transcript:", transcript);
  if (!transcript.toLowerCase().includes("brooklyn")) {
    console.error("FAIL: expected transcript to mention 'Brooklyn'");
    process.exit(1);
  }
  console.log("ok   real Cloud Speech-to-Text call succeeded");
}

main().catch((e) => {
  console.error("FAIL:", e);
  process.exit(1);
});
