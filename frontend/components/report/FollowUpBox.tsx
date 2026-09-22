"use client";
import { useState } from "react";
import { httpsCallable } from "firebase/functions";
import { MessageCircleQuestion, Send } from "lucide-react";
import { functions } from "@/lib/firebase";
import { useI18n } from "@/lib/i18n/I18nProvider";

interface Answer {
  answer: string;
  lang: string;
  translationFailed?: boolean;
}

const askFollowUpQuestion = httpsCallable<{ reportId: string; question: string; lang: string }, Answer>(functions, "askFollowUpQuestion");

// Agent 5 — a grounded question-and-answer box for THIS report. One question, one answer at a time
// (no chat thread), per followup-agent-task.md's scope. Additive: doesn't touch the existing result display.
export default function FollowUpBox({ reportId }: { reportId: string }) {
  const { t, lang } = useI18n();
  const [question, setQuestion] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [answer, setAnswer] = useState<Answer | null>(null);

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
          placeholder={t("followup.placeholder")}
          maxLength={300}
          className="min-w-0 flex-1 rounded-lg border bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
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
