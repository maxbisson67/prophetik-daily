import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import i18n from "@src/i18n/i18n";
import { MVP_ACHIEVEMENT_COUNT } from "../mvpAchievements.js";
import {
  countUnlockedAchievements,
  normalizeAchievements,
  normalizeStats,
} from "../progressionUtils.js";

const RED = "#b91c1c";

function StatPill({ icon, label, value, colors }) {
  return (
    <View
      style={{
        flex: 1,
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.card2 || colors.background,
        gap: 4,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <MaterialCommunityIcons name={icon} size={16} color={RED} />
        <Text style={{ color: colors.subtext, fontSize: 11, fontWeight: "700" }}>{label}</Text>
      </View>
      <Text style={{ color: colors.text, fontWeight: "900", fontSize: 22 }}>{value}</Text>
    </View>
  );
}

export default function ProgressionSummaryCard({
  colors,
  stats: rawStats,
  achievements: rawAchievements,
  onPress,
  compact = false,
}) {
  const stats = normalizeStats(rawStats);
  const achievements = normalizeAchievements(rawAchievements);
  const unlockedCount = countUnlockedAchievements(achievements);
  const currentStreak = Number(stats.currentStreak || 0);
  const bestStreak = Number(stats.bestStreak || 0);

  const content = (
    <View
      style={{
        padding: 14,
        borderWidth: 1,
        borderRadius: 12,
        backgroundColor: colors.card,
        borderColor: colors.border,
        gap: 12,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ color: colors.text, fontWeight: "900", fontSize: 16 }}>
            {i18n.t("progression.title", { defaultValue: "Progression" })}
          </Text>
          <Text style={{ color: colors.subtext, fontSize: 12 }}>
            {i18n.t("progression.badgesCount", {
              unlocked: unlockedCount,
              total: MVP_ACHIEVEMENT_COUNT,
              defaultValue: `${unlockedCount}/${MVP_ACHIEVEMENT_COUNT} badges`,
            })}
          </Text>
        </View>

        {onPress ? (
          <MaterialCommunityIcons name="chevron-right" size={22} color={colors.subtext} />
        ) : null}
      </View>

      <View style={{ flexDirection: "row", gap: 10 }}>
        <StatPill
          icon="fire"
          label={i18n.t("progression.streakCurrent", { defaultValue: "Série actuelle" })}
          value={i18n.t("progression.days", {
            count: currentStreak,
            defaultValue: `${currentStreak}`,
          })}
          colors={colors}
        />
        <StatPill
          icon="trophy-outline"
          label={i18n.t("progression.streakBest", { defaultValue: "Meilleure série" })}
          value={i18n.t("progression.days", {
            count: bestStreak,
            defaultValue: `${bestStreak}`,
          })}
          colors={colors}
        />
      </View>

      {!compact && onPress ? (
        <Text style={{ color: RED, fontWeight: "800", fontSize: 13 }}>
          {i18n.t("progression.seeAll", { defaultValue: "Voir tous les badges" })}
        </Text>
      ) : null}
    </View>
  );

  if (!onPress) return content;

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85}>
      {content}
    </TouchableOpacity>
  );
}
