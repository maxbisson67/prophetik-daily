/**
 * Réduit les bundles TP du jour à 2 matchs (supprime le slot 3 si aucune participation).
 *
 * Usage:
 *   node functions/scripts/trimTpBundlesToTwoGames.js
 *   node functions/scripts/trimTpBundlesToTwoGames.js --date=20260709
 *   node functions/scripts/trimTpBundlesToTwoGames.js --dry-run
 */
import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { TP_BUNDLE_MAX_GAMES, computeBundleStatus } from "../teamPredictionBundles/tpBundleUtils.js";
import { getBusinessYmdDashed } from "../teamPredictionBundles/tpBundleUtils.js";

if (!getApps().length) initializeApp();

const db = getFirestore();

function readArg(name) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split("=").slice(1).join("=") : null;
}

const dryRun = process.argv.includes("--dry-run");

function ymdCompactFromDashed(ymd) {
  return String(ymd || "").replace(/-/g, "");
}

function hasPickForGameId(picks = {}, gameId) {
  const gid = String(gameId || "").trim();
  if (!gid) return false;
  const pick = picks[gid];
  if (!pick || typeof pick !== "object") return false;
  return (
    Number.isFinite(Number(pick.predictedAwayScore)) &&
    Number.isFinite(Number(pick.predictedHomeScore))
  );
}

async function bundleHasPickOnGame(bundleId, gameId) {
  const entriesSnap = await db.collection(`team_prediction_bundles/${bundleId}/entries`).get();
  for (const doc of entriesSnap.docs) {
    const picks = doc.data()?.picks || {};
    if (hasPickForGameId(picks, gameId)) return true;
  }
  return false;
}

async function main() {
  const dateArg = readArg("date");
  const gameYmd = dateArg || ymdCompactFromDashed(getBusinessYmdDashed(new Date()));

  const snap = await db
    .collection("team_prediction_bundles")
    .where("gameYmd", "==", gameYmd)
    .get();

  const results = [];

  for (const doc of snap.docs) {
    const data = doc.data() || {};
    const games = Array.isArray(data.games) ? [...data.games] : [];
    const bundleId = doc.id;

    if (games.length <= TP_BUNDLE_MAX_GAMES) {
      results.push({ bundleId, skipped: true, reason: "already-at-or-below-max", gameCount: games.length });
      continue;
    }

    const sorted = games.sort((a, b) => (a.slot || 0) - (b.slot || 0));
    const toRemove = sorted.slice(TP_BUNDLE_MAX_GAMES);
    const kept = sorted.slice(0, TP_BUNDLE_MAX_GAMES);

    const blockedByPicks = [];
    for (const slot of toRemove) {
      const picked = await bundleHasPickOnGame(bundleId, slot.gameId);
      if (picked) blockedByPicks.push(String(slot.gameId));
    }

    if (blockedByPicks.length) {
      results.push({
        bundleId,
        groupId: data.groupId || null,
        skipped: true,
        reason: "picks-on-removed-slots",
        blockedGameIds: blockedByPicks,
        gameCount: games.length,
      });
      continue;
    }

    const nextGames = kept.map((g, idx) => ({ ...g, slot: idx + 1 }));
    const patch = {
      games: nextGames,
      gameCount: nextGames.length,
      status: computeBundleStatus(nextGames),
      updatedAt: FieldValue.serverTimestamp(),
      tpTrimmedToTwoGamesAt: FieldValue.serverTimestamp(),
    };

    if (!dryRun) {
      await doc.ref.set(patch, { merge: true });
    }

    results.push({
      bundleId,
      groupId: data.groupId || null,
      applied: !dryRun,
      dryRun,
      before: games.length,
      after: nextGames.length,
      removedGameIds: toRemove.map((g) => g.gameId),
    });
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        gameYmd,
        maxGames: TP_BUNDLE_MAX_GAMES,
        dryRun,
        count: results.length,
        results,
      },
      null,
      2
    )
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
