const MLB_LINESCORE_URL = (gamePk) =>
  `https://statsapi.mlb.com/api/v1/game/${encodeURIComponent(String(gamePk))}/linescore`;

export const MLB_LINESCORE_POLL_MS = 15000;
export const MLB_LINESCORE_STALE_MS = 45000;

const LINESCORE_OVERLAY_KEYS = [
  "awayScore",
  "homeScore",
  "currentInning",
  "currentInningOrdinal",
  "inningState",
  "inningHalf",
  "balls",
  "strikes",
  "outs",
  "onFirst",
  "onSecond",
  "onThird",
  "runnersOnBase",
  "inningLinescore",
  "inningLinescoreTotals",
  "inningLinescoreSig",
  "linescorePolledAt",
];

export function pickMlbLinescoreOverlayFields(source = {}) {
  if (!source || typeof source !== "object") return null;
  const patch = {};
  for (const key of LINESCORE_OVERLAY_KEYS) {
    if (source[key] !== undefined) patch[key] = source[key];
  }
  return patch.linescorePolledAt ? patch : null;
}

/** Score/manche monotonique — évite qu'un overlay stale régresse Firestore. */
export function mlbLinescoreProgress(game = {}) {
  const inning = Number(game?.currentInning) || 0;
  const away = Number(game?.awayScore) || 0;
  const home = Number(game?.homeScore) || 0;
  const state = String(game?.inningState || game?.inningHalf || "").toLowerCase();

  let phase = 0;
  if (state === "top") phase = 1;
  else if (state === "bottom") phase = 2;
  else if (state === "middle" || state === "end") phase = 3;

  return inning * 10_000 + phase * 1_000 + away * 10 + home;
}

export function shouldApplyMlbLinescoreOverlay(base = {}, overlay = {}) {
  if (!overlay?.linescorePolledAt) return false;
  if (Date.now() - Number(overlay.linescorePolledAt) > MLB_LINESCORE_STALE_MS) return false;

  const baseProg = mlbLinescoreProgress(base);
  const overlayProg = mlbLinescoreProgress(overlay);

  if (overlayProg > baseProg) return true;
  if (overlayProg < baseProg) return false;

  // Même manche/score : rafraîchir compte, bases, tableau si poll récent.
  return Date.now() - Number(overlay.linescorePolledAt) <= MLB_LINESCORE_POLL_MS * 2;
}

export function mergeMlbLinescoreOverlay(game = {}, overlay = null) {
  if (!game || !overlay) return game;
  const patch = pickMlbLinescoreOverlayFields(overlay);
  if (!patch || !shouldApplyMlbLinescoreOverlay(game, patch)) return game;
  return { ...game, ...patch };
}

function safeCount(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function hasRunner(node) {
  return node != null && typeof node === "object";
}

/** Mappe la réponse `/linescore` vers les champs affichés dans l'app. */
export function mapMlbLinescoreResponseToGamePatch(payload = {}) {
  if (!payload || typeof payload !== "object") return null;

  const awayTeam = payload?.teams?.away || {};
  const homeTeam = payload?.teams?.home || {};
  const offense = payload?.offense || {};
  const innings = Array.isArray(payload.innings) ? payload.innings : [];

  const inningLinescore = innings
    .map((inn) => {
      const n = Number(inn?.num);
      if (!Number.isFinite(n) || n <= 0) return null;
      return {
        n,
        away: safeCount(inn?.away?.runs),
        home: safeCount(inn?.home?.runs),
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.n - b.n);

  const inningLinescoreTotals = {
    away: {
      runs: safeCount(awayTeam.runs),
      hits: safeCount(awayTeam.hits),
      errors: safeCount(awayTeam.errors),
    },
    home: {
      runs: safeCount(homeTeam.runs),
      hits: safeCount(homeTeam.hits),
      errors: safeCount(homeTeam.errors),
    },
  };

  const inningLinescoreSig =
    inningLinescore.map((row) => `${row.n}:${row.away ?? "x"}-${row.home ?? "x"}`).join("|") +
    `#A${inningLinescoreTotals.away.runs ?? "x"}-${inningLinescoreTotals.away.hits ?? "x"}-${inningLinescoreTotals.away.errors ?? "x"}` +
    `#H${inningLinescoreTotals.home.runs ?? "x"}-${inningLinescoreTotals.home.hits ?? "x"}-${inningLinescoreTotals.home.errors ?? "x"}`;

  const halfRaw = String(payload?.inningHalf || "").trim();
  const stateRaw = String(payload?.inningState || "").trim();

  return {
    awayScore: safeCount(awayTeam.runs),
    homeScore: safeCount(homeTeam.runs),
    currentInning: safeCount(payload?.currentInning),
    currentInningOrdinal: String(payload?.currentInningOrdinal || ""),
    inningState: stateRaw,
    inningHalf: halfRaw,
    balls: safeCount(payload?.balls),
    strikes: safeCount(payload?.strikes),
    outs: safeCount(payload?.outs),
    onFirst: hasRunner(offense?.first),
    onSecond: hasRunner(offense?.second),
    onThird: hasRunner(offense?.third),
    runnersOnBase: [offense?.first, offense?.second, offense?.third].filter(hasRunner).length,
    inningLinescore,
    inningLinescoreTotals,
    inningLinescoreSig,
    linescorePolledAt: Date.now(),
  };
}

export async function fetchMlbLinescoreGamePatch(gamePk) {
  const pk = String(gamePk || "").trim();
  if (!pk) return null;

  const res = await fetch(MLB_LINESCORE_URL(pk), {
    headers: { Accept: "application/json", "User-Agent": "prophetik/1.0" },
  });

  if (res.status === 429 || res.status >= 500) {
    throw new Error(`MLB linescore HTTP ${res.status}`);
  }
  if (!res.ok) return null;

  const json = await res.json();
  return mapMlbLinescoreResponseToGamePatch(json);
}
