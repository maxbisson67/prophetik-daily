// src/live/liveSyncClient.js
import firestore from '@react-native-firebase/firestore';

const db = firestore();

/** --- API helpers --- **/
const UA = { 'User-Agent': 'prophetik-daily/1.0' };
async function jget(url, { retries = 2 } = {}) {
  let last;
  for (let i = 0; i <= retries; i++) {
    try {
      const r = await fetch(url, { headers: UA });
      const t = await r.text();
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return JSON.parse(t);
    } catch (e) {
      last = e;
      await new Promise((res) => setTimeout(res, 400 * (i + 1)));
    }
  }
  throw last || new Error('fetch failed');
}

/** --- NHL fetchers --- **/
export async function fetchGameIds(ymd) {
  const data = await jget(`https://api-web.nhle.com/v1/schedule/${encodeURIComponent(ymd)}`);
  const day = Array.isArray(data?.gameWeek) ? data.gameWeek.find((d) => d?.date === ymd) : null;
  const games = day ? day.games || [] : Array.isArray(data?.games) ? data.games : [];
  return games.map((g) => g?.id || g?.gamePk).filter(Boolean);
}

export async function fetchPbp(gameId) {
  return jget(`https://api-web.nhle.com/v1/gamecenter/${encodeURIComponent(gameId)}/play-by-play`);
}

/** --- tallies (consolidée, sans doublon) --- **/
export function computeTalliesFromPbpList(pbps) {
  const goals = new Map(); // playerId -> n
  const a1 = new Map();
  const a2 = new Map();
  const feed = []; // [{ scorerId, assists:[a1,a2], teamId, timeInPeriod, period, ts }]

  const inc = (m, pid) => {
    if (!pid) return;
    m.set(pid, (m.get(pid) || 0) + 1);
  };

  for (const pbp of pbps) {
    const plays = Array.isArray(pbp?.plays)
      ? pbp.plays
      : Array.isArray(pbp?.allPlays)
      ? pbp.allPlays
      : [];
    for (const ev of plays) {
      const key = String(ev?.typeDescKey || ev?.typeCode || '').toLowerCase();
      if (!key.includes('goal')) continue;

      const d = ev?.details || {};
      const scorerId = d.scoringPlayerId || null;
      const a1Id = d.assist1PlayerId || null;
      const a2Id = d.assist2PlayerId || null;

      inc(goals, scorerId);
      inc(a1, a1Id);
      inc(a2, a2Id);

      feed.push({
        id: ev?.eventId || undefined,
        scorerId,
        assists: [a1Id, a2Id].filter(Boolean),
        teamId: d.eventOwnerTeamId || null,
        timeInPeriod: ev?.timeInPeriod || d?.timeInPeriod || null,
        period: ev?.periodDescriptor?.number || null,
        ts:
          (ev?.epochMs || ev?.timeUTC)
            ? Number(new Date(ev?.epochMs || ev?.timeUTC))
            : Date.now(),
      });
    }
  }

  const toObj = (m) =>
    Object.fromEntries(Array.from(m.entries()).map(([k, v]) => [String(k), v]));

  return {
    playerGoals: toObj(goals),
    playerA1: toObj(a1),
    playerA2: toObj(a2),
    goalsFeed: feed.sort((a, b) => (a.ts || 0) - (b.ts || 0)),
  };
}

/** --- lock (RNFB) --- **/
export async function tryAcquireLock(defiId, uid) {
  const ref = db.collection('defis').doc(String(defiId)).collection('live').doc('lock');
  const snap = await ref.get();
  const now = Date.now();
  const ttlMs = 90_000;

  const data = snap.exists ? snap.data() : {};
  const last = data?.heartbeatAt?.toMillis
    ? data.heartbeatAt.toMillis()
    : typeof data?.heartbeatAt === 'number'
    ? data.heartbeatAt
    : 0;
  const valid = last && now - last < ttlMs;

  if (!valid || data?.ownerUid === uid) {
    await ref.set(
      { ownerUid: uid, heartbeatAt: firestore.FieldValue.serverTimestamp() },
      { merge: true }
    );
    return true;
  }
  return false;
}

export async function heartbeat(defiId, uid) {
  const ref = db.collection('defis').doc(String(defiId)).collection('live').doc('lock');
  await ref.set(
    { ownerUid: uid, heartbeatAt: firestore.FieldValue.serverTimestamp() },
    { merge: true }
  );
}

/** --- write live stats & scores (RNFB) --- **/
export async function writeLive(defi, tallies) {
  const liveRef = db.collection('defis').doc(String(defi.id)).collection('live').doc('stats');
  await liveRef.set(
    { ...tallies, updatedAt: firestore.FieldValue.serverTimestamp() },
    { merge: true }
  );
}

/** --- recompute participants (RNFB) --- **/
export async function recomputeParticipants(defi, tallies) {
  const { playerGoals = {}, playerA1 = {}, playerA2 = {} } = tallies;
  // barème simple
  const P_GOAL = 1.0,
    P_A1 = 0.5,
    P_A2 = 0.5;

  const partsSnap = await db
    .collection('defis')
    .doc(String(defi.id))
    .collection('participations')
    .get();

  const batch = db.batch();

  partsSnap.forEach((d) => {
    const v = d.data() || {};
    const picks = Array.isArray(v.picks) ? v.picks : [];
    let pts = 0;

    for (const p of picks) {
      const pid = String(
        p?.playerId ?? p?.id ?? p?.nhlId ?? p?.player?.id ?? ''
      ).trim();
      if (!pid) continue;
      pts += (playerGoals[pid] || 0) * P_GOAL;
      pts += (playerA1[pid] || 0) * P_A1;
      pts += (playerA2[pid] || 0) * P_A2;
    }

    batch.set(
      d.ref,
      { livePoints: pts, liveUpdatedAt: firestore.FieldValue.serverTimestamp() },
      { merge: true }
    );
  });

  await batch.commit();
}

/** --- master step (one tick) --- **/
export async function runOneTick(defi, uid) {
  // 1) schedule → gameIds
  const ymd =
    typeof defi.gameDate === 'string'
      ? defi.gameDate
      : defi.gameDate?.toDate?.()
      ? defi.gameDate.toDate().toISOString().slice(0, 10)
      : null;
  if (!ymd) return { ok: false, reason: 'no-date' };

  const gameIds = await fetchGameIds(ymd);
  if (!gameIds.length) return { ok: false, reason: 'no-games' };

  // 2) pbp list
  const pbps = [];
  for (const gid of gameIds) {
    try {
      pbps.push(await fetchPbp(gid));
    } catch {
      /* ignore per-game */
    }
  }
  if (!pbps.length) return { ok: false, reason: 'no-pbp' };

  // 3) tallies
  const tallies = computeTalliesFromPbpList(pbps);

  // 4) writes
  await writeLive(defi, tallies);
  await recomputeParticipants(defi, tallies);

  return { ok: true };
}