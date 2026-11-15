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
  return `${s.slice(0, 4)}-${s.slice(4, 8)}`;
}

export function resolveNhlDisplaySeasonId(seasonId, fromYmd) {
  const from = String(fromYmd || "").slice(0, 10);
  const inferred = from ? inferNhlSeasonIdFromYmd(from) : "";
  if (inferred && /^\d{8}$/.test(inferred)) return inferred;
  const sid = String(seasonId || "").trim();
  return sid || inferred || "20252026";
}

export function buildNhlCompetitionLabel(phase, seasonId, fromYmd) {
  const displaySeasonId = resolveNhlDisplaySeasonId(seasonId, fromYmd);
  const human = formatNhlSeasonLabel(displaySeasonId);
  const p = String(phase || "regular").toLowerCase();
  if (p === "playoffs") return `Saison NHL ${human} — Séries`;
  if (p === "opening") return `Saison NHL ${human} — Ouverture`;
  if (p === "winter") return `Saison NHL ${human} — Hiver`;
  if (p === "sprint") return `Saison NHL ${human} — Sprint`;
  return `Saison NHL ${human} — Saison régulière`;
}

export function defaultMlbSeasonBounds(seasonId) {
  const year = String(seasonId || new Date().getUTCFullYear());
  return {
    regular: { fromYmd: `${year}-03-25`, toYmd: `${year}-09-28` },
    playoffs: { fromYmd: `${year}-09-29`, toYmd: `${year}-11-05` },
  };
}

export function inferNhlSeasonIdFromYmd(ymd) {
  const s = String(ymd || "").slice(0, 10);
  const y = Number(s.slice(0, 4));
  const m = Number(s.slice(5, 7));
  if (!Number.isFinite(y) || !Number.isFinite(m)) return "20252026";
  const startYear = m >= 10 ? y : y - 1;
  const endYear = startYear + 1;
  return `${startYear}${endYear}`;
}

export function deriveNhlCompetitionEntries(config = {}) {
  const anchorYmd = String(
    config.gameYmd || config.regularSeasonStartYmd || config.fromYmd || "2025-10-07"
  ).slice(0, 10);
  const rsStart = String(
    config.regularSeasonStartYmd || config.fromYmd || anchorYmd
  ).slice(0, 10);
  const seasonId = inferNhlSeasonIdFromYmd(rsStart || anchorYmd);
  const startYear = Number(seasonId.slice(0, 4)) || Number(rsStart.slice(0, 4));
  const endYear = Number(seasonId.slice(4, 8)) || startYear + 1;
  const rsEnd = String(config.regularSeasonEndYmd || `${endYear}-04-17`).slice(0, 10);
  const poEnd = String(config.playoffEndYmd || config.toYmd || `${endYear}-06-15`).slice(0, 10);
  const poStart = addDaysToYmd(rsEnd, 1);

  return [
    {
      competitionKey: buildCompetitionKey("nhl", seasonId, "regular"),
      sport: "nhl",
      seasonId,
      phase: "regular",
      label: buildNhlCompetitionLabel("regular", seasonId, rsStart),
      fromYmd: rsStart,
      toYmd: rsEnd,
      status: "active",
    },
    {
      competitionKey: buildCompetitionKey("nhl", seasonId, "playoffs"),
      sport: "nhl",
      seasonId,
      phase: "playoffs",
      label: buildNhlCompetitionLabel("playoffs", seasonId, rsStart),
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

function isCatalogEntryEligible(entry) {
  const st = String(entry?.status || "").toLowerCase();
  return st !== "retired" && st !== "archived" && st !== "finalized";
}

export function pickCompetitionForDate(entries, gameYmd) {
  const ymd = String(gameYmd || "").slice(0, 10);
  if (!ymd || !Array.isArray(entries) || !entries.length) return null;

  const sportEntries = entries.filter((e) => e?.fromYmd && e?.toYmd && isCatalogEntryEligible(e));
  const exactMatches = sportEntries.filter((e) => e.fromYmd <= ymd && ymd <= e.toYmd);
  if (exactMatches.length) {
    exactMatches.sort(
      (a, b) =>
        competitionPhaseSortIndex(a?.phase) - competitionPhaseSortIndex(b?.phase) ||
        String(a?.fromYmd || "").localeCompare(String(b?.fromYmd || ""))
    );
    return exactMatches[0];
  }

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

export function filterLeaderboardCompetitionEntries(entries = []) {
  const list = (Array.isArray(entries) ? entries : []).filter(Boolean);
  const visible = list.filter((e) => {
    const st = String(e.status || "").toLowerCase();
    return st !== "retired" && st !== "archived";
  });

  const seasonsWithFourBlock = new Set();
  for (const e of visible) {
    if (e.sport !== "nhl") continue;
    const p = String(e.phase || "").toLowerCase();
    if (p === "opening" || p === "winter" || p === "sprint") {
      seasonsWithFourBlock.add(String(e.seasonId || ""));
    }
  }

  const primaryNhlFourBlockSeason = [...seasonsWithFourBlock].sort((a, b) => b.localeCompare(a))[0] || "";

  return visible.filter((e) => {
    if (e.sport !== "nhl") return true;
    const sid = String(e.seasonId || "");
    if (primaryNhlFourBlockSeason && sid !== primaryNhlFourBlockSeason) return false;
    if (!seasonsWithFourBlock.has(sid)) return true;
    const p = String(e.phase || "").toLowerCase();
    const key = String(e.competitionKey || "");
    if (p === "regular" || key.endsWith("_regular")) return false;
    return true;
  });
}

export function competitionPhaseSortIndex(phase) {
  const p = String(phase || "").toLowerCase();
  if (p === "opening") return 0;
  if (p === "winter") return 1;
  if (p === "sprint") return 2;
  if (p === "playoffs") return 3;
  if (p === "regular") return 10;
  return 5;
}

export function normalizeCompetitionEntry(raw, id) {
  if (!raw || typeof raw !== "object") return null;
  const sport = normalizeSport(raw.sport);
  const seasonId = String(raw.seasonId || "").trim();
  const phase = String(raw.phase || "regular").trim();
  const competitionKey =
    String(raw.competitionKey || id || buildCompetitionKey(sport, seasonId, phase)).trim();

  const fromYmd = String(raw.fromYmd || "").slice(0, 10);
  const explicitLabel = String(raw.label || "").trim();
  let label = explicitLabel || competitionKey;
  if (!explicitLabel && sport === "nhl" && fromYmd) {
    label = buildNhlCompetitionLabel(phase, seasonId, fromYmd);
  }

  return {
    competitionKey,
    sport,
    seasonId,
    phase,
    label,
    fromYmd,
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
  const st = String(competition.status || "").toLowerCase();
  if (st === "finalized" || st === "retired" || st === "archived") return false;
  return isWithinCompetitionWindow(competition, gameYmd);
}

export function isCompetitionReadyToFinalize(competition, todayYmd, graceDays = 2) {
  if (!competition) return false;
  const st = String(competition.status || "").toLowerCase();
  if (st === "finalized" || st === "retired" || st === "archived") return false;
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
