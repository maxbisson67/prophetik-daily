export function formatMlbPitcherSummary(pitcher) {
  if (!pitcher?.name) return null;

  const parts = [pitcher.name];

  if (pitcher.wins !== null && pitcher.wins !== undefined && pitcher.losses !== null && pitcher.losses !== undefined) {
    parts.push(`${pitcher.wins}-${pitcher.losses}`);
  }

  if (pitcher.era) {
    parts.push(`ERA ${pitcher.era}`);
  }

  return parts.join(" · ");
}

export function formatMlbPitcherNameAndRecord(pitcher) {
  if (!pitcher?.name) return null;

  const parts = [pitcher.name];

  if (
    pitcher.wins !== null &&
    pitcher.wins !== undefined &&
    pitcher.losses !== null &&
    pitcher.losses !== undefined
  ) {
    parts.push(`${pitcher.wins}-${pitcher.losses}`);
  }

  return parts.join(" · ");
}

export function formatMlbPitcherEraLine(pitcher) {
  if (!pitcher?.name) return null;
  if (pitcher.era) return `ERA ${pitcher.era}`;
  return "ERA —";
}

export function formatMlbPitcherFallbackLabel(t) {
  return t?.("mlb.pitcher.tbd", { defaultValue: "Lanceur à confirmer" }) || "Lanceur à confirmer";
}

export function formatMlbOpponentPitcherLine(pitcher, t) {
  const summary = formatMlbPitcherSummary(pitcher);
  if (!summary) {
    return t?.("mlb.pitcher.vsTbd", { defaultValue: "vs lanceur à confirmer" }) || "vs lanceur à confirmer";
  }
  return `vs ${summary}`;
}
