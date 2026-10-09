import React from "react";
import { View, Text } from "react-native";
import TeamLogoBadge from "@src/sports/TeamLogoBadge";
import { lookupTeamByAbbr } from "@src/groups/data/fallbackTeams";

export function resolveNhlOpponentAbbr(item) {
  return String(item?.matchup?.opponentAbbr || "").toUpperCase();
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
