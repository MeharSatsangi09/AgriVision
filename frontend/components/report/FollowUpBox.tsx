"use client";
import { useEffect, useRef, useState } from "react";
import { httpsCallable } from "firebase/functions";
import { Mic, MessageCircleQuestion, Send, Square } from "lucide-react";
import { functions } from "@/lib/firebase";
import { useI18n } from "@/lib/i18n/I18nProvider";

interface Answer {
  answer: string;
  lang: string;
  translationFailed?: boolean;
}

const askFollowUpQuestion = httpsCallable<{ reportId: string; question: string; lang: string }, Answer>(functions, "askFollowUpQuestion");

// Minimal shape of the bits of the Web Speech API this component uses — not in TS's default lib.
interface SpeechRecognitionResultLike {
  0: { transcript: string };
  isFinal: boolean;
}
interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
}
interface SpeechRecognitionLike extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
}

// BCP-47 tags for SpeechRecognition — must match lib/languages.ts's app language codes.
const SPEECH_LANG: Record<string, string> = {
  en: "en-IN", hi: "hi-IN", mr: "mr-IN", ta: "ta-IN", te: "te-IN", bn: "bn-IN", gu: "gu-IN", kn: "kn-IN", pa: "pa-IN",
};

// Agent 5 — a grounded question-and-answer box for THIS report. One question, one answer at a time
// (no chat thread), per followup-agent-task.md's scope. Additive: doesn't touch the existing result display.
export default function FollowUpBox({ reportId }: { reportId: string }) {
  const { t, lang } = useI18n();
  const [question, setQuestion] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  // Feature-detected client-side, after mount, so server and first-client render match (no SSR window access).
  // Safari has only partial/prefixed support and some versions have none at all — this silently falls back
  // to text-only input rather than showing a button that might not work.
  useEffect(() => {
    const w = window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike };
    setVoiceSupported(!!(w.SpeechRecognition || w.webkitSpeechRecognition));
    return () => {
      recognitionRef.current?.stop();
    };
  }, []);

  function toggleVoice() {
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }
    const w = window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike };
    const Recognition = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Recognition) return;
    const recognition = new Recognition();
    recognition.lang = SPEECH_LANG[lang] ?? "en-IN";
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.onresult = (e) => {
      let text = "";
      for (let i = 0; i < e.results.length; i++) text += e.results[i][0].transcript;
      setQuestion(text.slice(0, 300));
    };
    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    setListening(true);
    recognition.start();
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
          placeholder={listening ? t("followup.listening") : t("followup.placeholder")}
          maxLength={300}
          className="min-w-0 flex-1 rounded-lg border bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
        {voiceSupported && (
          <button
            type="button"
            onClick={toggleVoice}
            aria-label={t("followup.voiceInput")}
            aria-pressed={listening}
            className={
              listening
                ? "inline-flex shrink-0 items-center justify-center rounded-lg bg-severity-high px-3 py-2 text-white transition animate-pulse"
                : "inline-flex shrink-0 items-center justify-center rounded-lg border bg-card px-3 py-2 text-muted-foreground transition hover:bg-muted hover:text-foreground"
            }
          >
            {listening ? <Square className="size-4" /> : <Mic className="size-4" />}
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
