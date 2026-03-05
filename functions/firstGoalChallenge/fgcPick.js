// functions/firstGoalChallenge/fgcPick.js
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { logger } from "firebase-functions";

if (!getApps().length) initializeApp();
const db = getFirestore();

const CUT_OFF_MINUTES = 5;

function str(v) {
  return String(v ?? "").trim();
}

function safeAbbr(v) {
  return String(v || "").trim().toUpperCase();
}

function toDateSafe(v) {
  if (!v) return null;
  if (v?.toDate && typeof v.toDate === "function") return v.toDate(); // Firestore Timestamp
  if (v instanceof Date) return v;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function nowMs() {
  return Date.now();
}

function getDisplayIdentity(auth) {
  // Tu peux enrichir plus tard (avatar, etc.) en lisant participants/{uid}
  // Pour rester léger ici, on accepte ce que le client envoie aussi.
  return {
    uid: str(auth?.uid),
    // displayName et avatarUrl peuvent venir du client ou d’un doc participants
  };
}

/**
 * data attendu:
 * {
 *   challengeId: string,
 *   playerId: string,
 *   playerName?: string,
 *   teamAbbr?: string,
 *   positionCode?: string,
 *   headshotUrl?: string,
 *   displayName?: string,
 *   avatarUrl?: string
 * }
 */
export const fgcPick = onCall(
  { region: "us-central1" },
  async (req) => {
    const auth = req.auth;
    if (!auth?.uid) throw new HttpsError("unauthenticated", "Auth requise.");

    const uid = str(auth.uid);
    const data = req.data || {};

    const challengeId = str(data.challengeId);
    const playerId = str(data.playerId);

    if (!challengeId) throw new HttpsError("invalid-argument", "challengeId requis.");
    if (!playerId) throw new HttpsError("invalid-argument", "playerId requis.");

    const playerName = str(data.playerName) || null;
    const teamAbbr = data.teamAbbr ? safeAbbr(data.teamAbbr) : null;
    const positionCode = str(data.positionCode) || null;
    const headshotUrl = str(data.headshotUrl) || null;

    const clientDisplayName = str(data.displayName) || null;
    const clientAvatarUrl = str(data.avatarUrl) || null;

    const chRef = db.collection("first_goal_challenges").doc(challengeId);
    const entryRef = chRef.collection("entries").doc(uid);

    try {
      const res = await db.runTransaction(async (tx) => {
        const chSnap = await tx.get(chRef);
        if (!chSnap.exists) throw new HttpsError("not-found", "Challenge introuvable.");

        const ch = chSnap.data() || {};
        const st = String(ch.status || "").toLowerCase();

        // Ajuste si tu veux autoriser "open" seulement
        if (!["open", "locked"].includes(st)) {
          throw new HttpsError("failed-precondition", "Le défi est verrouillé.");
        }

        const start = toDateSafe(ch.gameStartTimeUTC);
        const startMs = start ? start.getTime() : null;
        if (!startMs) {
          throw new HttpsError("failed-precondition", "Heure de match inconnue (gameStartTimeUTC).");
        }

        const cutoffMs = startMs - CUT_OFF_MINUTES * 60 * 1000;
        const n = nowMs();

        if (n >= startMs) throw new HttpsError("failed-precondition", "Le match est commencé.");
        if (n >= cutoffMs) throw new HttpsError("failed-precondition", "Le choix est verrouillé (cutoff).");

        const entrySnap = await tx.get(entryRef);
        const prev = entrySnap.exists ? (entrySnap.data() || {}) : {};

        const hadPickBefore = !!str(prev.playerId);
        const willHavePickNow = !!playerId;

        // ✅ on incrémente seulement si on passe de "pas de pick" -> "pick"
        const isFirstParticipation = !hadPickBefore && willHavePickNow;

        // identité: on prend client si fourni, sinon fallback minimal
        const ident = getDisplayIdentity(auth);
        const displayName =
          clientDisplayName ||
          (typeof ch?.defaultDisplayName === "string" ? ch.defaultDisplayName : null) ||
          "Invité";

        const avatarUrl = clientAvatarUrl || null;

        // ✅ écrire l'entry
        tx.set(
          entryRef,
          {
            uid,
            displayName,
            avatarUrl,
            playerId,
            playerName,
            teamAbbr,
            positionCode,
            headshotUrl,
            updatedAt: FieldValue.serverTimestamp(),
            ...(entrySnap.exists ? {} : { createdAt: FieldValue.serverTimestamp() }),
            // debug / audit (optionnel)
            pickedBy: ident.uid,
          },
          { merge: true }
        );

        // ✅ incrément atomique
        if (isFirstParticipation) {
          tx.set(
            chRef,
            {
              participantsCount: FieldValue.increment(1),
              updatedAt: FieldValue.serverTimestamp(),
            },
            { merge: true }
          );
        }

        return {
          ok: true,
          isFirstParticipation,
          participantsCountDelta: isFirstParticipation ? 1 : 0,
        };
      });

      return res;
    } catch (e) {
      const msg = String(e?.message || e);
      logger.warn("[fgcPick] failed", { challengeId, uid, err: msg });

      // si c'est déjà une HttpsError (throw dans transaction)
      if (e?.code && typeof e.code === "string") {
        throw e;
      }
      throw new HttpsError("internal", msg);
    }
  }
);