import { HttpsError } from "firebase-functions/v2/https";
import { getBusinessYmdDashed } from "../teamPredictionBundles/tpBundleUtils.js";
import { hasExistingTsForGroupDay } from "../defis/autopilotTsCreate.js";

/** Autopilot désactivé explicitement → création manuelle par le owner. */
export function isGroupManualChallengeMode(group = {}) {
  return group?.autopilotEnabled === false;
}

export function assertManualChallengeCreationAllowed(group = {}) {
  if (!isGroupManualChallengeMode(group)) {
    throw new HttpsError(
      "failed-precondition",
      "La création manuelle est réservée aux groupes sans autopilot."
    );
  }
}

export function getManualChallengeBusinessYmdDashed(now = new Date()) {
  return getBusinessYmdDashed(now);
}

export function getManualChallengeBusinessYmdCompact(now = new Date()) {
  return getManualChallengeBusinessYmdDashed(now).replace(/-/g, "");
}

export async function hasExistingManualFgcForGroupDay(
  db,
  { groupId, league, businessYmdDashed }
) {
  const gid = String(groupId || "").trim();
  const lg = String(league || "NHL").toUpperCase() === "MLB" ? "MLB" : "NHL";
  const dashed = String(businessYmdDashed || "").slice(0, 10);
  const compact = dashed.replace(/-/g, "");

  for (const ymd of [dashed, compact]) {
    if (!ymd) continue;

    const snap = await db
      .collection("first_goal_challenges")
      .where("groupId", "==", gid)
      .where("league", "==", lg)
      .where("type", "==", "first_goal")
      .where("gameYmd", "==", ymd)
      .limit(1)
      .get();

    if (!snap.empty) return true;
  }

  return false;
}

export async function assertManualFgcDayLimit(db, { groupId, league, businessYmdDashed }) {
  const exists = await hasExistingManualFgcForGroupDay(db, {
    groupId,
    league,
    businessYmdDashed,
  });

  if (exists) {
    throw new HttpsError(
      "already-exists",
      "Un défi premier but / premier point produit existe déjà pour ce groupe aujourd'hui."
    );
  }
}

export async function assertManualTsDayLimit({ groupId, gameDateYmd }) {
  const exists = await hasExistingTsForGroupDay({
    groupId,
    gameYmd: String(gameDateYmd || "").slice(0, 10),
  });

  if (exists) {
    throw new HttpsError(
      "already-exists",
      "Un défi top scoreurs (3×3) existe déjà pour ce groupe à cette date."
    );
  }
}
