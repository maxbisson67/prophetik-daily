import { db } from "../../../utils.js";
import { getMlbCurrentSeason } from "../../../players/seasonHelpers.js";
import { buildEmptyMlbPitcher } from "../../../mlb/mlbProbablePitchers.js";
import { isSlotOpenForPick, TP_BUNDLE_MAX_GAMES } from "../../../teamPredictionBundles/tpBundleUtils.js";
import { MLB_TEAM_ID_TO_ABBR, resolveMlbAbbrFromTeam } from "../../../mlb/mlbTeamAbbr.js";

const MLB_AL_ID = "103";
const MLB_NL_ID = "104";

const MLB_ABBR_ALIASES = {
  ARI: ["AZ"],
  AZ: ["ARI"],
  ATH: ["OAK"],
  OAK: ["ATH"],
  CHW: ["CWS"],
  CWS: ["CHW"],
  KC: ["KCR"],
  KCR: ["KC"],
  SD: ["SDP"],
  SDP: ["SD"],
  SF: ["SFG"],
  SFG: ["SF"],
  TB: ["TBR"],
  TBR: ["TB"],
  WSH: ["WSN", "WAS"],
  WSN: ["WSH", "WAS"],
  WAS: ["WSH", "WSN"],
};

function str(v) {
  return String(v ?? "").trim();
}

function safeAbbr(v) {
  return str(v).toUpperCase();
}

function ymdCompact(ymd) {
  return str(ymd).replaceAll("-", "");
}

function normalizePitcher(raw) {
  const base = buildEmptyMlbPitcher();
  if (!raw || typeof raw !== "object") return base;
  return {
    id: raw.id ?? null,
    name: str(raw.name || raw.fullName) || null,
    wins: raw.wins ?? null,
    losses: raw.losses ?? null,
    era: raw.era ?? null,
  };
}

function pickTeamRecord(row = {}) {
  const gp = Number(row.gamesPlayed) || 0;
  const runsScored = Number(row.runsScored) || 0;
  const runsAllowed = Number(row.runsAllowed) || 0;
  const streakCode = str(row.streak?.streakCode);
  const streakType = str(row.streak?.streakType).toLowerCase();
  const streakNumber = Number(row.streak?.streakNumber) || 0;

  return {
    gamesPlayed: gp,
    wins: Number(row.wins) || 0,
    losses: Number(row.losses) || 0,
    winningPct: str(row.winningPercentage) || null,
    runsScored,
    runsAllowed,
    runDifferential: Number(row.runDifferential) || 0,
    runsScoredPerGame: gp > 0 ? Number((runsScored / gp).toFixed(2)) : null,
    runsAllowedPerGame: gp > 0 ? Number((runsAllowed / gp).toFixed(2)) : null,
    divisionRank: str(row.divisionRank) || null,
    wildCardRank: str(row.wildCardRank) || null,
    streak: streakCode || null,
    streakType: streakType || null,
    streakLength: streakNumber || null,
    home: {
      wins: Number(row.home?.wins) || 0,
      losses: Number(row.home?.losses) || 0,
      pct: str(row.home?.pct) || null,
    },
    away: {
      wins: Number(row.away?.wins) || 0,
      losses: Number(row.away?.losses) || 0,
      pct: str(row.away?.pct) || null,
    },
    lastTen: {
      wins: Number(row.lastTen?.wins) || 0,
      losses: Number(row.lastTen?.losses) || 0,
      pct: str(row.lastTen?.pct) || null,
    },
  };
}

function buildSideForm(record, side) {
  if (!record) return null;
  const isHome = side === "home";
  const split = isHome ? record.home : record.away;
  const splitLabel = isHome ? "home" : "away";

  return {
    side: splitLabel,
    season: `${record.wins}-${record.losses}`,
    winningPct: record.winningPct,
    runsScoredPerGame: record.runsScoredPerGame,
    runsAllowedPerGame: record.runsAllowedPerGame,
    runDifferential: record.runDifferential,
    streak: record.streak,
    lastTen: record.lastTen
      ? `${record.lastTen.wins}-${record.lastTen.losses}${record.lastTen.pct ? ` (${record.lastTen.pct})` : ""}`
      : null,
    splitRecord: split ? `${split.wins}-${split.losses}${split.pct ? ` (${split.pct})` : ""}` : null,
    divisionRank: record.divisionRank,
  };
}

