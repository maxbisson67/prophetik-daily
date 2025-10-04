// functions/index.js
import { setTimeout as delay } from "node:timers/promises";
import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { logger } from "firebase-functions";
import * as admin from "firebase-admin";

/* ------------------------- Admin init ------------------------- */
if (getApps().length === 0) initializeApp();
const db = getFirestore();


/* --------------------------- Helpers -------------------------- */
const UA_HEADERS = { "User-Agent": "prophetik/1.0", Accept: "application/json" };


// helpers en haut du fichier (une fois)
function numOrNull(v) {
  if (typeof v === "number") return v;
  if (typeof v === "string" && v.trim() !== "" && !isNaN(Number(v))) return Number(v);
  return null;
}
function readAnyBalance(doc) {
  // ordre de priorité: credits.balance, credits (number), credit, balance
  return (
    numOrNull(doc?.credits?.balance) ??
    numOrNull(doc?.credits) ??
    numOrNull(doc?.credit) ??
    numOrNull(doc?.balance) ??
    0
  );
}

async function safeFetchJson(url, { method = "GET", headers = {}, timeoutMs = 10000, retries = 3 } = {}) {
  let lastErr;
  for (let attempt = 1; attempt <= retries; attempt++) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, { method, headers: { ...UA_HEADERS, ...headers }, signal: ctrl.signal });
      clearTimeout(t);
      if (!res.ok) throw new Error(`HTTP ${res.status} — ${await res.text()}`);
      return await res.json();
    } catch (e) {
      clearTimeout(t);
      lastErr = e;
      if (attempt < retries) await delay(200 * attempt);
    }
  }
  throw lastErr || new Error("fetch failed");
}
const readTS = (v) => (v?.toDate?.() ? v.toDate() : v instanceof Date ? v : v ? new Date(v) : null);
const toYMD = (d) => {
  const x = typeof d === "string" ? new Date(d) : d instanceof Date ? d : new Date();
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
};
function splitEven(total, n) {
  if (n <= 0 || !(total > 0)) return Array.from({ length: Math.max(0, n) }, () => 0);
  const base = Math.floor(total / n);
  let r = total - base * n;
  return Array.from({ length: n }, (_, i) => (i < r ? base + 1 : base));
}

/* ------------------------ NHL API helpers --------------------- */
const apiWebSchedule = (ymd) => safeFetchJson(`https://api-web.nhle.com/v1/schedule/${encodeURIComponent(ymd)}`);
const apiWebPbp      = (gid) => safeFetchJson(`https://api-web.nhle.com/v1/gamecenter/${encodeURIComponent(gid)}/play-by-play`);
const apiWebRoster   = (t)   => safeFetchJson(`https://api-web.nhle.com/v1/roster/${encodeURIComponent(t.abbr)}/current`);

/* ------------------ Firestore/Callable basics ----------------- */
export const onParticipantCreate = onDocumentCreated("participants/{uid}", async (event) => {
  logger.info("new participant", { uid: event.params.uid });
});

export const freeTopUp = onCall(async (req) => {
  const uid = req.auth?.uid || null;
  if (!uid) throw new HttpsError("unauthenticated", "Auth required.");
  const amount = Number(req.data?.amount || 0);
  if (!(amount > 0)) throw new HttpsError("invalid-argument", "amount must be > 0");

  const ref = db.collection("participants").doc(uid);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const cur = snap.exists ? (snap.data() || {}) : {};
    const curBal =
      typeof cur?.credits?.balance === "number" ? cur.credits.balance :
      typeof cur?.credits === "number"        ? cur.credits :
      typeof cur?.credit === "number"         ? cur.credit :
      typeof cur?.balance === "number"        ? cur.balance : 0;
    tx.set(ref, { credits: { balance: curBal + amount, updatedAt: FieldValue.serverTimestamp() } }, { merge: true });
  });
  return { ok: true };
});

