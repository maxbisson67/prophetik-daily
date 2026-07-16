import firestore from "@react-native-firebase/firestore";
import { snapshotExists, snapshotData, snapshotId } from "@src/lib/safeSnapshot";
import { mlbScheduleGameDocPath } from "@src/mlb/mlbScheduleClient";
import { normalizeMlbPitcherId } from "@src/mlb/loadMlbBvpForPlayers";

export function safeTeamAbbr(v) {
  return String(v || "").trim().toUpperCase();
}

function pickPitcherField(challenge, schedule, field) {
  const c = challenge?.[field];
  const s = schedule?.[field];
  if (c !== null && c !== undefined && c !== "") return c;
  if (s !== null && s !== undefined && s !== "") return s;
  return null;
}

export function normalizeProbablePitcherRecord(pitcher) {
  if (!pitcher || typeof pitcher !== "object") return null;

  const id = normalizeMlbPitcherId(pitcher);
  const name = String(pitcher.name || pitcher.fullName || "").trim() || null;

  if (!id && !name) return null;

  return {
    ...pitcher,
    id: id || null,
    name,
  };
}

/** Fusionne lanceur partant : priorité à un ID valide (schedule > challenge). */
export function mergeProbablePitcherRecords(fromChallenge, fromSchedule) {
  const schedule = normalizeProbablePitcherRecord(fromSchedule);
  const challenge = normalizeProbablePitcherRecord(fromChallenge);

  const id = normalizeMlbPitcherId(schedule) || normalizeMlbPitcherId(challenge);
  const name = challenge?.name || schedule?.name || null;

  if (!id && !name) return null;

  return {
    ...(schedule || {}),
    ...(challenge || {}),
    id: id || null,
    name,
    wins: pickPitcherField(challenge, schedule, "wins"),
    losses: pickPitcherField(challenge, schedule, "losses"),
    era: pickPitcherField(challenge, schedule, "era"),
  };
}

export function opposingProbablePitcherForPlayer(player, probablePitchers, homeAbbr, awayAbbr) {
  const team = safeTeamAbbr(player?.teamAbbr);
  const home = safeTeamAbbr(homeAbbr);
  const away = safeTeamAbbr(awayAbbr);
  if (team === away) return probablePitchers?.home || null;
  if (team === home) return probablePitchers?.away || null;
  return null;
}

export function mergeFgcOpposingPitcherSources(...sources) {
  let merged = null;
  for (const src of sources) {
    if (!src) continue;
    merged = mergeProbablePitcherRecords(merged, src);
  }
  return merged;
}

export function getFgcBvpMatchups({ probablePitchers, awayAbbr, homeAbbr }) {
  const away = safeTeamAbbr(awayAbbr);
  const home = safeTeamAbbr(homeAbbr);
  const matchups = [];

  if (away) {
    matchups.push({
      teamAbbr: away,
      pitcher: mergeProbablePitcherRecords(null, probablePitchers?.home),
    });
  }

  if (home) {
    matchups.push({
      teamAbbr: home,
      pitcher: mergeProbablePitcherRecords(null, probablePitchers?.away),
    });
  }

  return matchups;
}

export async function resolveFgcProbablePitchersForBvp(challenge, probablePitchers) {
  const awayAbbr = safeTeamAbbr(challenge?.awayAbbr);
  const homeAbbr = safeTeamAbbr(challenge?.homeAbbr);

  let merged = {
    away: mergeProbablePitcherRecords(challenge?.awayProbablePitcher, probablePitchers?.away),
    home: mergeProbablePitcherRecords(challenge?.homeProbablePitcher, probablePitchers?.home),
  };

  const needsScheduleFallback = getFgcBvpMatchups({
    probablePitchers: merged,
    awayAbbr,
    homeAbbr,
  }).some((m) => m.pitcher?.name && !normalizeMlbPitcherId(m.pitcher));

  if (needsScheduleFallback) {
    const path = mlbScheduleGameDocPath(
      challenge?.gameYmd,
      challenge?.gamePk || challenge?.gameId
    );

    if (path) {
      try {
        const snap = await firestore().doc(path).get();
        if (snapshotExists(snap)) {
          const data = snapshotData(snap) || {};
          merged = {
            away: mergeProbablePitcherRecords(merged.away, data.awayProbablePitcher),
            home: mergeProbablePitcherRecords(merged.home, data.homeProbablePitcher),
          };
        }
      } catch {
        // garde merged tel quel
      }
    }
  }

  return {
    probablePitchers: merged,
    matchups: getFgcBvpMatchups({ probablePitchers: merged, awayAbbr, homeAbbr }),
  };
}
