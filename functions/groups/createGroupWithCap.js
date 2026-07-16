// functions/createGroupWithCap.js
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { logger } from "firebase-functions";
import { initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { parseAutopilotEnabled, parseFavoriteTeam } from "./groupConfigUtils.js";
import {
  assertCanCreateOwnedGroup,
  assertCanSetAutopilot,
  readUserPlanTier,
} from "./groupTierLimits.js";

initializeApp();
const db = getFirestore();

function generateCodeInvitation(length = 8) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ123456789";
  let code = "";
  for (let i = 0; i < length; i++) code += alphabet[Math.floor(Math.random() * alphabet.length)];
  return code;
}

function normalizeSport(value) {
  const sport = String(value || "NHL").trim().toUpperCase();
  return sport === "MLB" ? "MLB" : "NHL";
}

export const createGroupWithCap = onCall(async (req) => {
  const uid = req.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Not authenticated");

  const name = String(req.data?.name || "").trim();
  const description = String(req.data?.description || "").trim();
  const sport = normalizeSport(req.data?.sport);
  const autopilotEnabled = parseAutopilotEnabled(req.data?.autopilotEnabled, {
    defaultValue: true,
  });
  const favoriteTeam = parseFavoriteTeam(req.data?.favoriteTeam ?? null);

  if (!name) throw new HttpsError("invalid-argument", "Missing name");

  logger.info("[createGroupWithCap] config", {
    uid,
    sport,
    autopilotEnabled,
    favoriteTeam,
  });

  const tier = await readUserPlanTier(db, uid);
  await assertCanCreateOwnedGroup(db, uid, tier);

  if (autopilotEnabled) {
    await assertCanSetAutopilot(db, uid, tier, {
      currentlyEnabled: false,
      nextEnabled: true,
    });
  }

  const pSnap = await db.doc(`participants/${uid}`).get();
  const p = pSnap.exists ? pSnap.data() || {} : {};

  const displayName =
    p.displayName || (p.email ? String(p.email).split("@")[0] : "") || "Guest";

  const avatarUrl = p.photoURL || p.avatarUrl || null;

  const groupRef = db.collection("groups").doc();
  const groupId = groupRef.id;
  const codeInvitation = generateCodeInvitation(8);
  const gmRef = db.doc(`group_memberships/${groupId}_${uid}`);

  const now = FieldValue.serverTimestamp();

  await db.runTransaction(async (tx) => {
    tx.set(groupRef, {
      name,
      description,
      sport,
      league: sport,

      avatarUrl: null,
      codeInvitation,

      createdBy: uid,
      ownerId: uid,
      ownerName: displayName,
      ownerAvatarUrl: avatarUrl || null,

      isPrivate: true,
      status: "active",
      active: true,

      autopilotEnabled,
      favoriteTeam,

      createdAt: now,
      updatedAt: now,
    });

    tx.set(gmRef, {
      groupId,
      uid,
      userId: uid,
      role: "owner",
      active: true,
      status: "active",
      displayName,
      avatarUrl: avatarUrl || null,
      createdAt: now,
      updatedAt: now,
    });
  });

  return { groupId, codeInvitation, sport, autopilotEnabled, favoriteTeam };
});
