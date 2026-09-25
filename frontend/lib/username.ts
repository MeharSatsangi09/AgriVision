// Friendly display name for a report, e.g. "goldenmillet57". Derived ONLY from the report's own id, so it is
// stable for that report but says nothing about who uploaded it and never links two reports to the same person
// (no uid, phone number or any user input goes in). Same id -> same name, computed client-side, nothing stored.
const ADJECTIVES = [
  "swift", "green", "golden", "quiet", "bright", "brave", "gentle", "sunny", "misty", "lucky", "calm", "bold",
  "clever", "happy", "proud", "fresh", "wild", "kind", "sturdy", "merry", "royal", "silver", "rustic", "humble",
];
const NOUNS = [
  "wheat", "paddy", "millet", "mango", "tulsi", "neem", "lotus", "maize", "cotton", "jowar", "sesame", "banana",
  "clover", "meadow", "sparrow", "peacock", "harvest", "monsoon", "sapling", "furrow", "orchard", "tractor", "bullock", "pollen",
];

// FNV-1a 32-bit: small, deterministic, well spread.
function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

export function reportUsername(reportId: string): string {
  const h = hash(reportId);
  const adjective = ADJECTIVES[h % ADJECTIVES.length];
  const noun = NOUNS[(h >>> 8) % NOUNS.length];
  const number = 10 + ((h >>> 16) % 90);
  return `${adjective}${noun}${number}`;
}
