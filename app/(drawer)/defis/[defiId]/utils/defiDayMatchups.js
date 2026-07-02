import { ymdTorontoFromUTC } from "./defiFormatters";

function toStartIso(v) {
  if (!v) return null;
  if (typeof v?.toDate === "function") {
    const d = v.toDate();
    return Number.isFinite(d?.getTime?.()) ? d.toISOString() : null;
  }
  if (v instanceof Date) {
    return Number.isFinite(v.getTime()) ? v.toISOString() : null;
  }
  if (typeof v === "string") return v;
  const d = new Date(v);
  return Number.isFinite(d.getTime()) ? d.toISOString() : null;
}

export function normalizeNhlMatchupGame(data = {}, docId = "") {
  return {
    id: String(data?.gameId ?? docId),
    gameId: String(data?.gameId ?? docId),
    sport: "NHL",
    startTimeUTC: toStartIso(data?.startTimeUTC) ?? data?.startTimeUTC,
    startYmdToronto: data?.startYmdToronto || ymdTorontoFromUTC(data?.startTimeUTC),
    home: data?.home || {},
    away: data?.away || {},
    context: data?.context || null,
  };
}

export function normalizeMlbMatchupGame(data = {}, docId = "") {
  const awayAbbr = String(data?.awayTeam?.abbreviation || "").toUpperCase();
  const homeAbbr = String(data?.homeTeam?.abbreviation || "").toUpperCase();
  const startIso = toStartIso(data?.startTimeUTC);

  return {
    id: String(data?.gamePk ?? docId),
    gameId: String(data?.gamePk ?? docId),
    sport: "MLB",
    startTimeUTC: startIso,
    startYmdToronto: ymdTorontoFromUTC(startIso),
    home: {
      abbr: homeAbbr,
      teamId: data?.homeTeam?.id ?? null,
      logo: data?.homeTeam?.logo ?? null,
    },
    away: {
      abbr: awayAbbr,
      teamId: data?.awayTeam?.id ?? null,
      logo: data?.awayTeam?.logo ?? null,
    },
    awayProbablePitcher: data?.awayProbablePitcher || null,
    homeProbablePitcher: data?.homeProbablePitcher || null,
  };
}

export function filterAndSortDayMatchups(games, gameYMD) {
  const filtered = (games || []).filter((g) => {
    if (!g) return false;
    const ymd = g.startYmdToronto || ymdTorontoFromUTC(g.startTimeUTC);
    return !gameYMD || ymd === gameYMD;
  });

  filtered.sort((a, b) =>
    String(a.startTimeUTC || "").localeCompare(String(b.startTimeUTC || ""))
  );

  return filtered;
}
