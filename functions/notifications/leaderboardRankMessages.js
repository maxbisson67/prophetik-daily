function normalizeLang(lang) {
  return String(lang || "fr").toLowerCase().startsWith("en") ? "en" : "fr";
}

function formatRankFr(rank) {
  const n = Number(rank);
  if (!Number.isFinite(n) || n < 1) return String(rank || "");
  if (n === 1) return "1er";
  return `${n}e`;
}

function formatRankEn(rank) {
  const n = Number(rank);
  if (!Number.isFinite(n) || n < 1) return String(rank || "");
  const v = n % 100;
  if (v >= 11 && v <= 13) return `${n}th`;
  const r = n % 10;
  if (r === 1) return `${n}st`;
  if (r === 2) return `${n}nd`;
  if (r === 3) return `${n}rd`;
  return `${n}th`;
}

export function buildLeaderboardRankUpPush({
  lang = "fr",
  groupName,
  previousRank,
  newRank,
} = {}) {
  const lg = normalizeLang(lang);
  const prev = Number(previousRank);
  const next = Number(newRank);
  const spots = Number.isFinite(prev) && Number.isFinite(next) ? Math.max(0, prev - next) : 0;
  const group = String(groupName || "").trim();

  if (lg === "en") {
    const rankLabel = formatRankEn(next);
    const title = group ? `Standings — ${group}` : "Standings update";
    const body =
      spots > 1
        ? `You moved up to ${rankLabel} (+${spots} spots)!`
        : spots === 1
        ? `You moved up to ${rankLabel} (+1 spot)!`
        : `You are now ${rankLabel} in the group standings!`;
    return { title, body };
  }

  const rankLabel = formatRankFr(next);
  const title = group ? `Classement — ${group}` : "Classement";
  const body =
    spots > 1
      ? `Tu grimpes au ${rankLabel} rang (+${spots} places) !`
      : spots === 1
      ? `Tu grimpes au ${rankLabel} rang (+1 place) !`
      : `Tu es maintenant ${rankLabel} au classement du groupe !`;

  return { title, body };
}
