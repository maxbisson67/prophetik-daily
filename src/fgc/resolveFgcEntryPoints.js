import { FGC_WIN_POINTS } from "@src/lib/challengeScoringConstants";

function toNumber(v, def = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}

/** Aligné sur functions/fgc/fgcEntryPoints.js */
export function resolveFgcEntryPoints(entry = {}, { winPoints = FGC_WIN_POINTS } = {}) {
  const payout = toNumber(entry?.payout, 0);
  const pointsField = toNumber(entry?.points, 0);

  const won = entry?.won === true || payout > 0 || pointsField > 0;
  if (!won) return 0;

  const floor = toNumber(winPoints, FGC_WIN_POINTS);
  return Math.max(payout, pointsField, floor);
}
