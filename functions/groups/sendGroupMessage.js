import { onCall, HttpsError } from "firebase-functions/v2/https";
import { db, FieldValue, logger } from "../utils.js";

const MAX_TEXT_LENGTH = 1000;
const MIN_INTERVAL_MS = 2000;
const MAX_PER_MINUTE = 20;
const WINDOW_MS = 60 * 1000;

function isActiveMembership(m) {
  const status = String(m?.status || "active").toLowerCase();
  const active = m?.active === true || m?.active === undefined;
  return active && status === "active";
}

async function getMyMembership(groupId, uid) {
  const snap = await db
    .collection("group_memberships")
    .where("groupId", "==", String(groupId))
    .where("uid", "==", String(uid))
    .limit(1)
    .get();

  if (snap.empty) return null;
  return snap.docs[0].data() || {};
}

async function getSenderProfile(uid) {
  const pubSnap = await db.doc(`profiles_public/${uid}`).get();
  if (pubSnap.exists) {
    const d = pubSnap.data() || {};
    return {
      displayName: d.displayName || d.name || null,
      photoURL: d.photoURL || d.avatarUrl || null,
    };
  }

  const partSnap = await db.doc(`participants/${uid}`).get();
  if (partSnap.exists) {
    const d = partSnap.data() || {};
    return {
      displayName: d.name || null,
      photoURL: d.avatarUrl || null,
    };
  }

  return { displayName: null, photoURL: null };
}

async function enforceRateLimit(uid) {
  const ref = db.doc(`chat_rate_limits/${uid}`);
  const now = Date.now();

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.data() || {};

    const lastSent = data.lastSentAt?.toMillis?.() || 0;
    if (now - lastSent < MIN_INTERVAL_MS) {
      throw new HttpsError("resource-exhausted", "RATE_LIMIT_FAST");
    }

    let windowStartMs = data.windowStart?.toMillis?.() || 0;
    let count = Number(data.countInWindow) || 0;

    if (!windowStartMs || now - windowStartMs > WINDOW_MS) {
      windowStartMs = now;
      count = 0;
    }

    if (count >= MAX_PER_MINUTE) {
      throw new HttpsError("resource-exhausted", "RATE_LIMIT_MINUTE");
    }

    tx.set(
      ref,
      {
        lastSentAt: FieldValue.serverTimestamp(),
        windowStart:
          count === 0 && windowStartMs === now
            ? FieldValue.serverTimestamp()
            : data.windowStart || FieldValue.serverTimestamp(),
        countInWindow: count + 1,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  });
}

/**
 * Envoie un message dans le chat d'un groupe (membre actif seulement).
 * Rate limit: 1 msg / 2 s, max 20 / min.
 */
export const sendGroupMessage = onCall(
  {
    region: "us-central1",
    enforceAppCheck: false,
  },
  async (req) => {
    const uid = req.auth?.uid || null;
    if (!uid) throw new HttpsError("unauthenticated", "Authentification requise.");

    const groupId = req.data?.groupId;
    const text = String(req.data?.text || "").trim();

    if (!groupId || typeof groupId !== "string") {
      throw new HttpsError("invalid-argument", 'Paramètre "groupId" requis.');
    }
    if (!text) {
      throw new HttpsError("invalid-argument", "Message vide.");
    }
    if (text.length > MAX_TEXT_LENGTH) {
      throw new HttpsError("invalid-argument", "MESSAGE_TOO_LONG");
    }

    const membership = await getMyMembership(groupId, uid);
    if (!membership || !isActiveMembership(membership)) {
      throw new HttpsError("permission-denied", "Tu n'es pas membre actif de ce groupe.");
    }

    const groupSnap = await db.doc(`groups/${groupId}`).get();
    if (!groupSnap.exists) {
      throw new HttpsError("not-found", "Groupe introuvable.");
    }

    await enforceRateLimit(uid);

    const profile = await getSenderProfile(uid);
    const displayName =
      profile.displayName ||
      req.auth?.token?.name ||
      req.auth?.token?.email ||
      "Anonyme";

    const messageRef = db.collection(`groups/${groupId}/messages`).doc();
    const readRef = db.doc(`groups/${groupId}/reads/${uid}`);
    const now = FieldValue.serverTimestamp();

    await db.runTransaction(async (tx) => {
      tx.set(messageRef, {
        uid,
        text,
        type: "text",
        createdAt: now,
        groupId: String(groupId),
        displayName,
        photoURL: profile.photoURL || null,
      });

      tx.set(
        readRef,
        {
          lastSeenAt: now,
          lastOpenAt: now,
        },
        { merge: true }
      );
    });

    logger.info("[sendGroupMessage] sent", { groupId, uid, messageId: messageRef.id });

    return { ok: true, messageId: messageRef.id };
  }
);
