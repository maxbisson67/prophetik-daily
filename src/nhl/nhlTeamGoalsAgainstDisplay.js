import i18n from "@src/i18n/i18n";

function isFrench() {
  return String(i18n.locale || "").toLowerCase().startsWith("fr");
}

function numOrNull(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** BC / GA par match à partir d’un objet équipe, record parsé ou snapshot matchup. */
export function resolveTeamGoalsAgainstPerGame(source) {
  if (!source) return null;

  for (const key of [
    "goalsAgainstPerGame",
    "runsAgainstPerGame",
    "gaPerGame",
    "oppGaPerGame",
  ]) {
    if (source[key] == null || source[key] === "") continue;
    const direct = numOrNull(source[key]);
    if (direct != null && direct >= 0) return direct;
  }

  const ga = numOrNull(source.goalsAgainst ?? source.oppGoalsAgainst);
  const gp = numOrNull(source.gamesPlayed ?? source.oppGamesPlayed);
  if (ga != null && gp != null && gp > 0) return ga / gp;

  return null;
}

export function formatTeamGoalsAgainstPerGame(value) {
  const n = numOrNull(value);
  if (n == null || n < 0) return null;
  const s = n.toFixed(2);
  return isFrench() ? s.replace(".", ",") : s;
}
