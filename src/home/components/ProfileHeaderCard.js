// ProfileHeaderCard.js
import React, { useState } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Feather } from "@expo/vector-icons";
import i18n from "@src/i18n/i18n";
import GroupsToggleRow from "@src/home/components/GroupsToggleRow";
import JerseyFlipAvatar from "@src/ui/JerseyFlipAvatar";
import JerseyPlaceholder from "@src/ui/JerseyPlaceholder";
import JerseyImage from "@src/ui/JerseyImage";
import LegacyAvatar from "@src/ui/LegacyAvatar";
import {
  hasCompleteJersey,
  hasJerseyFrontOnly,
  shouldShowLegacyAvatar,
  resolveCatalogAvatarUrl,
} from "@src/ui/resolveJerseyAvatar";
import { useTheme } from "@src/theme/ThemeProvider";
import StreakHeroCard from "@src/achievements/components/StreakHeroCard";

const AVATAR_SIZE = 120;

export default function ProfileHeaderCard({
  colors,
  avatarKind,
  avatarUrl,
  jerseyFrontUrl,
  jerseyBackUrl,
  displayName,
  onEditAvatar,
  groups = [],
  currentGroupId,
  onSelectGroup,
  stats,
  achievements,
  onPressProgression,
  groupSummary = null,
}) {
  const { isDark } = useTheme();
  const [jerseyFrontFailed, setJerseyFrontFailed] = useState(false);

  const avatarFrameBg = isDark ? colors.background : "#f3f4f6";
  const avatarFrameBorder = isDark ? colors.border : "#eee";
  const isJersey = hasCompleteJersey(jerseyFrontUrl, jerseyBackUrl);
  const catalogUrl = resolveCatalogAvatarUrl({ avatarKind, avatarUrl });
  const showLegacyAvatar = shouldShowLegacyAvatar({
    avatarKind,
    avatarUrl: catalogUrl,
    jerseyFrontUrl,
    jerseyBackUrl,
  });
  const showJerseyFront =
    hasJerseyFrontOnly(jerseyFrontUrl, jerseyBackUrl) && !jerseyFrontFailed;

  return (
    <View
      style={{
        padding: 12,
        borderWidth: 1,
        borderRadius: 12,
        backgroundColor: colors.card,
        borderColor: colors.border,
      }}
    >
      <GroupsToggleRow
        colors={colors}
        groups={groups}
        value={currentGroupId}
        onChange={onSelectGroup}
        compact
      />

      <View style={{ alignItems: "center", marginTop: 12, marginBottom: 8 }}>
        <TouchableOpacity onPress={onEditAvatar} activeOpacity={0.8}>
          {isJersey ? (
            <JerseyFlipAvatar
              frontUrl={jerseyFrontUrl}
              backUrl={jerseyBackUrl}
              size={AVATAR_SIZE}
              holdMs={2800}
              fadeDurationMs={1100}
              backgroundColor="transparent"
            />
          ) : showJerseyFront ? (
            <View
              style={{
                width: AVATAR_SIZE,
                height: AVATAR_SIZE,
                borderRadius: 18,
                borderWidth: 3,
                borderColor: avatarFrameBorder,
                backgroundColor: avatarFrameBg,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <JerseyImage
                uri={jerseyFrontUrl}
                size={AVATAR_SIZE - 6}
                onError={() => setJerseyFrontFailed(true)}
              />
            </View>
          ) : showLegacyAvatar ? (
            <LegacyAvatar
              uri={catalogUrl}
              name={displayName}
              size={AVATAR_SIZE}
              colors={colors}
              borderWidth={3}
            />
          ) : (
            <JerseyPlaceholder
              size={AVATAR_SIZE}
              colors={colors}
              name={displayName}
              borderRadius={18}
              emphasized
            />
          )}

          <View
            style={{
              position: "absolute",
              bottom: 4,
              right: 4,
              backgroundColor: colors.card,
              borderRadius: 12,
              padding: 8,
              elevation: 3,
              minWidth: 36,
              minHeight: 36,
              alignItems: "center",
              justifyContent: "center",
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

      <StreakHeroCard
        stats={stats}
        achievements={achievements}
        onPress={onPressProgression}
        embedded
        homeMinimal
        showBadgesHint={false}
        groupSummary={groupSummary}
      />
    </View>
  );
}
