import { SpeechClient } from "@google-cloud/speech";

let client: SpeechClient | null = null;
const getClient = () => (client ??= new SpeechClient());

// BCP-47 tags — must match frontend's SPEECH_LANG map in FollowUpBox.tsx.
const SUPPORTED_LANGS = new Set(["en-IN", "hi-IN", "mr-IN", "ta-IN", "te-IN", "bn-IN", "gu-IN", "kn-IN", "pa-IN"]);

export interface TranscribeResult {
  transcript: string;
  confidence: number;
}

// Cloud Speech-to-Text — real Google AI doing the transcription work (not the browser's own engine).
// Audio comes from the frontend as a short WEBM/Opus recording (MediaRecorder's default codec).
export async function transcribeAudio(audioBase64: string, langCode: string): Promise<TranscribeResult> {
  const lang = SUPPORTED_LANGS.has(langCode) ? langCode : "en-IN";
  const [response] = await getClient().recognize({
    audio: { content: audioBase64 },
    config: {
      encoding: "WEBM_OPUS",
      sampleRateHertz: 48000,
      audioChannelCount: 1, // frontend forces mono via getUserMedia's channelCount constraint
      languageCode: lang,
      model: "default",
      maxAlternatives: 1,
    },
  });
  const results = response.results ?? [];
  const transcript = results
    .map((r) => r.alternatives?.[0]?.transcript ?? "")
    .join(" ")
    .trim();
  const confidence = results[0]?.alternatives?.[0]?.confidence ?? 0;
  return { transcript, confidence };
}
