import React, { useMemo, useState } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import ProphetikIcons from "@src/ui/ProphetikIcons";
import i18n from "@src/i18n/i18n";

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
    padding: 12,
    borderLeftWidth: 4,
    borderLeftColor: accent,
    borderBottomWidth: 2,
    borderBottomColor: accent,
  };
}

function EmojiIcon({ children }) {
  return <Text style={{ fontSize: 18, lineHeight: 20 }}>{children}</Text>;
}

export default function LeaderboardLegend({ colors }) {
  const t = i18n.t.bind(i18n);
  const [open, setOpen] = useState(true);

  const rows = useMemo(
    () => [
      {
        key: "fgc",
        icon: <EmojiIcon>🏒</EmojiIcon>,
        label: t("leaderboard.legend.fgc.label", { defaultValue: "Défi premier but" }),
        text: t("leaderboard.legend.fgc.text", {
          defaultValue: "Points cumulés des défis Premier but.",
        }),
      },
      {
        key: "tp",
        icon: <EmojiIcon>🏆</EmojiIcon>,
        label: t("leaderboard.legend.tp.label", { defaultValue: "Défi équipe gagnante" }),
        text: t("leaderboard.legend.tp.text", {
          defaultValue: "Points cumulés des défis Équipe gagnante.",
        }),
      },
      {
        key: "ts",
        icon: <EmojiIcon>🎯</EmojiIcon>,
        label: t("leaderboard.legend.ts.label", { defaultValue: "Défi top scoreurs" }),
        text: t("leaderboard.legend.ts.text", {
          defaultValue: "Points cumulés des défis Top scoreur.",
        }),
      },
      {
        key: "total",
        icon: <ProphetikIcons mode="points" amount={null} size="sm" iconOnly />,
        label: t("leaderboard.legend.total.label", { defaultValue: "Total" }),
        text: t("leaderboard.legend.total.text", {
          defaultValue: "Total des points gagnés dans le groupe.",
        }),
      },
    ],
    [t]
  );

  return (
    <View style={[cardShadow(), sectionCardStyle(colors, RED)]}>
      <TouchableOpacity
        onPress={() => setOpen((v) => !v)}
        activeOpacity={0.85}
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
        }}
      >
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.text, fontWeight: "900" }}>
            {t("leaderboard.legend.title", { defaultValue: "Légende du classement" })}
          </Text>

          <Text style={{ marginTop: 2, color: colors.subtext, fontSize: 12 }}>
            {t("leaderboard.legend.subtitleMvp", {
              defaultValue: "Interprétation des colonnes affichées dans le classement.",
            })}
          </Text>
        </View>

        <MaterialCommunityIcons
          name={open ? "chevron-up" : "chevron-down"}
          size={22}
          color={colors.subtext}
        />
      </TouchableOpacity>

      {open ? (
        <View style={{ marginTop: 10, gap: 10 }}>
          {rows.map((r) => (
            <LegendRow
              key={r.key}
              icon={r.icon}
              label={r.label}
              text={r.text}
              colors={colors}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

function LegendRow({ icon, label, text, colors }) {
  return (
    <View style={{ flexDirection: "row", gap: 10, alignItems: "flex-start" }}>
      <View style={{ marginTop: 1, width: 22, alignItems: "center" }}>{icon}</View>

      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.text, fontWeight: "800" }}>{label}</Text>
        <Text style={{ color: colors.subtext, fontSize: 12, marginTop: 2 }}>{text}</Text>
      </View>
    </View>
  );
}