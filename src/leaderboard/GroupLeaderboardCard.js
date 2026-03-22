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
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  };
}

function sectionCardStyle(colors, accent = RED) {
  return {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 16,
    overflow: "hidden",
    padding: 5,
    borderLeftWidth: 4,
    borderLeftColor: accent,
    borderBottomWidth: 2,
    borderBottomColor: accent,
  };
}

function getAlignItems(align) {
  if (align === "right") return "flex-end";
  if (align === "center") return "center";
  return "flex-start";
}

function getTextAlign(align) {
  if (align === "right") return "right";
  if (align === "center") return "center";
  return "left";
}

function LeaderboardHeaderRow({ columns, colors }) {
  if (!Array.isArray(columns) || !columns.length) return null;

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingBottom: 2,
        marginBottom: 2,
      }}
    >
      {/* ✅ Même structure que les vraies rows */}
      <View
        style={{
          width: 40, // 32 avatar + 8 marginRight
        }}
      />
      <View
        style={{
          flex: 1.5,
          paddingRight: 8,
        }}
      />

      {columns.map((col) => {
        const align = col?.align || "center";
        const headerContent = col?.header ?? col?.label;

        return (
          <View
            key={String(col?.key)}
            style={{
              flex: col?.flex || 1,
              minHeight: 22,
              paddingHorizontal: 2,
              justifyContent: "center",
              alignItems: "center", // ✅ force le centrage visuel
            }}
          >
            {React.isValidElement(headerContent) ? (
              <View
                style={{
                  minWidth: 24,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {headerContent}
              </View>
            ) : (
              <Text
                style={{
                  color: colors.subtext,
                  fontSize: 12,
                  fontWeight: "900",
                  textAlign: "center",
                }}
                numberOfLines={1}
              >
                {String(headerContent ?? "")}
              </Text>
            )}
          </View>
        );
      })}
    </View>
  );
}

export default function GroupLeaderboardCard({
  group,
  rows,
  colors,
  columns,
  emptyText,
  onRowPress,
}) {
  // On vide les labels passés au tableau pour éviter un doublon
  const tableColumns = Array.isArray(columns)
    ? columns.map((c) => ({
        ...c,
        label: "",
      }))
    : [];

  return (
    <View style={[cardShadow(), sectionCardStyle(colors, RED)]}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        
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
        <>
          <LeaderboardHeaderRow columns={columns} colors={colors} />

      <LeaderboardTable
        rows={rows}
        colors={colors}
        columns={tableColumns}
        hideHeader
        defaultSortKey="pointsTotal"
        onRowPress={(row) => onRowPress?.(row, rows)}
      />
        </>
      )}
    </View>
  );
}