"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { httpsCallable } from "firebase/functions";
import { MessageCircleQuestion } from "lucide-react";
import { functions } from "@/lib/firebase";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { useData } from "@/lib/data";
import { diseaseName } from "@/lib/diseases";
import { timeAgo } from "@/lib/format";

interface ConversationSummary {
  id: string; // == the report's id
  reportId: string;
  title: string;
  lastMessage: string;
  updatedAt: string;
  messageCount: number;
}

const listMyFollowUps = httpsCallable<Record<string, never>, ConversationSummary[]>(functions, "listMyFollowUps");

// Every follow-up conversation the logged-in farmer has ever had, one row per report, newest activity first.
// Cross-references the already-loaded public `reports` collection for the photo/disease/severity shown on each
// row, so the backend doesn't need to duplicate that data.
export default function ChatHistoryView() {
  const { t, lang } = useI18n();
  const { reports } = useData();
  const [conversations, setConversations] = useState<ConversationSummary[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    listMyFollowUps({}).then(({ data }) => {
      if (!cancelled) setConversations(data);
    }).catch(() => {
      if (!cancelled) setConversations([]);
    });
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("chathistory.title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("chathistory.subtitle")}</p>
      </div>

      {conversations === null ? null : conversations.length === 0 ? (
        <div className="rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/10 to-primary/[0.04] p-8 text-center">
          <p className="mx-auto max-w-md text-sm text-muted-foreground">{t("chathistory.empty")}</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {conversations.map((c) => {
            const report = reports.find((r) => r.id === c.reportId);
            const name = report ? diseaseName(report.diagnosis.disease, lang, report.diseaseTranslations?.[lang]) : c.title;
            return (
              <li key={c.id}>
                <Link
                  href={`/report/${c.reportId}`}
                  className="flex items-center gap-3 rounded-xl border border-primary/15 bg-gradient-to-br from-[#eef7ea] via-white to-[#e6f3e2] p-3 shadow-sm transition-[box-shadow,border-color] duration-300 hover:border-primary/30 hover:shadow-[0_0_14px_2px_rgba(47,107,58,0.2)]"
                >
                  {report ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={report.photoUrl} alt="" className="size-12 shrink-0 rounded-lg object-cover" />
                  ) : (
                    <span className="grid size-12 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
                      <MessageCircleQuestion className="size-5" />
                    </span>
                  )}
                  <span className="min-w-0 flex-1 leading-tight">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium">{name}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">{t("chathistory.messages", { n: c.messageCount })}</span>
                    </span>
                    <span className="mt-0.5 block truncate text-[13px] text-muted-foreground">{c.lastMessage}</span>
                    <span className="mt-0.5 block text-[11px] text-muted-foreground">{timeAgo(c.updatedAt, lang)}</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
