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

function compactYmdFromIso(ymd) {
  return String(ymd || "").slice(0, 10).replace(/-/g, "");
}

function gameDateFromAnyYmd(v) {
  const compact = String(v || "").replace(/\D/g, "");
  if (compact.length === 8) {
    return `${compact.slice(0, 4)}-${compact.slice(4, 6)}-${compact.slice(6, 8)}`;
  }
  return ymd10(v);
}

function bundleHasScoredSlots(bundle = {}) {
  if (bundle.payoutApplied === true) return true;
  const status = String(bundle.status || "").toLowerCase();
  if (["decided", "partial", "closed"].includes(status)) return true;
  const games = Array.isArray(bundle.games) ? bundle.games : [];
  return games.some((g) => g?.payoutApplied === true);
}

function parseTpScoredEntry(entry = {}) {
  const points = toNumber(entry.points ?? entry.payout ?? entry.totalPoints, 0);
  const won =
    entry.won === true || entry.winnerCorrect === true || points > 0;

  return {
    points,
    won,
    displayName: entry.displayName || null,
    avatarUrl: pickString(entry.avatarUrl),
  };
}

function parseTpBundleEntry(entry = {}) {
  const pickResults = { ...(entry.pickResults || {}) };
  for (const [key, value] of Object.entries(entry)) {
    if (!key.startsWith("pickResults.")) continue;
    if (!value || typeof value !== "object") continue;
    pickResults[key.slice("pickResults.".length)] = value;
  }

  let pointsFromResults = 0;
  let won = false;

  for (const result of Object.values(pickResults)) {
    if (!result || typeof result !== "object") continue;
    pointsFromResults += toNumber(result.points, 0);
    if (result.won === true || result.winnerCorrect === true) won = true;
  }

  const totalFromField = toNumber(entry.totalPoints, 0);
  const points =
    pointsFromResults > 0 ? Math.max(totalFromField, pointsFromResults) : totalFromField;

  return {
    points,
    won,
    displayName: entry.displayName || null,
    avatarUrl: pickString(entry.avatarUrl),
  };
}

function tpEntryHasParticipation(entry = {}) {
  if (Number(entry?.picksCompletedCount ?? 0) > 0) return true;
  const picks = entry?.picks;
  return picks && typeof picks === "object" && Object.keys(picks).length > 0;
}

