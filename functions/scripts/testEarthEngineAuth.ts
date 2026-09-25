// Offline test for the Earth Engine token refresh logic (no network, no GCP calls).
// Run: npm run build && node lib/scripts/testEarthEngineAuth.js
import { EarthEngineAuth, REFRESH_BEFORE_MS, type AuthToken } from "../tools/earthEngineTool";

let failed = 0;
const check = (name: string, ok: boolean, detail = "") => {
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${detail ? " — " + detail : ""}`);
  if (!ok) failed++;
};

const HOUR = 3_600_000;

// A fake EE client + clock that behaves like the real one: the token vanishes once it expires.
function harness(opts: { mintFails?: number } = {}) {
  let clock = 1_000_000_000_000;
  let tokenExpires = 0; // 0 = no token held by the fake EE client
  let mints = 0, sets = 0, inits = 0, failsLeft = opts.mintFails ?? 0;
  const auth = new EarthEngineAuth({
    now: () => clock,
    hasToken: () => tokenExpires > clock, // the real client drops the token after its lifetime
    mintToken: async (): Promise<AuthToken> => {
      mints++;
      if (failsLeft-- > 0) throw new Error("metadata server unavailable");
      return { token: `tok${mints}`, expiresAtMs: clock + HOUR };
    },
    setToken: (t) => {
      sets++;
      tokenExpires = t.expiresAtMs;
    },
    initialize: async () => void inits++,
  });
  return { auth, advance: (ms: number) => (clock += ms), stats: () => ({ mints, sets, inits }), dropToken: () => (tokenExpires = 0) };
}

(async () => {
  let h = harness();
  await h.auth.ensure();
  check("first call mints, sets the token and initializes once", JSON.stringify(h.stats()) === '{"mints":1,"sets":1,"inits":1}', JSON.stringify(h.stats()));

  h.advance(10 * 60_000);
  await h.auth.ensure();
  check("token still valid (50 min left): nothing re-minted", h.stats().mints === 1);

  h.advance(HOUR - 10 * 60_000 - (REFRESH_BEFORE_MS - 1000)); // 4 min 59 s left
  await h.auth.ensure();
  check("within 5 min of expiry: re-minted and re-set, NOT re-initialized", JSON.stringify(h.stats()) === '{"mints":2,"sets":2,"inits":1}', JSON.stringify(h.stats()));

  // The exact production bug: a warm instance an hour+ later, EE client already dropped its token.
  h = harness();
  await h.auth.ensure();
  h.advance(HOUR + 60_000);
  await h.auth.ensure();
  check("warm instance after the 1 h lifetime: token refreshed (was the bug)", h.stats().mints === 2 && h.stats().sets === 2 && h.stats().inits === 1, JSON.stringify(h.stats()));

  h = harness();
  await h.auth.ensure();
  h.dropToken(); // client lost its token even though our clock says it's fresh
  await h.auth.ensure();
  check("client reports no token: refreshed even if our expiry looks fine", h.stats().mints === 2);

  h = harness();
  await Promise.all([h.auth.ensure(), h.auth.ensure(), h.auth.ensure()]);
  check("concurrent lookups share one refresh", h.stats().mints === 1 && h.stats().inits === 1, JSON.stringify(h.stats()));

  h = harness({ mintFails: 1 });
  let threw = false;
  try { await h.auth.ensure(); } catch { threw = true; }
  await h.auth.ensure();
  check("a failed mint is not cached: it throws once, then the next call succeeds", threw && h.stats().mints === 2 && h.stats().inits === 1, JSON.stringify(h.stats()));

  console.log(failed ? `\n${failed} FAILED` : "\nall passed");
  process.exit(failed ? 1 : 0);
})();
