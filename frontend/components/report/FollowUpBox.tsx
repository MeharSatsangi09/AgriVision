"use client";
import { useEffect, useRef, useState } from "react";
import { httpsCallable } from "firebase/functions";
import { Loader2, Mic, MessageCircleQuestion, Send, Square } from "lucide-react";
import { functions } from "@/lib/firebase";
import { useI18n } from "@/lib/i18n/I18nProvider";

interface Answer {
  answer: string;
  lang: string;
  translationFailed?: boolean;
}

const askFollowUpQuestion = httpsCallable<{ reportId: string; question: string; lang: string }, Answer>(functions, "askFollowUpQuestion");
const transcribeSpeech = httpsCallable<{ audio: string; langCode: string }, { transcript: string; confidence: number }>(functions, "transcribeSpeech");

// BCP-47 tags — must match lib/languages.ts's app language codes and functions/tools/speechTool.ts's
// SUPPORTED_LANGS.
const SPEECH_LANG: Record<string, string> = {
  en: "en-IN", hi: "hi-IN", mr: "mr-IN", ta: "ta-IN", te: "te-IN", bn: "bn-IN", gu: "gu-IN", kn: "kn-IN", pa: "pa-IN",
};

const RECORD_MIME = "audio/webm;codecs=opus"; // must match speechTool.ts's WEBM_OPUS config

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// Agent 5 — a grounded question-and-answer box for THIS report. One question, one answer at a time
// (no chat thread), per followup-agent-task.md's scope. Additive: doesn't touch the existing result display.
export default function FollowUpBox({ reportId }: { reportId: string }) {
  const { t, lang } = useI18n();
  const [question, setQuestion] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // Feature-detected client-side, after mount, so server and first-client render match (no SSR window
  // access). Requires getUserMedia + MediaRecorder + the exact codec speechTool.ts expects — anything
  // short of that (older Safari, etc.) silently falls back to text-only rather than showing a button
  // that would record in a format the backend can't decode.
  useEffect(() => {
    const supported =
      typeof navigator !== "undefined" &&
      !!navigator.mediaDevices?.getUserMedia &&
      typeof MediaRecorder !== "undefined" &&
      MediaRecorder.isTypeSupported(RECORD_MIME);
    setVoiceSupported(supported);
    return () => {
      recorderRef.current?.stream.getTracks().forEach((tr) => tr.stop());
    };
  }, []);

  async function toggleVoice() {
    if (recording) {
      recorderRef.current?.stop();
      return;
    }
    let stream: MediaStream;
    try {
      // channelCount: 1 forces mono — must match speechTool.ts's audioChannelCount: 1 (some devices/
      // browsers default to stereo capture, which Cloud Speech-to-Text rejects as a header mismatch).
      stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1 } });
    } catch {
      return; // permission denied or no mic — stay on text input, no crash
    }
    const recorder = new MediaRecorder(stream, { mimeType: RECORD_MIME });
    chunksRef.current = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.onstop = async () => {
      stream.getTracks().forEach((tr) => tr.stop());
      setRecording(false);
      const blob = new Blob(chunksRef.current, { type: RECORD_MIME });
      if (!blob.size) return;
      setTranscribing(true);
      try {
        const audio = await blobToBase64(blob);
        const res = await transcribeSpeech({ audio, langCode: SPEECH_LANG[lang] ?? "en-IN" });
        if (res.data.transcript) setQuestion(res.data.transcript.slice(0, 300));
      } catch {
        // Transcription failed (network, quota, etc.) — leave the input as-is, farmer can type instead.
      } finally {
        setTranscribing(false);
      }
    };
    recorderRef.current = recorder;
    setRecording(true);
    recorder.start();
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const q = question.trim().slice(0, 300);
    if (!q || status === "loading") return;
    setStatus("loading");
    setAnswer(null);
    try {
      const res = await askFollowUpQuestion({ reportId, question: q, lang });
      setAnswer(res.data);
      setStatus("idle");
    } catch {
      setStatus("error");
    }
  }

  const englishFallback = !!answer && lang !== "en" && (answer.lang === "en" || !!answer.translationFailed);

  return (
    <section className="rounded-xl border bg-background p-3.5">
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <MessageCircleQuestion className="size-4 text-primary" /> {t("followup.label")}
      </h3>
      <form onSubmit={submit} className="mt-2 flex gap-2">
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder={recording ? t("followup.listening") : transcribing ? t("followup.transcribing") : t("followup.placeholder")}
          maxLength={300}
          disabled={transcribing}
          className="min-w-0 flex-1 rounded-lg border bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
        />
        {voiceSupported && (
          <button
            type="button"
            onClick={toggleVoice}
            disabled={transcribing}
            aria-label={t("followup.voiceInput")}
            aria-pressed={recording}
            className={
              recording
                ? "inline-flex shrink-0 items-center justify-center rounded-lg bg-severity-high px-3 py-2 text-white transition animate-pulse"
                : "inline-flex shrink-0 items-center justify-center rounded-lg border bg-card px-3 py-2 text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:opacity-40"
            }
          >
            {transcribing ? <Loader2 className="size-4 animate-spin" /> : recording ? <Square className="size-4" /> : <Mic className="size-4" />}
          </button>
        )}
        <button
          type="submit"
          disabled={!question.trim() || status === "loading"}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-40"
        >
          <Send className="size-4" /> {status === "loading" ? t("followup.loading") : t("followup.button")}
        </button>
      </form>
      {status === "error" && <p className="mt-2 text-sm text-severity-high">{t("followup.error")}</p>}
      {answer && (
        <div className="mt-3 rounded-lg bg-accent p-3 text-sm text-accent-foreground">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-primary">{t("followup.answerLabel")}</p>
          <p className="whitespace-pre-line leading-relaxed">{answer.answer}</p>
          {englishFallback && <p className="mt-1.5 text-xs text-muted-foreground">{t("followup.englishNote")}</p>}
        </div>
      )}
    </section>
  );
}
