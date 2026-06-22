import React from "react";
import { View, Text } from "react-native";
import i18n from "@src/i18n/i18n";
import { prophetikCardShadow, prophetikSectionCardStyle } from "./prophetikCardStyles.js";

function CareerStatRow({ emoji, label, value, colors, isLast = false }) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingVertical: 12,
        paddingHorizontal: 4,
        borderBottomWidth: isLast ? 0 : 1,
        borderBottomColor: colors.border,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
        <Text style={{ fontSize: 18 }}>{emoji}</Text>
        <Text style={{ color: colors.text, fontWeight: "700", fontSize: 14, flex: 1 }}>{label}</Text>
      </View>
      <Text
        style={{
          color: colors.text,
          fontWeight: "900",
          fontSize: 20,
          fontVariant: ["tabular-nums"],
          marginLeft: 12,
        }}
      >
        {value}
      </Text>
    </View>
  );
}

export default function ProgressionCareerSection({ colors, stats }) {
  const rows = [
    {
      key: "participations",
      emoji: "🏒",
      label: i18n.t("progression.career.participations", { defaultValue: "Défis joués" }),
      value: stats.totalParticipations,
    },
    {
      key: "correct",
      emoji: "🎯",
      label: i18n.t("progression.career.correctPredictions", { defaultValue: "Bonnes prédictions" }),
      value: stats.totalCorrectPredictions,
    },
    {
      key: "bestStreak",
      emoji: "🔥",
      label: i18n.t("progression.career.bestStreak", { defaultValue: "Série record" }),
      value: i18n.t("progression.days", {
        count: stats.bestStreak,
        defaultValue: `${stats.bestStreak}`,
      }),
    },
    {
      key: "fivePoint",
      emoji: "⭐",
      label: i18n.t("progression.career.tsFivePointNights", { defaultValue: "Soirées 5+ points" }),
      value: stats.tsFivePointNights,
    },
    {
      key: "fgc",
      emoji: "🥅",
      label: i18n.t("progression.career.fgcWins", { defaultValue: "FGC remportés" }),
      value: stats.fgcWins,
    },
    {
      key: "exact",
      emoji: "🎯",
      label: i18n.t("progression.career.exactScores", { defaultValue: "Scores exacts" }),
      value: stats.exactScores,
    },
  ];

  return (
    <View style={prophetikCardShadow()}>
      <View style={prophetikSectionCardStyle(colors)}>
        <Text
          style={{
            color: colors.text,
            fontWeight: "900",
            fontSize: 16,
            marginBottom: 4,
            letterSpacing: 0.3,
          }}
        >
          {i18n.t("progression.career.title", { defaultValue: "Ma carrière Prophetik" })}
        </Text>

        <View style={{ marginTop: 4 }}>
          {rows.map((row, index) => (
            <CareerStatRow
              key={row.key}
              emoji={row.emoji}
              label={row.label}
              value={row.value}
              colors={colors}
              isLast={index === rows.length - 1}
            />
          ))}
        </View>
      </View>
    </View>
  );
}
