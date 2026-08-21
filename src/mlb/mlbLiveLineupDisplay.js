const MLB_BOXSCORE_URL = (gamePk) =>
  `https://statsapi.mlb.com/api/v1/game/${encodeURIComponent(String(gamePk))}/boxscore`;

const MLB_LIVE_FEED_URL = (gamePk) =>
  `https://statsapi.mlb.com/api/v1.1/game/${encodeURIComponent(String(gamePk))}/feed/live`;

const MIN_LINEUP_SIDE = 5;

function str(v) {
  return String(v ?? "").trim();
}

function playerNameFromTeamPlayers(players = {}, playerId) {
  const id = str(playerId);
  if (!id) return null;

  const direct = players?.[`ID${id}`] || players?.[id];
  if (direct?.person?.fullName) return str(direct.person.fullName) || null;

  for (const node of Object.values(players || {})) {
    if (str(node?.person?.id) === id && node?.person?.fullName) {
      return str(node.person.fullName) || null;
    }
  }

  return null;
}

function extractBattingOrderFromTeam(teamNode = {}) {
  const order = Array.isArray(teamNode?.battingOrder) ? teamNode.battingOrder : [];
  return order
    .map((rawId, index) => {
      const playerId = str(rawId);
      if (!playerId) return null;
      return {
        slot: index + 1,
        playerId,
        name: playerNameFromTeamPlayers(teamNode?.players, playerId),
      };
    })
    .filter(Boolean);
}

export function hasMlbLineupEntries(entries = []) {
  return Array.isArray(entries) && entries.length >= MIN_LINEUP_SIDE;
}

export function hasMlbLineupDisplay(game = {}) {
  return (
    hasMlbLineupEntries(game?.awayBattingOrder) ||
    hasMlbLineupEntries(game?.homeBattingOrder)
  );
}

export function lineupDisplayFromGameDoc(game = {}) {
  return {
    awayBattingOrder: Array.isArray(game?.awayBattingOrder) ? game.awayBattingOrder : [],
    homeBattingOrder: Array.isArray(game?.homeBattingOrder) ? game.homeBattingOrder : [],
    currentBatterId: game?.currentBatterId ?? null,
    currentBatterName: game?.currentBatterName ?? null,
    currentPitcherId: game?.currentPitcherId ?? null,
    currentPitcherName: game?.currentPitcherName ?? null,
    battingTeamAbbr: game?.battingTeamAbbr ?? null,
  };
}

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": "prophetik/1.0" },
  });
  if (!res.ok) return null;
  return res.json();
}

/** Repli client si le doc Firestore n'a pas encore les alignements. */
export async function fetchMlbLineupDisplayFromApi(gamePk) {
  const pk = str(gamePk);
  if (!pk) {
    return lineupDisplayFromGameDoc({});
  }

  try {
    const live = await fetchJson(MLB_LIVE_FEED_URL(pk));
    if (live) {
      const teams = live?.liveData?.boxscore?.teams || {};
      const awayBattingOrder = extractBattingOrderFromTeam(teams?.away);
      const homeBattingOrder = extractBattingOrderFromTeam(teams?.home);
      const linescore = live?.liveData?.linescore || {};
      const currentPlay = live?.liveData?.plays?.currentPlay || {};
      const matchup = currentPlay?.matchup || {};
      const batter = matchup?.batter || linescore?.offense?.batter || {};
      const pitcher = matchup?.pitcher || linescore?.defense?.pitcher || {};
      const half = str(linescore?.inningHalf).toLowerCase();
      const awayAbbr = str(live?.gameData?.teams?.away?.abbreviation).toUpperCase();
      const homeAbbr = str(live?.gameData?.teams?.home?.abbreviation).toUpperCase();

      if (hasMlbLineupEntries(awayBattingOrder) || hasMlbLineupEntries(homeBattingOrder)) {
        return {
          awayBattingOrder,
          homeBattingOrder,
          currentBatterId: batter?.id != null ? String(batter.id) : null,
          currentBatterName: str(batter?.fullName) || null,
          currentPitcherId: pitcher?.id != null ? String(pitcher.id) : null,
          currentPitcherName: str(pitcher?.fullName) || null,
          battingTeamAbbr: half === "top" ? awayAbbr || null : half === "bottom" ? homeAbbr || null : null,
        };
      }
    }

    const box = await fetchJson(MLB_BOXSCORE_URL(pk));
    if (box) {
      const awayBattingOrder = extractBattingOrderFromTeam(box?.teams?.away);
      const homeBattingOrder = extractBattingOrderFromTeam(box?.teams?.home);
      if (hasMlbLineupEntries(awayBattingOrder) || hasMlbLineupEntries(homeBattingOrder)) {
        return {
          awayBattingOrder,
          homeBattingOrder,
          currentBatterId: null,
          currentBatterName: null,
          currentPitcherId: null,
          currentPitcherName: null,
          battingTeamAbbr: null,
        };
      }
    }
  } catch (e) {
    if (__DEV__) {
      console.log("[mlbLiveLineupDisplay] fetch failed", e?.message || e);
    }
  }

  return lineupDisplayFromGameDoc({});
}
