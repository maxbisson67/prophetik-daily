import { buildTsIndicatorModel } from "@src/nova/buildTsIndicatorModel";
import { buildFgcIndicatorModel } from "@src/nova/buildFgcIndicatorModel";
import { buildTpIndicatorModel } from "@src/nova/buildTpIndicatorModel";

export function supportsNovaIndicatorView(domain, sport) {
  const d = String(domain || "").toLowerCase();
  const s = String(sport || "").toUpperCase();
  if (d === "ts" && s === "MLB") return true;
  if (d === "fgc" && (s === "MLB" || s === "NHL")) return true;
  if (d === "tp" && s === "MLB") return true;
  return false;
}

/**
 * @param {{ domain: string, sport: string, indicators?: object|null, novaResponse?: object|null, player?: object|null, lang?: string, probablePitchers?: object|null, homeAbbr?: string|null, awayAbbr?: string|null }} params
 */
export function buildNovaIndicatorModel({
  domain,
  sport,
  indicators,
  novaResponse,
  player,
  lang = "fr",
  probablePitchers = null,
  homeAbbr = null,
  awayAbbr = null,
}) {
  const d = String(domain || "").toLowerCase();
  const s = String(sport || "").toUpperCase();

  if (d === "ts" && s === "MLB") {
    return { kind: "ts_mlb", ...buildTsIndicatorModel({ indicators, novaResponse, player, lang }) };
  }

  if (d === "fgc") {
    const fgcModel = buildFgcIndicatorModel({
      sport: s,
      indicators,
      novaResponse,
      player,
      lang,
      probablePitchers,
      homeAbbr,
      awayAbbr,
    });
    if (!fgcModel) return null;
    return { kind: s === "NHL" ? "fgc_nhl" : "fgc_mlb", ...fgcModel };
  }

  if (d === "tp" && s === "MLB") {
    const tpModel = buildTpIndicatorModel({ indicators, novaResponse, lang });
    if (!tpModel) return null;
    return { kind: "tp_mlb", ...tpModel };
  }

  return null;
}
