import React, { useMemo } from "react";
import { View, Text } from "react-native";
import i18n from "@src/i18n/i18n";
import { LeaderboardTrophyLeading } from "./leaderboardSectionIcons";
import { computeTeamStandings } from "@src/groups/teamSplitUtils";

function cardStyle(colors, accent) {
  return {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 16,
    overflow: "hidden",
    borderLeftWidth: 4,
    borderLeftColor: accent,
    marginTop: 16,
    marginBottom: 16,
  };
}

export default function TeamLeaderboardSection({
  teamSplit,
  memberRows = [],
  colors,
  accent = "#ef4444",
}) {
  const t = i18n.t.bind(i18n);
  const standings = useMemo(
    () => computeTeamStandings({ teamSplit, memberRows }),
    [teamSplit, memberRows]
  );

  const { ranked, gap, leader } = standings;

  const gapDisplay =
    gap > 0
      ? Number(gap).toLocaleString(
          String(i18n.locale || "fr").startsWith("fr") ? "fr-FR" : "en-US",
          { minimumFractionDigits: gap % 1 === 0 ? 0 : 1, maximumFractionDigits: 1 }
        )
      : "";

  return (
    <View style={cardStyle(colors, accent)}>
      <View
        style={{
          paddingHorizontal: 14,
          paddingTop: 14,
          paddingBottom: 10,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
          backgroundColor: colors.card2,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <LeaderboardTrophyLeading size={28} />
          <Text style={{ color: colors.text, fontWeight: "900", fontSize: 16, flex: 1 }}>
            {t("leaderboard.teamSplit.title", {
              defaultValue: "Classement par équipes",
            })}
          </Text>
        </View>
        <Text style={{ color: colors.subtext, fontSize: 12, marginTop: 4, fontWeight: "600" }}>
          {t("leaderboard.teamSplit.subtitle", {
            defaultValue: "Moyenne des points totaux (phase sélectionnée).",
          })}
        </Text>
      </View>

      {ranked.map((team, idx) => {
        const isLeader = idx === 0 && team.memberCount > 0;
        return (
          <View
            key={team.teamId}
            style={{
              flexDirection: "row",
              alignItems: "center",
              paddingVertical: 14,
              paddingHorizontal: 14,
              borderBottomWidth: idx < ranked.length - 1 ? 1 : 0,
              borderBottomColor: colors.border,
              backgroundColor: isLeader ? `${accent}12` : colors.card,
            }}
          >
            <Text
              style={{
                width: 28,
                fontWeight: "900",
                fontSize: 18,
                color: isLeader ? accent : colors.subtext,
              }}
            >
              {team.rank}
            </Text>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ fontWeight: "900", color: colors.text, fontSize: 16 }} numberOfLines={1}>
                {team.name}
              </Text>
              <Text style={{ color: colors.subtext, fontSize: 12, marginTop: 2 }}>
                {t("leaderboard.teamSplit.memberCount", {
                  defaultValue: "{{count}} membre(s)",
                  count: team.memberCount,
                })}
              </Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={{ fontWeight: "900", color: colors.text, fontSize: 17 }}>
                {team.averageDisplay.toLocaleString("fr-FR")}
              </Text>
              <Text style={{ color: colors.subtext, fontSize: 11, fontWeight: "700" }}>
                {t("leaderboard.teamSplit.avgLabel", { defaultValue: "moy. pts" })}
              </Text>
            </View>
          </View>
        );
      })}

      {ranked.length === 2 && gap > 0 && leader?.name ? (
        <View style={{ padding: 12, backgroundColor: colors.card2 }}>
          <Text style={{ color: colors.text, fontSize: 13, fontWeight: "800", textAlign: "center" }}>
            {t("leaderboard.teamSplit.gapLead", {
              defaultValue: "🔥 {{team}} mène par {{gap}} points !",
              team: leader.name,
              gap: gapDisplay,
            })}
          </Text>
        </View>
      ) : null}
    </View>
  );
}