export const joinGroupByCode = onCall(async (req) => {
  try {
    const userId = req.auth?.uid || null;
    if (!userId) throw new HttpsError("unauthenticated", "Auth required.");

    const raw = (req.data?.code ?? "").toString();
    const code = raw.trim();
    if (!code) throw new HttpsError("invalid-argument", "code required");

    // Variantes pour matcher codeInvitation
    const upper = code.toUpperCase();
    const cleaned = upper.replace(/[^A-Z0-9]/g, "");
    const candidates = Array.from(new Set([code, upper, cleaned])).filter(Boolean);

    // 1) Trouver le groupe
    let foundDoc = null;
    for (const c of candidates) {
      const q = await db.collection("groups")
        .where("codeInvitation", "==", c)
        .limit(1)
        .get();
      if (!q.empty) { foundDoc = q.docs[0]; break; }
    }
    if (!foundDoc) throw new HttpsError("not-found", "Invalid code");

    const groupId = foundDoc.id;
    const membershipId = `${groupId}_${userId}`;

    // 2) Écrire UNIQUEMENT group_memberships (schéma exact)
    await db.collection("group_memberships").doc(membershipId).set(
      {
        active: true,
        groupId,
        createdAt: FieldValue.serverTimestamp(),
        role: "member",
        uid: userId,
      },
      { merge: true } // idempotent
    );

    const g = foundDoc.data() || {};
    return { ok: true, groupId, groupName: g.name ?? null };
  } catch (err) {
    if (err instanceof HttpsError) throw err;
    throw new HttpsError("internal", err?.message || "joinGroupByCode failed");
  }
});

/* -------------------- PARTICIPATE (old name) ------------------- */
export const participateInDefi = onCall(async (req) => {
  const uid = req.auth?.uid || null;
  if (!uid) throw new HttpsError("unauthenticated", "Auth required");
  const defiId = String(req.data?.defiId || "");
  const picks = Array.isArray(req.data?.picks) ? req.data.picks : [];
  if (!defiId) throw new HttpsError("invalid-argument", "defiId required");

  const dRef = db.collection("defis").doc(defiId);
  const pRef = dRef.collection("participations").doc(uid);
  const userRef = db.collection("participants").doc(uid);

  let returnPayload = { ok: true, newPot: null, newBalance: null, alreadyPaid: false };

  await db.runTransaction(async (tx) => {
    // --- LECTURES (d'abord) ---
    const [dSnap, pSnap, uSnap] = await Promise.all([tx.get(dRef), tx.get(pRef), tx.get(userRef)]);
    if (!dSnap.exists) throw new HttpsError("not-found", "defi not found");

    const d = dSnap.data() || {};
    const status = String(d.status || "").toLowerCase();
    if (status !== "open") throw new HttpsError("failed-precondition", "defi is not open");

    const already = pSnap.exists ? (pSnap.data() || {}) : null;
    const alreadyPaid = already?.paid === true;

    // coût: participationCost sinon type (fallback)
    const costRaw = d.participationCost ?? d.type ?? 0;
    const cost = Number(costRaw);
    if (!Number.isFinite(cost) || cost < 0) {
      throw new HttpsError("failed-precondition", "invalid participation cost");
    }

    // solde utilisateur
    const curU = uSnap.exists ? (uSnap.data() || {}) : {};
    const readAnyBalance = (x) => {
      const v =
        x?.credits?.balance ?? x?.credits ?? x?.credit ?? x?.balance ?? 0;
      const n = Number(v);
      return Number.isFinite(n) ? n : 0;
    };
    const currentBalance = readAnyBalance(curU);

    if (!alreadyPaid && currentBalance < cost) {
      throw new HttpsError("failed-precondition", "insufficient credits");
    }

    // --- ÉCRITURES ---
    // 1) participation
    tx.set(
      pRef,
      {
        picks,
        joinedAt: FieldValue.serverTimestamp(),
        ...(alreadyPaid
          ? {}
          : { paid: true, paidAmount: cost, paidAt: FieldValue.serverTimestamp() }),
      },
      { merge: true }
    );

    // 2) cagnotte + compteur
    const incParticipants = already ? 0 : 1;
    tx.set(
      dRef,
      {
        ...(alreadyPaid ? {} : { pot: FieldValue.increment(cost) }),
        ...(incParticipants ? { participantsCount: FieldValue.increment(1) } : {}),
      },
      { merge: true }
    );

    // 3) débit du participant (si pas déjà payé)
    if (!alreadyPaid && cost > 0) {
      const newBal = Math.max(0, currentBalance - cost);
      tx.set(
        userRef,
        {
          credits: {
            balance: newBal,
            updatedAt: FieldValue.serverTimestamp(),
          },
        },
        { merge: true }
      );
      returnPayload.newBalance = newBal;
    } else {
      returnPayload.newBalance = currentBalance;
    }

    returnPayload.alreadyPaid = alreadyPaid;
    const oldPot = Number(d.pot ?? 0);
    const newPot = alreadyPaid ? oldPot : oldPot + cost;
    returnPayload.newPot = newPot;
  });

  return returnPayload;
});

