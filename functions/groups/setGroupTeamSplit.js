import { onCall, HttpsError } from "firebase-functions/v2/https";
import { logger } from "firebase-functions";
import { db, FieldValue } from "../utils.js";
import { FUNCTIONS_REGION } from "../regions.js";
import {
  loadParticipatingHumanUids,
  normalizeTeamSplitNames,
  normalizeTeamSplitRoster,
  teamSplitHasBothTeams,
} from "./groupTeamSplitCore.js";

function assertOwner(group, uid) {
  const ownerId = group?.ownerId || group?.createdBy || null;
  if (String(ownerId) !== String(uid)) {
    throw new HttpsError("permission-denied", "OWNER_ONLY");
  }
}

export const setGroupTeamSplit = onCall(
  { region: FUNCTIONS_REGION, timeoutSeconds: 60 },
  async (req) => {
    const uid = req.auth?.uid;
    if (!uid) throw new HttpsError("unauthenticated", "Auth required.");

    const groupId = String(req.data?.groupId || "").trim();
    if (!groupId) throw new HttpsError("invalid-argument", "groupId required");

    const groupSnap = await db.doc(`groups/${groupId}`).get();
    if (!groupSnap.exists) throw new HttpsError("not-found", "GROUP_NOT_FOUND");

    const group = groupSnap.data() || {};
    assertOwner(group, uid);

    const { teamAName, teamBName } = normalizeTeamSplitNames(
      req.data?.teamAName,
      req.data?.teamBName
    );
    const roster = normalizeTeamSplitRoster(req.data?.roster);

    const participatingUids = await loadParticipatingHumanUids(db, groupId);
    const participatingSet = new Set(participatingUids);

    for (const rosterUid of Object.keys(roster)) {
      if (!participatingSet.has(rosterUid)) {
        throw new HttpsError("invalid-argument", "ROSTER_UID_NOT_PARTICIPATING", {
          uid: rosterUid,
        });
      }
    }

    const teamSplit = {
      teamA: { id: "a", name: teamAName },
      teamB: { id: "b", name: teamBName },
      roster,
      ready: teamSplitHasBothTeams(roster),
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: uid,
    };

    await db.doc(`groups/${groupId}`).set(
      {
        teamSplit,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    logger.info("[setGroupTeamSplit] saved", {
      groupId,
      ready: teamSplit.ready,
      rosterSize: Object.keys(roster).length,
    });

    return {
      ok: true,
      groupId,
      ready: teamSplit.ready,
    };
  }
);