export function buildTeamFormFacts(record, side) {
  if (!record) return null;
  const splitKey = side === "home" ? "home" : "away";
  const split = record[splitKey] || {};
  const lastTen = record.lastTen || {};

  return {
    seasonRecord: `${record.wins}-${record.losses}`,
    winningPct: record.winningPct,
    gamesPlayed: record.gamesPlayed || null,
    streak: record.streak || null,
    streakType: record.streakType || null,
    streakLength: record.streakLength || null,
    lastTen: `${lastTen.wins ?? 0}-${lastTen.losses ?? 0}`,
    lastTenPct: lastTen.pct || null,
    splitSide: splitKey,
    splitRecord: `${split.wins ?? 0}-${split.losses ?? 0}`,
    splitPct: split.pct || null,
    runsScoredPerGame: record.runsScoredPerGame,
    runsAllowedPerGame: record.runsAllowedPerGame,
    runDifferential: record.runDifferential,
    divisionRank: record.divisionRank,
  };
}

function buildMatchupSummary({ awayAbbr, homeAbbr, awayRecord, homeRecord, awayPitcher, homePitcher }) {
  return {
    away: {
      abbr: awayAbbr,
      form: buildSideForm(awayRecord, "away"),
      pitcher: awayPitcher?.name
        ? {
            name: awayPitcher.name,
            era: awayPitcher.era,
            record: `${awayPitcher.wins ?? "?"}-${awayPitcher.losses ?? "?"}`,
          }
        : null,
    },
    home: {
      abbr: homeAbbr,
      form: buildSideForm(homeRecord, "home"),
      pitcher: homePitcher?.name
        ? {
            name: homePitcher.name,
            era: homePitcher.era,
            record: `${homePitcher.wins ?? "?"}-${homePitcher.losses ?? "?"}`,
          }
        : null,
    },
  };
}

function abbrFromTeamRecord(row = {}) {
  return safeAbbr(resolveMlbAbbrFromTeam(row.team || {}));
}

function teamIdFromScheduleTeam(team) {
  if (team?.id == null) return null;
  return String(team.id);
}

/**
 * Contexte vérifié — TP MLB (bundle, max 2 matchs).
 */
export class TpMlbContextBuilder {
  async build({ uid, challengeId, gameId = null, focusSlot = null }) {
    const bundleId = str(challengeId);
    if (!bundleId) throw new Error("CHALLENGE_ID_REQUIRED");

    const bundleSnap = await db.doc(`team_prediction_bundles/${bundleId}`).get();
    if (!bundleSnap.exists) throw new Error("CHALLENGE_NOT_FOUND");

    const bundle = bundleSnap.data() || {};
    const league = safeAbbr(bundle.league || "MLB");
    if (league !== "MLB") throw new Error("TP_MLB_ONLY");

    const entrySnap = uid
      ? await db.doc(`team_prediction_bundles/${bundleId}/entries/${uid}`).get()
      : null;
    const entry = entrySnap?.exists ? entrySnap.data() || {} : null;
    const savedPicks = entry?.picks || {};

    const gameYmd = ymdCompact(bundle.gameYmd);
    const gamesRaw = Array.isArray(bundle.games) ? [...bundle.games] : [];
    gamesRaw.sort((a, b) => (a.slot || 0) - (b.slot || 0));

    const standingsMaps = await this.loadStandingsMaps();
    const nowMs = Date.now();
    let focusedGameId = str(gameId) || null;
    if (!focusedGameId && focusSlot != null) {
      const slotNum = Number(focusSlot);
      const match = gamesRaw.find((g) => Number(g.slot) === slotNum);
      if (match) focusedGameId = str(match.gameId);
    }

    const games = [];
    for (const slot of gamesRaw.slice(0, TP_BUNDLE_MAX_GAMES)) {
      const gid = str(slot.gameId);
      if (!gid) continue;

      const awayAbbr = safeAbbr(slot.awayAbbr);
      const homeAbbr = safeAbbr(slot.homeAbbr);
      let awayPitcher = normalizePitcher(slot.awayProbablePitcher);
      let homePitcher = normalizePitcher(slot.homeProbablePitcher);

      let awayTeamId = null;
      let homeTeamId = null;

      if (gameYmd) {
        const schedSnap = await db.doc(`mlb_schedule_daily/${gameYmd}/games/${gid}`).get();
        if (schedSnap.exists) {
          const g = schedSnap.data() || {};
          if (!awayPitcher.name) awayPitcher = normalizePitcher(g.awayProbablePitcher);
          if (!homePitcher.name) homePitcher = normalizePitcher(g.homeProbablePitcher);
          awayTeamId = teamIdFromScheduleTeam(g.awayTeam);
          homeTeamId = teamIdFromScheduleTeam(g.homeTeam);
        }
      }

      const awayRecord = this.lookupRecord(standingsMaps, awayAbbr, awayTeamId);
      const homeRecord = this.lookupRecord(standingsMaps, homeAbbr, homeTeamId);
      const pick = savedPicks[gid] || null;

      const teamForm = {
        away: buildTeamFormFacts(awayRecord, "away"),
        home: buildTeamFormFacts(homeRecord, "home"),
      };

      games.push({
        slot: slot.slot ?? null,
        gameId: gid,
        awayAbbr,
        homeAbbr,
        status: str(slot.status).toLowerCase() || "open",
        openForPick: isSlotOpenForPick(slot, nowMs),
        gameStartTimeUTC: slot.gameStartTimeUTC?.toDate?.()?.toISOString?.() || null,
        teamForm,
        awayRecord,
        homeRecord,
        awayPitcher,
        homePitcher,
        matchupSummary: buildMatchupSummary({
          awayAbbr,
          homeAbbr,
          awayRecord,
          homeRecord,
          awayPitcher,
          homePitcher,
        }),
        participantPick: pick
          ? {
              predictedAwayScore: Number(pick.predictedAwayScore),
              predictedHomeScore: Number(pick.predictedHomeScore),
              predictedOutcome: str(pick.predictedOutcome) || "FINAL",
              winnerAbbr: str(pick.winnerAbbr) || null,
            }
          : null,
        isFocused: focusedGameId ? gid === focusedGameId : false,
      });
    }

    const focusedGame =
      games.find((g) => g.gameId === focusedGameId) ||
      games.find((g) => g.isFocused) ||
      null;

    return {
      domain: "tp",
      sport: "MLB",
      teamFormChecklist: [
        "seasonRecord",
        "streak",
        "lastTen",
        "homeAwaySplit",
        "runsScoredPerGame",
        "runsAllowedPerGame",
        "probableStarter",
      ],
      bundle: {
        id: bundleId,
        status: str(bundle.status).toLowerCase() || "open",
        groupId: str(bundle.groupId) || null,
        gameYmd: gameYmd || null,
        gameCount: games.length,
        scoring: bundle.scoring || { winnerPoints: 5, exactScorePoints: 5 },
      },
      participant: {
        uid,
        picksCompletedCount: Number(entry?.picksCompletedCount) || 0,
        picks: Object.fromEntries(
          Object.entries(savedPicks).map(([gid, p]) => [
            gid,
            {
              predictedAwayScore: Number(p?.predictedAwayScore),
              predictedHomeScore: Number(p?.predictedHomeScore),
              predictedOutcome: str(p?.predictedOutcome) || null,
            },
          ])
        ),
      },
      focusedGameId,
      focusedGame,
      focusedTeamForm: focusedGame?.teamForm || null,
      games: focusedGameId
        ? [...games].sort((a, b) => {
            if (a.gameId === focusedGameId) return -1;
            if (b.gameId === focusedGameId) return 1;
            return (a.slot || 0) - (b.slot || 0);
          })
        : games,
      seasonId: getMlbCurrentSeason(new Date()),
    };
  }

