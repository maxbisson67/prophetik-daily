import React from "react";
import { View, Text, Image } from "react-native";
import i18n from "@src/i18n/i18n";
import JerseyFlipAvatar from "@src/ui/JerseyFlipAvatar";
import { useTheme } from "@src/theme/ThemeProvider";
import { MVP_ACHIEVEMENT_COUNT } from "../mvpAchievements.js";
import { countUnlockedAchievements } from "../progressionUtils.js";
import {
  getOverallBadgeProgress,
  getProphetikLevel,
} from "../prophetikLevelUtils.js";
import {
  PROPHETIK_RED,
  ProphetikProgressBar,
  prophetikCardShadow,
  prophetikSectionCardStyle,
} from "./prophetikCardStyles.js";

export default function ProgressionHeroCard({
  colors,
  displayName,
  avatarKind,
  avatarUrl,
  jerseyFrontUrl,
  jerseyBackUrl,
  achievements,
}) {
  const { isDark } = useTheme();
  const unlockedCount = countUnlockedAchievements(achievements);
  const level = getProphetikLevel(unlockedCount);
  const { pct } = getOverallBadgeProgress(unlockedCount, MVP_ACHIEVEMENT_COUNT);

  const levelLabel = i18n.t(`progression.levels.${level.id}`, {
    defaultValue:
      level.id === "recrue"
        ? "Recrue"
        : level.id === "prospect"
        ? "Prospect"
        : level.id === "veteran"
        ? "Vétéran"
        : level.id === "allstar"
        ? "All-Star"
        : "Légende",
  });

  const frameBg = isDark ? colors.background : "#f3f4f6";
  const frameBorder = isDark ? colors.border : "#eee";
  const isJersey = avatarKind === "jersey" && jerseyFrontUrl && jerseyBackUrl;
  const name = String(displayName || "—").trim().toUpperCase();

  return (
    <View style={prophetikCardShadow()}>
      <View style={prophetikSectionCardStyle(colors)}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
          <View
            style={{
              width: 88,
              height: 88,
              borderRadius: isJersey ? 18 : 44,
              borderWidth: 3,
              borderColor: frameBorder,
              backgroundColor: frameBg,
              overflow: "hidden",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {isJersey ? (
              <JerseyFlipAvatar
                frontUrl={jerseyFrontUrl}
                backUrl={jerseyBackUrl}
                size={96}
                pauseMs={2800}
                flipDurationMs={1100}
                backgroundColor={frameBg}
              />
            ) : (
              <Image
                source={
                  avatarUrl
                    ? { uri: avatarUrl }
                    : require("@src/assets/avatar-placeholder.png")
                }
                style={{ width: 88, height: 88, borderRadius: 44 }}
              />
            )}
          </View>

          <View style={{ flex: 1, gap: 4 }}>
            <Text
              style={{
                color: colors.text,
                fontWeight: "900",
                fontSize: 18,
                letterSpacing: 0.6,
              }}
              numberOfLines={1}
            >
              {name}
            </Text>

            <View
              style={{
                alignSelf: "flex-start",
                paddingHorizontal: 10,
                paddingVertical: 4,
                borderRadius: 999,
                backgroundColor: "rgba(185,28,28,0.12)",
                borderWidth: 1,
                borderColor: "rgba(185,28,28,0.28)",
              }}
            >
              <Text
                style={{
                  color: PROPHETIK_RED,
                  fontWeight: "900",
                  fontSize: 11,
                  letterSpacing: 1.4,
                }}
              >
                {levelLabel}
              </Text>
            </View>

            <Text style={{ color: colors.subtext, fontWeight: "800", fontSize: 12, marginTop: 2 }}>
              {i18n.t("progression.hero.badgesLine", {
                unlocked: unlockedCount,
                total: MVP_ACHIEVEMENT_COUNT,
                defaultValue: `${unlockedCount} / ${MVP_ACHIEVEMENT_COUNT} BADGES`,
              }).toUpperCase()}
            </Text>
          </View>
        </View>

        <View style={{ marginTop: 16, gap: 6 }}>
          <ProphetikProgressBar pct={pct} colors={colors} height={14} />
          <Text
            style={{
              color: colors.subtext,
              fontWeight: "800",
              fontSize: 12,
              textAlign: "right",
              fontVariant: ["tabular-nums"],
            }}
          >
            {i18n.t("progression.hero.progressPct", {
              pct,
              defaultValue: `${pct} %`,
            })}
          </Text>
        </View>
      </View>
    </View>
  );
}
