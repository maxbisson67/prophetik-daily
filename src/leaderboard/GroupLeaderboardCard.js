// src/leaderboard/GroupLeaderboardCard.js
import React from "react";
import { View, Text, Image } from "react-native";
import LeaderboardTable from "./LeaderboardTable";

const GROUP_PLACEHOLDER = require("@src/assets/group-placeholder.png");
const RED = "#b91c1c";

function cardShadow() {
  return {
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 }, // iOS
    elevation: 4, // Android
  };
}

function sectionCardStyle(colors, accent = RED) {
  return {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 16,
    overflow: "hidden",
    padding: 14,

    // ✅ signature Prophetik
    borderLeftWidth: 4,
    borderLeftColor: accent,
    borderBottomWidth: 2,
    borderBottomColor: accent,
  };
}

export default function GroupLeaderboardCard({
  group,
  rows,
  colors,
  columns,
  emptyText,
  onRowPress,
}) {
  return (
    <View style={[cardShadow(), sectionCardStyle(colors, RED)]}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 8,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", flex: 1, paddingRight: 8 }}>
          <Image
            source={group?.avatarUrl ? { uri: group.avatarUrl } : GROUP_PLACEHOLDER}
            style={{
              width: 32,
              height: 32,
              borderRadius: 16,
              marginRight: 8,
              backgroundColor: colors.border,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          />
          <Text style={{ fontWeight: "900", color: colors.text }} numberOfLines={1}>
            {group?.name || group?.title || group?.id || "—"}
          </Text>
        </View>
      </View>

      {!rows || rows.length === 0 ? (
        <Text style={{ color: colors.subtext }}>{emptyText}</Text>
      ) : (
        <LeaderboardTable
          rows={rows}
          colors={colors}
          columns={columns}
          defaultSortKey="pointsTotal"
          onRowPress={(row) => onRowPress?.(row, rows)}
        />
      )}
    </View>
  );
}