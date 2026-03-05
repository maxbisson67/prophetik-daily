// functions/finalize.js
import { onSchedule } from "firebase-functions/v2/scheduler";
import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import crypto from "crypto";

// 🔁 Ingest (pré-sync avant finalisation)
import { runIngestStatsForDate } from "./ingest.js";

// 🔁 Date/fuseau centralisés
import { APP_TZ, appYmd, addDaysToYmd, formatDebug } from "./ProphetikDate.js";

/* ------------------------- Admin init ------------------------- */
if (getApps().length === 0) initializeApp();
const db = getFirestore();

/* --------------------------- Config -------------------------- */
const PAYOUT_APPLIED_VERSION = "v7_ascension_cycles_members_2026-01-14";
const CATCHUP_DAYS = 14;

const CURRENT_SEASON_DOC = "app_config/currentSeason";
const FALLBACK_SEASON_ID = "20252026";

/* --------------------------- Helpers -------------------------- */
function splitEven(total, n) {
  if (n <= 0 || !(total > 0)) return Array.from({ length: Math.max(0, n) }, () => 0);
  const base = Math.floor(total / n);
  let r = total - base * n;
  return Array.from({ length: n }, (_, i) => (i < r ? base + 1 : base));
}

function numOrNull(v) {
  if (typeof v === "number") return v;
  if (typeof v === "string" && v.trim() !== "" && !isNaN(Number(v))) return Number(v);
  return null;
}

/** Bonus déterministe basé sur defiId */
function pickDeterministicFromValues(defiId, values = []) {
  const arr = Array.isArray(values)
    ? values.filter((x) => Number.isFinite(Number(x))).map((x) => Number(x))
    : [];
  if (!arr.length) return 0;

  const hex = crypto.createHash("sha256").update(String(defiId)).digest("hex");
  const n = parseInt(hex.slice(0, 8), 16);
  const idx = n % arr.length;
  return Number(arr[idx]) || 0;
}

function computeBonusPerWinner(defiId, defiDoc) {
  const br = defiDoc?.bonusReward;
  if (!br || typeof br !== "object") return 0;

  const type = String(br.type || "").toLowerCase();
  if (type !== "random") return 0;

  const values = br.values || [6, 7];
  const bonus = pickDeterministicFromValues(defiId, values);
  return bonus > 0 ? bonus : 0;
}

function normalizeUidArray(v) {
  const arr = Array.isArray(v) ? v : [];
  return arr.map((x) => String(x || "").trim()).filter(Boolean);
}

function normalizeWinnerSharesMap(v) {
  if (!v || typeof v !== "object") return {};
  const out = {};
  for (const [k, val] of Object.entries(v)) {
    const uid = String(k || "").trim();
    const n = Number(val);
    if (!uid) continue;
    if (!Number.isFinite(n) || n < 0) continue;
    out[uid] = n;
  }
  return out;
}

// ✅ seasonId courant (best effort)
async function getSeasonIdSafe() {
  try {
    const snap = await db.doc(CURRENT_SEASON_DOC).get();
    if (!snap.exists) return FALLBACK_SEASON_ID;
    const d = snap.data() || {};
    return String(d.seasonId || FALLBACK_SEASON_ID);
  } catch (e) {
    logger.warn("finalizeDefiWinners: cannot read currentSeason, fallback", String(e?.message || e));
    return FALLBACK_SEASON_ID;
  }
}

function readWinsByTypeSafe(obj) {
  return obj && typeof obj === "object" ? obj : {};
}

function readNumberSafe(v, def = 0) {
  const n = numOrNull(v);
  return Number.isFinite(n) ? n : def;
}

function ensureTypeKey(typeVal) {
  const t = Number(typeVal || 0);
  if (!Number.isFinite(t) || t <= 0) return "0";
  return String(t);
}

// ✅ Détecte Nova/AI (doc id "ai" OU champ uid/type = ai)
function isNovaParticipation(uid, data) {
  const id = String(uid || "").toLowerCase();
  const t = String(data?.type || "").toLowerCase();
  const duid = String(data?.uid || "").toLowerCase();
  return id === "ai" || duid === "ai" || t === "ai";
}

// ---- Ascension helpers ----
function stepsTotalForAscKey(ascKey) {
  return String(ascKey).toUpperCase() === "ASC7" ? 7 : 4;
}

/**
 * ✅ Migration + count:
 * - si ancien boolean true => 1
 * - si number => clamp >=0
 */
