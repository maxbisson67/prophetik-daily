// app/(drawer)/(tabs)/SportHubScreen.js
import React, { useState } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Stack, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@src/theme/ThemeProvider";
import i18n from "@src/i18n/i18n";

function Pill({ active, label, onPress, colors }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: active ? colors.primary : colors.border,
        backgroundColor: active ? colors.primary : colors.card,
      }}
    >
      <Text style={{ color: active ? "#fff" : colors.text, fontWeight: "800" }}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function BigBtn({ icon, title, subtitle, onPress, colors }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        padding: 14,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.card,
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
      }}
    >
      <View
        style={{
          width: 42,
          height: 42,
          borderRadius: 12,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.background,
          borderWidth: 1,
          borderColor: colors.border,
        }}
      >
        {icon}
      </View>

      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.text, fontWeight: "900", fontSize: 16 }}>
          {title}
        </Text>
        <Text style={{ color: colors.subtext, marginTop: 2 }}>
          {subtitle}
        </Text>
      </View>

      <Ionicons name="chevron-forward" size={18} color={colors.subtext} />
    </TouchableOpacity>
  );
}

export default function SportsHubScreen() {
  const router = useRouter();
  const { colors } = useTheme();

  const [sport, setSport] = useState("nhl"); // 'nhl' | 'mlb'

  const title = i18n.t("sports.hub.title", { defaultValue: "Sports" });
  const isNhl = sport === "nhl";

  return (
    <>
      <Stack.Screen options={{ title }} />

      <View
        style={{
          flex: 1,
          backgroundColor: colors.background,
          padding: 16,
          gap: 14,
        }}
      >
        <View style={{ flexDirection: "row", gap: 10 }}>
          <Pill
            active={sport === "nhl"}
            label={i18n.t("sports.hub.nhl", { defaultValue: "Hockey (NHL)" })}
            onPress={() => setSport("nhl")}
            colors={colors}
          />
          <Pill
            active={sport === "mlb"}
            label={i18n.t("sports.hub.mlb", { defaultValue: "Baseball (MLB)" })}
            onPress={() => setSport("mlb")}
            colors={colors}
          />
        </View>

        <BigBtn
          colors={colors}
          icon={<Ionicons name="flash-outline" size={20} color={colors.text} />}
          title={i18n.t("sports.hub.live", { defaultValue: "Match Live" })}
          subtitle={
            isNhl
              ? i18n.t("sports.hub.liveNhl", {
                  defaultValue: "Scores & buts en temps réel",
                })
              : i18n.t("sports.hub.liveMlb", {
                  defaultValue: "Bientôt disponible",
                })
          }
          onPress={() => {
            if (isNhl) router.push("/(drawer)/sports/MatchLiveScreen");
            else router.push("/(drawer)/sports/MlbComingSoon");
          }}
        />

        <BigBtn
          colors={colors}
          icon={<Ionicons name="trophy-outline" size={20} color={colors.text} />}
          title={i18n.t("sports.hub.standings", { defaultValue: "Classement" })}
          subtitle={
            isNhl
              ? i18n.t("sports.hub.standingsNhl", {
                  defaultValue: "Classement officiel NHL",
                })
              : i18n.t("sports.hub.standingsMlb", {
                  defaultValue: "Classement MLB",
                })
          }
          onPress={() => {
            if (isNhl) router.push("/(drawer)/sports/NhlStandingsScreen");
            else router.push("/(drawer)/sports/MlbStandingsScreen");
          }}
        />

        <BigBtn
          colors={colors}
          icon={<Ionicons name="calendar-outline" size={20} color={colors.text} />}
          title={i18n.t("sports.hub.schedule", { defaultValue: "Calendrier" })}
          subtitle={
            isNhl
              ? i18n.t("sports.hub.scheduleNhl", {
                  defaultValue: "Matchs de la journée",
                })
              : i18n.t("sports.hub.scheduleMlb", {
                  defaultValue: "Calendrier MLB",
                })
          }
          onPress={() => {
            if (isNhl) router.push("/(drawer)/sports/NhlScheduleScreen");
            else router.push("/(drawer)/sports/MlbScheduleScreen");
          }}
        />

        <BigBtn
          colors={colors}
          icon={<Ionicons name="bar-chart-outline" size={20} color={colors.text} />}
          title={i18n.t("sports.hub.leaders", { defaultValue: "Leaders" })}
          subtitle={
            isNhl
              ? i18n.t("sports.hub.leadersNhl", {
                  defaultValue: "Liste des joueurs et statistiques",
                })
              : i18n.t("sports.hub.leadersMlb", {
                  defaultValue: "Bientôt disponible",
                })
          }
          onPress={() => {
            if (isNhl) router.push("/(drawer)/sports/NhlSkaterLeadersScreen");
            else router.push("/(drawer)/sports/MlbComingSoon");
          }}
        />
      </View>
    </>
  );
}