/* -------------------- NIGHTLY PLAYERS (old name) -------------- */
async function runRefreshNhlPlayers() {
  const teams = [
    { abbr:"MTL"},{ abbr:"TOR"},{ abbr:"OTT"},{ abbr:"BOS"},{ abbr:"NYR"},{ abbr:"NJD"},
    { abbr:"BUF"},{ abbr:"TBL"},{ abbr:"FLA"},{ abbr:"DET"},{ abbr:"CHI"},{ abbr:"COL"},
    { abbr:"DAL"},{ abbr:"EDM"},{ abbr:"CGY"},{ abbr:"VAN"},{ abbr:"SEA"},{ abbr:"LAK"},
    { abbr:"ANA"},{ abbr:"ARI"},{ abbr:"WPG"},{ abbr:"MIN"},{ abbr:"NSH"},{ abbr:"STL"},
    { abbr:"VGK"},{ abbr:"SJS"},{ abbr:"CBJ"},{ abbr:"PIT"},{ abbr:"PHI"},{ abbr:"WSH"},
    { abbr:"CAR"}
  ];
  for (const team of teams) {
    let roster; try { roster = await apiWebRoster(team); } catch (e) { logger.warn("roster fetch failed", { team:team.abbr, err:String(e) }); continue; }
    const all = [
      ...(roster?.forwards||[]), ...(roster?.defensemen||[]), ...(roster?.goalies||[]),
      ...(Array.isArray(roster?.skaters) ? roster.skaters : []),
    ];
    for (const p of all) {
      const playerId = p?.playerId ?? p?.id;
      const pos = (p?.positionCode ?? p?.position?.abbreviation ?? "").toUpperCase();
      if (!playerId || pos === "G") continue;
      const first = typeof p?.firstName === "string" ? p.firstName : p?.firstName?.default;
      const last  = typeof p?.lastName  === "string" ? p.lastName  : p?.lastName?.default;
      const fullName = [first,last].filter(Boolean).join(" ");
      await db.collection("nhl_players").doc(String(playerId)).set(
        { id:String(playerId), fullName, teamAbbr: String(team.abbr), updatedAt: FieldValue.serverTimestamp() },
        { merge:true }
      );
    }
  }
}
// ancien nom RESTE callable (type inchangé)
export const refreshNhlPlayers = onCall(async () => { await runRefreshNhlPlayers(); return { ok:true }; });
// nouveau cron qui appelle la même logique
export const refreshNhlPlayersCron = onSchedule(
  { schedule: "0 3 * * *", timeZone: "America/Toronto", region: "us-central1" },
  async () => { await runRefreshNhlPlayers(); }
);
// alias pour l’ancien nom déjà déployé côté scheduled (si présent)
export const nightlyNhlPlayers = refreshNhlPlayersCron;

/* -------------------- STATUS CRON ----------------------------- */
export const cronIngestToday = onSchedule(
  { schedule: "*/5 * * * *", timeZone: "America/Toronto", region: "us-central1" },
  async () => {
    const snap = await db.collection("defis").get();
    for (const docSnap of snap.docs) {
      const d = { id: docSnap.id, ...(docSnap.data() || {}) };
      const now = new Date();
      const startAt = readTS(d.startAt);
      const endAt   = readTS(d.endAt);
      let status = String(d.status || "").toLowerCase();
      if (status === "completed") continue;
      if (startAt && now < startAt) status = "open";
      else if (startAt && endAt && now >= startAt && now <= endAt) status = "live";
      else if (endAt && now > endAt) status = "awaiting_result";
      await docSnap.ref.set({ status }, { merge: true });
    }
  }
);
// alias pour l’ancien nom déjà déployé
export const cronDefiStatus = cronIngestToday;

