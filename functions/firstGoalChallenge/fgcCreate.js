// functions/firstGoalChallenge/fgcCreate.js
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { logger } from "firebase-functions";

import { APP_TZ, toYmdInTz } from "../ProphetikDate.js";

if (!getApps().length) initializeApp();
const db = getFirestore();

const EXPIRES_HOURS = 48;

function str(v) {
  return String(v ?? "").trim();
}

function safeAbbr(v) {
  return String(v || "").trim().toUpperCase();
}

function toDateSafe(v) {
  if (!v) return null;
  if (v?.toDate && typeof v.toDate === "function") return v.toDate(); // Timestamp
  if (v instanceof Date) return v;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function addHours(date, hours) {
  const d = new Date(date);
  d.setHours(d.getHours() + hours);
  return d;
}

async function assertGroupOwnerOrThrow(tx, groupId, uid) {
  const gRef = db.doc(`groups/${groupId}`);
  const gSnap = await tx.get(gRef);
  if (!gSnap.exists) throw new HttpsError("not-found", "Groupe introuvable.");

  const g = gSnap.data() || {};
  const ownerId = str(g.ownerId || g.createdBy || "");
  const createdBy = str(g.createdBy || "");

  if (uid !== ownerId && uid !== createdBy) {
    throw new HttpsError("permission-denied", "Seul le propriétaire du groupe peut créer ce défi.");
  }

  return { g };
}

/**
 * fgcCreate
 * data:
 * {
 *   groupId: string,
 *   league?: "NHL",
 *   gameId: string,
 *   gameStartTimeUTC: Timestamp|Date|string,
 *   homeAbbr: string,
 *   awayAbbr: string,
 *   // optionnels
 *   expiresHours?: number (default 48)
 * }
 */
export const fgcCreate = onCall(
  { region: "us-central1" },
  async (req) => {
    if (!req.auth?.uid) throw new HttpsError("unauthenticated", "Auth requise.");
    const uid = str(req.auth.uid);

    const data = req.data || {};
    const groupId = str(data.groupId);
    const league = str(data.league || "NHL") || "NHL";

    const gameId = str(data.gameId);
    const homeAbbr = safeAbbr(data.homeAbbr);
    const awayAbbr = safeAbbr(data.awayAbbr);

    const start = toDateSafe(data.gameStartTimeUTC);

    if (!groupId) throw new HttpsError("invalid-argument", "groupId requis.");
    if (!gameId) throw new HttpsError("invalid-argument", "gameId requis.");
    if (!homeAbbr || homeAbbr.length < 2) throw new HttpsError("invalid-argument", "homeAbbr invalide.");
    if (!awayAbbr || awayAbbr.length < 2) throw new HttpsError("invalid-argument", "awayAbbr invalide.");
    if (!start) throw new HttpsError("invalid-argument", "gameStartTimeUTC requis/invalide.");

    const gameYmd = toYmdInTz(start, APP_TZ);

    const expiresHours = Number(data.expiresHours ?? EXPIRES_HOURS);
    const safeExpiresHours = Number.isFinite(expiresHours) && expiresHours > 0 ? expiresHours : EXPIRES_HOURS;

    // ✅ ID déterministe => idempotence & anti-doublon
    const challengeId = `fgc_${groupId}_${gameId}`;
    const chRef = db.collection("first_goal_challenges").doc(challengeId);

    try {
      const out = await db.runTransaction(async (tx) => {
        // ✅ permission (owner)
        await assertGroupOwnerOrThrow(tx, groupId, uid);

        const chSnap = await tx.get(chRef);
        if (chSnap.exists) {
          const existing = chSnap.data() || {};
          return { ok: true, challengeId, alreadyExisted: true, status: existing.status || null };
        }

        const createdAt = new Date();
        const expiresAt = addHours(createdAt, safeExpiresHours);

        tx.set(chRef, {
          type: "first_goal",
          league,

          groupId,
          gameId,
          gameYmd,

          homeAbbr,
          awayAbbr,
          gameStartTimeUTC: start,

          status: "open",

          participantsCount: 0,
          winnersCount: 0,
          winnersPreviewUids: [],

          // firstGoal: (absent au départ)
          // decidedAt / lockedAt / resultMessage: (absent au départ)

          createdBy: uid,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
          expiresAt, // Date OK: admin SDK va le convertir
        });

        return { ok: true, challengeId, alreadyExisted: false, status: "open" };
      });

      return out;
    } catch (e) {
      logger.warn("[fgcCreate] failed", {
        groupId,
        gameId,
        uid,
        err: String(e?.message || e),
      });

      if (e?.code && typeof e.code === "string") throw e;
      throw new HttpsError("internal", String(e?.message || e));
    }
  }
);