const AI_UID = "ai";

export function computeTeamStandings({ teamAName, teamBName, roster = {}, memberRows = [] }) {
  const buckets = {
    a: { teamId: "a", name: teamAName || "Équipe A", memberCount: 0, pointsSum: 0 },
    b: { teamId: "b", name: teamBName || "Équipe B", memberCount: 0, pointsSum: 0 },
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
  };
}
