// functions/defis/onDefiCreated.js
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { logger } from "firebase-functions";
import { db, FieldValue } from "../utils.js";


// ✅ règle “pas plus que 72h avant”
const MAX_AHEAD_HOURS = 72;

// ✅ pool figé du défi
const POOL_SIZE = 150;

// Firestore getAll limite pratique: on chunk à 400-500
const GETALL_CHUNK = 400;

/* ===================== DATE / SEASON ===================== */

function toYMD(v) {
  if (!v) return null;
  if (typeof v === "string") return v.trim().slice(0, 10);
  const d = v?.toDate?.() ? v.toDate() : v instanceof Date ? v : new Date(v);
  if (!d || Number.isNaN(d.getTime())) return null;
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

function ymdToronto(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (t) => parts.find((p) => p.type === t)?.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

// même logique que ton client: saison démarre ~ juillet
function seasonIdFromGameDateYmd(ymd) {
  const y = Number(ymd.slice(0, 4));
  const m = Number(ymd.slice(5, 7));
  const start = m >= 7 ? y : y - 1;
  return `${start}${start + 1}`; // ex 20252026
}

function ymdCompact(ymd) {
  return String(ymd || "").replaceAll("-", "");
}

function ymdFromStartTimeUTC(startTimeUTC) {
  if (!startTimeUTC) return null;
  const d = new Date(startTimeUTC);
  if (!d || Number.isNaN(d.getTime())) return null;
  return ymdToronto(d); // ymdToronto formate en America/Toronto
}


/* ===================== HELPERS ===================== */

function tierFromIndex0(idx0) {
  if (idx0 <= 9) return "T1";
  if (idx0 <= 19) return "T2";
  return "T3";
}

/**
 * ✅ Source de vérité: nhl_schedule_daily/{snapshotYyyymmdd}/games/*
 * Contient la semaine, donc on filtre par startTimeUTC (YYYY-MM-DD)
 */
async function fetchTeamsPlayingOnFromScheduleDaily(gameDateYmd) {
  if (!gameDateYmd) return [];

  // On lit le snapshot "aujourd'hui" (Toronto), car il contient la semaine à venir
  const snapshotYmd = ymdToronto(new Date());
  const snapshotId = ymdCompact(snapshotYmd);

  const snap = await db.collection(`nhl_schedule_daily/${snapshotId}/games`).get();

  const set = new Set();

  snap.forEach((doc) => {
    const g = doc.data() || {};
    const gYmd = ymdFromStartTimeUTC(g.startTimeUTC);
    if (gYmd !== gameDateYmd) return;

    const h = String(g?.home?.abbr || "").toUpperCase();
    const a = String(g?.away?.abbr || "").toUpperCase();
    if (h) set.add(h);
    if (a) set.add(a);
  });

  // ✅ fallback soft: si vide (rare), essaie le snapshot d'hier
  if (set.size === 0) {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const snapYmd2 = ymdToronto(yesterday);
    const snapId2 = ymdCompact(snapYmd2);

    const snap2 = await db.collection(`nhl_schedule_daily/${snapId2}/games`).get();
    snap2.forEach((doc) => {
      const g = doc.data() || {};
      const gYmd = ymdFromStartTimeUTC(g.startTimeUTC);
      if (gYmd !== gameDateYmd) return;

      const h = String(g?.home?.abbr || "").toUpperCase();
      const a = String(g?.away?.abbr || "").toUpperCase();
      if (h) set.add(h);
      if (a) set.add(a);
    });
  }

  return Array.from(set);
}

function chunk(arr, n) {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

function num(v, fallback = 0) {
  const x = Number(v);
  return Number.isFinite(x) ? x : fallback;
}

function clamp(v, lo, hi) {
  const x = num(v, 0);
  return Math.max(lo, Math.min(hi, x));
}

/* ===================== NOVA ===================== */

// ✅ métrique Nova (sert pour ses picks, PAS pour tiers/rank)
function computeNovaBaseScore({ pointsPerGame, coeff, reliability }) {
  // score = PPG * coeff * (1 - clamp(reliability, 0..0.25))
  const ppg = num(pointsPerGame, 0);
  const c = num(coeff, 1);
  const rel = clamp(reliability, 0, 0.25);
  return ppg * c * (1 - rel);
}

/* ===================== DAILY MATCHUPS (ENRICHED) ===================== */
/**
 * On lit une collection déjà “enrichie” quotidiennement (rank overall, goalDifferential, etc.)
 * Structure attendue:
 *   nhl_matchups_daily/{yyyymmdd}/games/{gameId} : {
 *     gameId,
 *     startTimeUTC,
 *     home: { abbr, rankOverall, goalDifferential, ... },
 *     away: { abbr, rankOverall, goalDifferential, ... },
 *     context: { homeCoeff, awayCoeff, notes? }
 *   }
 *
 * Si cette collection n'existe pas encore, on retombe en mode neutre.
 */
async function loadMatchupsByTeam({ gameDateYmd }) {
  const yyyymmdd = ymdCompact(gameDateYmd);
  const snap = await db.collection(`nhl_matchups_daily/${yyyymmdd}/games`).get();

  const map = new Map();

  snap.forEach((doc) => {
    const g = doc.data() || {};

    // ✅ FILTRE PAR DATE DU MATCH
    const gYmd = ymdFromStartTimeUTC(g.startTimeUTC);
    if (gYmd !== gameDateYmd) return;

    const home = g.home || {};
    const away = g.away || {};

    const homeAbbr = String(home.abbr || "").toUpperCase();
    const awayAbbr = String(away.abbr || "").toUpperCase();
    if (!homeAbbr || !awayAbbr) return;

    const gameId = String(g.gameId || doc.id);

    const homeEntry = {
      gameId,
      isHome: true,
      homeAbbr,
      awayAbbr,
      opponentAbbr: awayAbbr,
      homeStats: home,
      awayStats: away,
      context: g.context || {},
      startTimeUTC: g.startTimeUTC || null,
    };

    const awayEntry = {
      gameId,
      isHome: false,
      homeAbbr,
      awayAbbr,
      opponentAbbr: homeAbbr,
      homeStats: home,
      awayStats: away,
      context: g.context || {},
      startTimeUTC: g.startTimeUTC || null,
    };

    map.set(homeAbbr, homeEntry);
    map.set(awayAbbr, awayEntry);
  });

  return map;
}
/**
 * Coeff contextuel (simple, clampé)
 * - baseCoeff vient de ton ingest (balance D/F etc.)
 * - ctx homeCoeff/awayCoeff vient du daily matchup context
 */
function computeFinalCoeff({ baseCoeff, matchupEntry }) {
  const base = num(baseCoeff, 1);

  if (!matchupEntry) {
    return {
      opponentCoeff: 1,
      homeCoeff: 1,
      fatigueCoeff: 1,
      finalCoeff: Number(base.toFixed(4)),
      ctxCoeff: 1,
    };
  }

  const ctx = matchupEntry.context || {};

  // ctxCoeff: ex homeCoeff=1.03 (matchup plus facile), 0.97 (plus dur)
  const ctxCoeff = matchupEntry.isHome ? num(ctx.homeCoeff, 1) : num(ctx.awayCoeff, 1);

  // facteurs exposés (placeholders si tu veux décomposer plus tard)
  const opponentCoeff = 1;
  const homeCoeff = matchupEntry.isHome ? 1.01 : 0.99;
  const fatigueCoeff = 1.0;

  const finalCoeff = clamp(base * ctxCoeff, 0.85, 1.35);

  return {
    opponentCoeff,
    homeCoeff,
    fatigueCoeff,
    ctxCoeff: Number(ctxCoeff.toFixed(4)),
    finalCoeff: Number(finalCoeff.toFixed(4)),
  };
}

/* ===================== TRIGGER ===================== */

export const onDefiCreated = onDocumentCreated("defis/{defiId}", async (event) => {
  const defiId = event.params.defiId;
  const defiRef = db.doc(`defis/${defiId}`);
  const defi = event.data?.data();
  if (!defi) return;

  // évite double build
  if (defi.poolStatus === "ready" || defi.poolStatus === "building") return;

  const firstGameUTC = defi.firstGameUTC || defi.firstGameAtUTC || null;
  const firstGameDate = firstGameUTC?.toDate?.() ? firstGameUTC.toDate() : null;

  if (!firstGameDate) {
    await defiRef.set(
      {
        poolStatus: "error",
        poolError: "missing_firstGameUTC",
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    return;
  }

  // règle 72h
  const now = new Date();
  const aheadMs = firstGameDate.getTime() - now.getTime();
  const aheadHours = aheadMs / (1000 * 60 * 60);

  // règle 72h (sauf Ascensions)
  const isAsc = !!defi?.ascension?.key;

  if (!isAsc && aheadHours > MAX_AHEAD_HOURS) {
    await defiRef.set(
      {
        status: "invalid",
        invalidReason: "too_early",
        poolStatus: "error",
        poolError: `defi_created_more_than_${MAX_AHEAD_HOURS}h_before_firstGameUTC`,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    logger.warn("[onDefiCreated] rejected (too early)", { defiId, aheadHours });
    return;
  }

  const gameDateYmd = toYMD(defi.gameDate) || toYMD(firstGameDate);
  if (!gameDateYmd) {
    await defiRef.set(
      {
        poolStatus: "error",
        poolError: "missing_gameDate",
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    return;
  }

  const seasonId = seasonIdFromGameDateYmd(gameDateYmd);

  await defiRef.set(
    {
      poolStatus: "building",
      poolSeasonId: seasonId,
      poolGameDate: gameDateYmd,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  // ✅ Matchups enrichis (rank/GD/coeffs) — si absent, on retombe en “neutre”
  let matchupsByTeam = new Map();
  try {
    matchupsByTeam = await loadMatchupsByTeam({ gameDateYmd });
  } catch (e) {
    logger.warn("[onDefiCreated] no daily matchup context", {
      defiId,
      gameDateYmd,
      err: e?.message || String(e),
    });
  }

  try {
    // 1) équipes qui jouent ce jour-là
    const teams = await fetchTeamsPlayingOnFromScheduleDaily(gameDateYmd);
    if (!teams.length) throw new Error(`no_teams_for_date:${gameDateYmd}`);

    // 2) joueurs des équipes (nhl_players)
    const players = [];
    for (const part of chunk(teams, 10)) {
      const snap = await db.collection("nhl_players").where("teamAbbr", "in", part).get();
      snap.forEach((doc) => {
        const p = doc.data() || {};
        const pid = String(p.playerId ?? p.id ?? "");
        if (!pid) return;

        players.push({
          playerId: pid,
          fullName: p.fullName || p.skaterFullName || "",
          teamAbbr: String(p.teamAbbr || "").toUpperCase() || null,
          positionCode: p.position || p.positionCode || null,
          injury: p.injury || null, // ✅ snapshot
        });
      });
    }
    if (!players.length) throw new Error("no_players_for_teams");

    // 3) stats : lire UNIQUEMENT les docs nécessaires via docId `${seasonId}_${playerId}`
    const statsMap = new Map();
    const refs = players.map((p) => db.doc(`nhl_player_stats_current/${seasonId}_${p.playerId}`));

    for (const refChunk of chunk(refs, GETALL_CHUNK)) {
      const snaps = await db.getAll(...refChunk);
      for (const s of snaps) {
        if (!s.exists) continue;
        const d = s.data() || {};
        const pid = String(d.playerId ?? "");
        if (!pid) continue;

        const goals = num(d.goals, 0);
        const assists = num(d.assists, 0);
        const points = Number.isFinite(d.points)
          ? num(d.points, goals + assists)
          : goals + assists;

        const gamesPlayed = num(d.gamesPlayed, 0);

        const ppg = Number.isFinite(d.pointsPerGame)
          ? num(d.pointsPerGame, 0)
          : gamesPlayed > 0
          ? points / gamesPlayed
          : 0;

        // ✅ coeff_meta (v2_df) est imbriqué
        const meta = d.coeff_meta || {};

        statsMap.set(pid, {
          goals,
          assists,
          points,
          gamesPlayed,
          pointsPerGame: ppg,

          coeff: Number.isFinite(d.coeff) ? num(d.coeff, 1) : 1,

          // ✅ ces champs viennent de coeff_meta (sinon 0/null)
          reliability: Number.isFinite(meta.reliability) ? num(meta.reliability, 0) : 0,
          ppgN: Number.isFinite(meta.ppgN) ? num(meta.ppgN, 0) : null,
          shN: Number.isFinite(meta.shN) ? num(meta.shN, 0) : null,
          talent: Number.isFinite(meta.talent) ? num(meta.talent, 0) : null,
          defense: typeof meta.defense === "boolean" ? meta.defense : null,

          coeff_v: d.coeff_v || null,
          positionCode: d.positionCode || null,
          teamAbbrevs: d.teamAbbrevs || d.teamAbbr || null,
          timeOnIcePerGame: d.timeOnIcePerGame ?? null,
        });
      }
    }

    // 4) merge + calc Nova score + matchup context (rank/GD + finalCoeff)
    const merged = players.map((p) => {
      const st = statsMap.get(p.playerId) || {};

      const goals = num(st.goals, 0);
      const assists = num(st.assists, 0);
      const points = num(st.points, goals + assists);
      const gamesPlayed = num(st.gamesPlayed, 0);

      const pointsPerGame = num(st.pointsPerGame, gamesPlayed > 0 ? points / gamesPlayed : 0);

      const coeff = num(st.coeff, 1);
      const reliability = num(st.reliability, 0);

      const scoreNovaBase = computeNovaBaseScore({ pointsPerGame, coeff, reliability });

      const teamAbbr = (
        p.teamAbbr ||
        (typeof st.teamAbbrevs === "string" ? st.teamAbbrevs : "")
      )
        .toString()
        .toUpperCase() || null;

      const matchEntry = teamAbbr ? matchupsByTeam.get(teamAbbr) : null;

      const { opponentCoeff, homeCoeff, fatigueCoeff, finalCoeff, ctxCoeff } = computeFinalCoeff({
        baseCoeff: coeff,
        matchupEntry: matchEntry,
      });

      const myTeam = matchEntry
        ? matchEntry.isHome
          ? matchEntry.homeStats
          : matchEntry.awayStats
        : null;

      const oppTeam = matchEntry
        ? matchEntry.isHome
          ? matchEntry.awayStats
          : matchEntry.homeStats
        : null;

      return {
        ...p,

        goals,
        assists,
        points,
        gamesPlayed,
        pointsPerGame,

        // snapshot balancing (base)
        coeff,
        reliability,
        ppgN: st.ppgN ?? null,
        shN: st.shN ?? null,
        talent: st.talent ?? null,
        coeff_v: st.coeff_v ?? null,
        timeOnIcePerGame: st.timeOnIcePerGame ?? null,
        defense: st.defense ?? null,

        positionCode: p.positionCode || st.positionCode || null,
        teamAbbr,

        // ✅ Matchup snapshot (PRO/VIP UI)
        matchup: matchEntry
          ? {
              gameId: matchEntry.gameId,
              startTimeUTC: matchEntry.startTimeUTC || null,
              isHome: !!matchEntry.isHome,
              homeAbbr: matchEntry.homeAbbr,
              awayAbbr: matchEntry.awayAbbr,
              opponentAbbr: matchEntry.opponentAbbr,

              myRankOverall: num(myTeam?.rankOverall, 0),
              myGoalDifferential: num(myTeam?.goalDifferential, 0),

              oppRankOverall: num(oppTeam?.rankOverall, 0),
              oppGoalDifferential: num(oppTeam?.goalDifferential, 0),

              // bonus (si tu veux plus tard)
              myGoalsFor: num(myTeam?.goalsFor, 0),
              myGoalsAgainst: num(myTeam?.goalsAgainst, 0),
              oppGoalsFor: num(oppTeam?.goalsFor, 0),
              oppGoalsAgainst: num(oppTeam?.goalsAgainst, 0),
            }
          : null,

        // ✅ Coeff contextuel (sert à Nova + NovaScore VIP)
        coeff_ctx: {
          opponentCoeff,
          homeCoeff,
          fatigueCoeff,
          ctxCoeff,      // le vrai facteur utilisé (homeCoeff/awayCoeff calculé par ingest)
          finalCoeff,    // baseCoeff * ctxCoeff (clampé)
          v: "ctx_v1",
        },

        // ✅ champ direct pour queries/UI
        finalCoeff,

        // Nova helper
        scoreNovaBase,
      };
    });

    // ✅ TRI OFFICIEL DU DÉFI: points totaux seulement (desc), puis nom (stable)
    merged.sort((a, b) => {
      const dp = num(b.points, 0) - num(a.points, 0);
      if (dp) return dp;
      return String(a.fullName || "").localeCompare(String(b.fullName || ""));
    });

    const top = merged.slice(0, POOL_SIZE);

    // 5) write pool
    const batch = db.batch();
    const poolColl = db.collection(`defis/${defiId}/playerPool`);
    const nowTs = FieldValue.serverTimestamp();

    top.forEach((p, idx) => {
      const ref = poolColl.doc(String(p.playerId));
      batch.set(ref, {
        // ids & identity
        playerId: String(p.playerId),
        fullName: p.fullName || "",
        teamAbbr: p.teamAbbr || null,
        positionCode: p.positionCode || null,

        // snapshot injury
        injury: p.injury || null,

        // snapshot stats
        goals: num(p.goals, 0),
        assists: num(p.assists, 0),
        points: num(p.points, 0),
        gamesPlayed: num(p.gamesPlayed, 0),
        pointsPerGame: num(p.pointsPerGame, 0),

        // snapshot balancing (base)
        coeff: num(p.coeff, 1),
        reliability: num(p.reliability, 0),
        ppgN: p.ppgN ?? null,
        shN: p.shN ?? null,
        talent: p.talent ?? null,
        coeff_v: p.coeff_v ?? null,
        timeOnIcePerGame: p.timeOnIcePerGame ?? null,
        defense: p.defense ?? null,

        // matchup snapshot (rank / goalDiff)
        matchup: p.matchup || null,

        // coeff contextuel (finalCoeff)
        coeff_ctx: p.coeff_ctx || null,
        finalCoeff: num(p.finalCoeff, num(p.coeff, 1)),

        // Nova helper (sert à novaPickAtLock)
        scoreNovaBase: num(p.scoreNovaBase, 0),

        // pool meta
        seasonId,
        gameDateYmd,
        rank: idx + 1,
        tier: tierFromIndex0(idx),

        createdAt: nowTs,
      });
    });

    batch.set(
      defiRef,
      {
        poolStatus: "ready",
        poolFrozenAt: nowTs,
        poolCount: top.length,
        poolSeasonId: seasonId,
        poolGameDate: gameDateYmd,
        updatedAt: nowTs,
      },
      { merge: true }
    );

    await batch.commit();
    logger.info("[onDefiCreated] pool frozen", {
      defiId,
      seasonId,
      count: top.length,
      gameDateYmd,
    });
  } catch (e) {
    await defiRef.set(
      {
        poolStatus: "error",
        poolError: String(e?.message || e),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    logger.error("[onDefiCreated] failed", { defiId, error: e?.message || String(e) });
  }
});