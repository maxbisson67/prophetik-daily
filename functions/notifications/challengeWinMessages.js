function normalizeLang(lang) {
  return String(lang || "fr").toLowerCase().startsWith("en") ? "en" : "fr";
}

function normalizeLeague(league) {
  return String(league || "NHL").toUpperCase() === "MLB" ? "MLB" : "NHL";
}

export function buildFgcWinPush({ lang = "fr", league = "NHL" } = {}) {
  const lg = normalizeLang(lang);
  const sport = normalizeLeague(league);

  if (lg === "en") {
    return {
      title: "Bravo!",
      body:
        sport === "MLB"
          ? "You correctly predicted the player who drove in the first run!"
          : "You correctly predicted the player who scored the first goal!",
    };
  }

  return {
    title: "Bravo !",
    body:
      sport === "MLB"
        ? "Tu as bien prédit le joueur qui a produit le premier point !"
        : "Tu as bien prédit le joueur qui a marqué le premier but !",
  };
}

export function buildTpExactScorePush({
  lang = "fr",
  awayAbbr,
  homeAbbr,
  awayScore,
  homeScore,
} = {}) {
  const lg = normalizeLang(lang);
  const away = String(awayAbbr || "").trim().toUpperCase();
  const home = String(homeAbbr || "").trim().toUpperCase();
  const a = Number(awayScore);
  const h = Number(homeScore);
  const scoreLine = Number.isFinite(a) && Number.isFinite(h) ? `${a}-${h}` : "";

  if (lg === "en") {
    return {
      title: "Bravo!",
      body: scoreLine
        ? `You nailed the exact score for ${away} vs ${home} (${scoreLine}).`
        : `You nailed the exact score for ${away} vs ${home}.`,
    };
  }

  return {
    title: "Bravo !",
    body: scoreLine
      ? `Tu as prédit le pointage exact du match ${away} contre ${home} (${scoreLine}).`
      : `Tu as prédit le pointage exact du match ${away} contre ${home}.`,
  };
}
