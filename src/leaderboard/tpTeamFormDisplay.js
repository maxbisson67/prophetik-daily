function formatSideSplitWlt(record, side, league = "NHL") {
  if (!record || (side !== "home" && side !== "away")) return null;

  const lg = String(league || "NHL").toUpperCase();

  if (lg === "MLB") {
    const split = side === "home" ? record.home : record.away;
    if (!split || split.wins == null || split.losses == null) return null;
    return split.pctLabel
      ? `${split.wins}-${split.losses} · ${split.pctLabel}`
      : `${split.wins}-${split.losses}`;
  }

  const split = side === "home" ? record.home : record.road;
  if (!split || split.wins == null || split.losses == null) return null;
  const ot = split.otLosses ?? 0;
  return `${split.wins}-${split.losses}-${ot}`;
}

function formatRatePerGame(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  return n.toFixed(2);
}

export function formatTpWlt(record, league = "NHL") {
  if (!record) return null;
  const lg = String(league || "NHL").toUpperCase();
  const wins = record.wins;
  const losses = record.losses;
  if (wins == null || losses == null) return null;

  if (lg === "MLB") {
    return `${wins}-${losses}`;
  }

  const ot = record.otLosses ?? 0;
  return `${wins}-${losses}-${ot}`;
}

function formatTpLastTen(record, league = "NHL") {
  const lt = record?.lastTen;
  if (!lt || lt.wins == null || lt.losses == null) return null;
  return formatTpWlt(lt, league);
}

/** Données affichables DUO à partir d’un record parsé (classement). */
export function buildTpTeamFormFacts(record, side, league = "NHL") {
  if (!record) return null;

  const lg = String(league || "NHL").toUpperCase();
  const gfpg =
    lg === "MLB"
      ? formatRatePerGame(record.runsForPerGame)
      : formatRatePerGame(record.goalsForPerGame);
  const gapg =
    lg === "MLB"
      ? formatRatePerGame(record.runsAgainstPerGame)
      : formatRatePerGame(record.goalsAgainstPerGame);

  return {
    recordWlt: formatTpWlt(record, lg),
    splitWlt: formatSideSplitWlt(record, side, lg),
    goalsForPerGame: gfpg,
    goalsAgainstPerGame: gapg,
    lastTenWlt: formatTpLastTen(record, lg),
  };
}
