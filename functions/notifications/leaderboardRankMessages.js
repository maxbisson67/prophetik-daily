function normalizeLang(lang) {
  return String(lang || "fr").toLowerCase().startsWith("en") ? "en" : "fr";
}

function titleWithGroup(baseTitle, groupName) {
  const base = String(baseTitle || "").trim();
  const group = String(groupName || "").trim();
  if (!base) return group || "";
  return group ? `${base} — ${group}` : base;
}

function formatRankPositionFr(rank) {
  const n = Number(rank);
  if (!Number.isFinite(n) || n < 1) return String(rank || "");
  if (n === 1) return "première position";
  if (n === 2) return "deuxième position";
  if (n === 3) return "troisième position";
  return `${n}e position`;
}

function formatRankPositionEn(rank) {
  const n = Number(rank);
  if (!Number.isFinite(n) || n < 1) return String(rank || "");
  if (n === 1) return "first place";
  if (n === 2) return "second place";
  if (n === 3) return "third place";
  const v = n % 100;
  if (v >= 11 && v <= 13) return `${n}th place`;
  const r = n % 10;
  if (r === 1) return `${n}st place`;
  if (r === 2) return `${n}nd place`;
  if (r === 3) return `${n}rd place`;
  return `${n}th place`;
}

export function buildLeaderboardRankUpPush({
  lang = "fr",
  groupName,
  memberName,
  newRank,
} = {}) {
  const lg = normalizeLang(lang);
  const name = String(memberName || "").trim() || (lg === "en" ? "A member" : "Un membre");
  const next = Number(newRank);

  const title = titleWithGroup(lg === "en" ? "Standings" : "Classement", groupName);

  if (lg === "en") {
    const position = formatRankPositionEn(next);
    return {
      title,
      body: `Congrats to ${name}, now in ${position}!`,
    };
  }

  const position = formatRankPositionFr(next);
  return {
    title,
    body: `Bravo à ${name} qui est maintenant en ${position}.`,
  };
}
