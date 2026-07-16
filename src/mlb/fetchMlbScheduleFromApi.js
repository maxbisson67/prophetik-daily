import { mapMlbScheduleGameToLiveGame } from "@src/mlb/mapMlbScheduleToLiveGame";

function toApiDateYmd(ymd) {
  const s = String(ymd || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const compact = s.replace(/\D/g, "");
  if (compact.length === 8) {
    return `${compact.slice(0, 4)}-${compact.slice(4, 6)}-${compact.slice(6, 8)}`;
  }
  return s;
}

function normalizeMlbApiScheduleGame(raw = {}) {
  const teams = raw?.teams || {};
  const away = teams?.away || {};
  const home = teams?.home || {};
  const linescore = raw?.linescore || {};

  return {
    gamePk: String(raw?.gamePk || ""),
    gameType: raw?.gameType || "R",
    status: raw?.status || {},
    awayTeam: {
      abbreviation:
        away?.team?.abbreviation ||
        away?.team?.teamCode ||
        away?.team?.fileCode ||
        "",
      score: away?.score,
    },
    homeTeam: {
      abbreviation:
        home?.team?.abbreviation ||
        home?.team?.teamCode ||
        home?.team?.fileCode ||
        "",
      score: home?.score,
    },
    currentInning: linescore?.currentInning ?? null,
    currentInningOrdinal: linescore?.currentInningOrdinal || "",
    inningState: linescore?.inningState || "",
    startTimeUTC: raw?.gameDate || null,
    gameDateRaw: raw?.gameDate || null,
    venue: raw?.venue ? { name: raw.venue?.name || "" } : null,
  };
}

/** Calendrier MLB du jour via statsapi (fallback si Firestore incomplet). */
export async function fetchMlbScheduleGamesForYmd(ymd) {
  const date = toApiDateYmd(ymd);
  if (!date) return [];

  const url =
    `https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=${encodeURIComponent(date)}` +
    "&gameTypes=R&hydrate=team,linescore";

  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) {
    throw new Error(`MLB schedule HTTP ${res.status}`);
  }

  const json = await res.json();
  const out = [];

  for (const block of json?.dates || []) {
    for (const raw of block?.games || []) {
      const row = normalizeMlbApiScheduleGame(raw);
      if (!row.gamePk) continue;
      out.push(mapMlbScheduleGameToLiveGame(row, date));
    }
  }

  return out;
}
