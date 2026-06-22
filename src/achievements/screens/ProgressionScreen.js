import React, { useMemo } from "react";
import { View, Text, ActivityIndicator, ScrollView } from "react-native";
import { Stack } from "expo-router";
import { useAuth } from "@src/auth/SafeAuthProvider";
import { useTheme } from "@src/theme/ThemeProvider";
import i18n from "@src/i18n/i18n";
import useMeDoc from "@src/home/hooks/useMeDoc";
import BadgesGrid from "@src/achievements/components/BadgesGrid";
import ProgressionHeroCard from "@src/achievements/components/ProgressionHeroCard";
import ProgressionStreakCard from "@src/achievements/components/ProgressionStreakCard";
import ProgressionNextGoalCard from "@src/achievements/components/ProgressionNextGoalCard";
import ProgressionCareerSection from "@src/achievements/components/ProgressionCareerSection";
import {
  findNextAchievement,
  normalizeAchievements,
  normalizeStats,
} from "@src/achievements/progressionUtils";

export const BADGES_TAB_HREF = "/(drawer)/(tabs)/BadgesScreen";

export default function ProgressionScreen({
  title = i18n.t("tabs.badges", { defaultValue: "Badges" }),
}) {
  const { user, authReady } = useAuth();
  const { colors } = useTheme();
  const { meDoc, loadingMe } = useMeDoc({ authReady, uid: user?.uid, dayTick: 0 });

  const stats = useMemo(() => normalizeStats(meDoc?.stats), [meDoc?.stats]);
  const achievements = useMemo(
    () => normalizeAchievements(meDoc?.achievements),
    [meDoc?.achievements]
  );

  const nextGoal = useMemo(
    () => findNextAchievement(stats, achievements),
    [stats, achievements]
  );

  const avatarKind = meDoc?.avatarKind || null;
  const avatarUrl = meDoc?.avatarUrl || null;
  const jerseyFrontUrl = meDoc?.jerseyFrontUrl || null;
  const jerseyBackUrl = meDoc?.jerseyBackUrl || null;
  const displayName = meDoc?.displayName || meDoc?.name || user?.displayName;

  if (!authReady || loadingMe) {
    return (
      <>
        <Stack.Screen options={{ title }} />
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
        <Stack.Screen options={{ title }} />
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
      <Stack.Screen options={{ title }} />
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={{ padding: 16, gap: 18, paddingBottom: 48 }}
      >
        <ProgressionHeroCard
          colors={colors}
          displayName={displayName}
          avatarKind={avatarKind}
          avatarUrl={avatarUrl}
          jerseyFrontUrl={jerseyFrontUrl}
          jerseyBackUrl={jerseyBackUrl}
          achievements={achievements}
        />

        <ProgressionStreakCard colors={colors} stats={stats} achievements={achievements} />

        <ProgressionNextGoalCard colors={colors} nextGoal={nextGoal} />

        <ProgressionCareerSection colors={colors} stats={stats} />

        <BadgesGrid stats={stats} achievements={achievements} colors={colors} />
      </ScrollView>
    </>
  );
}
