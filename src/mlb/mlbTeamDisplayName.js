const MLB_TWO_WORD_CITY_PREFIXES = [
  "New York",
  "Los Angeles",
  "San Francisco",
  "San Diego",
  "Kansas City",
  "St. Louis",
  "Tampa Bay",
];

/** Affiche le nom d'équipe court (ex. « White Sox », « Blue Jays »). */
export function formatMlbTeamDisplayName(team, abbrFallback = "") {
  const shortName = String(team?.shortName || team?.teamName || "").trim();
  if (shortName) return shortName;

  const fullName = String(team?.name || "").trim();
  if (!fullName) return String(abbrFallback || "").trim() || "—";

  for (const city of MLB_TWO_WORD_CITY_PREFIXES) {
    if (fullName.startsWith(`${city} `)) {
      return fullName.slice(city.length + 1);
    }
  }

  const parts = fullName.split(/\s+/);
  if (parts.length <= 1) return fullName;
  return parts.slice(1).join(" ");
}