  lookupRecord(maps, abbr, teamId = null) {
    const byAbbr = maps?.byAbbr || {};
    const byTeamId = maps?.byTeamId || {};

    const key = safeAbbr(abbr);
    if (key && byAbbr[key]) return byAbbr[key];

    const aliases = MLB_ABBR_ALIASES[key] || [];
    for (const alias of aliases) {
      if (byAbbr[alias]) return byAbbr[alias];
    }

    if (teamId && byTeamId[String(teamId)]) return byTeamId[String(teamId)];

    if (key) {
      for (const [id, canonicalAbbr] of Object.entries(MLB_TEAM_ID_TO_ABBR)) {
        if (canonicalAbbr === key || aliases.includes(canonicalAbbr)) {
          if (byTeamId[String(id)]) return byTeamId[String(id)];
        }
      }
    }

    return null;
  }

  async loadStandingsMaps() {
    const currentSnap = await db.doc("mlb_standings/current").get();
    const season = currentSnap.exists
      ? str(currentSnap.data()?.season) || getMlbCurrentSeason()
      : getMlbCurrentSeason();

    const leagueIds =
      currentSnap.exists && Array.isArray(currentSnap.data()?.leagueIds)
        ? currentSnap.data().leagueIds.map(String)
        : [MLB_AL_ID, MLB_NL_ID];

    const byAbbr = {};
    const byTeamId = {};

    for (const leagueId of leagueIds) {
      const snap = await db.doc(`mlb_standings/${season}/leagues/${leagueId}`).get();
      if (!snap.exists) continue;

      const divisions = Array.isArray(snap.data()?.divisions) ? snap.data().divisions : [];
      for (const div of divisions) {
        const teamRecords = Array.isArray(div?.teamRecords) ? div.teamRecords : [];
        for (const row of teamRecords) {
          const record = pickTeamRecord(row);
          const teamId = row.team?.id != null ? String(row.team.id) : null;
          if (teamId) byTeamId[teamId] = record;

          const abbr = abbrFromTeamRecord(row);
          if (abbr) byAbbr[abbr] = record;
        }
      }
    }

    return { byAbbr, byTeamId };
  }
}
