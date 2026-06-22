/**
 * Création autopilot du défi TS (3×3) — réutilise le schedule du jour.
 */
import { Timestamp } from "firebase-admin/firestore";
import { db, FieldValue, logger } from "../utils.js";

const TS_TYPE = 3;
const SIGNUP_DEADLINE_MINUTES = 15;

function randSuffix(len = 10) {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

function ymdToUnderscore(ymd) {
  return String(ymd || "").slice(0, 10).replace(/-/g, "_");
}

export async function hasExistingTsForGroupDay({ groupId, gameYmd }) {
  const snap = await db
    .collection("defis")
    .where("groupId", "==", String(groupId))
    .where("gameDate", "==", gameYmd)
    .where("type", "==", TS_TYPE)
    .limit(1)
    .get();

  return !snap.empty;
}

/**
 * @param {object} opts
 * @param {string} opts.groupId
 * @param {string} opts.sport - "MLB" | "NHL"
 * @param {string} opts.gameYmd - YYYY-MM-DD
 * @param {Date} opts.firstGameUTC
 */
export async function createAutopilotTsDefiForGroup({
  groupId,
  sport,
  gameYmd,
  firstGameUTC,
}) {
  const sportUpper = String(sport || "").toUpperCase();
  if (!["MLB", "NHL"].includes(sportUpper)) return null;

  const firstGame = firstGameUTC instanceof Date ? firstGameUTC : new Date(firstGameUTC);
  if (Number.isNaN(firstGame.getTime())) return null;

  const signupDeadline = new Date(
    firstGame.getTime() - SIGNUP_DEADLINE_MINUTES * 60 * 1000
  );

  const idDate = ymdToUnderscore(gameYmd);
  const defiId = `${idDate}_3x3_${randSuffix(10)}`;
  const defiRef = db.doc(`defis/${defiId}`);

  const existing = await defiRef.get();
  if (existing.exists) return null;

  await defiRef.set({
    groupId: String(groupId),
    title: "Défi 3x3",
    type: TS_TYPE,
    gameDate: gameYmd,
    createdBy: "system",
    autopilotCreated: true,
    autopilotCreatedAt: FieldValue.serverTimestamp(),
    participationCost: TS_TYPE,
    potJoinIncrement: TS_TYPE,
    status: "open",
    pot: 0,
    sport: sportUpper,
    firstGameUTC: Timestamp.fromDate(firstGame),
    signupDeadline: Timestamp.fromDate(signupDeadline),
    defiKey: `${gameYmd}_3x3`,
    participantsCount: 0,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  logger.info("[GROUP AUTOPILOT] ts created", {
    groupId,
    sport: sportUpper,
    defiId,
    gameYmd,
  });

  return defiId;
}
