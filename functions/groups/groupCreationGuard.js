import { HttpsError } from "firebase-functions/v2/https";
import { FieldValue } from "firebase-admin/firestore";

const HOURLY_LIMIT = 5;
const DAILY_LIMIT = 15;
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

function rateLimitRef(db, uid) {
  return db.doc(`users/${uid}/rate_limits/group_create`);
}

export async function assertCanCreateGroup(db, uid) {
  const ref = rateLimitRef(db, uid);
  const snap = await ref.get();
  const data = snap.exists ? snap.data() || {} : {};
  const now = Date.now();

  const hourStart = Number(data.hourWindowStart) || 0;
  const dayStart = Number(data.dayWindowStart) || 0;
  let hourCount = Number(data.hourCount) || 0;
  let dayCount = Number(data.dayCount) || 0;

  if (!hourStart || now - hourStart >= HOUR_MS) {
    hourCount = 0;
  }
  if (!dayStart || now - dayStart >= DAY_MS) {
    dayCount = 0;
  }

  if (hourCount >= HOURLY_LIMIT || dayCount >= DAILY_LIMIT) {
    throw new HttpsError("resource-exhausted", "GROUP_CREATE_RATE_LIMITED", {
      reason: "GROUP_CREATE_RATE_LIMITED",
    });
  }

  return { hourCount, dayCount, hourStart, dayStart, now };
}

export async function recordGroupCreation(db, uid, state) {
  const ref = rateLimitRef(db, uid);
  const now = state?.now || Date.now();
  const hourStart =
    state?.hourStart && now - state.hourStart < HOUR_MS ? state.hourStart : now;
  const dayStart =
    state?.dayStart && now - state.dayStart < DAY_MS ? state.dayStart : now;

  const hourCount =
    state?.hourStart && now - state.hourStart < HOUR_MS
      ? (Number(state.hourCount) || 0) + 1
      : 1;
  const dayCount =
    state?.dayStart && now - state.dayStart < DAY_MS
      ? (Number(state.dayCount) || 0) + 1
      : 1;

  await ref.set(
    {
      hourWindowStart: hourStart,
      dayWindowStart: dayStart,
      hourCount,
      dayCount,
      lastCreatedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
}
