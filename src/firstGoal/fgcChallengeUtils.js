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

/** Premier point produit : match en cours, aucun RBI encore. */
export function getFgcNoPointYetLabel(ch, t) {
  if (isFirstRbiChallenge(ch)) {
    return t("firstGoal.firstRbi.noPointYet", {
      defaultValue: "Pas encore de point produit",
    });
  }
  return t("firstGoal.live.noGoalYet", { defaultValue: "Aucun but pour le moment." });
}

/** Aucun gagnant une fois le résultat officiellement confirmé. */
export function getFgcConfirmedNoWinnerLabel(ch, t) {
  if (isFirstRbiChallenge(ch)) {
    return t("firstGoal.firstRbi.noWinner", { defaultValue: "Aucun gagnant" });
  }
  return t("firstGoal.live.noWinner", { defaultValue: "Aucun gagnant" });
}

/** Libellé quand le résultat n'est pas encore connu (pas de joueur gagnant). */
export function getFgcResultOutcomeLabel(challenge, t, matchState) {
  if (getFgcResultPlayerName(challenge)) return null;

  const chStatus = String(challenge?.status || "").toLowerCase();
  const decided = chStatus === "decided" || chStatus === "closed";
  const state = String(matchState || "").toLowerCase();

  if (state === "not_started" && !decided) {
    return t("firstGoal.home.upcoming", { defaultValue: "À venir" });
  }

  if (isFirstRbiChallenge(challenge)) {
    if (decided || state === "completed") {
      return getFgcConfirmedNoWinnerLabel(challenge, t);
    }
    return getFgcNoPointYetLabel(challenge, t);
  }

  if (decided || state === "completed") {
    return t("firstGoal.home.noWinner", { defaultValue: "Aucun gagnant" });
  }

  return t("firstGoal.live.noGoalYet", { defaultValue: "Aucun but pour le moment." });
}

export function getFgcLiveNoneText(ch, t) {
  return getFgcNoPointYetLabel(ch, t);
}

export function getFgcLivePendingText(ch, t, { name, team }) {
  if (isFirstRbiChallenge(ch)) {
    return t("firstGoal.firstRbi.live.pending", {
      defaultValue: "Premier point produit : {{name}} {{team}} · en attente de confirmation finale",
      name,
      team,
    });
  }
  return t("firstGoal.live.goalPending", {
    defaultValue: "Premier but: {{name}} {{team}} · en attente de confirmation finale",
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
