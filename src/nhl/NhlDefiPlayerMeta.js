import React, { useMemo } from "react";
import { View, Text } from "react-native";
import TeamLogoBadge from "@src/sports/TeamLogoBadge";
import { lookupTeamByAbbr } from "@src/groups/data/fallbackTeams";
import i18n from "@src/i18n/i18n";
import {
  formatTeamGoalsAgainstPerGame,
  resolveTeamGoalsAgainstPerGame,
} from "@src/nhl/nhlTeamGoalsAgainstDisplay";

export function resolveNhlOpponentAbbr(item) {
  return String(item?.matchup?.opponentAbbr || "").toUpperCase();
}

/** TRIO pick : vs adversaire + BC sur une ligne (sans fiche ni rang). */
export function NhlOpponentPickMeta({
  opponentAbbr,
  colors,
  getStandingsRecord = null,
  teamOrMatchup = null,
  logoSize = 14,
}) {
  const opp = String(opponentAbbr || "").toUpperCase();
  const bcLabel = i18n.t("defi.matchup.goalsAgainstShort", { defaultValue: "BC" });

  const bcValue = useMemo(() => {
    if (!opp) return null;
    const standingsRecord =
      typeof getStandingsRecord === "function" ? getStandingsRecord(opp) : null;
    const gaPg =
      resolveTeamGoalsAgainstPerGame(teamOrMatchup) ??
      resolveTeamGoalsAgainstPerGame(standingsRecord);
    return formatTeamGoalsAgainstPerGame(gaPg);
  }, [opp, getStandingsRecord, teamOrMatchup]);

  if (!opp) return null;

  const oppTeam = lookupTeamByAbbr("NHL", opp);

  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
      <Text style={{ color: colors.subtext, fontWeight: "900", fontSize: 12 }}>vs</Text>
      <TeamLogoBadge
        team={{ ...oppTeam, sport: "NHL", abbreviation: opp }}
        size={logoSize}
        colors={colors}
      />
      <Text style={{ color: colors.subtext, fontWeight: "900", fontSize: 12 }}>{opp}</Text>
      <Text style={{ color: colors.subtext, fontWeight: "700", fontSize: 12 }}>·</Text>
      <Text style={{ color: colors.subtext, fontWeight: "800", fontSize: 12 }}>
        {bcLabel}: {bcValue ?? "—"}
      </Text>
    </View>
  );
}

/** Adversaire du soir + fiche (W-L) si disponible. */
export function NhlOpponentMatchupLine({
  opponentAbbr,
  colors,
  formatStandingsLine = null,
  logoSize = 14,
}) {
  const opp = String(opponentAbbr || "").toUpperCase();
  if (!opp) return null;

  const oppTeam = lookupTeamByAbbr("NHL", opp);
  const rawRecord =
    typeof formatStandingsLine === "function" ? formatStandingsLine(opp) : null;
  const record = rawRecord ? String(rawRecord).split(" · ")[0] : null;

  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
      <Text style={{ color: colors.subtext, fontWeight: "900", fontSize: 12 }}>vs</Text>
      <TeamLogoBadge
        team={{ ...oppTeam, sport: "NHL", abbreviation: opp }}
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
