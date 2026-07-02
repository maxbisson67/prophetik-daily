/** Logique pure — compétitions saison (régulière / séries) par sport. */

export const LEGACY_SEASON_ALIASES = {
  "20252026": "nhl_20252026_regular",
};

export const LEGACY_READ_KEYS = {
  nhl_20252026_regular: ["nhl_20252026_regular", "20252026"],
};

export function normalizeSport(sport) {
  return String(sport || "NHL").trim().toUpperCase() === "MLB" ? "mlb" : "nhl";
}

export function buildCompetitionKey(sport, seasonId, phase) {
  return `${normalizeSport(sport)}_${String(seasonId || "").trim()}_${String(phase || "regular").trim()}`;
}

export function addDaysToYmd(baseYmd, delta) {
  const s = String(baseYmd || "");
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return s;
  const dt = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  dt.setDate(dt.getDate() + delta);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

export function formatNhlSeasonLabel(seasonId) {
  const s = String(seasonId || "");
  if (!/^\d{8}$/.test(s)) return s;
  return `${s.slice(0, 4)}-${s.slice(6, 8)}`;
}

export function defaultMlbSeasonBounds(seasonId) {
  const year = String(seasonId || new Date().getUTCFullYear());
  return {
    regular: { fromYmd: `${year}-03-25`, toYmd: `${year}-09-28` },
    playoffs: { fromYmd: `${year}-09-29`, toYmd: `${year}-11-05` },
  };
}

export function deriveNhlCompetitionEntries(config = {}) {
  const seasonId = String(config.seasonId || "20252026");
  const rsStart = String(
    config.regularSeasonStartYmd || config.fromYmd || "2025-10-07"
  ).slice(0, 10);
  const rsEnd = String(config.regularSeasonEndYmd || "2026-04-17").slice(0, 10);
  const poEnd = String(config.playoffEndYmd || config.toYmd || "2026-06-15").slice(0, 10);
  const poStart = addDaysToYmd(rsEnd, 1);

  return [
    {
      competitionKey: buildCompetitionKey("nhl", seasonId, "regular"),
      sport: "nhl",
      seasonId,
      phase: "regular",
      label: `Saison NHL ${formatNhlSeasonLabel(seasonId)} — Saison régulière`,
      fromYmd: rsStart,
      toYmd: rsEnd,
      status: "active",
    },
    {
      competitionKey: buildCompetitionKey("nhl", seasonId, "playoffs"),
      sport: "nhl",
      seasonId,
      phase: "playoffs",
      label: `Saison NHL ${formatNhlSeasonLabel(seasonId)} — Séries`,
      fromYmd: poStart,
      toYmd: poEnd,
      status: "active",
    },
  ];
}

export function deriveMlbCompetitionEntries(seasonId, bounds = null) {
  const sid = String(seasonId || new Date().getUTCFullYear());
  const b = bounds || defaultMlbSeasonBounds(sid);

  return [
    {
      competitionKey: buildCompetitionKey("mlb", sid, "regular"),
      sport: "mlb",
      seasonId: sid,
      phase: "regular",
      label: `Saison MLB ${sid} — Saison régulière`,
      fromYmd: b.regular.fromYmd,
      toYmd: b.regular.toYmd,
      status: "active",
    },
    {
      competitionKey: buildCompetitionKey("mlb", sid, "playoffs"),
      sport: "mlb",
      seasonId: sid,
      phase: "playoffs",
      label: `Saison MLB ${sid} — Séries`,
      fromYmd: b.playoffs.fromYmd,
      toYmd: b.playoffs.toYmd,
      status: "active",
    },
  ];
}

export function pickCompetitionForDate(entries, gameYmd) {
  const ymd = String(gameYmd || "").slice(0, 10);
  if (!ymd || !Array.isArray(entries) || !entries.length) return null;

  const sportEntries = entries.filter((e) => e?.fromYmd && e?.toYmd);
  const exact = sportEntries.find((e) => e.fromYmd <= ymd && ymd <= e.toYmd);
  if (exact) return exact;

  const future = sportEntries
    .filter((e) => e.fromYmd > ymd)
    .sort((a, b) => a.fromYmd.localeCompare(b.fromYmd));
  if (future.length) return future[0];

  const past = sportEntries
    .filter((e) => e.toYmd < ymd)
    .sort((a, b) => b.toYmd.localeCompare(a.toYmd));
  return past[0] || sportEntries[0] || null;
}

export function resolveLeaderboardReadKeys(competitionKey) {
  const key = String(competitionKey || "").trim();
  if (!key) return [];
  if (LEGACY_READ_KEYS[key]) return LEGACY_READ_KEYS[key];
  return [key];
}

export function normalizeCompetitionEntry(raw, id) {
  if (!raw || typeof raw !== "object") return null;
  const sport = normalizeSport(raw.sport);
  const seasonId = String(raw.seasonId || "").trim();
  const phase = String(raw.phase || "regular").trim();
  const competitionKey =
    String(raw.competitionKey || id || buildCompetitionKey(sport, seasonId, phase)).trim();

  return {
    competitionKey,
    sport,
    seasonId,
    phase,
    label: String(raw.label || competitionKey),
    fromYmd: String(raw.fromYmd || "").slice(0, 10),
    toYmd: String(raw.toYmd || "").slice(0, 10),
    status: String(raw.status || "active"),
  };
}

export function isWithinCompetitionWindow(competition, gameYmd) {
  const ymd = String(gameYmd || "").slice(0, 10);
  const from = String(competition?.fromYmd || "").slice(0, 10);
  const to = String(competition?.toYmd || "").slice(0, 10);
  if (!ymd || !from || !to) return false;
  return from <= ymd && ymd <= to;
}

export function isCompetitionOpenForCredit(competition, gameYmd) {
  if (!competition) return false;
  if (String(competition.status || "").toLowerCase() === "finalized") return false;
  return isWithinCompetitionWindow(competition, gameYmd);
}

export function isCompetitionReadyToFinalize(competition, todayYmd, graceDays = 2) {
  if (!competition) return false;
  if (String(competition.status || "").toLowerCase() === "finalized") return false;
  const to = String(competition.toYmd || "").slice(0, 10);
  const today = String(todayYmd || "").slice(0, 10);
  if (!to || !today) return false;
  return addDaysToYmd(to, graceDays) < today;
}

export function computeExAequoWinners(memberUids, pointsByUid) {
  const uids = Array.from(
    new Set(
      (memberUids?.length ? memberUids : [...(pointsByUid?.keys?.() || [])]).map(String).filter(Boolean)
    )
  );
  if (!uids.length) return [];

  const sorted = [...uids].sort((a, b) => {
    const diff = (Number(pointsByUid?.get?.(b)) || 0) - (Number(pointsByUid?.get?.(a)) || 0);
    if (diff !== 0) return diff;
    return String(a).localeCompare(String(b));
  });

  const topPoints = Number(pointsByUid?.get?.(sorted[0])) || 0;
  return sorted.filter((uid) => (Number(pointsByUid?.get?.(uid)) || 0) === topPoints);
}
