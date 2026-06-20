import React, { useMemo } from "react";
import { View, Text, ActivityIndicator, ScrollView } from "react-native";
import { Stack } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useAuth } from "@src/auth/SafeAuthProvider";
import { useTheme } from "@src/theme/ThemeProvider";
import i18n from "@src/i18n/i18n";
import useMeDoc from "@src/home/hooks/useMeDoc";
import ProgressionSummaryCard from "@src/achievements/components/ProgressionSummaryCard";
import BadgesGrid from "@src/achievements/components/BadgesGrid";
import { normalizeStats } from "@src/achievements/progressionUtils";

const RED = "#b91c1c";

function MiniStat({ label, value, colors }) {
  return (
    <View
      style={{
        flexBasis: "48%",
        flexGrow: 1,
        padding: 10,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.card2 || colors.background,
      }}
    >
      <Text style={{ color: colors.subtext, fontSize: 11, fontWeight: "700" }}>{label}</Text>
      <Text style={{ color: colors.text, fontWeight: "900", fontSize: 18, marginTop: 4 }}>
        {value}
      </Text>
    </View>
  );
}

export default function ProgressionScreen() {
  const { user, authReady } = useAuth();
  const { colors } = useTheme();
  const { meDoc, loadingMe } = useMeDoc({ authReady, uid: user?.uid, dayTick: 0 });

  const stats = useMemo(() => normalizeStats(meDoc?.stats), [meDoc?.stats]);
  const achievements = meDoc?.achievements || {};

  const statRows = useMemo(
    () => [
      {
        key: "totalParticipations",
        label: i18n.t("progression.stats.participations", { defaultValue: "Participations" }),
        value: stats.totalParticipations,
      },
      {
        key: "totalCorrectPredictions",
        label: i18n.t("progression.stats.correctPredictions", {
          defaultValue: "Bonnes prédictions",
        }),
        value: stats.totalCorrectPredictions,
      },
      {
        key: "exactScores",
        label: i18n.t("progression.stats.exactScores", { defaultValue: "Scores exacts" }),
        value: stats.exactScores,
      },
      {
        key: "fgcWins",
        label: i18n.t("progression.stats.fgcWins", { defaultValue: "FGC gagnés" }),
        value: stats.fgcWins,
      },
      {
        key: "tsFivePointNights",
        label: i18n.t("progression.stats.tsFivePointNights", {
          defaultValue: "Soirées 5+ pts",
        }),
        value: stats.tsFivePointNights,
      },
    ],
    [stats]
  );

  if (!authReady || loadingMe) {
    return (
      <>
        <Stack.Screen options={{ title: i18n.t("progression.title", { defaultValue: "Progression" }) }} />
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: colors.background,
          }}
        >
          <ActivityIndicator color={colors.primary} />
        </View>
      </>
    );
  }

  if (!user) {
    return (
      <>
        <Stack.Screen options={{ title: i18n.t("progression.title", { defaultValue: "Progression" }) }} />
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
            backgroundColor: colors.background,
          }}
        >
          <Text style={{ color: colors.text, textAlign: "center" }}>
            {i18n.t("home.loginToAccess", { defaultValue: "Connecte-toi pour accéder à cette section." })}
          </Text>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: i18n.t("progression.title", { defaultValue: "Progression" }) }} />
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 40 }}
      >
        <ProgressionSummaryCard
          colors={colors}
          stats={stats}
          achievements={achievements}
          compact
        />

        <View
          style={{
            padding: 14,
            borderWidth: 1,
            borderRadius: 12,
            backgroundColor: colors.card,
            borderColor: colors.border,
            gap: 10,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <MaterialCommunityIcons name="chart-box-outline" size={18} color={RED} />
            <Text style={{ color: colors.text, fontWeight: "800", fontSize: 15 }}>
              {i18n.t("progression.statsTitle", { defaultValue: "Statistiques" })}
            </Text>
          </View>

          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {statRows.map((row) => (
              <MiniStat key={row.key} label={row.label} value={row.value} colors={colors} />
            ))}
          </View>
        </View>

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
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <MaterialCommunityIcons name="medal-outline" size={18} color={RED} />
            <Text style={{ color: colors.text, fontWeight: "800", fontSize: 15 }}>
              {i18n.t("progression.badgesTitle", { defaultValue: "Badges" })}
            </Text>
          </View>

          <BadgesGrid stats={stats} achievements={achievements} colors={colors} />
        </View>
      </ScrollView>
    </>
  );
}
