export async function fetchNhlStats() {
  try {
    const res = await fetch('https://api-web.nhle.com/v1/skater-stats-leaders/current');
    const json = await res.json();
    // On garde un mapping { playerId: { goals, assists, points, teamAbbr } }
    const map = {};
    json?.leaders?.forEach((p) => {
      map[p.playerId] = {
        goals: p.goals || 0,
        assists: p.assists || 0,
        points: p.points || (p.goals || 0) + (p.assists || 0),
        teamAbbr: p.teamAbbrev,
      };
    });
    return map;
  } catch (e) {
    console.warn('fetchNhlStats failed:', e);
    return {};
  }
}