/* -------------------- INGEST (HTTPS + CRON) ------------------- */
async function runIngestStatsForDate() {
  logger.info("[runIngestStatsForDate] tick", { at: new Date().toISOString() });

  const snap = await db.collection("defis").where("status", "in", ["live","awaiting_result","open"]).get();
  for (const docSnap of snap.docs) {
    const defi = docSnap.data() || {};
    const ymd = typeof defi.gameDate === "string" ? defi.gameDate : (defi.gameDate ? toYMD(readTS(defi.gameDate)) : null);
    if (!ymd) continue;

    const sched = await apiWebSchedule(ymd);
    const day   = Array.isArray(sched?.gameWeek) ? sched.gameWeek.find(d => d?.date === ymd) : null;
    const games = day ? (day.games || []) : (Array.isArray(sched?.games) ? sched.games : []);
    const gameIds = games.map(g => g.id).filter(Boolean);
    if (!gameIds.length) continue;

    const GOAL_POINTS = 1;
    const ASSIST_POINTS = 1;
    const goalsByPlayer  = new Map();
    const pointsByPlayer = new Map();
    const inc = (m, id, d=1) => { if (!id) return; m.set(id, (m.get(id)||0) + d); };

    for (const gid of gameIds) {
      let pbp; try { pbp = await apiWebPbp(gid); } catch (e) { logger.warn("pbp fetch failed", { gid, err:String(e) }); continue; }
      const plays = Array.isArray(pbp?.plays) ? pbp.plays : [];
      for (const p of plays) {
        const isGoal = String(p?.typeDescKey||"").toLowerCase() === "goal" || Number(p?.typeCode) === 505;
        if (!isGoal) continue;
        const det = p?.details || {};
        const scorerId = det.scoringPlayerId || det.playerId || null;
        const a1 = det.assist1PlayerId || null;
        const a2 = det.assist2PlayerId || null;
        if (scorerId) { inc(goalsByPlayer, scorerId, 1); inc(pointsByPlayer, scorerId, GOAL_POINTS); }
        if (a1) inc(pointsByPlayer, a1, ASSIST_POINTS);
        if (a2) inc(pointsByPlayer, a2, ASSIST_POINTS);
      }
    }

    const liveRef   = docSnap.ref.collection("live").doc("stats");
    const goalsObj  = Object.fromEntries(Array.from(goalsByPlayer.entries(),  ([k,v]) => [String(k), v]));
    const pointsObj = Object.fromEntries(Array.from(pointsByPlayer.entries(), ([k,v]) => [String(k), v]));

    const bw = db.bulkWriter();
    bw.set(liveRef, { playerGoals: goalsObj, playerPoints: pointsObj, updatedAt: FieldValue.serverTimestamp() }, { merge:true });

    const parts = await docSnap.ref.collection("participations").get();
    for (const pSnap of parts.docs) {
      const p = pSnap.data() || {};
      const picks = Array.isArray(p.picks) ? p.picks : [];
      let pts = 0;
      for (const pick of picks) {
        const raw = pick?.playerId ?? pick?.id ?? pick?.nhlId ?? pick?.player?.id;
        if (!raw) continue;
        const s = String(raw).trim();
        const key = /^\d+$/.test(s) ? String(Number(s)) : s;
        pts += Number(pointsObj[key] ?? 0);
      }
      bw.update(pSnap.ref, { livePoints: pts, liveUpdatedAt: FieldValue.serverTimestamp() });
    }
    await bw.close();
  }
  logger.info("[runIngestStatsForDate] done");
}

// conserve l’ancien nom en HTTPS (type inchangé)
export const ingestStatsForDate = onCall(async () => { await runIngestStatsForDate(); return { ok:true }; });
// nouvelle scheduled qui appelle la même logique
export const ingestStatsForDateCron = onSchedule(
  { schedule: "*/2 * * * *", timeZone: "America/Toronto", region: "us-central1" },
  async () => { await runIngestStatsForDate(); }
);
// alias pour l’ancien nom cron déjà déployé
export const syncDefiLiveScores = ingestStatsForDateCron;

