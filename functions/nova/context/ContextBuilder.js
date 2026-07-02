import { FgcNhlContextBuilder } from "./builders/FgcNhlContextBuilder.js";
import { FgcMlbContextBuilder } from "./builders/FgcMlbContextBuilder.js";
import { TpMlbContextBuilder } from "./builders/TpMlbContextBuilder.js";

const BUILDERS = {
  fgc_nhl: new FgcNhlContextBuilder(),
  fgc_mlb: new FgcMlbContextBuilder(),
  tp_mlb: new TpMlbContextBuilder(),
};

/**
 * Résout le domaine → builder de contexte vérifié.
 */
export class ContextBuilder {
  /**
   * @param {{ domain: string, sport?: string, uid: string, challengeId?: string, playerIds?: string[] }}
   */
  async build({ domain, sport, uid, challengeId, playerIds = [], gameId = null, focusSlot = null, focusPlayerHint = null }) {
    const key = this.resolveBuilderKey(domain, sport);
    const builder = BUILDERS[key];

    if (!builder) {
      throw new Error(`UNSUPPORTED_CONTEXT:${key}`);
    }

    return builder.build({ uid, challengeId, playerIds, gameId, focusSlot, focusPlayerHint });
  }

  resolveBuilderKey(domain, sport) {
    const d = String(domain || "").trim().toLowerCase();
    const s = String(sport || "").trim().toUpperCase();

    if (d === "fgc" && s === "NHL") return "fgc_nhl";
    if (d === "fgc" && s === "MLB") return "fgc_mlb";
    if (d === "tp" && s === "MLB") return "tp_mlb";
    if (d === "fgc_nhl") return "fgc_nhl";
    if (d === "fgc_mlb") return "fgc_mlb";
    if (d === "tp_mlb") return "tp_mlb";

    return `${d}_${s}`.toLowerCase();
  }
}
