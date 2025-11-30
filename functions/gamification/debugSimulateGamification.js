// functions/gamification/debugSimulateGamification.js
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import * as logger from "firebase-functions/logger";
import { awardCredit } from "./utils.js";

const db = getFirestore();

/**
 * Petit helper : trouve un groupId pour l'utilisateur
 * - membership
 * - ou groupe qu'il a créé / dont il est owner
 */
async function pickAnyGroupIdForUser(uid) {
  if (!uid) return null;

  // 1) memberships
  const gmSnap = await db
    .collection("group_memberships")
    .where("uid", "==", uid)
    .limit(1)
    .get();

  if (!gmSnap.empty) {
    const doc = gmSnap.docs[0].data();
    if (doc.groupId) return doc.groupId;
  }

  // 2) participantId => uid (au cas où)
  const gmSnap2 = await db
    .collection("group_memberships")
    .where("participantId", "==", uid)
    .limit(1)
    .get();

  if (!gmSnap2.empty) {
    const doc = gmSnap2.docs[0].data();
    if (doc.groupId) return doc.groupId;
  }

  // 3) groups.createdBy
  const g1 = await db
    .collection("groups")
    .where("createdBy", "==", uid)
    .limit(1)
    .get();
  if (!g1.empty) return g1.docs[0].id;

  // 4) groups.ownerId
  const g2 = await db
    .collection("groups")
    .where("ownerId", "==", uid)
    .limit(1)
    .get();
  if (!g2.empty) return g2.docs[0].id;

  return null;
}

/**
 * Burst de participations "debug" pour faire travailler onParticipationCreated
 * Les docs créés sont dans:
 *   groups/{groupId}/defis/{defiId}/participations/{uid}
 */
async function createDebugParticipationBurst(uid, groupId, n, label) {
  if (!uid || !groupId || !n || n <= 0) return;

  logger.info("Simulate participation burst", {
    uid,
    groupId,
    n,
    type: label,
  });

  const batch = db.batch();
  const now = Date.now();

  for (let i = 0; i < n; i++) {
    const defiId = `debug-${label}-${now}-${i}`;
    const partiRef = db
      .collection("groups")
      .doc(groupId)
      .collection("defis")
      .doc(defiId)
      .collection("participations")
      .doc(uid);

    batch.set(partiRef, {
      createdAt: FieldValue.serverTimestamp(),
      debug: true,
      source: label,
      uid,
      groupId,
      defiId,
    });
  }

  await batch.commit();
}

/**
 * Simule un "pas de jour" pour le défi 3 jours consécutifs, sans dépendre du vrai calendrier.
 *
 * - Incrémente stats.totalParticipations
 * - Incrémente stats.currentStreakDays
 * - Met à jour maxStreakDays, lastParticipationDay
 * - Met achievements.threeConsecutiveDays à true lorsqu'on atteint >= 3
 * - Donne +1 crédit à chaque fois que currentStreakDays est un multiple de 3
 */
async function simulateThreeDaysStep(uid, groupId) {
  const participantRef = db.collection("participants").doc(uid);

  let newTotal = 0;
  let currentStreak = 0;
  let maxStreak = 0;

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(participantRef);
    if (!snap.exists) {
      throw new Error("participant not found");
    }

    const data = snap.data() || {};
    const stats = data.stats || {};
    const achievements = data.achievements || {};

    const prevTotal = Number(stats.totalParticipations || 0);
    newTotal = prevTotal + 1;

    const prevStreak = Number(stats.currentStreakDays || 0);
    currentStreak = prevStreak + 1;

    maxStreak = Math.max(Number(stats.maxStreakDays || 0), currentStreak);

    const today = new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"

    const nextStats = {
      ...stats,
      totalParticipations: newTotal,
      currentStreakDays: currentStreak,
      maxStreakDays: maxStreak,
      lastParticipationDay: today,
    };

    const nextAchievements = { ...achievements };
    if (!achievements.threeConsecutiveDays && currentStreak >= 3) {
      nextAchievements.threeConsecutiveDays = true;
    }

    tx.set(
      participantRef,
      {
        stats: nextStats,
        achievements: nextAchievements,
      },
      { merge: true }
    );
  });

  let credited = 0;

  // Même logique que onParticipationCreated:
  // chaque multiple de 3 jours consécutifs → +1 crédit
  if (currentStreak > 0 && currentStreak % 3 === 0) {
    await awardCredit(uid, 1, {
      reason: "three_consecutive_days",
      meta: {
        groupId,
        ref: { type: "debug_three_days_step" },
      },
      idempotencyKey: `three_consecutive_days_debug:${groupId || "nogroup"}:${newTotal}:${uid}`,
    });
    credited = 1;
  }

  logger.info("[debugSimulateGamification] THREE_DAYS_STEP", {
    uid,
    groupId,
    newTotal,
    currentStreak,
    maxStreak,
    credited,
  });

  return { newTotal, currentStreak, maxStreak, credited };
}

