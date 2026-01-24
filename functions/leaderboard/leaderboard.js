// functions/leaderboard/leaderboard.js
import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

if (!getApps().length) initializeApp();
export const db = getFirestore();

/* --------------------------- Utils --------------------------- */
export const toNumber = (x, def = 0) => {
  if (typeof x === "number") return x;
  const n = Number(x);
  return Number.isFinite(n) ? n : def;
};

export const chunk = (arr, size) => {
  const out = [];
  for (let i = 0; i < (arr || []).length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

export const typeKey = (defiType) => {
  const t = Number(defiType);
  return Number.isFinite(t) && t > 0 ? String(t) : "0";
};

/**
 * Règle "win" (alignée avec finalize.js):
 * - potInc = payout + bonus
 * - won si potInc > 0
 *
 * NOTE: on ne stocke plus potTotal dans le leaderboard, mais on garde
 * la règle de "won" basée sur payout+bonus (c’est le plus cohérent).
 *
 * ✅ Ajout:
 * - nhlPoints: somme des points NHL réels de la sélection
 */
export const parseParticipation = (data = {}) => {
  const payout = toNumber(data.payout, 0);
  const bonus = toNumber(data.bonus, 0);
  const potInc = payout + bonus;

  // ✅ NHL réel (qualité de sélection)
  const finalPoints = toNumber(data.finalPoints, 0);

  // ✅ “games” = nb de picks (plus fiable que defi.type)
  const picksLen = Array.isArray(data.picks) ? data.picks.length : 0;

  const won = potInc > 0;
  const displayName = data.displayName || null;

  return { payout, bonus, potInc, finalPoints, won, displayName, picksLen };
};

function pickString(v) {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

function ymd10(v) {
  return typeof v === "string" ? v.slice(0, 10) : "";
}

/**
 * Parse YYYY-MM-DD en date "UTC midnight" (stable pour calculer diffDays)
 */
function dateFromYmdUTC(ymd) {
  const s = String(ymd || "").slice(0, 10);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const d = Number(m[3]);
  return new Date(Date.UTC(y, mo, d, 0, 0, 0));
}

function diffDaysUTC(a, b) {
  const ms = b.getTime() - a.getTime();
  return Math.floor(ms / 86400000);
}

/**
 * ✅ Clé de semaine "relative saison"
 */
function weekKeyFromGameDate({ seasonId, fromYmd, gameDate }) {
  const fromDate = dateFromYmdUTC(fromYmd);
  const gdDate = dateFromYmdUTC(gameDate);
  if (!fromDate || !gdDate) return null;

  const delta = diffDaysUTC(fromDate, gdDate);
  if (!Number.isFinite(delta) || delta < 0) return null;

  const weekIndex = Math.floor(delta / 7) + 1;
  const wk = String(weekIndex).padStart(2, "0");
  return `${String(seasonId)}-W${wk}`;
}

function monthKeyFromGameDate(gameDate) {
  const gd = String(gameDate || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(gd)) return null;
  return gd.slice(0, 7); // YYYY-MM
}

function incMap(mapObj, key, amount) {
  if (!key) return;
  const prev = toNumber(mapObj?.[key], 0);
  mapObj[key] = prev + toNumber(amount, 0);
}

function safeDiv(a, b) {
  const aa = toNumber(a, 0);
  const bb = toNumber(b, 0);
  return bb > 0 ? aa / bb : 0;
}

/**
 * Rebuild (Season + Group)
 */
export async function rebuildLeaderboardSeasonForGroupLogic({
  groupId,
  seasonId,
  fromYmd,
  toYmd,
  clearDirty = false,
}) {
  if (!groupId) throw new Error("Missing groupId");
  if (!seasonId) throw new Error("Missing seasonId");
  if (!fromYmd || !toYmd) throw new Error("Missing fromYmd/toYmd");

  const from = String(fromYmd).slice(0, 10);
  const to = String(toYmd).slice(0, 10);

  const defisSnap = await db
    .collection("defis")
    .where("groupId", "==", groupId)
    .where("status", "==", "completed")
    .where("gameDate", ">=", from)
    .where("gameDate", "<=", to)
    .get();

  // uid -> aggregates
  const totals = new Map();

  for (const d of defisSnap.docs) {
    const defi = d.data() || {};
    const tKey = typeKey(defi?.type);
    const gameDate = ymd10(defi?.gameDate);

    const weekKey = weekKeyFromGameDate({ seasonId, fromYmd: from, gameDate });
    const monthKey = monthKeyFromGameDate(gameDate);
    const partsSnap = await db.collection(`defis/${d.id}/participations`).get();

    for (const p of partsSnap.docs) {
      const uid = p.id;
      const { finalPoints, won, displayName, potInc, picksLen } = parseParticipation(p.data());

      const cur =
        totals.get(uid) || {
          uid,
          participations: 0,
          wins: 0,

          // ✅ Prophetik (cagnotte)
          pointsTotal: 0,
          pointsByWeek: {},
          winsByWeek: {},
          pointsByMonth: {},
          winsByMonth: {},

          // ✅ NHL réel (qualité)
          nhlPointsTotal: 0,
          nhlGamesTotal: 0,
          nhlPointsByWeek: {},
          nhlGamesByWeek: {},
          nhlPointsByMonth: {},
          nhlGamesByMonth: {},

          winsByType: {},

          displayName: null,
          avatarUrl: null,
          avatarId: null,
        };

      // --- counts
      cur.participations += 1;
      if (won) cur.wins += 1;

      // --- ✅ Prophetik points = potInc
      cur.pointsTotal += toNumber(potInc, 0);
      incMap(cur.pointsByWeek, weekKey, potInc);
      incMap(cur.pointsByMonth, monthKey, potInc);

      if (won) {
        incMap(cur.winsByWeek, weekKey, 1);
        incMap(cur.winsByMonth, monthKey, 1);
      }

      // --- ✅ NHL réel = finalPoints ; ✅ games = picksLen
      cur.nhlPointsTotal += toNumber(finalPoints, 0);
      cur.nhlGamesTotal += toNumber(picksLen, 0);

      incMap(cur.nhlPointsByWeek, weekKey, finalPoints);
      incMap(cur.nhlGamesByWeek, weekKey, picksLen);
      incMap(cur.nhlPointsByMonth, monthKey, finalPoints);
      incMap(cur.nhlGamesByMonth, monthKey, picksLen);

      // --- by type
      if (!cur.winsByType[tKey]) {
        cur.winsByType[tKey] = {
          plays: 0,
          wins: 0,

          // Prophetik
          pointsTotal: 0,

          // NHL
          nhlPointsTotal: 0,
          nhlGamesTotal: 0,
        };
      }

      cur.winsByType[tKey].plays += 1;
      if (won) cur.winsByType[tKey].wins += 1;

      cur.winsByType[tKey].pointsTotal += toNumber(potInc, 0);

      cur.winsByType[tKey].nhlPointsTotal += toNumber(finalPoints, 0);
      cur.winsByType[tKey].nhlGamesTotal += toNumber(picksLen, 0);

      if (!cur.displayName && displayName) cur.displayName = displayName;

      totals.set(uid, cur);
    }
  }

  const allUids = [...totals.keys()];

  // 1) Complète displayName manquant depuis participants/{uid}
  const uidsNeedingName = [...totals.entries()]
    .filter(([, v]) => !v.displayName)
    .map(([uid]) => uid);

  if (uidsNeedingName.length) {
    for (const batchIds of chunk(uidsNeedingName, 500)) {
      const reads = await Promise.all(batchIds.map((uid) => db.doc(`participants/${uid}`).get()));
      reads.forEach((snap, idx) => {
        if (!snap.exists) return;
        const uid = batchIds[idx];
        const name = pickString(snap.data()?.displayName);
        const cur = totals.get(uid);
        if (cur && name) cur.displayName = name;
      });
    }
  }

  // 2) ✅ Enrichit avatarUrl/avatarId depuis profiles_public/{uid} (fallback participants/{uid})
  if (allUids.length) {
    for (const batchIds of chunk(allUids, 500)) {
      const profileReads = await Promise.all(batchIds.map((uid) => db.doc(`profiles_public/${uid}`).get()));
      profileReads.forEach((snap, idx) => {
        const uid = batchIds[idx];
        const cur = totals.get(uid);
        if (!cur) return;

        if (snap.exists) {
          const data = snap.data() || {};
          const avatarUrl = pickString(data.avatarUrl);
          const avatarId = pickString(data.avatarId);
          if (avatarUrl) cur.avatarUrl = avatarUrl;
          if (avatarId) cur.avatarId = avatarId;
        }
      });

      const needFallback = batchIds.filter((uid) => {
        const cur = totals.get(uid);
        return cur && !cur.avatarUrl && !cur.avatarId;
      });

      if (needFallback.length) {
        const partReads = await Promise.all(needFallback.map((uid) => db.doc(`participants/${uid}`).get()));
        partReads.forEach((snap, idx) => {
          const uid = needFallback[idx];
          const cur = totals.get(uid);
          if (!cur || !snap.exists) return;
          const data = snap.data() || {};
          const avatarUrl = pickString(data.avatarUrl);
          const avatarId = pickString(data.avatarId);
          if (avatarUrl) cur.avatarUrl = avatarUrl;
          if (avatarId) cur.avatarId = avatarId;
        });
      }
    }
  }

  // Écriture metadata saison
  await db.doc(`groups/${groupId}/leaderboards/${seasonId}`).set(
    {
      seasonId,
      groupId,
      fromYmd: from,
      toYmd: to,
      membersCount: totals.size,
      defisCount: defisSnap.size,
      rebuiltAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  // Écriture members (batch)
  const base = `groups/${groupId}/leaderboards/${seasonId}/members`;
  const entries = [...totals.entries()];

  for (const batchEntries of chunk(entries, 450)) {
    const batch = db.batch();

    for (const [uid, agg] of batchEntries) {
      const winRate = agg.participations > 0 ? agg.wins / agg.participations : 0;

      // ✅ NHL PPG (points NHL / games)
      const nhlPPG = safeDiv(agg.nhlPointsTotal, agg.nhlGamesTotal);

      // ✅ calc nhlPPG per type
      const winsByType = agg.winsByType || {};
      for (const k of Object.keys(winsByType)) {
        const t = winsByType[k] || {};
        t.nhlPPG = safeDiv(t.nhlPointsTotal, t.nhlGamesTotal);
        winsByType[k] = t;
      }

      batch.set(
        db.doc(`${base}/${uid}`),
        {
          uid,
          displayName: agg.displayName || null,

          avatarUrl: agg.avatarUrl || null,
          avatarId: agg.avatarId || null,

          participations: agg.participations,
          wins: agg.wins,
          winRate,

          // ✅ Prophetik
          pointsTotal: agg.pointsTotal,
          pointsByWeek: agg.pointsByWeek || {},
          winsByWeek: agg.winsByWeek || {},
          pointsByMonth: agg.pointsByMonth || {},
          winsByMonth: agg.winsByMonth || {},

          // ✅ NHL real performance
          nhlPointsTotal: agg.nhlPointsTotal || 0,
          nhlGamesTotal: agg.nhlGamesTotal || 0,
          nhlPPG,

          nhlPointsByWeek: agg.nhlPointsByWeek || {},
          nhlGamesByWeek: agg.nhlGamesByWeek || {},
          nhlPointsByMonth: agg.nhlPointsByMonth || {},
          nhlGamesByMonth: agg.nhlGamesByMonth || {},

          // ✅ per type
          winsByType,

          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    }

    await batch.commit();
  }

  // ✅ Clear dirty flag (optionnel)
  if (clearDirty) {
    await db.doc(`groups/${groupId}`).set(
      {
        leaderboardSeasonDirty: false,
        leaderboardSeasonDirtyAt: FieldValue.delete(),
        leaderboardSeasonRebuiltAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  }

  return {
    groupId,
    seasonId,
    users: totals.size,
    defis: defisSnap.size,
    fromYmd: from,
    toYmd: to,
    clearedDirty: !!clearDirty,
  };
}