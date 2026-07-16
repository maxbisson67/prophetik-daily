import {
  getFgcLeague,
  getFgcMode,
  getFgcResult,
  isFirstRbiChallenge,
} from "@src/firstGoal/fgcChallengeUtils";

export function getFgcMutualizedGameCollection(challengeOrLeague, fgcModeHint = null) {
  const league =
    typeof challengeOrLeague === "string"
      ? String(challengeOrLeague || "").toUpperCase()
      : getFgcLeague(challengeOrLeague);

  const mode =
    fgcModeHint ||
    (typeof challengeOrLeague === "object" ? getFgcMode(challengeOrLeague) : null);

  if (league === "MLB" || mode === "first_rbi") {
    return "mlb_first_rbi_games";
  }
  return "nhl_first_goal_games";
}

export function getFgcMutualizedGameDocId(challenge = {}) {
  return String(challenge?.gamePk || challenge?.gameId || "").trim();
}

function candidateFromMutualizedDoc(mutualizedGameDoc = {}, challenge = {}) {
  const candidate = mutualizedGameDoc?.candidate || {};
  if (!candidate || typeof candidate !== "object") return null;

  const isRbi = isFirstRbiChallenge(challenge);

  const playerId = isRbi
    ? candidate?.batterId != null
      ? String(candidate.batterId)
      : null
    : candidate?.scoringPlayerId != null
    ? String(candidate.scoringPlayerId)
    : null;

  const playerName = isRbi
    ? String(candidate?.batterName || "").trim() || null
    : String(candidate?.scoringPlayerName || "").trim() || null;

  if (!playerId && !playerName) return null;

  return {
    playerId,
    playerName,
    teamAbbr: candidate?.teamAbbr ? String(candidate.teamAbbr) : null,
  };
}

function resultFromMutualizedDoc(mutualizedGameDoc = {}) {
  const result = mutualizedGameDoc?.result || null;
  if (!result || typeof result !== "object") return null;

  return {
    playerId: result?.playerId != null ? String(result.playerId) : null,
    playerName: result?.playerName ? String(result.playerName) : null,
    teamAbbr: result?.teamAbbr ? String(result.teamAbbr) : null,
    noWinner: !result?.playerId && !result?.playerName,
  };
}

/** Résultat affichable = confirmé sur le défi, ou candidat provisoire du doc mutualisé. */
export function resolveFgcEffectiveResult(challenge = {}, mutualizedGameDoc = null) {
  const fromChallenge = getFgcResult(challenge) || {};
  const chStatus = String(challenge?.status || "").toLowerCase();
  const decided = chStatus === "decided" || chStatus === "closed";

  if (fromChallenge?.playerId || fromChallenge?.playerName) {
    return {
      playerId: fromChallenge.playerId ? String(fromChallenge.playerId) : null,
      playerName: fromChallenge.playerName || null,
      teamAbbr: fromChallenge.teamAbbr || null,
      awaitingFinalConfirmation: false,
      confirmed: true,
      noWinner: false,
    };
  }

  if (decided) {
    return {
      playerId: null,
      playerName: null,
      teamAbbr: null,
      awaitingFinalConfirmation: false,
      confirmed: true,
      noWinner: true,
    };
  }

  if (!mutualizedGameDoc) return null;

  const gameStatus = String(mutualizedGameDoc?.status || "").toLowerCase();

  if (gameStatus === "confirmed") {
    const confirmed = resultFromMutualizedDoc(mutualizedGameDoc);
    if (!confirmed) return null;
    return {
      ...confirmed,
      awaitingFinalConfirmation: false,
      confirmed: true,
    };
  }

  if (gameStatus === "no_winner") {
    return {
      playerId: null,
      playerName: null,
      teamAbbr: null,
      awaitingFinalConfirmation: false,
      confirmed: true,
      noWinner: true,
    };
  }

  if (["pending", "provisional"].includes(gameStatus)) {
    const provisional = candidateFromMutualizedDoc(mutualizedGameDoc, challenge);
    if (!provisional) return null;
    return {
      ...provisional,
      awaitingFinalConfirmation: true,
      confirmed: false,
      noWinner: false,
    };
  }

  return null;
}

export function getFgcEffectiveResultPlayerName(challenge, mutualizedGameDoc = null) {
  return resolveFgcEffectiveResult(challenge, mutualizedGameDoc)?.playerName || null;
}

export function getFgcEffectiveResultPlayerId(challenge, mutualizedGameDoc = null) {
  return resolveFgcEffectiveResult(challenge, mutualizedGameDoc)?.playerId || null;
}

export function getFgcEffectiveResultTeamAbbr(challenge, mutualizedGameDoc = null) {
  return resolveFgcEffectiveResult(challenge, mutualizedGameDoc)?.teamAbbr || null;
}

export function isFgcResultAwaitingFinalConfirmation(challenge, mutualizedGameDoc = null) {
  return !!resolveFgcEffectiveResult(challenge, mutualizedGameDoc)?.awaitingFinalConfirmation;
}
