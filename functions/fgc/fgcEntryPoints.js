import { FGC_WIN_POINTS } from "../challengeScoringConstants.js";

function toNumber(v, def = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}

/**
 * Points FGC comptabilisés pour un entry (classement, bonus du soir, live).
 * Si gagnant : au moins FGC_WIN_POINTS (évite les vieux payout/points à 5).
 */
export function resolveFgcEntryPoints(
  entry = {},
  { winnersPreviewUids = [], winPoints = FGC_WIN_POINTS } = {}
) {
  const payout = toNumber(entry?.payout, 0);
  const pointsField = toNumber(entry?.points, 0);
  const uid = String(entry?.uid || entry?.pickedBy || "");
  const preview = (winnersPreviewUids || []).map(String);

  const won =
    entry?.won === true ||
    payout > 0 ||
    pointsField > 0 ||
    preview.includes(uid);

  if (!won) return 0;

  const floor = toNumber(winPoints, FGC_WIN_POINTS);
  return Math.max(payout, pointsField, floor);
}

export function isFgcEntryWinner(entry = {}, { winnersPreviewUids = [] } = {}) {
  const payout = toNumber(entry?.payout, 0);
  const pointsField = toNumber(entry?.points, 0);
  const uid = String(entry?.uid || entry?.pickedBy || "");
  const preview = (winnersPreviewUids || []).map(String);

  return (
    entry?.won === true ||
    payout > 0 ||
    pointsField > 0 ||
    preview.includes(uid)
  );
}
