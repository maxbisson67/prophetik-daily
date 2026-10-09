import { resolveTsLeaderboardStats } from "./tsLeaderboardStats";

/** Points Prophetik d'une ligne membre (aligné rebuild backend). */
export function computeProphetikMemberPoints(row = {}) {
  const r = row || {};
  const fgc = Number(r.fgcPoints ?? r?.families?.fgc?.points ?? 0) || 0;
  const tp = Number(r.tpPoints ?? r?.families?.tp?.points ?? 0) || 0;
  const ts = resolveTsLeaderboardStats(r).points;
  const daily =
    Number(r.dailyBonusPoints ?? r?.families?.daily?.points ?? 0) || 0;
  return fgc + tp + ts + daily;
}

/**
 * Fusionne les docs leaderboard (clé canonique d'abord, legacy seulement si absent).
 */
export function mergeLeaderboardRows(rowsByKey, readKeys = []) {
  const keys =
    readKeys.length > 0 ? readKeys : Object.keys(rowsByKey || {});

  const merged = new Map();

  for (const key of keys) {
    for (const row of rowsByKey[key] || []) {
      const id = String(row.uid || row.id || "").trim();
      if (!id) continue;
      if (!merged.has(id)) {
        merged.set(id, { ...row, id, uid: id });
      }
    }
  }

  for (const key of keys.slice(1)) {
    for (const row of rowsByKey[key] || []) {
      const id = String(row.uid || row.id || "").trim();
      if (!id || merged.has(id)) continue;
      merged.set(id, { ...row, id, uid: id });
    }
  }

  return Array.from(merged.values()).sort(
    (a, b) => computeProphetikMemberPoints(b) - computeProphetikMemberPoints(a)
  );
}

export function isActiveGroupMembership(data = {}) {
  return (
    (typeof data.status === "string" && data.status.toLowerCase() === "active") ||
    data.active === true ||
    data.status === undefined
  );
}

/** Une ligne par membre actif du groupe (0 pts si pas encore de doc leaderboard). */
export function mergeMembersWithLeaderboardRows(memberUids, leaderboardRows) {
  const byId = new Map();
  for (const row of leaderboardRows || []) {
    const id = String(row.uid || row.id || "").trim();
    if (id) byId.set(id, row);
  }

  const uids =
    memberUids.length > 0
      ? memberUids
      : Array.from(byId.keys());

  const rows = uids.map((uid) => {
    const id = String(uid || "").trim();
    if (!id) return null;
    return (
      byId.get(id) || {
        id,
        uid: id,
        pointsTotal: 0,
        fgcPoints: 0,
        tpPoints: 0,
        tsPoints: 0,
        fgcWins: 0,
        tpWins: 0,
        tsWins: 0,
        wins: 0,
        participations: 0,
      }
    );
  });

  return rows.filter(Boolean).sort(
    (a, b) => computeProphetikMemberPoints(b) - computeProphetikMemberPoints(a)
  );
}