/**
 * Callable de debug
 *
 * data:
 *  - eventId | type : "PARTICIPATION" | "JUST_HIT_THREE" | "JUST_HIT_FIVE"
 *                      "THREE_DAYS_STEP" | "FIRST_DEFI_CREATED" | "FIRST_GROUP_CREATED"
 *  - groupId? : optionnel, sinon on essaie de le déduire
 */
export const debugSimulateGamification = onCall(async (request) => {
  const { eventId, type, groupId: groupIdRaw } = request.data || {};
  const uid = request.auth?.uid;

  if (!uid) {
    throw new HttpsError("unauthenticated", "You must be authenticated");
  }

  const kind = type || eventId;
  if (!kind) {
    throw new HttpsError("invalid-argument", "Missing eventId/type");
  }

  // Pour certains events, on a besoin d'un groupId
  let groupId = groupIdRaw || null;
  if (!groupId && kind !== "FIRST_GROUP_CREATED") {
    groupId = await pickAnyGroupIdForUser(uid);
  }

  logger.info("debugSimulateGamification called", {
    uid,
    groupId,
    type: kind,
  });

  // ROUTAGE DES EVENTS
  if (kind === "PARTICIPATION") {
    if (!groupId) {
      throw new HttpsError(
        "failed-precondition",
        "No groupId available for PARTICIPATION"
      );
    }
    await createDebugParticipationBurst(uid, groupId, 1, "participation");
    return { ok: true, type: kind, n: 1, groupId };
  }

  if (kind === "JUST_HIT_THREE") {
    if (!groupId) {
      throw new HttpsError(
        "failed-precondition",
        "No groupId available for JUST_HIT_THREE"
      );
    }
    await createDebugParticipationBurst(uid, groupId, 3, "just_hit_three");
    return { ok: true, type: kind, n: 3, groupId };
  }

  if (kind === "JUST_HIT_FIVE") {
    if (!groupId) {
      throw new HttpsError(
        "failed-precondition",
        "No groupId available for JUST_HIT_FIVE"
      );
    }
    await createDebugParticipationBurst(uid, groupId, 5, "just_hit_five");
    return { ok: true, type: kind, n: 5, groupId };
  }

  // 🔥 NOUVEL EVENT : simuler un jour consécutif pour le streak
  if (kind === "THREE_DAYS_STEP") {
    // groupId utile surtout pour les métadonnées du credit (meta.groupId),
    // mais pas strictement requis — on laisse possible que groupId soit null
    const res = await simulateThreeDaysStep(uid, groupId || null);
    return { ok: true, type: kind, groupId: groupId || null, ...res };
  }

  // Premier défi créé → on crée un "vrai" défi pour laisser onDefiCreated faire le travail
  if (kind === "FIRST_DEFI_CREATED") {
    if (!groupId) {
      throw new HttpsError(
        "failed-precondition",
        "No groupId available for FIRST_DEFI_CREATED"
      );
    }

    const now = Date.now();
    const defiRef = db.collection("defis").doc();
    await defiRef.set({
      groupId,
      createdBy: uid,
      type: 1,
      gameDate: new Date().toISOString().slice(0, 10),
      status: "open",
      title: `Debug Defi ${now}`,
      createdAt: FieldValue.serverTimestamp(),
      debug: true,
    });

    logger.info("Debug FIRST_DEFI_CREATED created", {
      uid,
      groupId,
      defiId: defiRef.id,
    });

    return { ok: true, type: kind, groupId, defiId: defiRef.id };
  }

  // Premier groupe créé → on crée un vrai groupe pour laisser onGroupCreated faire le travail
  if (kind === "FIRST_GROUP_CREATED") {
    const gRef = db.collection("groups").doc();
    await gRef.set({
      name: "Debug Group",
      createdBy: uid,
      ownerId: uid,
      createdAt: FieldValue.serverTimestamp(),
      debug: true,
    });

    logger.info("Debug FIRST_GROUP_CREATED group created", {
      uid,
      groupId: gRef.id,
    });

    return { ok: true, type: kind, groupId: gRef.id };
  }

  // Event inconnu
  throw new HttpsError("invalid-argument", `Unknown eventId/type: ${kind}`);
});