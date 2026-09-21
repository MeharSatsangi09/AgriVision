export const titleCase = (s: string) => s.replace(/\b\w/g, (c) => c.toUpperCase());

// "5 minutes ago" in the user's language (falls back to English if the locale is unavailable).
export function timeAgo(iso: string, lang: string): string {
  const secs = Math.round((new Date(iso).getTime() - Date.now()) / 1000);
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["day", 86400],
    ["hour", 3600],
    ["minute", 60],
  ];
  let rtf: Intl.RelativeTimeFormat;
  try {
    rtf = new Intl.RelativeTimeFormat(lang, { numeric: "auto" });
  } catch {
    rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  }
  for (const [unit, size] of units) if (Math.abs(secs) >= size) return rtf.format(Math.round(secs / size), unit);
  return rtf.format(Math.round(secs / 60), "minute");
}

export const roundCoord = (n: number) => Math.round(n * 100) / 100;
