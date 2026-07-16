import i18n from "@src/i18n/i18n";
import { lookupTeamByAbbr } from "@src/groups/data/fallbackTeams";
import { formatMlbTeamDisplayName } from "@src/mlb/mlbTeamDisplayName";
import { isCompleteTpPick } from "@src/defis/TpHomePredictionRow";
import { resolveFgcEffectiveResult } from "@src/firstGoal/fgcMutualizedGameUtils";
import { isSlotDecided, resolveTpPickResult } from "@src/defis/tpBundleDisplayHelpers";
import { FGC_WIN_POINTS } from "@src/lib/challengeScoringConstants";

function resolveFgcDefaultPoints(challenge = {}) {
  return (
    Number(
      challenge?.stakePoints ?? challenge?.points ?? challenge?.potJoinIncrement ?? FGC_WIN_POINTS
    ) || FGC_WIN_POINTS
  );
}

function resolveFgcEntryPoints(pick = {}) {
  if (pick?.payout != null) return Number(pick.payout) || 0;
  if (pick?.won === true) return Number(pick?.points ?? 0) || 0;
  return 0;
}

export function formatLiveBravoBadgeLabel(points) {
  const pts = Number(points) || 0;
  if (pts <= 0) return null;

  return i18n.t("live.challenge.bravoPoints", {
    defaultValue: "Bravo! {{points}} points",
    points: pts,
  });
}

export function resolveLiveFgcBravoLabel({ challenge = {}, pick = null, mutualizedGame = null }) {
  const effective = resolveFgcEffectiveResult(challenge, mutualizedGame);
  if (!effective?.confirmed || effective.awaitingFinalConfirmation) return null;
  if (effective.noWinner) return null;

  const winnerPlayerId = String(effective.playerId || "").trim();
  const myPlayerId = String(pick?.playerId || "").trim();
  if (!winnerPlayerId || !myPlayerId || winnerPlayerId !== myPlayerId) return null;

  const paid = resolveFgcEntryPoints(pick);
  const pts = paid > 0 ? paid : resolveFgcDefaultPoints(challenge);
  return formatLiveBravoBadgeLabel(pts);
}

export function resolveLiveTpBravoLabel({ pick = null, tpSlot = null, pickResult = null }) {
  const slot = tpSlot?.slot;
  const bundle = tpSlot?.item?.raw || tpSlot?.item;
  if (!pick || !slot || !isSlotDecided(slot)) return null;

  const result = resolveTpPickResult({ pick, slot, pickResult, bundle });
  if (!result?.winnerCorrect) return null;

  const pts = Number(result.points ?? result.payout ?? 0);
  if (!Number.isFinite(pts) || pts <= 0) return null;

  return formatLiveBravoBadgeLabel(pts);
}

export function resolveLiveTeamDisplayName(abbr, league, teamForAbbr = null) {
  const lg = String(league || "NHL").toUpperCase();
  const key = String(abbr || "").trim().toUpperCase();
  const team = teamForAbbr ? teamForAbbr(key) : lookupTeamByAbbr(lg, key);

  if (lg === "MLB") {
    return formatMlbTeamDisplayName(team, key);
  }

  const shortName = String(team?.shortName || "").trim();
  if (shortName) return shortName;

  const fullName = String(team?.name || "").trim();
  if (fullName) {
    const parts = fullName.split(/\s+/);
    return parts.length > 1 ? parts[parts.length - 1] : fullName;
  }

  return key || "—";
}

export function formatLiveTpScoreLine({ pick, slot, league, teamForAbbr = null }) {
  if (!isCompleteTpPick(pick)) return null;

  const awayAbbr = slot?.awayAbbr;
  const homeAbbr = slot?.homeAbbr;
  const awayName = resolveLiveTeamDisplayName(awayAbbr, league, teamForAbbr);
  const homeName = resolveLiveTeamDisplayName(homeAbbr, league, teamForAbbr);

  return `${awayName} ${pick.predictedAwayScore} · ${homeName} ${pick.predictedHomeScore}`;
}

export function formatLiveTpPredictionLabel({ pick, slot, league, teamForAbbr = null }) {
  const line = formatLiveTpScoreLine({ pick, slot, league, teamForAbbr });
  if (!line) return null;

  return i18n.t("live.challenge.myPredictionLine", {
    defaultValue: "Ma prédiction — {{line}}",
    line,
  });
}
