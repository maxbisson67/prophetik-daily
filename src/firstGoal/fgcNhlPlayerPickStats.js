import { getNhlFirstGoalsSeasonCount, getNhlGoalsPerGameFromStats, getSeasonStats } from "@src/players/seasonStatsHelpers";

export function getNhlPickSeasonId(seasonPair) {
  return seasonPair?.current ? String(seasonPair.current) : "";
}

export function getNhlPickSeasonStats(player, seasonId) {
  const sid = String(seasonId || "").trim();
  if (!sid) return null;
  const stats = getSeasonStats(player?.statsBySeason, sid);
  return stats && typeof stats === "object" ? stats : null;
}

export function formatNhlPickGoalsPerGame(player, seasonId) {
  const stats = getNhlPickSeasonStats(player, seasonId);
  if (!stats) return "—";
  const gp = Number(stats.gamesPlayed) || 0;
  if (gp <= 0) return "—";
  return getNhlGoalsPerGameFromStats(stats).toFixed(2);
}

export function getNhlPickFirstGoalsCount(player, seasonId) {
  const n = getNhlFirstGoalsSeasonCount(player, seasonId);
  if (n == null || !Number.isFinite(Number(n))) return 0;
  return Math.max(0, Number(n));
}

export function getNhlPlayerFirstName(player) {
  const full = String(player?.fullName || player?.name || "").trim();
  if (!full) return "";
  const parts = full.split(/\s+/).filter(Boolean);
  return parts[0] || full;
}

export function formatNhlTimeOnIcePerGame(raw) {
  if (raw == null || raw === "") return "—";
  if (typeof raw === "string") {
    const s = raw.trim();
    if (s.includes(":")) return s;
  }
  const sec = Number(raw);
  if (!Number.isFinite(sec) || sec <= 0) return "—";
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function formatNhlShotsPerGame(stats) {
  if (!stats) return "—";
  const gp = Number(stats.gamesPlayed) || 0;
  const shots = Number(stats.shots);
  if (gp <= 0 || !Number.isFinite(shots)) return "—";
  return (shots / gp).toFixed(1);
}

export function getNhlPickDetailStats(player, seasonId) {
  const stats = getNhlPickSeasonStats(player, seasonId);
  if (!stats) {
    return {
      goals: "—",
      goalsPerGame: "—",
      timeOnIce: "—",
      shotsPerGame: "—",
      ppGoals: "—",
    };
  }
  const goals = Number(stats.goals);
  const pp = Number(stats.ppGoals ?? stats.powerPlayGoals);
  const goalsPerGame = formatNhlPickGoalsPerGame(player, seasonId);
  return {
    goals: Number.isFinite(goals) ? String(goals) : "—",
    goalsPerGame,
    timeOnIce: formatNhlTimeOnIcePerGame(stats.timeOnIcePerGame),
    shotsPerGame: formatNhlShotsPerGame(stats),
    ppGoals: Number.isFinite(pp) ? String(pp) : "—",
  };
}
