import React from "react";
import { View, Text } from "react-native";
import i18n from "@src/i18n/i18n";
import TeamLogoBadge from "@src/sports/TeamLogoBadge";
import { lookupTeamByAbbr } from "@src/groups/data/fallbackTeams";
import {
  formatMlbPitcherFallbackLabel,
  formatMlbPitcherSummary,
} from "@src/mlb/mlbPitcherDisplayHelpers";

export function resolveMlbOpponentAbbr(item) {
  return String(item?.opponentTeamAbbr || item?.matchup?.opponentAbbr || "").toUpperCase();
}

export function buildMlbGameByTeamMap(matchups = []) {
  const map = new Map();
  for (const g of matchups) {
    if (String(g?.sport || "").toUpperCase() !== "MLB") continue;
    const awayAbbr = String(g?.away?.abbr || "").toUpperCase();
    const homeAbbr = String(g?.home?.abbr || "").toUpperCase();
    if (!awayAbbr || !homeAbbr) continue;
    const entry = { awayAbbr, homeAbbr };
    map.set(awayAbbr, entry);
    map.set(homeAbbr, entry);
  }
  return map;
}

export function resolveMlbGameAbbrs(item, scheduleByTeam = null) {
  const team = String(item?.teamAbbr || "").toUpperCase();
  const fromSchedule = scheduleByTeam?.get?.(team);
  if (fromSchedule) return fromSchedule;

  const awayStored = String(item?.awayAbbr || item?.matchup?.awayAbbr || "").toUpperCase();
  const homeStored = String(item?.homeAbbr || item?.matchup?.homeAbbr || "").toUpperCase();
  if (awayStored && homeStored) {
    return { awayAbbr: awayStored, homeAbbr: homeStored };
  }

  const opp = resolveMlbOpponentAbbr(item);
  if (!team || !opp) {
    return { awayAbbr: awayStored, homeAbbr: homeStored };
  }

  if (item?.isHome === true) return { awayAbbr: opp, homeAbbr: team };
  if (item?.isHome === false) return { awayAbbr: team, homeAbbr: opp };
  return { awayAbbr: team, homeAbbr: opp };
}

export function MlbOpponentMatchupLine({
  opponentAbbr,
  colors,
  formatStandingsLine = null,
  logoSize = 14,
}) {
  const opp = String(opponentAbbr || "").toUpperCase();
  if (!opp) return null;

  const oppTeam = lookupTeamByAbbr("MLB", opp);
  const rawRecord =
    typeof formatStandingsLine === "function" ? formatStandingsLine(opp) : null;
  const record = rawRecord ? String(rawRecord).split(" · ")[0] : null;

  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
      <Text style={{ color: colors.subtext, fontWeight: "900", fontSize: 12 }}>@</Text>
      <TeamLogoBadge
        team={{ ...oppTeam, sport: "MLB", abbreviation: opp }}
        size={logoSize}
        colors={colors}
      />
      <Text style={{ color: colors.subtext, fontWeight: "900", fontSize: 12 }}>{opp}</Text>
      {record ? (
        <Text style={{ color: colors.subtext, fontWeight: "700", fontSize: 12 }}>({record})</Text>
      ) : null}
    </View>
  );
}

export function MlbGameMatchupRow({ awayAbbr, homeAbbr, colors, logoSize = 14 }) {
  const away = String(awayAbbr || "").toUpperCase();
  const home = String(homeAbbr || "").toUpperCase();
  if (!away || !home) return null;

  const awayTeam = lookupTeamByAbbr("MLB", away);
  const homeTeam = lookupTeamByAbbr("MLB", home);

  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
      <TeamLogoBadge
        team={{ ...awayTeam, sport: "MLB", abbreviation: away }}
        size={logoSize}
        colors={colors}
      />
      <Text style={{ color: colors.subtext, fontWeight: "900", fontSize: 12 }}>{away}</Text>
      <Text style={{ color: colors.subtext, fontWeight: "900", fontSize: 12 }}>@</Text>
      <Text style={{ color: colors.subtext, fontWeight: "900", fontSize: 12 }}>{home}</Text>
      <TeamLogoBadge
        team={{ ...homeTeam, sport: "MLB", abbreviation: home }}
        size={logoSize}
        colors={colors}
      />
    </View>
  );
}

export function MlbProbablePitcherLine({ pitcher, colors }) {
  const line =
    formatMlbPitcherSummary(pitcher) || formatMlbPitcherFallbackLabel(i18n.t.bind(i18n));

  return (
    <Text
      style={{ color: colors.subtext, fontWeight: "700", fontSize: 12 }}
      numberOfLines={2}
    >
      {line}
    </Text>
  );
}

export function shouldShowMlbBvpLine(bvp) {
  if (!bvp || typeof bvp !== "object") return false;
  return bvp.hasSample === true || Number(bvp.pa) > 0;
}

export function formatMlbBvpSummary(bvp, { pitcherName } = {}) {
  const row = bvp && typeof bvp === "object" ? bvp : null;
  if (!row) return null;

  const name = String(pitcherName || row.pitcherName || "").trim();

  if (!row.hasSample) {
    if (!name) {
      return i18n.t("mlb.bvp.noSampleShort", { defaultValue: "Pas d'historique vs ce lanceur" });
    }
    return i18n.t("mlb.bvp.noSample", {
      defaultValue: "vs {{pitcher}} : pas d'historique",
      pitcher: name,
    });
  }

  const ops = row.ops != null ? String(row.ops) : "—";
  if (!name) {
    return i18n.t("mlb.bvp.shortLine", {
      defaultValue: "{{pa}} PA · {{hits}} H · {{hr}} HR · OPS {{ops}}",
      pa: row.pa,
      hits: row.hits,
      hr: row.homeRuns,
      rbi: row.rbi,
      ops,
    });
  }

  return i18n.t("mlb.bvp.careerLine", {
    defaultValue: "vs {{pitcher}} : {{pa}} PA · {{hits}} H · {{hr}} HR · {{rbi}} RBI · OPS {{ops}}",
    pitcher: name,
    pa: row.pa,
    hits: row.hits,
    hr: row.homeRuns,
    rbi: row.rbi,
    ops,
  });
}

export function MlbBvpLine({ bvp, pitcher, colors }) {
  if (!shouldShowMlbBvpLine(bvp)) return null;

  const line = formatMlbBvpSummary(bvp, { pitcherName: pitcher?.name });
  if (!line) return null;

  return (
    <Text style={{ color: colors.subtext, fontWeight: "700", fontSize: 11 }} numberOfLines={2}>
      {line}
    </Text>
  );
}

export function isMlbDefiPlayer(item, sport) {
  if (String(sport || item?.sport || "").toUpperCase() === "MLB") return true;
  return !!item?.opponentProbablePitcher;
}