function toCount(v) {
  if (v === true) return 1;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/**
 * ✅ Completed si chaque step 1..stepsTotal a un count >= 1
 */
function allStepsCompletedCount(winsByType = {}, stepsTotal = 4) {
  for (let i = 1; i <= stepsTotal; i++) {
    if (toCount(winsByType[String(i)]) < 1) return false;
  }
  return true;
}

function cycleRefFor(groupId, cycleId) {
  return db.doc(`groups/${String(groupId)}/ascension_cycles/${String(cycleId)}`);
}

function cycleMemberRefFor(groupId, cycleId, uid) {
  return db.doc(
    `groups/${String(groupId)}/ascension_cycles/${String(cycleId)}/members/${String(uid)}`
  );
}

/* -------------------- FINALIZATION (daily 5AM) ----------------- */
export const finalizeDefiWinners = onSchedule(
  {
    schedule: "0 5 * * *",
    timeZone: APP_TZ,
    region: "us-central1",
  },
  async () => {
    const now = new Date();
    const seasonId = await getSeasonIdSafe();

    // 0) Pré-sync livePoints (best effort)
    try {
      logger.info("finalizeDefiWinners: running runIngestStatsForDate() before finalization");
      await runIngestStatsForDate();
      logger.info("finalizeDefiWinners: ingest done");
    } catch (e) {
      logger.error("finalizeDefiWinners: runIngestStatsForDate failed, using last known livePoints", {
        error: String(e?.message || e),
      });
    }

    const todayYmd = appYmd(now);
    const yYMD = addDaysToYmd(todayYmd, -1);
    const catchupFromYmd = addDaysToYmd(todayYmd, -CATCHUP_DAYS);

    logger.info(
      `finalizeDefiWinners@5AM: nowUTC=${formatDebug(now, "UTC")} todayApp=${todayYmd} target<=${yYMD} catchupFrom=${catchupFromYmd} seasonId=${seasonId}`
    );

    // 1) Candidats
    let snap;
    try {
      snap = await db
        .collection("defis")
        .where("gameDate", ">=", catchupFromYmd)
        .where("gameDate", "<=", yYMD)
        .where("status", "in", ["open", "live", "awaiting_result", "completed"])
        .get();
    } catch (e) {
      logger.warn("finalizeDefiWinners: primary query failed, fallback status scan", String(e));
      snap = null;
    }

    let candidates = [];
    let reason = "primary";
    if (snap && !snap.empty) {
      candidates = snap.docs;
      logger.info(`finalizeDefiWinners: candidates=${snap.size} (primary)`);
    } else {
      reason = "fallback-status-scan";
      const stSnap = await db
        .collection("defis")
        .where("status", "in", ["open", "live", "awaiting_result", "completed"])
        .get();

      const filtered = [];
      stSnap.forEach((d) => {
        const val = d.data() || {};
        const gd = typeof val.gameDate === "string" ? val.gameDate.slice(0, 10) : null;
        if (!gd) return;
        if (gd >= catchupFromYmd && gd <= yYMD) filtered.push(d);
      });

      candidates = filtered;
      logger.info(`finalizeDefiWinners: candidates=${filtered.length} (${reason})`);
    }

    if (!candidates.length) {
      logger.info("finalizeDefiWinners: none", { reason });
      return;
    }

    let processed = 0;
    let payoutApplied = 0;
    let finalizedNow = 0;
    let skippedAlreadyApplied = 0;
    let cancelledNoParticipants = 0;
    let cancelledNoHumans = 0;

    for (const docSnap of candidates) {
      const defiId = docSnap.id;
      const d = docSnap.data() || {};
      const bonusPerWinner = computeBonusPerWinner(defiId, d);

      // Participations (hors transaction)
      const partsSnap = await docSnap.ref.collection("participations").get();

      const partsAll = partsSnap.docs.map((s) => {
        const v = s.data() || {};
        return {
          uid: s.id,
          livePoints: Number(v.livePoints ?? v.finalPoints ?? 0),
          isAi: isNovaParticipation(s.id, v),
        };
      });

      const humanParts = partsAll.filter((p) => !p.isAi);

      const eligibleParts = partsAll; // humains + Nova

      const txResult = await db.runTransaction(async (tx) => {
        const dRef = db.collection("defis").doc(defiId);

        // ✅ READ #1
        const fresh = await tx.get(dRef);
        if (!fresh.exists) return { applied: false, finalized: false, skipped: true };

        const cur = fresh.data() || {};
        const groupId = String(cur.groupId || "");
        if (!groupId) {
          tx.set(
            dRef,
            { finalizeError: "missing_groupId_for_leaderboard", updatedAt: FieldValue.serverTimestamp() },
            { merge: true }
          );
          return { applied: false, finalized: false, skipped: true };
        }

        // ✅ Idempotence
        if (cur.payoutAppliedAt) {
          return { applied: false, finalized: false, skippedAlreadyApplied: true, groupId };
        }

        const alreadyCompleted = String(cur.status || "").toLowerCase() === "completed";
        const alreadyCancelled = String(cur.status || "").toLowerCase() === "cancelled";

        // --- CAS: aucun participant
        if (!partsAll.length) {
          const originalPot = Number(cur.pot ?? 0);

          tx.set(
            dRef,
            {
              status: "cancelled",
              cancelReason: "NO_PARTICIPANTS",
              winners: [],
              winnerShares: {},
              cancelledAt: FieldValue.serverTimestamp(),
              cancelledPotOriginal: originalPot,
              pot: 0,
              payoutAppliedAt: FieldValue.serverTimestamp(),
              payoutAppliedTo: null,
              payoutAppliedVersion: PAYOUT_APPLIED_VERSION,
              updatedAt: FieldValue.serverTimestamp(),
            },
            { merge: true }
          );

          return {
            applied: true,
            finalized: !alreadyCompleted && !alreadyCancelled,
            cancelled: "NO_PARTICIPANTS",
            groupId,
          };
        }

        // --- CAS: Nova seule
        if (!humanParts.length) {
          const originalPot = Number(cur.pot ?? 0);

          tx.set(
            dRef,
            {
              status: "cancelled",
              cancelReason: "NO_HUMANS",
              winners: [],
              winnerShares: {},
              cancelledAt: FieldValue.serverTimestamp(),
              cancelledPotOriginal: originalPot,
              pot: 0,
              payoutAppliedAt: FieldValue.serverTimestamp(),
              payoutAppliedTo: null,
              payoutAppliedVersion: PAYOUT_APPLIED_VERSION,
              updatedAt: FieldValue.serverTimestamp(),
            },
            { merge: true }
          );

          tx.set(
            dRef.collection("participations").doc("ai"),
            {
              payout: 0,
              finalizedAt: FieldValue.serverTimestamp(),
              cancelled: true,
            },
            { merge: true }
          );

          return {
            applied: true,
            finalized: !alreadyCompleted && !alreadyCancelled,
            cancelled: "NO_HUMANS",
            groupId,
          };
        }

        // --- Winners + shares (réutilise si déjà présent) ---
        const existingWinners = normalizeUidArray(cur.winners);
        const existingShares = normalizeWinnerSharesMap(cur.winnerShares);

        let winners = existingWinners;
        let winnerShares = existingShares;

        const pot = Number(cur.pot ?? 0);

        if (!winners.length || Object.keys(winnerShares).length === 0) {
          const top = eligibleParts.reduce((m, p) => Math.max(m, p.livePoints), -Infinity);
          winners = eligibleParts.filter((p) => p.livePoints === top).map((p) => p.uid);

          const shares = splitEven(pot, Math.max(1, winners.length));
          winnerShares = {};
          winners.forEach((uid, i) => {
            winnerShares[uid] = shares[i] || 0;
          });
        }

        // ✅ IMPORTANT: toutes les READS AVANT toute WRITE
        const typeKey = ensureTypeKey(cur.type);

        // leaderboards
        const lbMemberRefs = eligibleParts.map((p) =>
          db
            .collection("groups")
            .doc(groupId)
            .collection("leaderboards")
            .doc(String(seasonId))
            .collection("members")
            .doc(String(p.uid))
        );

        const lbMemberSnaps = await Promise.all(lbMemberRefs.map((ref) => tx.get(ref)));
        const prevByUid = {};
        lbMemberSnaps.forEach((s, idx) => {
          const uid = String(eligibleParts[idx]?.uid);
          prevByUid[uid] = s.exists ? (s.data() || {}) : {};
        });

        // ✅ Ascension progress reads (cycle doc + member docs) AVANT writes
        const ascKey = cur?.ascension?.key ? String(cur.ascension.key).toUpperCase() : null;
        const ascStepType = Number(cur?.ascension?.stepType || cur.type || 0);
        const isAscensionDefi = !!ascKey && (ascKey === "ASC4" || ascKey === "ASC7") && ascStepType > 0;

        let ascRef = null;
        let ascSnap = null;
        let ascState = null;

        let cycleId = null;
        let cycRef = null;
        let cycSnap = null;
        let cycState = null;

        let cycMemberRefs = [];
        let cycMemberSnaps = [];

        if (isAscensionDefi) {
          // état courant (compat)
          ascRef = db.doc(`groups/${groupId}/ascensions/${ascKey}`);
          ascSnap = await tx.get(ascRef);
          ascState = ascSnap.exists ? (ascSnap.data() || {}) : {};

          // ✅ cycleId prioritaire: défi -> ascension state
          cycleId = String(cur?.ascension?.cycleId || "") || String(ascState?.activeCycleId || ascState?.cycleId || "");
          cycleId = cycleId ? cycleId.trim() : "";

          if (cycleId) {
            cycRef = cycleRefFor(groupId, cycleId);
            cycSnap = await tx.get(cycRef);
            cycState = cycSnap.exists ? (cycSnap.data() || {}) : {};

            // On ne met à jour la progression que pour les winners
            cycMemberRefs = winners.map((uid) => cycleMemberRefFor(groupId, cycleId, uid));
            cycMemberSnaps = await Promise.all(cycMemberRefs.map((r) => tx.get(r)));
          }
        }

        // --- ✅ WRITES seulement à partir d'ici ---

        // 1) Défi
        tx.set(
          dRef,
          {
            status: "completed",
            winners,
            winnerShares,
            completedAt: cur.completedAt || FieldValue.serverTimestamp(),
            payoutAppliedAt: FieldValue.serverTimestamp(),
            payoutAppliedTo: `groups/{groupId}/leaderboards/{seasonId}/members`,
            payoutAppliedVersion: PAYOUT_APPLIED_VERSION,
            ...(bonusPerWinner > 0
              ? {
                  bonusPerWinner,
                  bonusReward: cur.bonusReward || { type: "random", values: [6, 7] },
                }
              : {}),
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );

        // 2) Participations humains
        for (const p of eligibleParts) {
          const payout = winners.includes(p.uid) ? Number(winnerShares[p.uid] || 0) : 0;
          tx.set(
            dRef.collection("participations").doc(p.uid),
            {
              finalPoints: p.livePoints,
              payout,
              ...(bonusPerWinner > 0 && winners.includes(p.uid) ? { bonus: bonusPerWinner } : {}),
              finalizedAt: FieldValue.serverTimestamp(),
            },
            { merge: true }
          );
        }

        // Nova finalize
        const aiPart = partsAll.find((x) => String(x.uid).toLowerCase() === "ai");
        if (aiPart) {
          const aiUid = aiPart.uid;
          const aiIsWinner = winners.includes(aiUid);
          const aiPayout = aiIsWinner ? Number(winnerShares[aiUid] || 0) : 0;

          tx.set(
            dRef.collection("participations").doc(aiUid),
            {
              finalPoints: aiPart.livePoints,
              payout: aiPayout,
              ...(bonusPerWinner > 0 && aiIsWinner ? { bonus: bonusPerWinner } : {}),
              finalizedAt: FieldValue.serverTimestamp(),
            },
            { merge: true }
          );
        }

        // 3) Leaderboard season members
        for (const p of eligibleParts) {
          const uid = String(p.uid);
          const isWinner = winners.includes(uid);

          const shareAmount = isWinner ? Number(winnerShares[uid] || 0) : 0;
          const bonusAmount = isWinner ? Number(bonusPerWinner || 0) : 0;
          const addPoints = (shareAmount > 0 ? shareAmount : 0) + (bonusAmount > 0 ? bonusAmount : 0);

          const memberRef = db
            .collection("groups")
            .doc(groupId)
            .collection("leaderboards")
            .doc(String(seasonId))
            .collection("members")
            .doc(uid);

          const prev = prevByUid[uid] || {};

          const prevPlays = readNumberSafe(prev.participations ?? prev.plays, 0);
          const prevWins = readNumberSafe(prev.wins, 0);
          const prevPointsTotal = readNumberSafe(prev.pointsTotal, 0);

          const nextPlays = prevPlays + 1;
          const nextWins = prevWins + (isWinner ? 1 : 0);
          const nextPointsTotal = prevPointsTotal + (addPoints > 0 ? addPoints : 0);
          const nextWinRate = nextPlays > 0 ? nextWins / nextPlays : 0;

          const winsByType = readWinsByTypeSafe(prev.winsByType);
          const prevType = readWinsByTypeSafe(winsByType[typeKey]);

          const prevTypePlays = readNumberSafe(prevType.plays, 0);
          const prevTypeWins = readNumberSafe(prevType.wins, 0);
          const prevTypePoints = readNumberSafe(prevType.pointsTotal, 0);

          winsByType[typeKey] = {
            plays: prevTypePlays + 1,
            wins: prevTypeWins + (isWinner ? 1 : 0),
            pointsTotal: prevTypePoints + (addPoints > 0 ? addPoints : 0),
          };

          tx.set(
            memberRef,
            {
              uid,
              participations: nextPlays,
              pointsTotal: nextPointsTotal,
              wins: nextWins,
              winRate: nextWinRate,
              winsByType,
              updatedAt: FieldValue.serverTimestamp(),
              createdAt: prev.createdAt || FieldValue.serverTimestamp(),
            },
            { merge: true }
          );
        }

        // 3.5) ✅ Ascension progress (winners only) -> ascension_cycles/{cycleId}/members/{uid}
        // ✅ NOTE: ici on NE choisit PAS de gagnant de cycle. Juste progression + completed bool.
        if (isAscensionDefi && cycRef && cycleId) {
          const stepsTotal = stepsTotalForAscKey(ascKey);

          const prevCompletedWinners = Array.isArray(cycState?.completedWinners)
            ? cycState.completedWinners
            : [];
          const newlyCompleted = [];

          cycMemberSnaps.forEach((s, idx) => {
            const uid = winners[idx];
            const prev = s.exists ? (s.data() || {}) : {};
            const prevWinsByType =
              prev.winsByType && typeof prev.winsByType === "object" ? prev.winsByType : {};

            const stepKey = String(ascStepType);
            const prevCount = toCount(prevWinsByType[stepKey]);
            const nextWinsByType = { ...prevWinsByType, [stepKey]: prevCount + 1 };

            const completedNow = allStepsCompletedCount(nextWinsByType, stepsTotal);

            const memberRef = cycMemberRefs[idx];

            tx.set(
              memberRef,
              {
                uid,
                groupId,
                ascKey,
                cycleId,
                winsByType: nextWinsByType, // ✅ numbers
                completed: completedNow === true,
                // ❌ pas de completedAt (simplicité)
                updatedAt: FieldValue.serverTimestamp(),
                createdAt: prev.createdAt || FieldValue.serverTimestamp(),
              },
              { merge: true }
            );

            if (completedNow) newlyCompleted.push(uid);
          });

          // info utile pour UI (liste des complétés), sans décider du gagnant
          const merged = Array.from(new Set([...prevCompletedWinners, ...newlyCompleted])).filter(Boolean);

          // ✅ cycle summary: reste "active", finalizeAscensionCycleWinners décidera ensuite
          tx.set(
            cycRef,
            {
              status: "active",
              stepsTotal,
              completedWinners: merged,
              completedCount: merged.length,
              updatedAt: FieldValue.serverTimestamp(),
              lastFinalizeAt: FieldValue.serverTimestamp(),
              lastFinalizeDefiId: defiId,
              lastFinalizeStepType: ascStepType,
            },
            { merge: true }
          );

          // ✅ compat: doc courant ascensions/{ascKey}
          if (ascRef) {
            tx.set(
              ascRef,
              {
                enabled: true,
                stepsTotal,
                activeCycleId: cycleId,
                cycleId: ascState?.cycleId || cycleId,
                completedWinners: merged,
                updatedAt: FieldValue.serverTimestamp(),
                lastFinalizeAt: FieldValue.serverTimestamp(),
                lastFinalizeDefiId: defiId,
                lastFinalizeStepType: ascStepType,
              },
              { merge: true }
            );
          }
        }

        // 4) Dirty flag group
        tx.set(
          db.collection("groups").doc(groupId),
          {
            leaderboardSeasonDirty: true,
            leaderboardSeasonDirtyAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );

        return { applied: true, finalized: !alreadyCompleted, groupId };
      });

      processed++;
      if (txResult?.skippedAlreadyApplied) skippedAlreadyApplied++;
      if (txResult?.applied) payoutApplied++;
      if (txResult?.finalized) finalizedNow++;
      if (txResult?.cancelled === "NO_PARTICIPANTS") cancelledNoParticipants++;
      if (txResult?.cancelled === "NO_HUMANS") cancelledNoHumans++;
    }

    logger.info("finalizeDefiWinners: done", {
      processed,
      payoutApplied,
      finalizedNow,
      skippedAlreadyApplied,
      cancelledNoParticipants,
      cancelledNoHumans,
      reason,
      version: PAYOUT_APPLIED_VERSION,
      catchupDays: CATCHUP_DAYS,
      seasonId,
    });
  }
);