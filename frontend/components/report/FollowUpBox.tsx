"use client";
import { useEffect, useRef, useState } from "react";
import { httpsCallable } from "firebase/functions";
import { Loader2, Mic, MessageCircleQuestion, Plus, Send, Square } from "lucide-react";
import { functions } from "@/lib/firebase";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n/I18nProvider";

interface Answer {
  conversationId: string;
  answer: string;
  lang: string;
  translationFailed?: boolean;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  lang?: string;
}

interface ConversationSummary {
  id: string;
  title: string;
  updatedAt: string;
  lastMessage: string;
}

const askFollowUpQuestion = httpsCallable<{ reportId: string; question: string; lang: string; conversationId?: string }, Answer>(functions, "askFollowUpQuestion");
const listConversations = httpsCallable<{ reportId: string }, ConversationSummary[]>(functions, "listFollowUpConversations");
const getConversation = httpsCallable<{ conversationId: string }, { messages: ChatMessage[] }>(functions, "getFollowUpConversation");
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
  const { user, loading: authLoading } = useAuth();
  const [question, setQuestion] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    if (!user) {
      setConversations([]);
      setConversationId(null);
      setMessages([]);
      return;
    }
    let cancelled = false;
    listConversations({ reportId }).then(({ data }) => {
      if (!cancelled) setConversations(data);
    }).catch(() => {
      if (!cancelled) setConversations([]);
    });
    return () => { cancelled = true; };
  }, [reportId, user]);

  async function selectConversation(id: string) {
    setStatus("loading");
    try {
      const { data } = await getConversation({ conversationId: id });
      setConversationId(id);
      setMessages(data.messages);
      setStatus("idle");
    } catch {
      setStatus("error");
    }
  }

  function newConversation() {
    setConversationId(null);
    setMessages([]);
    setQuestion("");
    setStatus("idle");
  }

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
    if (!q || status === "loading" || !user) return;
    setStatus("loading");
    try {
      const res = await askFollowUpQuestion({ reportId, question: q, lang, ...(conversationId ? { conversationId } : {}) });
      setConversationId(res.data.conversationId);
      setMessages((current) => [
        ...current,
        { id: `${res.data.conversationId}-user-${Date.now()}`, role: "user", text: q, lang },
        { id: `${res.data.conversationId}-assistant-${Date.now()}`, role: "assistant", text: res.data.answer, lang: res.data.lang },
      ]);
      setQuestion("");
      setStatus("idle");
      const updated = await listConversations({ reportId });
      setConversations(updated.data);
    } catch {
      setStatus("error");
    }
  }

  if (authLoading) return <section className="rounded-xl border bg-background p-3.5 text-sm text-muted-foreground">…</section>;
  if (!user) return <section className="rounded-xl border bg-background p-3.5 text-sm text-muted-foreground">Sign in to save and continue follow-up conversations.</section>;

  return (
    <section className="rounded-xl border bg-background p-3.5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold"><MessageCircleQuestion className="size-4 text-primary" /> {t("followup.label")}</h3>
        <button type="button" onClick={newConversation} className="inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs font-medium transition hover:bg-muted"><Plus className="size-3.5" /> New chat</button>
      </div>
      {conversations.length > 0 && (
        <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1">
          {conversations.map((conversation) => (
            <button key={conversation.id} type="button" onClick={() => selectConversation(conversation.id)} className={`max-w-48 shrink-0 truncate rounded-lg border px-2.5 py-1.5 text-left text-xs transition ${conversation.id === conversationId ? "border-primary bg-accent text-accent-foreground" : "bg-card hover:bg-muted"}`} title={conversation.title}>{conversation.title}</button>
          ))}
        </div>
      )}
      {messages.length > 0 && (
        <div className="mt-3 max-h-72 space-y-2 overflow-y-auto rounded-lg bg-card p-2">
          {messages.map((message) => (
            <div key={message.id} className={`rounded-lg p-2.5 text-sm ${message.role === "assistant" ? "bg-accent text-accent-foreground" : "ml-8 bg-muted"}`}>
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide opacity-60">{message.role === "assistant" ? t("followup.answerLabel") : "You"}</p>
              <p className="whitespace-pre-line leading-relaxed">{message.text}</p>
            </div>
          ))}
        </div>
      )}
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
    </section>
  );
}
