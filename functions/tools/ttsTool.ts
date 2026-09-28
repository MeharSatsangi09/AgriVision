import { TextToSpeechClient } from "@google-cloud/text-to-speech";

let client: TextToSpeechClient | null = null;
const getClient = () => (client ??= new TextToSpeechClient());

// BCP-47 tags — must match frontend's SPEECH_LANG map (FollowUpBox.tsx) and speechTool.ts's SUPPORTED_LANGS.
const SUPPORTED_LANGS = new Set(["en-IN", "hi-IN", "mr-IN", "ta-IN", "te-IN", "bn-IN", "gu-IN", "kn-IN", "pa-IN"]);

export interface SpeechAudio {
  audio: string; // base64 MP3
}

// Cloud Text-to-Speech — reads a follow-up answer aloud in the farmer's own language (the audio half of the
// voice loop; speechTool.ts is the other half, turning a spoken question into text). A neutral "Standard"
// voice keeps this cheap; the project's free/low quota already gates length and call volume upstream.
export async function synthesizeSpeech(text: string, langCode: string): Promise<SpeechAudio> {
  const lang = SUPPORTED_LANGS.has(langCode) ? langCode : "en-IN";
  const [response] = await getClient().synthesizeSpeech({
    input: { text },
    voice: { languageCode: lang, ssmlGender: "NEUTRAL" },
    audioConfig: { audioEncoding: "MP3", speakingRate: 0.96 },
  });
  const content = response.audioContent;
  if (!content) throw new Error("no audio returned");
  const audio = typeof content === "string" ? content : Buffer.from(content).toString("base64");
  return { audio };
}
