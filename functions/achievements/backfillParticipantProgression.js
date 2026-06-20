/**
 * Backfill idempotent d'une participation manquante (stats / streak).
 */
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { db, FieldValue, logger } from "../utils.js";
import {
  ensureParticipantProgressionFields,
  participationDateToronto,
  recordParticipantProgression,
  STAT_KEYS,
  mergeParticipantStats,
} from "./achievementService.js";

const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

function sanitizeReasonKey(raw) {
  return String(raw || "")
    .trim()
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .slice(0, 180);
}

function backfillEventId(reasonKey) {
  return `progression_backfill_${sanitizeReasonKey(reasonKey)}`;
}

async function verifyFgcEntryIfRequested({ uid, challengeId }) {
  const cid = String(challengeId || "").trim();
  if (!cid) return { ok: true, skipped: true };

  const entrySnap = await db
    .collection("first_goal_challenges")
    .doc(cid)
    .collection("entries")
    .doc(String(uid))
    .get();

  if (!entrySnap.exists) {
    return { ok: false, reason: "fgc-entry-not-found", challengeId: cid };
  }

  const entry = entrySnap.data() || {};
  const createdAt = entry.createdAt?.toDate?.() || null;

  return {
    ok: true,
    challengeId: cid,
    playerId: entry.playerId || null,
    playerName: entry.playerName || null,
    entryCreatedAt: createdAt ? createdAt.toISOString() : null,
  };
}

export async function backfillParticipantProgressionForUid(
  uid,
  {
    reasonKey,
    participationDate = null,
    challengeType = "FGC",
    challengeId = null,
    dryRun = false,
  } = {}
) {
  const pk = String(uid || "").trim();
  const key = sanitizeReasonKey(reasonKey);
  const date =
    participationDate && YMD_RE.test(String(participationDate))
      ? String(participationDate)
      : participationDateToronto(new Date());

  if (!pk) return { ok: false, reason: "missing-uid" };
  if (!key) return { ok: false, reason: "missing-reasonKey" };

  const entryCheck = await verifyFgcEntryIfRequested({ uid: pk, challengeId });
  if (!entryCheck.ok) return entryCheck;

  const participantRef = db.doc(`participants/${pk}`);
  const eventRef = participantRef.collection("events").doc(backfillEventId(key));

  const existingEvent = await eventRef.get();
  if (existingEvent.exists) {
    const participantSnap = await participantRef.get();
    const stats = mergeParticipantStats(participantSnap.data()?.stats);

    return {
      ok: true,
      alreadyApplied: true,
      reasonKey: key,
      participationDate: existingEvent.data()?.participationDate || date,
      stats,
    };
  }

  if (dryRun) {
    const participantSnap = await participantRef.get();
    const stats = mergeParticipantStats(participantSnap.data()?.stats);

    return {
      ok: true,
      dryRun: true,
      reasonKey: key,
      participationDate: date,
      challengeType,
      challengeId: challengeId || null,
      entryCheck,
      statsBefore: stats,
    };
  }

  await ensureParticipantProgressionFields(pk);

  const result = await recordParticipantProgression(pk, {
    challengeType,
    countParticipation: true,
    participationDate: date,
  });

  if (!result?.ok) {
    return {
      ok: false,
      reason: result?.reason || "progression-update-failed",
      result,
    };
  }

  await eventRef.set({
    type: "progression_backfilled",
    reasonKey: key,
    participationDate: date,
    challengeType: challengeType || null,
    challengeId: challengeId || null,
    entryCreatedAt: entryCheck.entryCreatedAt || null,
    statsAfter: result.stats || null,
    createdAt: FieldValue.serverTimestamp(),
    read: false,
  });

  logger.info("[achievements] progression backfilled", {
    uid: pk,
    reasonKey: key,
    participationDate: date,
    challengeType,
    challengeId: challengeId || null,
    currentStreak: result.stats?.[STAT_KEYS.CURRENT_STREAK],
    totalParticipations: result.stats?.[STAT_KEYS.TOTAL_PARTICIPATIONS],
    newlyUnlocked: result.newlyUnlocked || [],
  });

  return {
    ok: true,
    alreadyApplied: false,
    reasonKey: key,
    participationDate: date,
    stats: result.stats,
    newlyUnlocked: result.newlyUnlocked || [],
    entryCheck,
  };
}

export const backfillParticipantProgression = onCall(
  { region: "us-central1", timeoutSeconds: 60 },
  async (req) => {
    if (!req.auth?.uid) {
      throw new HttpsError("unauthenticated", "Auth requise.");
    }

    const uid = String(req.auth.uid);
    const data = req.data || {};

    const reasonKey =
      sanitizeReasonKey(data.reasonKey) ||
      (data.challengeId ? sanitizeReasonKey(`fgc_${data.challengeId}`) : "");

    if (!reasonKey) {
      throw new HttpsError(
        "invalid-argument",
        "reasonKey ou challengeId requis."
      );
    }

    try {
      return await backfillParticipantProgressionForUid(uid, {
        reasonKey,
        participationDate: data.participationDate || null,
        challengeType: data.challengeType || "FGC",
        challengeId: data.challengeId || null,
        dryRun: data.dryRun === true,
      });
    } catch (e) {
      logger.error("[backfillParticipantProgression] failed", {
        uid,
        reasonKey,
        err: String(e?.message || e),
      });
      throw new HttpsError("internal", String(e?.message || e));
    }
  }
);
