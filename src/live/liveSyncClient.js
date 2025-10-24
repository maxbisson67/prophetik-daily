// src/live/liveSyncClient.js
import { doc, getDoc, setDoc, serverTimestamp, writeBatch, collection, getDocs, query } from "firebase/firestore";
import { db } from "@src/lib/firebase";

/** --- API helpers --- **/
const UA = { "User-Agent": "prophetik-daily/1.0" };
async function jget(url, { retries = 2 } = {}) {
  let last;
  for (let i = 0; i <= retries; i++) {
    try {
      const r = await fetch(url, { headers: UA });
      const t = await r.text();
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return JSON.parse(t);
    } catch (e) { last = e; await new Promise(res => setTimeout(res, 400 * (i+1))); }
  }
  throw last || new Error("fetch failed");
}

export function computeTalliesFromPbpList(pbps) {
  const goals = new Map();   // playerId -> n
  const a1 = new Map();
  const a2 = new Map();
  const feed = [];           // [{ scorerId, assists:[a1,a2], teamId, timeInPeriod, period, ts }]

  const inc = (m, pid) => { if (!pid) return; m.set(pid, (m.get(pid) || 0) + 1); };

  for (const pbp of pbps) {
    const plays = Array.isArray(pbp?.plays) ? pbp.plays
                : Array.isArray(pbp?.allPlays) ? pbp.allPlays
                : [];
    for (const ev of plays) {
      const key = String(ev?.typeDescKey || ev?.typeCode || "").toLowerCase();
      if (!key.includes("goal")) continue;

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
        teamId: d.eventOwnerTeamId || null,               // on met l’ID; l’UI déduira l’abbr si besoin
        timeInPeriod: ev?.timeInPeriod || d?.timeInPeriod || null,
        period: ev?.periodDescriptor?.number || null,
        ts: (ev?.epochMs || ev?.timeUTC) ? Number(new Date(ev?.epochMs || ev?.timeUTC)) : Date.now(),
      });
    }
  }

  // to plain objects
  const toObj = (m) => Object.fromEntries(Array.from(m.entries()).map(([k,v]) => [String(k), v]));
  return {
    playerGoals: toObj(goals),
    playerA1: toObj(a1),
    playerA2: toObj(a2),
    goalsFeed: feed.sort((a,b) => (a.ts||0) - (b.ts||0)),
  };
}

export async function fetchGameIds(ymd) {
  const data = await jget(`https://api-web.nhle.com/v1/schedule/${encodeURIComponent(ymd)}`);
  const day = Array.isArray(data?.gameWeek) ? data.gameWeek.find(d => d?.date === ymd) : null;
  const games = day ? (day.games || []) : (Array.isArray(data?.games) ? data.games : []);
  // gamePk / id
  return games.map(g => g?.id || g?.gamePk).filter(Boolean);
}

export async function fetchPbp(gameId) {
  return jget(`https://api-web.nhle.com/v1/gamecenter/${encodeURIComponent(gameId)}/play-by-play`);
}

/** --- tallies --- **/
export function computeTalliesFromPbpList(pbps) {
  const goals = new Map();   // playerId -> n
  const a1 = new Map();
  const a2 = new Map();

  const inc = (m, pid) => { if (!pid) return; m.set(pid, (m.get(pid) || 0) + 1); };

  for (const pbp of pbps) {
    const plays = Array.isArray(pbp?.plays) ? pbp.plays : Array.isArray(pbp?.allPlays) ? pbp.allPlays : [];
    for (const ev of plays) {
      const key = String(ev?.typeDescKey || ev?.typeCode || "").toLowerCase();
      if (!key.includes("goal")) continue;

      const d = ev?.details || {};
      inc(goals, d.scoringPlayerId);
      inc(a1, d.assist1PlayerId);
      inc(a2, d.assist2PlayerId);
    }
  }

  // to plain objects
  const toObj = (m) => Object.fromEntries(Array.from(m.entries()).map(([k,v]) => [String(k), v]));
  return { playerGoals: toObj(goals), playerA1: toObj(a1), playerA2: toObj(a2) };
}

/** --- lock --- **/
export async function tryAcquireLock(defiId, uid) {
  const ref = doc(db, "defis", String(defiId), "live", "lock");
  const snap = await getDoc(ref);
  const now = Date.now();
  const ttlMs = 90_000;

  const data = snap.exists() ? snap.data() : {};
  const last = data.heartbeatAt?.toMillis ? data.heartbeatAt.toMillis() : (typeof data.heartbeatAt === "number" ? data.heartbeatAt : 0);
  const valid = last && now - last < ttlMs;

  if (!valid || data.ownerUid === uid) {
    await setDoc(ref, { ownerUid: uid, heartbeatAt: serverTimestamp() }, { merge: true });
    return true;
  }
  return false;
}

export async function heartbeat(defiId, uid) {
  const ref = doc(db, "defis", String(defiId), "live", "lock");
  await setDoc(ref, { ownerUid: uid, heartbeatAt: serverTimestamp() }, { merge: true });
}

/** --- write live stats & scores --- **/
export async function writeLive(defi, tallies) {
  const liveRef = doc(db, "defis", String(defi.id), "live", "stats");
  await setDoc(liveRef, { ...tallies, updatedAt: serverTimestamp() }, { merge: true });
}

export async function recomputeParticipants(defi, tallies) {
  const { playerGoals={}, playerA1={}, playerA2={} } = tallies;
  // barème simple
  const P_GOAL = 1.0, P_A1 = 0.5, P_A2 = 0.5;

  const partsQ = query(collection(db, "defis", String(defi.id), "participations"));
  const partsSnap = await getDocs(partsQ);
  const batch = writeBatch(db);

  partsSnap.forEach(d => {
    const v = d.data() || {};
    const picks = Array.isArray(v.picks) ? v.picks : [];
    let pts = 0;
    for (const p of picks) {
      const pid = String(p.playerId);
      pts += (playerGoals[pid] || 0) * P_GOAL;
      pts += (playerA1[pid] || 0) * P_A1;
      pts += (playerA2[pid] || 0) * P_A2;
    }
    batch.set(d.ref, { livePoints: pts, liveUpdatedAt: serverTimestamp() }, { merge: true });
  });

  await batch.commit();
}

/** --- master step (one tick) --- **/
export async function runOneTick(defi, uid) {
  // 1) schedule → gameIds
  const ymd = typeof defi.gameDate === "string" ? defi.gameDate : (defi.gameDate?.toDate?.() ? (
    defi.gameDate.toDate().toISOString().slice(0,10)
  ) : null);
  if (!ymd) return { ok:false, reason:"no-date" };

  const gameIds = await fetchGameIds(ymd);
  if (!gameIds.length) return { ok:false, reason:"no-games" };

  // 2) pbp list
  const pbps = [];
  for (const gid of gameIds) {
    try { pbps.push(await fetchPbp(gid)); } catch { /* ignore per-game */ }
  }
  if (!pbps.length) return { ok:false, reason:"no-pbp" };

  // 3) tallies
  const tallies = computeTalliesFromPbpList(pbps);

  // 4) writes
  await writeLive(defi, tallies);
  await recomputeParticipants(defi, tallies);

  return { ok:true };
}