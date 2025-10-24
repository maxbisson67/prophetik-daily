// functions/leaderboard.js
import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { onRequest } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { setGlobalOptions } from 'firebase-functions/v2';

if (!getApps().length) initializeApp();
setGlobalOptions({ region: 'us-central1', maxInstances: 10, timeoutSeconds: 540 });

const db = getFirestore();

const toNumber = (x, def = 0) => {
  if (typeof x === 'number') return x;
  const n = Number(x);
  return Number.isFinite(n) ? n : def;
};

const parseParticipation = (data = {}) => {
  const payout = toNumber(data.payout, 0);
  const finalPoints = toNumber(data.finalPoints, 0);
  const won = payout > 0; // règle actuelle: gagne si payout > 0
  const displayName = data.displayName || null;
  return { payout, finalPoints, won, displayName };
};

const chunk = (arr, size) => {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

/** ---------------- Backfill (logique réutilisable) ---------------- */
export async function rebuildLeaderboardForGroupLogic(groupId) {
  // Dans ta structure, status = "completed". (Tu peux ajouter d’autres statuts si nécessaire.)
  const defisSnap = await db
    .collection('defis')
    .where('groupId', '==', groupId)
    .where('status', '==', 'completed')
    .get();

  // userId -> { wins, potTotal, participations, displayName? }
  const totals = new Map();

  for (const d of defisSnap.docs) {
    const partsSnap = await db.collection(`defis/${d.id}/participations`).get();

    for (const p of partsSnap.docs) {
      const uid = p.id;
      const { payout, won, displayName } = parseParticipation(p.data());

      const cur = totals.get(uid) || { wins: 0, potTotal: 0, participations: 0, displayName: null };
      cur.participations += 1;
      if (won) {
        cur.wins += 1;
        cur.potTotal += payout;
      }
      // Mémorise un displayName si disponible
      if (!cur.displayName && displayName) cur.displayName = displayName;

      totals.set(uid, cur);
    }
  }

  // Complète displayName manquant à partir de participants/{uid}
  const uidsNeedingName = [...totals.entries()]
    .filter(([, v]) => !v.displayName)
    .map(([uid]) => uid);

  if (uidsNeedingName.length) {
    // Lis en petits lots pour éviter les dépassements
    for (const batchIds of chunk(uidsNeedingName, 500)) {
      const reads = await Promise.all(
        batchIds.map((uid) => db.doc(`participants/${uid}`).get())
      );
      reads.forEach((snap, idx) => {
        if (snap.exists) {
          const uid = batchIds[idx];
          const name = snap.data()?.displayName || null;
          const cur = totals.get(uid);
          if (cur && name) cur.displayName = name;
        }
      });
    }
  }

  // Écrit en lots (500 écritures max par batch)
  const entries = [...totals.entries()];
  for (const batchEntries of chunk(entries, 450)) {
    const batch = db.batch();
    for (const [uid, agg] of batchEntries) {
      const potAvg = agg.wins > 0 ? agg.potTotal / agg.wins : 0;
      batch.set(
        db.doc(`groups/${groupId}/leaderboard/${uid}`),
        {
          wins: agg.wins,
          potTotal: agg.potTotal,
          potAvg,
          participations: agg.participations,
          displayName: agg.displayName || null,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    }
    await batch.commit();
  }

  return { groupId, users: totals.size };
}

/** ---------------- Trigger temps réel ----------------
 * S’aligne avec la même règle (payout > 0 => win)
 */
export const onParticipationWritten = onDocumentWritten(
  'defis/{defiId}/participations/{userId}',
  async (event) => {
    const { defiId, userId } = event.params;
    const defiSnap = await db.doc(`defis/${defiId}`).get();
    if (!defiSnap.exists) return;
    const groupId = defiSnap.data()?.groupId;
    if (!groupId) return;

    const beforeData = event.data?.before?.data() || null;
    const afterData  = event.data?.after?.data()  || null;

    // On met toujours à jour la ligne du user dans le leaderboard
    // — si gagnant → wins/potTotal, sinon garde wins/potTotal, mais tu pourrais aussi
    //   décider d’initialiser la ligne à participations=1 (si tu stockes participations dans le temps réel).
    const b = beforeData ? parseParticipation(beforeData) : null;
    const a = afterData  ? parseParticipation(afterData)  : null;

    let deltaWins = 0, deltaPot = 0;
    if (!b && a) {
      if (a.won) { deltaWins = 1;  deltaPot = a.payout; }
    } else if (b && !a) {
      if (b.won) { deltaWins = -1; deltaPot = -b.payout; }
    } else if (b && a) {
      if (b.won && !a.won) { deltaWins = -1; deltaPot = -b.payout; }
      else if (!b.won && a.won) { deltaWins = 1; deltaPot = a.payout; }
      else if (b.won && a.won) { deltaPot = a.payout - b.payout; }
    }

    const lbRef = db.doc(`groups/${groupId}/leaderboard/${userId}`);
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(lbRef);
      const cur = snap.exists ? snap.data() : {};
      const wins = Math.max(0, (cur.wins || 0) + deltaWins);
      const potTotal = (cur.potTotal || 0) + deltaPot;
      const potAvg = wins > 0 ? potTotal / wins : 0;

      // displayName: privilégie la participation, sinon participants/{uid}
      let displayName = cur.displayName || a?.displayName || b?.displayName || null;
      if (!displayName) {
        const pSnap = await tx.get(db.doc(`participants/${userId}`));
        if (pSnap.exists) displayName = pSnap.data()?.displayName || null;
      }

      // Optionnel: tenir `participations` en temps réel
      // const curParts = toNumber(cur.participations, 0);
      // const partsDelta = !b && a ? 1 : b && !a ? -1 : 0;
      // const participations = Math.max(0, curParts + partsDelta);

      tx.set(
        lbRef,
        {
          wins,
          potTotal,
          potAvg,
          displayName: displayName || null,
          // participations, // décommente si tu veux le suivre en temps réel
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    });
  }
);

/** ---------------- HTTP: backfill d’un groupe ---------------- */
export const rebuildLeaderboardForGroup = onRequest(async (req, res) => {
  try {
    const groupId = String(req.query.groupId || '');
    if (!groupId) return res.status(400).json({ error: 'Missing groupId' });
    const out = await rebuildLeaderboardForGroupLogic(groupId);
    res.json({ ok: true, ...out });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: String(e?.message || e) });
  }
});

/** ---------------- CRON: backfill de tous les groupes ---------------- */
export const rebuildAllLeaderboards = onSchedule(
  { schedule: '0 3 * * *', timeZone: 'America/Toronto' },
  async () => {
    const groupsSnap = await db.collection('groups').select().get();
    const ids = groupsSnap.docs.map((d) => d.id);

    for (const gid of ids) {
      try {
        await rebuildLeaderboardForGroupLogic(gid);
      } catch (e) {
        console.error(`[leaderboard] rebuild failed for group ${gid}`, e);
      }
    }
    return { ok: true, groups: ids.length };
  }
);