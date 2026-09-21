import { LlmAgent, InMemoryRunner } from "@google/adk";
import { MODEL } from "./diagnosisAgent";
import { clusterReason, createTrendTools, findClusters, WINDOW_DAYS, type TrendStore } from "../tools/trendTools";

const TIMEOUT_MS = 60_000;

function buildTrendAgent(store: TrendStore) {
  const { findOutbreakCandidates, flagAlert } = createTrendTools(store);
  return new LlmAgent({
    name: "trend_agent",
    model: MODEL,
    description: "Decides whether clusters of crop-disease reports are regional outbreaks and flags them.",
    instruction: `You are a crop-disease surveillance analyst for Indian agriculture officers.
1. Call find_outbreak_candidates.
2. For each cluster decide if it is a genuine outbreak worth alerting: consider the number of reports, the severity mix (several high/medium reports matter more than all-low), and how recent the newest report is.
3. For each genuine outbreak that is not already alerted, call flag_alert with all its reportIds and a one-sentence reason naming the disease, count, radius and window.
4. Reply with a one-line summary of what you flagged (or that nothing needed flagging).`,
    tools: [findOutbreakCandidates, flagAlert],
  });
}

// Un-flags reports whose cluster no longer exists (aged out of the window or below threshold).
async function expireStaleAlerts(store: TrendStore, since: string): Promise<number> {
  const live = new Set(findClusters(await store.recentReports(since)).flatMap((c) => c.reportIds));
  const stale = (await store.alertedReports()).filter((r) => !live.has(r.id)).map((r) => r.id);
  return stale.length ? store.unflag(stale) : 0;
}

// Runs the Trend/Alert Agent. Expires stale alerts first, skips the LLM when there is no new candidate
// cluster, and falls back to flagging by rule if the agent fails (e.g. Gemini quota) so alerts still fire.
export async function runTrendCheck(store: TrendStore): Promise<string> {
  const since = new Date(Date.now() - WINDOW_DAYS * 864e5).toISOString();
  const expired = await expireStaleAlerts(store, since);
  const candidates = findClusters(await store.recentReports(since)).filter((c) => !c.alreadyAlerted);
  const note = expired ? `expired ${expired} stale alert(s); ` : "";
  if (!candidates.length) return `${note}no new candidate clusters`;

  try {
    return note + (await runAgent(store));
  } catch (err) {
    console.error("trend agent failed, flagging by rule:", err);
    for (const c of candidates) await store.flag(c.reportIds, clusterReason(c));
    return `${note}agent unavailable — flagged ${candidates.length} cluster(s) by rule`;
  }
}

async function runAgent(store: TrendStore): Promise<string> {
  const runner = new InMemoryRunner({ agent: buildTrendAgent(store), appName: "trend" });
  await runner.sessionService.createSession({ appName: "trend", userId: "system", sessionId: "run" });
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  let summary = "";
  try {
    for await (const ev of runner.runAsync({
      userId: "system",
      sessionId: "run",
      abortSignal: ctl.signal,
      newMessage: { role: "user", parts: [{ text: "Check for outbreaks now." }] },
    })) {
      if (ev.errorCode) throw new Error(`${ev.author}: ${ev.errorCode} ${ev.errorMessage ?? ""}`);
      const text = ev.content?.parts?.map((p) => p.text ?? "").join("").trim();
      if (text && ev.author === "trend_agent" && !ev.content?.parts?.some((p) => p.functionCall)) summary = text;
    }
  } finally {
    clearTimeout(timer);
  }
  return summary;
}