function addTpLeaderboardEntry({
  totals,
  summary,
  uid,
  points,
  won,
  displayName,
  avatarUrl,
  gameDate,
  seasonId,
  fromYmd,
}) {
  const cur = ensureAgg(totals, uid);
  const weekKey = weekKeyFromGameDate({ seasonId, fromYmd, gameDate });
  const monthKey = monthKeyFromGameDate(gameDate);

  cur.participations += 1;
  if (won) cur.wins += 1;

  cur.pointsTotal += toNumber(points, 0);
  incMap(cur.pointsByWeek, weekKey, points);
  incMap(cur.pointsByMonth, monthKey, points);

  if (won) {
    incMap(cur.winsByWeek, weekKey, 1);
    incMap(cur.winsByMonth, monthKey, 1);
  }

  cur.families.tp.plays += 1;
  cur.families.tp.points += toNumber(points, 0);
  if (won) cur.families.tp.wins += 1;

  summary.totals.tp.plays += 1;
  summary.totals.tp.points += toNumber(points, 0);
  if (won) summary.totals.tp.wins += 1;

  const tpTypeKey = "TP";
  if (!cur.winsByType[tpTypeKey]) {
    cur.winsByType[tpTypeKey] = {
      plays: 0,
      wins: 0,
      pointsTotal: 0,
      nhlPointsTotal: 0,
      nhlGamesTotal: 0,
    };
  }

  cur.winsByType[tpTypeKey].plays += 1;
  if (won) cur.winsByType[tpTypeKey].wins += 1;
  cur.winsByType[tpTypeKey].pointsTotal += toNumber(points, 0);

  if (!cur.displayName && displayName) cur.displayName = displayName;
  if (!cur.avatarUrl && avatarUrl) cur.avatarUrl = avatarUrl;
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

/* -------------------- Challenge family helpers -------------------- */

function challengeFamily(defi = {}) {
  const ascKey = String(defi?.ascension?.key || "").toUpperCase();
  if (ascKey === "ASC7") return "ascension_legacy"; // ignoré ensuite

  const title = String(defi?.title || "").toLowerCase();
  const defiKey = String(defi?.defiKey || "").toLowerCase();
  const mode = String(defi?.mode || "").toLowerCase();
  const category = String(defi?.category || "").toLowerCase();
  const typeRaw = defi?.type;
  const type = String(typeRaw || "").toLowerCase();

  const isFGC =
    type === "first_goal" ||
    defiKey.includes("fgc") ||
    title.includes("fgc") ||
    title.includes("first goal") ||
    title.includes("premier but") ||
    mode === "fgc" ||
    category === "fgc";

  if (isFGC) return "fgc";

  const isTP =
    type === "team_prediction" ||
    defiKey.includes("tp") ||
    title.includes("team prediction") ||
    title.includes("équipe gagnante") ||
    title.includes("equipe gagnante") ||
    mode === "tp" ||
    category === "tp";

  if (isTP) return "tp";

  const nType = Number(typeRaw);
  if (Number.isFinite(nType) && nType >= 1 && nType <= 7) return "ts";

  return "ts";
}

function emptyFamilyStats() {
  return { points: 0, plays: 0, wins: 0 };
}

function makeEmptyAgg(uid) {
  return {
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

    // ✅ per format (1x1, 2x2, 3x3...)
    winsByType: {},

    // ✅ per family (FGC / standard / ascension)
    families: {
    fgc: emptyFamilyStats(),
    tp: emptyFamilyStats(),
    ts: emptyFamilyStats(),
    },

    displayName: null,
    avatarUrl: null,
    avatarId: null,
  };
}

function ensureAgg(totals, uid) {
  const cur = totals.get(uid) || makeEmptyAgg(uid);
  totals.set(uid, cur);
  return cur;
}

/**
 * FGC entry parsing
 *
 * payout: vrai payout si la function FGC l’écrit
 * won:
 * - payout > 0
 * - OU flag won=true
 * - OU uid présent dans winnersPreviewUids (fallback)
 *
 * points FGC MVP:
 * - payout si présent
 * - sinon 1 si gagné
 * - sinon 0
 */
function parseFgcEntry({ entry = {}, winnersPreviewUids = [] }) {
  const payout = toNumber(entry?.payout, 0);
  const won =
    entry?.won === true ||
    payout > 0 ||
    winnersPreviewUids.includes(String(entry?.uid || entry?.pickedBy || ""));

  const points = payout > 0 ? payout : won ? 1 : 0;

  return {
    payout,
    won,
    points,
    displayName: entry?.displayName || null,
  };
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

  // uid -> aggregates
  const totals = new Map();

  /* -------------------- 1) DEFIS: Standard + Ascension -------------------- */
  const defisSnap = await db
    .collection("defis")
    .where("groupId", "==", groupId)
    .where("status", "==", "completed")
    .where("gameDate", ">=", from)
    .where("gameDate", "<=", to)
    .get();

  // ✅ summary global pour comparaison future avec moyenne des autres
const summary = {
  membersCount: 0,
  defisCount: defisSnap.size,
  fgcCount: 0,
  tpChallengeCount: 0,
  tpBundleCount: 0,
  totals: {
    fgc: emptyFamilyStats(),
    tp: emptyFamilyStats(),
    ts: emptyFamilyStats(),
  },
};

  for (const d of defisSnap.docs) {
    const defi = d.data() || {};
    const tKey = typeKey(defi?.type);
    const family = challengeFamily(defi);
    const gameDate = ymd10(defi?.gameDate);

    const weekKey = weekKeyFromGameDate({ seasonId, fromYmd: from, gameDate });
    const monthKey = monthKeyFromGameDate(gameDate);
    const partsSnap = await db.collection(`defis/${d.id}/participations`).get();

    for (const p of partsSnap.docs) {
      const uid = p.id;
      const { finalPoints, won, displayName, potInc, picksLen } = parseParticipation(p.data());

      const cur = ensureAgg(totals, uid);

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

      if (cur.families[family]) {
        cur.families[family].plays += 1;
        cur.families[family].points += toNumber(potInc, 0);
        if (won) cur.families[family].wins += 1;
      }

      if (summary.totals[family]) {
        summary.totals[family].plays += 1;
        summary.totals[family].points += toNumber(potInc, 0);
        if (won) summary.totals[family].wins += 1;
      }

      // --- by format type
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
    }
  }

  /* -------------------- 2) FGC: first_goal_challenges -------------------- */
  const fgcSnap = await db
    .collection("first_goal_challenges")
    .where("groupId", "==", groupId)
    .where("status", "in", ["decided", "closed"])
    .where("gameYmd", ">=", from)
    .where("gameYmd", "<=", to)
    .get();

  summary.fgcCount = fgcSnap.size;

  for (const chDoc of fgcSnap.docs) {
    const ch = chDoc.data() || {};
    const gameDate = ymd10(ch?.gameYmd);
    const weekKey = weekKeyFromGameDate({ seasonId, fromYmd: from, gameDate });
    const monthKey = monthKeyFromGameDate(gameDate);
    const winnersPreviewUids = Array.isArray(ch?.winnersPreviewUids)
      ? ch.winnersPreviewUids.map(String)
      : [];

    const entriesSnap = await db.collection(`first_goal_challenges/${chDoc.id}/entries`).get();

    for (const e of entriesSnap.docs) {
      const entry = e.data() || {};
      const uid = String(entry?.uid || entry?.pickedBy || e.id);
      if (!uid) continue;

      const { won, points, displayName } = parseFgcEntry({
        entry: { ...entry, uid },
        winnersPreviewUids,
      });

      const cur = ensureAgg(totals, uid);

      // ✅ FGC compte comme une participation pour le leaderboard MVP
      cur.participations += 1;
      if (won) cur.wins += 1;

      // ✅ Prophetik points globaux incluent FGC
      cur.pointsTotal += toNumber(points, 0);
      incMap(cur.pointsByWeek, weekKey, points);
      incMap(cur.pointsByMonth, monthKey, points);

      if (won) {
        incMap(cur.winsByWeek, weekKey, 1);
        incMap(cur.winsByMonth, monthKey, 1);
      }

      // ✅ family aggregates
      cur.families.fgc.plays += 1;
      cur.families.fgc.points += toNumber(points, 0);
      if (won) cur.families.fgc.wins += 1;

      // ✅ summary
      summary.totals.fgc.plays += 1;
      summary.totals.fgc.points += toNumber(points, 0);
      if (won) summary.totals.fgc.wins += 1;

      // ✅ winsByType: on isole FGC dans une clé spéciale
      const fgcTypeKey = "FGC";
      if (!cur.winsByType[fgcTypeKey]) {
        cur.winsByType[fgcTypeKey] = {
          plays: 0,
          wins: 0,
          pointsTotal: 0,
          nhlPointsTotal: 0,
          nhlGamesTotal: 0,
        };
      }

      cur.winsByType[fgcTypeKey].plays += 1;
      if (won) cur.winsByType[fgcTypeKey].wins += 1;
      cur.winsByType[fgcTypeKey].pointsTotal += toNumber(points, 0);

      if (!cur.displayName && displayName) cur.displayName = displayName;
      if (!cur.avatarUrl) {
        const avatarUrl = pickString(entry?.avatarUrl);
        if (avatarUrl) cur.avatarUrl = avatarUrl;
      }
    }
  }

  /* -------------------- 3) TP challenges (legacy single-match) -------------------- */
  const fromCompact = compactYmdFromIso(from);
  const toCompact = compactYmdFromIso(to);

  const tpChSnap = await db
    .collection("team_prediction_challenges")
    .where("groupId", "==", groupId)
    .get();

  const tpChDocs = tpChSnap.docs.filter((d) => {
    const ch = d.data() || {};
    if (String(ch.status || "").toLowerCase() !== "decided") return false;
    const gameYmd = String(ch.gameYmd || "");
    return gameYmd >= fromCompact && gameYmd <= toCompact;
  });

  summary.tpChallengeCount = tpChDocs.length;

  for (const chDoc of tpChDocs) {
    const ch = chDoc.data() || {};
    const gameDate = gameDateFromAnyYmd(ch?.gameYmd);
    const entriesSnap = await db
      .collection(`team_prediction_challenges/${chDoc.id}/entries`)
      .get();

    for (const e of entriesSnap.docs) {
      const entry = e.data() || {};
      const uid = String(entry?.uid || e.id);
      if (!uid) continue;

      const { points, won, displayName, avatarUrl } = parseTpScoredEntry(entry);

      addTpLeaderboardEntry({
        totals,
        summary,
        uid,
        points,
        won,
        displayName,
        avatarUrl,
        gameDate,
        seasonId,
        fromYmd: from,
      });
    }
  }

  /* -------------------- 4) TP bundles (multi-match) -------------------- */
  const tpBundleSnap = await db
    .collection("team_prediction_bundles")
    .where("groupId", "==", groupId)
    .get();

  const tpBundleDocs = tpBundleSnap.docs.filter((d) => {
    const bundle = d.data() || {};
    const gameYmd = String(bundle.gameYmd || "");
    return gameYmd >= fromCompact && gameYmd <= toCompact;
  });

  summary.tpBundleCount = tpBundleDocs.filter((d) =>
    bundleHasScoredSlots(d.data() || {})
  ).length;

  for (const bundleDoc of tpBundleDocs) {
    const bundle = bundleDoc.data() || {};
    if (!bundleHasScoredSlots(bundle)) continue;

    const gameDate = gameDateFromAnyYmd(bundle?.gameYmd);
    const entriesSnap = await db
      .collection(`team_prediction_bundles/${bundleDoc.id}/entries`)
      .get();

    for (const e of entriesSnap.docs) {
      const entry = e.data() || {};
      const uid = String(entry?.uid || e.id);
      if (!uid) continue;
      if (!tpEntryHasParticipation(entry)) continue;

      const { points, won, displayName, avatarUrl } = parseTpBundleEntry(entry);

      addTpLeaderboardEntry({
        totals,
        summary,
        uid,
        points,
        won,
        displayName,
        avatarUrl,
        gameDate,
        seasonId,
        fromYmd: from,
      });
    }
  }

  const allUids = [...totals.keys()];
  summary.membersCount = totals.size;

  /* -------------------- 5) Enrichissement noms / avatars -------------------- */

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
        return cur && (!cur.avatarUrl || !cur.avatarId);
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
          if (!cur.avatarUrl && avatarUrl) cur.avatarUrl = avatarUrl;
          if (!cur.avatarId && avatarId) cur.avatarId = avatarId;
        });
      }
    }
  }

  /* -------------------- 6) summary averages -------------------- */

  const count = summary.membersCount || 0;
  const averages = {
    fgc: {
      points: safeDiv(summary.totals.fgc.points, count),
      wins: safeDiv(summary.totals.fgc.wins, count),
      plays: safeDiv(summary.totals.fgc.plays, count),
    },
    tp: {
      points: safeDiv(summary.totals.tp.points, count),
      wins: safeDiv(summary.totals.tp.wins, count),
      plays: safeDiv(summary.totals.tp.plays, count),
    },
    ts: {
      points: safeDiv(summary.totals.ts.points, count),
      wins: safeDiv(summary.totals.ts.wins, count),
      plays: safeDiv(summary.totals.ts.plays, count),
    },
  };

  /* -------------------- 7) Écriture metadata + summary -------------------- */

  await db.doc(`groups/${groupId}/leaderboards/${seasonId}`).set(
    {
      seasonId,
      groupId,
      fromYmd: from,
      toYmd: to,
      membersCount: totals.size,
      defisCount: defisSnap.size,
      fgcCount: fgcSnap.size,
      tpChallengeCount: summary.tpChallengeCount,
      tpBundleCount: summary.tpBundleCount,
      rebuiltAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  await db.doc(`groups/${groupId}/leaderboards/${seasonId}/stats/summary`).set(
    {
      seasonId,
      groupId,
      fromYmd: from,
      toYmd: to,

      membersCount: summary.membersCount,
      defisCount: summary.defisCount,
      fgcCount: summary.fgcCount,
      tpChallengeCount: summary.tpChallengeCount,
      tpBundleCount: summary.tpBundleCount,

      totals: summary.totals,
      averages,

      updatedAt: FieldValue.serverTimestamp(),
      rebuiltAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  /* -------------------- 8) Écriture members -------------------- */

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

      const fgc = agg.families?.fgc || emptyFamilyStats();
      const tp = agg.families?.tp || emptyFamilyStats();
      const ts = agg.families?.ts || emptyFamilyStats();

      const cleanPointsTotal =
        toNumber(fgc.points, 0) +
        toNumber(tp.points, 0) +
        toNumber(ts.points, 0);

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

          // ✅ Prophetik global (sans ascension legacy)
          pointsTotal: cleanPointsTotal,
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

          winsByType,

          families: {
            fgc,
            tp,
            ts,
          },

          fgcPoints: fgc.points,
          tpPoints: tp.points,
          tsPoints: ts.points,

          fgcWins: fgc.wins,
          tpWins: tp.wins,
          tsWins: ts.wins,

          fgcPlays: fgc.plays,
          tpPlays: tp.plays,
          tsPlays: ts.plays,

          // ✅ nettoyage legacy
          "families.standard": FieldValue.delete(),
          "families.ascension": FieldValue.delete(),

          standardPoints: FieldValue.delete(),
          ascensionPoints: FieldValue.delete(),

          standardWins: FieldValue.delete(),
          ascensionWins: FieldValue.delete(),

          standardPlays: FieldValue.delete(),
          ascensionPlays: FieldValue.delete(),

          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    }

    await batch.commit();
  }

  /* -------------------- 9) Clear dirty flag -------------------- */

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
    fgc: fgcSnap.size,
    tpChallenges: summary.tpChallengeCount,
    tpBundles: summary.tpBundleCount,
    fromYmd: from,
    toYmd: to,
    clearedDirty: !!clearDirty,
  };
}