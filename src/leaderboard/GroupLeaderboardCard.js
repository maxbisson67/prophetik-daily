// src/leaderboard/GroupLeaderboardCard.js
import React from "react";
import { View, Text, Image } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import LeaderboardTable from "./LeaderboardTable";

const GROUP_PLACEHOLDER = require("@src/assets/group-placeholder.png");

export default function GroupLeaderboardCard({
  group,
  rows,
  colors,
  columns,
  emptyText,
  onRowPress,
}) {
  return (
    <View
      style={{
        padding: 14,
        borderRadius: 12,
        backgroundColor: colors.card,
        borderWidth: 1,
        borderColor: colors.border,
        shadowColor: "#000",
        shadowOpacity: 0.05,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 3 },
        elevation: 2,
      }}
    >
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