import { db } from "../../utils.js";
import { resolveNhlPoolRankSeasonForGame } from "../../defis/nhlPoolRankSeason.js";

const MIN_PLAYERS_WITH_CURRENT_STATS = 10;
const GETALL_CHUNK = 400;

function str(v) {
  return String(v ?? "").trim();
}

function safeAbbr(v) {
  return str(v).toUpperCase();
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function isSkaterPosition(positionCode) {
  const pos = safeAbbr(positionCode);
  if (!pos) return true;
  return pos !== "G";
}

function playerHasCurrentSeasonSample(stats) {
  if (!stats || typeof stats !== "object") return false;
  const gp = Number(stats.gamesPlayed) || 0;
  const g = Number(stats.goals) || 0;
  const a = Number(stats.assists) || 0;
  const pts = Number(stats.points) || g + a;
  return g > 0 || pts > 0 || gp >= 5;
}

/**
 * Échantillon courant représentatif sur le roster actif des deux équipes du match.
 */
export async function poolHasRepresentativeNhlCurrentSeason({
  homeAbbr,
  awayAbbr,
  currentSeasonId,
}) {
  const teams = [safeAbbr(homeAbbr), safeAbbr(awayAbbr)].filter(Boolean);
  const current = str(currentSeasonId);
  if (teams.length < 2 || !current) return false;

  const snap = await db
    .collection("nhl_players")
    .where("teamAbbr", "in", teams)
    .where("active", "==", true)
    .get();

  const playerIds = [];
  snap.forEach((doc) => {
    const p = doc.data() || {};
    const playerId = str(p.playerId ?? p.id ?? doc.id);
    const teamAbbr = safeAbbr(p.teamAbbr);
    if (!playerId || !teams.includes(teamAbbr)) return;
    if (!isSkaterPosition(p.position || p.positionCode)) return;
    playerIds.push(playerId);
  });

  if (!playerIds.length) return false;

  let count = 0;
  const refs = playerIds.map((pid) => db.doc(`nhl_player_stats_current/${current}_${pid}`));
  for (const refChunk of chunk(refs, GETALL_CHUNK)) {
    const snaps = await db.getAll(...refChunk);
    for (const s of snaps) {
      if (!s.exists) continue;
      if (playerHasCurrentSeasonSample(s.data() || {})) {
        count += 1;
        if (count >= MIN_PLAYERS_WITH_CURRENT_STATS) return true;
      }
    }
  }

  return false;
}

/**
 * Saison NHL à utiliser pour les stats Nova / pick auto SOLO (aligné sur l’app).
 */
export async function resolveFgcNhlStatsSeasonForChallenge({
  gameDateYmd,
  homeAbbr,
  awayAbbr,
  seasonConfig = null,
} = {}) {
  const ymd = str(gameDateYmd).slice(0, 10);
  const rankMeta = resolveNhlPoolRankSeasonForGame({ gameDateYmd: ymd, seasonConfig });

  let statsSeasonId = rankMeta.rankSeasonId;
  let statsUsesPreviousSeason = rankMeta.usedPreviousForRank;

  if (
    !statsUsesPreviousSeason &&
    rankMeta.previousSeasonId &&
    rankMeta.calendarSeasonId
  ) {
    const representative = await poolHasRepresentativeNhlCurrentSeason({
      homeAbbr,
      awayAbbr,
      currentSeasonId: rankMeta.calendarSeasonId,
    });
    if (!representative) {
      statsSeasonId = rankMeta.previousSeasonId;
      statsUsesPreviousSeason = true;
    }
  }

  return {
    calendarSeasonId: rankMeta.calendarSeasonId,
    previousSeasonId: rankMeta.previousSeasonId,
    statsSeasonId: str(statsSeasonId || rankMeta.calendarSeasonId),
    statsUsesPreviousSeason,
    poolRankUsesPreviousUntilYmd: rankMeta.poolRankUsesPreviousUntilYmd,
  };
}
