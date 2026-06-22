import React, { useMemo } from "react";
import { View, Text } from "react-native";
import i18n from "@src/i18n/i18n";
import StreakHeroCard from "./StreakHeroCard.js";
import { normalizeStats } from "../progressionUtils.js";
import { prophetikCardShadow, prophetikSectionCardStyle, PROPHETIK_RED } from "./prophetikCardStyles.js";

function getStreakMessage(currentStreak, bestStreak) {
  const cur = Number(currentStreak || 0);
  const best = Number(bestStreak || 0);

  if (cur <= 0) {
    return i18n.t("progression.streakMotivation.start", {
      defaultValue: "Participe aujourd'hui pour démarrer ta série !",
    });
  }

  if (cur >= best && best > 0) {
    return i18n.t("progression.streakMotivation.continue", {
      defaultValue: "Continue ta série !",
    });
  }

  return i18n.t("progression.streakMotivation.tomorrow", {
    count: cur + 1,
    defaultValue: `Joue demain pour atteindre ${cur + 1} jours`,
  });
}

export default function ProgressionStreakCard({ colors, stats: rawStats, achievements }) {
  const stats = normalizeStats(rawStats);
  const currentStreak = Number(stats.currentStreak || 0);
  const bestStreak = Number(stats.bestStreak || 0);

  const message = useMemo(
    () => getStreakMessage(currentStreak, bestStreak),
    [currentStreak, bestStreak]
  );

  return (
    <View style={prophetikCardShadow()}>
      <View style={{ gap: 0 }}>
        <StreakHeroCard stats={stats} achievements={achievements} showBadgesHint={false} />

        <View
          style={[
            prophetikSectionCardStyle(colors),
            {
              marginTop: -4,
              borderTopLeftRadius: 0,
              borderTopRightRadius: 0,
              paddingVertical: 12,
            },
          ]}
        >
          <Text
            style={{
              color: PROPHETIK_RED,
              fontWeight: "900",
              fontSize: 14,
              textAlign: "center",
            }}
          >
            {message}
          </Text>
        </View>
      </View>
    </View>
  );
}
