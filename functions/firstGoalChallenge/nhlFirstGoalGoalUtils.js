/** Shared NHL first-goal helpers (mutualized games + repair). */

export function toInt(v, def = null) {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}

export function timeInPeriodToSeconds(s) {
  if (!s || typeof s !== "string") return null;
  const [mmS, ssS] = s.split(":").map((x) => x.trim());
  const mm = toInt(mmS, null);
  const ss = toInt(ssS, null);
  if (mm == null || ss == null) return null;
  return mm * 60 + ss;
}

export function isShootoutGoal(goal) {
  const pt = String(goal?.periodType || "").toUpperCase();
  return pt === "SO";
}

export function isValidGoal(goal) {
  if (!goal) return false;
  if (isShootoutGoal(goal)) return false;
  if (goal?.voided === true || goal?.disallowed === true) return false;
  if (!goal?.scoringPlayerId && !goal?.scoringPlayerName) return false;
  return true;
}

export function looksFinal(live) {
  if (!live) return false;
  if (live.isFinal === true) return true;

  const a = String(live?.gameState || "").toUpperCase();
  const b = String(live?.gameStatus || "").toUpperCase();
  const c = String(live?.status || "").toUpperCase();
  const d = String(live?.state || "").toUpperCase();

  return (
    a.includes("FINAL") ||
    b.includes("FINAL") ||
    c.includes("FINAL") ||
    d.includes("FINAL") ||
    a === "OFF" ||
    b === "OFF" ||
    c === "OFF" ||
    d === "OFF"
  );
}

/**
 * @param {import("firebase-admin/firestore").Firestore} db
 */
export async function computeFirstValidGoalFromGoals(db, gameId) {
  const goalsRef = db.collection("nhl_live_games").doc(String(gameId)).collection("goals");

  const snap = await goalsRef.get();
  if (snap.empty) return null;

  const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter(isValidGoal);

  if (!rows.length) return null;

  rows.sort((a, b) => {
    const pa = toInt(a.period, 99);
    const pb = toInt(b.period, 99);
    if (pa !== pb) return pa - pb;

    const sa = timeInPeriodToSeconds(a.timeInPeriod) ?? 999999;
    const sb = timeInPeriodToSeconds(b.timeInPeriod) ?? 999999;
    if (sa !== sb) return sa - sb;

    return String(a.id).localeCompare(String(b.id));
  });

  const first = rows[0];
  return {
    goalId: String(first.id),
    scoringPlayerId: first.scoringPlayerId ? String(first.scoringPlayerId) : null,
    scoringPlayerName: first.scoringPlayerName || null,
    teamAbbr: first.teamAbbr || null,
    period: toInt(first.period, null),
    timeInPeriod: first.timeInPeriod || null,
    periodType: first.periodType || null,
  };
}