/* -------------------- FINALIZATION (old name) ----------------- */
export const finalizeDefiWinners = onSchedule(
  { schedule: "every 15 minutes", timeZone: "America/Toronto", region: "us-central1" },
  async () => {
    const toFinalize = await db.collection("defis").where("status","==","awaiting_result").get();
    if (toFinalize.empty) { logger.info("finalizeDefiWinners: none"); return; }

    for (const d of toFinalize.docs) {
      const defi = { id:d.id, ...(d.data()||{}) };
      if (String(defi.status||"").toLowerCase() === "completed") continue;

      const ps = await d.ref.collection("participations").get();
      const parts = ps.docs.map(s => {
        const v = s.data()||{};
        return { uid:s.id, livePoints:Number(v.livePoints||0), picks:Array.isArray(v.picks)?v.picks:[] };
      });
      if (!parts.length) {
        await d.ref.set({ status:"completed", winners:[], winnerShares:{}, completedAt: FieldValue.serverTimestamp() }, { merge:true });
        continue;
      }

      const top = parts.reduce((m,p)=>Math.max(m,p.livePoints), -Infinity);
      const winners = parts.filter(p=>p.livePoints===top).map(p=>p.uid);
      const potOutside = Number(defi.pot || 0);

      await db.runTransaction(async (tx) => {
            const dRef = db.collection("defis").doc(defi.id);

            // --- LECTURES D'ABORD ---
            const dSnap = await tx.get(dRef);                           // défi
            const cur = dSnap.exists ? (dSnap.data() || {}) : {};
            const curStatus = String(cur.status || "").toLowerCase();
            if (curStatus !== "awaiting_result") {
                logger.info(`defi ${defi.id}: status=${curStatus} — rien à faire.`);
                return;
            }

            // pré-lire les profils participants gagnants AVANT TOUTE ÉCRITURE
            const pRefs = winners.map((uid) => db.collection("participants").doc(uid));
            const pSnaps = await Promise.all(pRefs.map((r) => tx.get(r)));

            // --- CALCULS (pas d'I/O ici) ---
            const pot = Number(cur.pot || potOutside || 0);
            const shares = splitEven(pot, winners.length);
            const winnerShares = {};
            winners.forEach((uid, i) => { winnerShares[uid] = shares[i] || 0; });

            // --- ÉCRITURES ENSUITE ---
            // 1) Marquer le défi complété + winners
            tx.set(dRef, {
                status: "completed",
                winners,
                winnerShares,
                completedAt: FieldValue.serverTimestamp(),
            }, { merge: true });

            // 2) Payouts dans participations/*
            for (const p of parts) {
                const payout = winners.includes(p.uid) ? (winnerShares[p.uid] || 0) : 0;
                tx.set(dRef.collection("participations").doc(p.uid), {
                finalPoints: p.livePoints,
                payout,
                finalizedAt: FieldValue.serverTimestamp(),
                }, { merge: true });
            }

            // 3) Créditer les gagnants dans participants/*
            for (let i = 0; i < winners.length; i++) {
                const uid = winners[i];
                const amount = shares[i] || 0;
                if (!(amount > 0)) continue;

                const pRef = pRefs[i];
const pSnap = pSnaps[i];
const curP  = pSnap.exists ? (pSnap.data() || {}) : {};

const curBal = readAnyBalance(curP);     // ← récupère 44 même si c'est "44" (string)
const newBal = curBal + amount;

// On écrit en schéma "canonique" objet, sans lire à nouveau, et sans .increment.
// merge:true préserve les autres champs.
tx.set(pRef, {
  credits: {
    balance: newBal,
    updatedAt: FieldValue.serverTimestamp(),
  }
}, { merge: true });
            }
            });
      logger.info(`defi ${defi.id}: completed`, { winners, pot: potOutside });
    }
  }
);
// alias pour ancien nom déjà déployé
export const finalizeAwaitingDefis = finalizeDefiWinners;

