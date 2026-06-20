import React from "react";
import { View, Text } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import i18n from "@src/i18n/i18n";
import {
  getBadgeProgress,
  isAchievementUnlocked,
  formatUnlockedDate,
} from "../progressionUtils.js";

const RED = "#b91c1c";

export default function BadgeTile({ def, stats, achievements, colors, compact = false }) {
  const unlocked = isAchievementUnlocked(achievements, def.id);
  const { current, threshold } = getBadgeProgress(def, stats);

  const name = i18n.t(`progression.badges.${def.id}.name`, {
    defaultValue: def.id,
  });
  const description = i18n.t(`progression.badges.${def.id}.description`, {
    defaultValue: "",
  });

  const unlockedAt = achievements?.[def.id]?.unlockedAt;
  const unlockedLabel = unlocked
    ? i18n.t("progression.unlockedAt", {
        date: formatUnlockedDate(unlockedAt, i18n.locale),
        defaultValue: `Unlocked ${formatUnlockedDate(unlockedAt)}`,
      })
    : null;

  const iconColor = unlocked ? RED : colors.subtext;
  const bg = unlocked ? "rgba(185,28,28,0.10)" : colors.card2 || colors.background;
  const border = unlocked ? "rgba(185,28,28,0.35)" : colors.border;

  return (
    <View
      style={{
        flex: 1,
        minWidth: compact ? 96 : 100,
        maxWidth: compact ? 120 : undefined,
        padding: compact ? 10 : 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: border,
        backgroundColor: bg,
        opacity: unlocked ? 1 : 0.82,
        gap: 6,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <View
          style={{
            width: compact ? 34 : 38,
            height: compact ? 34 : 38,
            borderRadius: 10,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: unlocked ? "rgba(185,28,28,0.15)" : colors.card,
            borderWidth: 1,
            borderColor: border,
          }}
        >
          <MaterialCommunityIcons name={def.icon} size={compact ? 18 : 20} color={iconColor} />
        </View>

        {unlocked ? (
          <MaterialCommunityIcons name="check-circle" size={18} color={RED} />
        ) : (
          <MaterialCommunityIcons name="lock-outline" size={16} color={colors.subtext} />
        )}
      </View>

      <Text
        numberOfLines={2}
        style={{
          color: colors.text,
          fontWeight: "800",
          fontSize: compact ? 12 : 13,
          lineHeight: compact ? 15 : 16,
        }}
      >
        {name}
      </Text>

      {!compact && !!description ? (
        <Text numberOfLines={3} style={{ color: colors.subtext, fontSize: 11, lineHeight: 14 }}>
          {description}
        </Text>
      ) : null}

      {unlocked ? (
        unlockedLabel ? (
          <Text style={{ color: colors.subtext, fontSize: 10, marginTop: 2 }}>{unlockedLabel}</Text>
        ) : null
      ) : (
        <Text style={{ color: colors.subtext, fontSize: 11, fontWeight: "700", marginTop: 2 }}>
          {i18n.t("progression.progress", {
            current,
            threshold,
            defaultValue: `${current}/${threshold}`,
          })}
        </Text>
      )}
    </View>
  );
}
