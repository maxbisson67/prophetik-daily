import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_PREFIX = "@prophetik/teamSplit/v1:";

export const DEFAULT_TEAM_SPLIT = {
  teamAName: "Équipe A",
  teamBName: "Équipe B",
  roster: {},
};

function storageKey(groupId) {
  return `${STORAGE_PREFIX}${String(groupId || "").trim()}`;
}

function normalizeConfig(raw) {
  const teamAName = String(raw?.teamAName || DEFAULT_TEAM_SPLIT.teamAName).trim() || "Équipe A";
  const teamBName = String(raw?.teamBName || DEFAULT_TEAM_SPLIT.teamBName).trim() || "Équipe B";
  const roster = {};
  if (raw?.roster && typeof raw.roster === "object") {
    for (const [uid, team] of Object.entries(raw.roster)) {
      const id = String(uid || "").trim();
      const t = String(team || "").toLowerCase();
      if (!id || id.toLowerCase() === "ai") continue;
      if (t === "a" || t === "b") roster[id] = t;
    }
  }
  return { teamAName, teamBName, roster };
}

export async function loadTeamSplitConfig(groupId) {
  const gid = String(groupId || "").trim();
  if (!gid) return { ...DEFAULT_TEAM_SPLIT, roster: {} };
  try {
    const raw = await AsyncStorage.getItem(storageKey(gid));
    if (!raw) return { ...DEFAULT_TEAM_SPLIT, roster: {} };
    return normalizeConfig(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_TEAM_SPLIT, roster: {} };
  }
}

export async function saveTeamSplitConfig(groupId, config) {
  const gid = String(groupId || "").trim();
  if (!gid) return;
  const payload = normalizeConfig(config);
  await AsyncStorage.setItem(storageKey(gid), JSON.stringify(payload));
  return payload;
}

export function teamSplitAssignmentCounts(roster = {}) {
  let teamA = 0;
  let teamB = 0;
  for (const team of Object.values(roster)) {
    if (team === "a") teamA += 1;
    if (team === "b") teamB += 1;
  }
  return { teamA, teamB, total: teamA + teamB };
}

export function canShowTeamStandings(roster = {}) {
  const { teamA, teamB } = teamSplitAssignmentCounts(roster);
  return teamA > 0 && teamB > 0;
}