/* -------------------- Optional callable finalizer -------------- */
export const finalizeOneDefi = onCall(async (req) => {
  const id = String(req.data?.defiId || "");
  if (!id) throw new HttpsError("invalid-argument", "defiId required");
  const docSnap = await db.collection("defis").doc(id).get();
  if (!docSnap.exists) throw new HttpsError("not-found", "defi not found");
  const defi = { id: docSnap.id, ...(docSnap.data()||{}) };
  if (String(defi.status||"").toLowerCase() !== "awaiting_result") {
    throw new HttpsError("failed-precondition", "defi not awaiting_result");
  }

  const pSnap = await docSnap.ref.collection("participations").get();
  const parts = pSnap.docs.map(d => {
    const v = d.data() || {};
    return { uid:d.id, livePoints:Number(v.livePoints||0), picks:Array.isArray(v.picks)?v.picks:[] };
  });
  if (!parts.length) {
    await docSnap.ref.set({ status:"completed", winners:[], winnerShares:{}, completedAt: FieldValue.serverTimestamp() }, { merge:true });
    return { ok:true, winners:[], winnerShares:{}, pot:Number(defi.pot||0) };
  }

  let resultPot = Number(defi.pot || 0);
  let resultShares = {};
  const top = parts.reduce((m,p)=>Math.max(m,p.livePoints), -Infinity);
  const winners = parts.filter(p=>p.livePoints===top).map(p=>p.uid);

  await db.runTransaction(async (tx) => {
  const dRef = db.collection("defis").doc(defi.id);

  // --- LECTURES D'ABORD ---
  const dSnap = await tx.get(dRef);
  const cur = dSnap.exists ? (dSnap.data() || {}) : {};

  // pré-lire les profils gagnants
  const pRefs = winners.map((uid) => db.collection("participants").doc(uid));
  const pSnaps = await Promise.all(pRefs.map((r) => tx.get(r)));

  // --- CALCULS ---
  const pot = Number(cur.pot || defi.pot || 0);
  const shares = splitEven(pot, winners.length);
  const winnerShares = {};
  winners.forEach((uid, i) => { winnerShares[uid] = shares[i] || 0; });

  // --- ÉCRITURES ---
  tx.set(dRef, {
    status: "completed",
    winners,
    winnerShares,
    completedAt: FieldValue.serverTimestamp(),
  }, { merge: true });

  for (const p of parts) {
    const payout = winners.includes(p.uid) ? (winnerShares[p.uid] || 0) : 0;
    tx.set(dRef.collection("participations").doc(p.uid), {
      finalPoints: p.livePoints,
      payout,
      finalizedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
  }

  for (let i = 0; i < winners.length; i++) {
    const uid = winners[i];
    const amount = shares[i] || 0;
    if (!(amount > 0)) continue;

    const pRef = pRefs[i];
    const pSnap = pSnaps[i];
    const curP = pSnap.exists ? (pSnap.data() || {}) : {};

    if (typeof curP?.credits?.balance === "number") {
      tx.update(pRef, {
        credits: { balance: FieldValue.increment(amount), updatedAt: FieldValue.serverTimestamp() }
      });
    } else if (typeof curP?.credits === "number" || typeof curP?.credit === "number") {
      tx.update(pRef, { credits: FieldValue.increment(amount) });
    } else if (typeof curP?.balance === "number") {
      tx.update(pRef, { balance: FieldValue.increment(amount) });
    } else {
      tx.set(pRef, {
        credits: { balance: amount, updatedAt: FieldValue.serverTimestamp() }
      }, { merge: true });
    }
  }

  // (facultatif) renvoyer des valeurs au scope appelant via variables capturées
  resultPot = pot;
  resultShares = winnerShares;
});

  return { ok:true, winners, pot: resultPot, winnerShares: resultShares };
});

/**
 * On crée un défi: notifier tous les membres actifs du groupe (sauf le créateur).
 * Attendu dans defis/{defiId}:
 *  - groupId: string
 *  - createdBy: uid du créateur (ex: ownerId / createdBy / authorId -> voir mapping ci-dessous)
 *  - type: nombre (ex: 3 => "3x3")
 *  - title (optionnel)
 */
// ✅ Version Firebase Functions v2 (avec région)
export const notifyOnDefiCreate = onDocumentCreated(
  { document: "defis/{defiId}", region: "us-central1" },
  async (event) => {
    const defiId = event.params.defiId;
    const snap = event.data;                // QueryDocumentSnapshot
    const d = snap?.data() || {};

    const groupId = String(d.groupId || d.groupID || d.group || "").trim();
    if (!groupId) return;

    const createdBy = String(d.createdBy || d.ownerId || d.authorId || "").trim() || null;
    const typeNum = Number(d.type ?? 0);
    const typeLabel = Number.isFinite(typeNum) && typeNum > 0 ? `${typeNum}x${typeNum}` : "défi";

    // Flag test: inclure aussi le créateur
    const includeCreator =
      d.debugNotifyCreator === true ||
      d.notifyCreator === true ||
      process.env.FORCE_NOTIFY_CREATOR === "1";

    const [groupSnap, creatorSnap] = await Promise.all([
      db.collection("groups").doc(groupId).get(),
      createdBy ? db.collection("participants").doc(createdBy).get() : Promise.resolve(null),
    ]);

    const groupName = groupSnap.exists ? (groupSnap.data()?.name || groupId) : groupId;
    const creatorName = creatorSnap?.exists
      ? (creatorSnap.data()?.displayName || creatorSnap.data()?.name || "Quelqu’un")
      : "Quelqu’un";

    const title = `Nouveau défi dans ${groupName}`;
    const body  = `Hey, ${creatorName} te lance un défi ${typeLabel} dans le groupe ${groupName}. Veux-tu le défier ?`;

    // Membres actifs du groupe
    const memSnap = await db.collection("group_memberships")
      .where("groupId", "==", groupId)
      .where("active", "==", true)
      .get();

    // Si pas de membres, on continue quand même si on veut notifier le créateur (mode test)
    if (memSnap.empty && !includeCreator) return;

    const targetUids = new Set();
    memSnap.forEach(doc => {
      const m = doc.data() || {};
      const uid = String(m.userId || m.uid || "").trim();
      if (!uid) return;
      if (createdBy && uid === createdBy) return; // en prod on exclut l’auteur
      targetUids.add(uid);
    });

    if (includeCreator && createdBy) targetUids.add(createdBy);
    if (targetUids.size === 0) return;

    // Récup tokens + créer une notif in-app
    const notifDocs = [];
    const readTokensForUser = async (uid) => {
      const pSnap = await db.collection("participants").doc(uid).get();
      const pdata = pSnap.exists ? (pSnap.data() || {}) : {};
      const allow = pdata?.prefs?.push?.groupDefi;
      if (allow === false) return [];

      const out = new Set();
      const map = pdata?.fcmTokens;
      if (map && typeof map === "object") {
        for (const k of Object.keys(map)) {
          const t = String(k).trim();
          if (t) out.add(t);
        }
      }
      const single = pdata?.fcmToken;
      if (single && typeof single === "string") out.add(single.trim());

      const sub = await db.collection("participants").doc(uid).collection("fcm_tokens").get();
      sub.forEach(s => {
        const t = s.data()?.token;
        if (t && typeof t === "string") out.add(t.trim());
      });

      notifDocs.push({
        uid,
        docRef: db.collection("participants").doc(uid).collection("notifications").doc(),
        payload: {
          type: "defi_created",
          title,
          body,
          defiId,
          groupId,
          createdAt: FieldValue.serverTimestamp(),
          read: false,
        }
      });

      return Array.from(out);
    };

    const tokenLists = await Promise.all(Array.from(targetUids).map(readTokensForUser));
    const allTokens = tokenLists.flat().filter(Boolean);
    if (!allTokens.length) {
      await Promise.all(notifDocs.map(n => n.docRef.set(n.payload)));
      return;
    }

    // Envoi FCM (par paquets)
    const chunks = [];
    for (let i = 0; i < allTokens.length; i += 500) chunks.push(allTokens.slice(i, i + 500));

    const messageBase = {
      notification: { title, body },
      data: { action: "OPEN_DEFI", defiId, groupId },
      android: { priority: "high", notification: { channelId: "challenges" } },
      apns: { payload: { aps: { sound: "default", badge: 1 } } },
    };

    const sendResults = [];
    for (const tks of chunks) {
      const resp = await admin.messaging().sendEachForMulticast({ ...messageBase, tokens: tks });
      sendResults.push(resp);
    }

    await Promise.all(notifDocs.map(n => n.docRef.set(n.payload)));

    // (Optionnel) nettoyage des tokens invalides selon tes besoins
  }
);