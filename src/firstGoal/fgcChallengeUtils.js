export function getFgcMode(challenge) {
  if (challenge?.fgcMode) return String(challenge.fgcMode);
  if (String(challenge?.league || "").toUpperCase() === "MLB") return "first_rbi";
  return "first_goal";
}

export function getFgcLeague(challenge, fallback = "NHL") {
  const league = String(challenge?.league || "").toUpperCase();
  if (league === "MLB" || league === "NHL") return league;
  if (getFgcMode(challenge) === "first_rbi") return "MLB";
  const fb = String(fallback || "NHL").toUpperCase();
  return fb === "MLB" ? "MLB" : "NHL";
}

export function isFirstRbiChallenge(ch) {
  const league = String(ch?.league || "NHL").toUpperCase();
  if (league !== "MLB") return false;
  return getFgcMode(ch) === "first_rbi";
}

export function isFirstGoalChallenge(ch) {
  if (isFirstRbiChallenge(ch)) return false;
  const mode = String(ch?.fgcMode || "first_goal").toLowerCase();
  return mode === "first_goal";
}

export function getFgcResult(ch) {
  if (isFirstRbiChallenge(ch)) return ch?.firstRbi || null;
  return ch?.firstGoal || null;
}

export function getFgcResultPlayerId(ch) {
  const result = getFgcResult(ch);
  return result?.playerId ? String(result.playerId) : null;
}

export function getFgcResultPlayerName(ch) {
  const result = getFgcResult(ch);
  return result?.playerName || null;
}

export function getFgcResultTeamAbbr(ch) {
  const result = getFgcResult(ch);
  return result?.teamAbbr || "";
}

export function getFgcTitle(ch, t) {
  if (isFirstRbiChallenge(ch)) {
    return t("firstGoal.firstRbi.title", { defaultValue: "Premier point produit" });
  }
  return t("firstGoal.home.title", { defaultValue: "Premier but" });
}

export function getFgcResultPrefix(ch, t) {
  if (isFirstRbiChallenge(ch)) {
    return t("firstGoal.firstRbi.resultPrefix", { defaultValue: "Premier point produit :" });
  }
  return t("firstGoal.result.prefix", { defaultValue: "Premier but:" });
}

export function getFgcLiveNoneText(ch, t) {
  if (isFirstRbiChallenge(ch)) {
    return t("firstGoal.firstRbi.live.noneYet", {
      defaultValue: "Aucun point produit pour le moment.",
    });
  }
  return t("firstGoal.live.noGoalYet", { defaultValue: "Aucun but pour le moment." });
}

export function getFgcLivePendingText(ch, t, { name, team }) {
  if (isFirstRbiChallenge(ch)) {
    return t("firstGoal.firstRbi.live.pending", {
      defaultValue: "Premier point produit : {{name}} {{team}} · en attente de confirmation",
      name,
      team,
    });
  }
  return t("firstGoal.live.goalPending", {
    defaultValue: "Premier but: {{name}} {{team}} · en attente de confirmation",
    name,
    team,
  });
}

export function getFgcLiveConfirmedText(ch, t, { name, team }) {
  if (isFirstRbiChallenge(ch)) {
    return t("firstGoal.firstRbi.live.confirmed", {
      defaultValue: "Premier point produit confirmé : {{name}} {{team}}",
      name,
      team,
    });
  }
  return t("firstGoal.live.goalConfirmed", {
    defaultValue: "Premier but confirmé: {{name}} {{team}}",
    name,
    team,
  });
}
