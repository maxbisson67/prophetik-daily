function toNumber(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export function parseFgcEntryPoints(entry = {}) {
  const payout = toNumber(entry.payout, 0);
  const points = toNumber(entry.points, 0);
  if (payout > 0) return payout;
  if (points > 0) return points;
  return entry.won === true ? 5 : 0;
}

export function parseTpEntryPoints(entry = {}) {
  const pickResults = { ...(entry.pickResults || {}) };
  for (const [key, value] of Object.entries(entry)) {
    if (!key.startsWith("pickResults.")) continue;
    if (!value || typeof value !== "object") continue;
    pickResults[key.slice("pickResults.".length)] = value;
  }

  let pointsFromResults = 0;
  for (const result of Object.values(pickResults)) {
    if (!result || typeof result !== "object") continue;
    pointsFromResults += toNumber(result.points, 0);
  }

  const totalFromField = toNumber(entry.totalPoints, 0);
  return pointsFromResults > 0 ? Math.max(totalFromField, pointsFromResults) : totalFromField;
}

export function mergeParticipantRows({ fgcEntries = [], tpEntries = [], tsEntries = [] }) {
  const byUid = new Map();

  const touch = (uid, patch = {}) => {
    const id = String(uid || "").trim();
    if (!id) return;
    const prev = byUid.get(id) || {
      uid: id,
      displayName: null,
      avatarUrl: null,
      fgcPoints: 0,
      tpPoints: 0,
      tsPoints: 0,
      totalPoints: 0,
    };
    byUid.set(id, {
      ...prev,
      ...patch,
      fgcPoints: Math.max(prev.fgcPoints, patch.fgcPoints ?? prev.fgcPoints),
      tpPoints: Math.max(prev.tpPoints, patch.tpPoints ?? prev.tpPoints),
      tsPoints: Math.max(prev.tsPoints, patch.tsPoints ?? prev.tsPoints),
    });
  };

  for (const entry of fgcEntries) {
    const uid = String(entry.uid || entry.id || "").trim();
    if (!uid) continue;
    touch(uid, {
      displayName: entry.displayName || null,
      avatarUrl: entry.avatarUrl || null,
      fgcPoints: parseFgcEntryPoints(entry),
    });
  }

  for (const entry of tpEntries) {
    const uid = String(entry.uid || entry.id || "").trim();
    if (!uid) continue;
    touch(uid, {
      displayName: entry.displayName || null,
      avatarUrl: entry.avatarUrl || null,
      tpPoints: parseTpEntryPoints(entry),
    });
  }

  for (const entry of tsEntries) {
    const uid = String(entry.uid || entry.id || "").trim();
    if (!uid) continue;
    touch(uid, {
      displayName: entry.displayName || null,
      avatarUrl: entry.avatarUrl || null,
      tsPoints: toNumber(entry.livePoints ?? entry.finalPoints, 0),
    });
  }

  const rows = [...byUid.values()].map((row) => ({
    ...row,
    totalPoints: toNumber(row.fgcPoints) + toNumber(row.tpPoints) + toNumber(row.tsPoints),
  }));

  rows.sort((a, b) => {
    const diff = toNumber(b.totalPoints) - toNumber(a.totalPoints);
    if (diff !== 0) return diff;
    return String(a.displayName || a.uid).localeCompare(String(b.displayName || b.uid), "fr");
  });

  return rows;
}
