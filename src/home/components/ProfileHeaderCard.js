// ProfileHeaderCard.js
import React from "react";
import { View, Text, Image, TouchableOpacity } from "react-native";
import { Feather } from "@expo/vector-icons";
import i18n from "@src/i18n/i18n";
import GroupsToggleRow from "@src/home/components/GroupsToggleRow";
import ProphetikIcons from "@src/ui/ProphetikIcons";
import JerseyFlipAvatar from "@src/ui/JerseyFlipAvatar";
import { useTheme } from "@src/theme/ThemeProvider";
import StreakHeroCard from "@src/achievements/components/StreakHeroCard";

const ASC4_ICON = require("@src/assets/asc4.png");

export default function ProfileHeaderCard({
  colors,
  avatarKind,
  avatarUrl,
  jerseyFrontUrl,
  jerseyBackUrl,
  displayName,
  onEditAvatar,
  onCreateDefi,
  onCreateAscension,
  onCreateFirstGoal,
  onOpenPlayerProfile,
  groups = [],
  currentGroupId,
  onSelectGroup,
  stats,
  achievements,
  onPressProgression,
  groupSummary = null,
}) {
  const { isDark } = useTheme();
  const RED = "#b91c1c";

  const avatarFrameBg = isDark ? colors.background : "#f3f4f6";
  const avatarFrameBorder = isDark ? colors.border : "#eee";

  const baseBtn = {
    paddingVertical: 10,
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

  const isJersey = avatarKind === "jersey" && jerseyFrontUrl && jerseyBackUrl;


  const AVATAR_SIZE = 160;

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
      {/* Avatar / Jersey */}
      <View style={{ alignItems: "center", marginBottom: 12 }}>
        <TouchableOpacity onPress={onEditAvatar} activeOpacity={0.8}>
          {isJersey ? (
            <View
              style={{
                width: 120,
                height: 120,
                borderRadius: 20,
                borderWidth: 3,
                borderColor: avatarFrameBorder,
                backgroundColor: avatarFrameBg,
                overflow: "hidden",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
            <JerseyFlipAvatar
              frontUrl={jerseyFrontUrl}
              backUrl={jerseyBackUrl}
              size={140}
              pauseMs={2800}
              flipDurationMs={1100}
              backgroundColor={avatarFrameBg}
            />
            </View>
          ) : (
            <Image
              source={
                avatarUrl
                  ? { uri: avatarUrl }
                  : require("@src/assets/avatar-placeholder.png")
              }
              style={{
                width: AVATAR_SIZE,
                height: AVATAR_SIZE,
                borderRadius: 60,
                borderWidth: 3,
                borderColor: avatarFrameBorder,
                backgroundColor: avatarFrameBg,
              }}
            />
          )}

          <View
            style={{
              position: "absolute",
              bottom: 8,
              right: 8,
              backgroundColor: colors.card,
              borderRadius: 12,
              padding: 6,
              elevation: 3,
            }}
          >
            <Feather name="edit-2" size={16} color={colors.text} />
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

      <View style={{ marginTop: 10, marginBottom: 4, alignSelf: "stretch" }}>
        <StreakHeroCard
          stats={stats}
          achievements={achievements}
          onPress={onPressProgression}
          embedded
          showBadgesHint={false}
          groupSummary={groupSummary}
        />
      </View>

      {/* Sélecteur de groupe */}
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