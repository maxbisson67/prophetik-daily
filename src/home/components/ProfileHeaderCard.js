// ProfileHeaderCard.js
import React from "react";
import { View, Text, Image, TouchableOpacity } from "react-native";
import { Feather } from "@expo/vector-icons";
import i18n from "@src/i18n/i18n";
import GroupsToggleRow from "@src/home/components/GroupsToggleRow";
import ProphetikIcons from "@src/ui/ProphetikIcons";
const ASC4_ICON = require("@src/assets/asc4.png");

export default function ProfileHeaderCard({
  colors,
  avatarUrl,
  displayName,
  points,
  onEditAvatar,
  onPressPoints,
  onCreateDefi,
  onCreateAscension,
  onCreateFirstGoal,
  onOpenPlayerProfile,
  groups = [],
  currentGroupId,
  onSelectGroup,
}) {
  const RED = "#b91c1c";

  const baseBtn = {
    paddingVertical: 10,          // ✅ un peu moins gros
    paddingHorizontal: 14,
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    minHeight: 42,
  };

  const ctaPrimary = {
    ...baseBtn,
    backgroundColor: RED,
  };

  const ctaOutline = {
    ...baseBtn,
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: RED,
  };

  const textPrimary = { color: "#fff", fontWeight: "900" };
  const textOutline = { color: RED, fontWeight: "900" };

  return (
    <View
      style={{
        padding: 14,
        borderWidth: 1,
        borderRadius: 12,
        backgroundColor: colors.card,
        borderColor: colors.border,
      }}
    >
      {/* Avatar */}
      <View style={{ alignItems: "center", marginBottom: 12 }}>
        <TouchableOpacity onPress={onEditAvatar} activeOpacity={0.8}>
          <Image
            source={
              avatarUrl
                ? { uri: avatarUrl }
                : require("@src/assets/avatar-placeholder.png")
            }
            style={{
              width: 120,
              height: 120,
              borderRadius: 60,
              borderWidth: 3,
              borderColor: "#eee",
              backgroundColor: "#f3f4f6",
            }}
          />
          <View
            style={{
              position: "absolute",
              bottom: 6,
              right: 6,
              backgroundColor: colors.card,
              borderRadius: 12,
              padding: 4,
              elevation: 3,
            }}
          >
            <Feather name="edit-2" size={14} color={colors.text} />
          </View>
        </TouchableOpacity>

        <Text
          style={{
            fontWeight: "800",
            fontSize: 16,
            marginTop: 8,
            color: colors.text,
          }}
        >
          {i18n.t("home.hello")} {displayName || "—"}
        </Text>
      </View>

      {/* Sélecteur */}
      <View style={{ alignSelf: "stretch" }}>
        <GroupsToggleRow
          colors={colors}
          groups={groups}
          value={currentGroupId}
          onChange={onSelectGroup}
        />
      </View>

    
    </View>
  );
}