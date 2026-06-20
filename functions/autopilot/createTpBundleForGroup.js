import { FieldValue } from "firebase-admin/firestore";
import {
  buildTeamPredictionBundleId,
  defaultBundlePayload,
  ymdFromBusinessDate,
} from "../teamPredictionBundles/tpBundleUtils.js";
import {
  buildBundleGamesFromSelection,
  loadEligibleScheduleGames,
  selectGamesForTpBundle,
} from "../teamPredictionBundles/tpBundleGameSelection.js";

async function getEligibleTpGames({ db, league, gameYmd, cache }) {
  const key = `${league}:${gameYmd}`;
  if (!cache[key]) {
    cache[key] = await loadEligibleScheduleGames(db, { league, gameYmd });
  }
  return cache[key];
}

export async function createTpBundleForGroupIfNeeded({
  db,
  groupId,
  group,
  league,
  eligibleGamesCache = {},
}) {
  const gameYmd = ymdFromBusinessDate(new Date());
  const bundleId = buildTeamPredictionBundleId({ league, groupId, gameYmd });
  const bundleRef = db.doc(`team_prediction_bundles/${bundleId}`);

  const existingSnap = await bundleRef.get();
  if (existingSnap.exists) {
    return { created: false, reason: "exists", gameYmd };
  }

  const eligibleGames = await getEligibleTpGames({
    db,
    league,
    gameYmd,
    cache: eligibleGamesCache,
  });

  const { games: selectedGames, gameCount } = selectGamesForTpBundle({
    games: eligibleGames,
    group,
    league,
  });

  if (gameCount < 1) {
    return { created: false, reason: "no-games", gameYmd };
  }

  const games = buildBundleGamesFromSelection(selectedGames, league);

  const payload = {
    ...defaultBundlePayload({
      groupId,
      league,
      gameYmd,
      games,
      createdBy: "system",
      favoriteTeamSnapshot: group?.favoriteTeam || null,
      autopilotCreated: true,
    }),
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };

  await bundleRef.set(payload, { merge: false });

  return {
    created: true,
    bundleId,
    gameYmd,
    gameCount,
    gameIds: games.map((g) => g.gameId),
  };
}
