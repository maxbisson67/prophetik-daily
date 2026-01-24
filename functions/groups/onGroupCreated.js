import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { logger } from "firebase-functions";

// ✅ adapte selon ton projet (firebase-admin init + exports)
import { db, FieldValue } from "../utils.js";

export const onGroupCreated = onDocumentCreated("groups/{groupId}", async (event) => {
  const groupId = event.params.groupId;
  const group = event.data?.data();
  if (!group) return;

  const now = FieldValue.serverTimestamp();

  // ✅ IA "globale" (même uid pour tous les groupes), membership distinct par groupe
  const aiUid = "ai";
  const membershipId = `${groupId}_${aiUid}`;
  const aiRef = db.doc(`group_memberships/${membershipId}`);

  // Idempotent (retries possibles)
  const exists = await aiRef.get();
  if (exists.exists) {
    logger.info("[onGroupCreated] AI membership already exists", { groupId, membershipId });
    return;
  }

  // Personnalité par défaut (tu pourras la changer via une action owner plus tard)
  const personalityId = "coach"; // ex: coach | trash_talker | stats_nerd

  await aiRef.set({
    groupId,
    uid: aiUid,
    type: "ai",
    role: "member",
    active: true,
    status: "active",

    personalityId,
    displayName: "Prophetik AI",
    avatarUrl: null,

    createdAt: now,
    updatedAt: now,
    createdBy: "system",
  });

  logger.info("[onGroupCreated] AI membership created", { groupId, membershipId });
});