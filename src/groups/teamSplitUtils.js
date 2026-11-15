const AI_UID = "ai";

export function getGroupTeamSplit(group = {}) {
  const ts = group?.teamSplit;
  if (!ts || typeof ts !== "object") return null;
  return ts;
}

/** Au moins un membre en A et un en B → toggle visible pour tous les membres. */
export function isTeamSplitReady(teamSplit = {}) {
  if (teamSplit?.ready === true) return true;
  const roster = teamSplit?.roster || {};
  let hasA = false;
  let hasB = false;
  for (const t of Object.values(roster)) {
    if (t === "a") hasA = true;
    if (t === "b") hasB = true;
    if (hasA && hasB) return true;
  }
  return false;
}

export function computeTeamStandings({ teamSplit, memberRows = [] }) {
  const ts = teamSplit || {};
  const roster = ts.roster || {};
  const teamA = ts.teamA || { id: "a", name: "Équipe A" };
  const teamB = ts.teamB || { id: "b", name: "Équipe B" };

  const buckets = {
    a: { teamId: "a", name: teamA.name || "Équipe A", memberCount: 0, pointsSum: 0 },
    b: { teamId: "b", name: teamB.name || "Équipe B", memberCount: 0, pointsSum: 0 },
  };

  for (const row of memberRows) {
    const uid = String(row?.id || row?.uid || "").trim();
    if (!uid || uid.toLowerCase() === AI_UID) continue;
    const teamKey = roster[uid];
    if (teamKey !== "a" && teamKey !== "b") continue;
    const pts = Number(row?.pointsTotal ?? 0) || 0;
    buckets[teamKey].memberCount += 1;
    buckets[teamKey].pointsSum += pts;
  }

  const teams = ["a", "b"].map((key) => {
    const b = buckets[key];
    const average = b.memberCount > 0 ? b.pointsSum / b.memberCount : 0;
    return {
      ...b,
      average,
      averageDisplay: Math.round(average * 10) / 10,
    };
  });

  teams.sort((x, y) => y.average - x.average);

  const gap =
    teams.length === 2 ? Math.abs(teams[0].average - teams[1].average) : 0;

  return {
    ranked: teams.map((t, idx) => ({ ...t, rank: idx + 1 })),
    gap: Math.round(gap * 10) / 10,
    leader: teams[0] || null,
    runnerUp: teams[1] || null,
  };
}
