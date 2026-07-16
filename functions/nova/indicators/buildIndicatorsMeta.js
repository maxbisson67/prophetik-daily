import { buildTsIndicatorsMeta } from "./buildTsIndicatorsMeta.js";
import { buildFgcIndicatorsMeta } from "./buildFgcIndicatorsMeta.js";
import { buildTpIndicatorsMeta } from "./buildTpIndicatorsMeta.js";

/**
 * Snapshot indicateurs Nova — TS, FGC ou TP selon le contexte vérifié.
 * @param {object|null} verifiedContext
 */
export function buildIndicatorsMeta(verifiedContext) {
  return (
    buildTsIndicatorsMeta(verifiedContext) ||
    buildFgcIndicatorsMeta(verifiedContext) ||
    buildTpIndicatorsMeta(verifiedContext)
  );
}
