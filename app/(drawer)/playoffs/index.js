import React from "react";
import { View, Text, ScrollView, TouchableOpacity } from "react-native";
import { Stack, useRouter } from "expo-router";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";

import i18n from "@src/i18n/i18n";
import { useTheme } from "@src/theme/ThemeProvider";

function cardShadow() {
  return {
    shadowColor: "#000",
    shadowOpacity: 0.14,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  };
}

function SectionCard({ colors, children, accent = "#ef4444" }) {
  return (
    <View
      style={[
        cardShadow(),
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          borderWidth: 1,
          borderRadius: 18,
          overflow: "hidden",
          padding: 14,
          borderLeftWidth: 4,
          borderLeftColor: accent,
        },
      ]}
    >
      {children}
    </View>
  );
}

function StatusChip({ label, bg, color, icon = "radio-button-on" }) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        alignSelf: "flex-start",
        paddingVertical: 5,
        paddingHorizontal: 10,
        borderRadius: 999,
        backgroundColor: bg,
      }}
    >
      <MaterialCommunityIcons name={icon} size={14} color={color} />
      <Text
        style={{
          color,
          marginLeft: 6,
          fontWeight: "800",
          fontSize: 12,
        }}
      >
        {label}
      </Text>
    </View>
  );
}

function PrimaryButton({ label, onPress, icon = "arrow-forward", full = true }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.88}
      style={{
        backgroundColor: "#ef4444",
        borderRadius: 14,
        paddingVertical: 14,
        paddingHorizontal: 16,
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "row",
        alignSelf: full ? "stretch" : "flex-start",
      }}
    >
      <Text style={{ color: "#fff", fontWeight: "900", fontSize: 14 }}>{label}</Text>
      <Ionicons name={icon} size={16} color="#fff" style={{ marginLeft: 8 }} />
    </TouchableOpacity>
  );
}

function SecondaryButton({ label, onPress, icon = "arrow-forward" }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.88}
      style={{
        borderWidth: 1,
        borderColor: "rgba(239,68,68,0.30)",
        backgroundColor: "rgba(239,68,68,0.08)",
        borderRadius: 14,
        paddingVertical: 12,
        paddingHorizontal: 14,
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "row",
      }}
    >
      <Text style={{ color: "#b91c1c", fontWeight: "900", fontSize: 14 }}>{label}</Text>
      <Ionicons name={icon} size={16} color="#b91c1c" style={{ marginLeft: 8 }} />
    </TouchableOpacity>
  );
}

function MiniStat({ colors, value, label, icon }) {
  return (
    <View
      style={{
        flex: 1,
        minWidth: 90,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.card2,
        padding: 12,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
        <MaterialCommunityIcons name={icon} size={16} color={colors.subtext} />
      </View>
      <Text style={{ color: colors.text, fontSize: 20, fontWeight: "900" }}>{value}</Text>
      <Text style={{ color: colors.subtext, marginTop: 4, fontSize: 12 }}>{label}</Text>
    </View>
  );
}

function ShortcutCard({ colors, title, subtitle, icon, onPress }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.88}
      style={{
        flex: 1,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.card,
        padding: 14,
        minHeight: 110,
      }}
    >
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 12,
          backgroundColor: colors.card2,
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 10,
        }}
      >
        <MaterialCommunityIcons name={icon} size={18} color={colors.text} />
      </View>

      <Text style={{ color: colors.text, fontWeight: "900", fontSize: 14 }}>{title}</Text>
      <Text style={{ color: colors.subtext, marginTop: 4, fontSize: 12 }}>{subtitle}</Text>
    </TouchableOpacity>
  );
}

function PlayoffsHeroCard({ colors }) {
  return (
    <SectionCard colors={colors} accent="#f59e0b">
      <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" }}>
        <View style={{ flex: 1, paddingRight: 12 }}>
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 14,
                backgroundColor: "rgba(245,158,11,0.14)",
                alignItems: "center",
                justifyContent: "center",
                marginRight: 10,
              }}
            >
              <Ionicons name="trophy-outline" size={22} color="#f59e0b" />
            </View>

            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text, fontSize: 20, fontWeight: "900" }}>
                {i18n.t("playoffs.hero.title", { defaultValue: "Playoffs Prophetik" })}
              </Text>
              <Text style={{ color: colors.subtext, marginTop: 2 }}>
                {i18n.t("playoffs.hero.subtitle", {
                  defaultValue: "Prédictions quotidiennes, premier but et classement des séries.",
                })}
              </Text>
            </View>
          </View>

          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 }}>
            <StatusChip
              label={i18n.t("playoffs.hero.live", { defaultValue: "En cours" })}
              bg="rgba(239,68,68,0.12)"
              color="#b91c1c"
              icon="fire"
            />
            <StatusChip
              label={i18n.t("playoffs.hero.day", { defaultValue: "Jour 3 des séries" })}
              bg={colors.card2}
              color={colors.text}
              icon="calendar-month"
            />
          </View>
        </View>
      </View>

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 14 }}>
        <MiniStat
          colors={colors}
          value="#4"
          label={i18n.t("playoffs.hero.rank", { defaultValue: "Ton rang" })}
          icon="podium-gold"
        />
        <MiniStat
          colors={colors}
          value="12"
          label={i18n.t("playoffs.hero.points", { defaultValue: "Points séries" })}
          icon="star-four-points"
        />
        <MiniStat
          colors={colors}
          value="7"
          label={i18n.t("playoffs.hero.gamesDone", { defaultValue: "Matchs joués" })}
          icon="hockey-puck"
        />
      </View>
    </SectionCard>
  );
}

function DailyPicksCard({ colors, onPress }) {
  return (
    <SectionCard colors={colors} accent="#ef4444">
      <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 10 }}>
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: 14,
            backgroundColor: "rgba(239,68,68,0.12)",
            alignItems: "center",
            justifyContent: "center",
            marginRight: 10,
          }}
        >
          <Ionicons name="checkmark-circle-outline" size={22} color="#ef4444" />
        </View>

        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.text, fontSize: 18, fontWeight: "900" }}>
            {i18n.t("playoffs.dailyPicks.title", { defaultValue: "Pick des matchs du jour" })}
          </Text>
          <Text style={{ color: colors.subtext, marginTop: 2 }}>
            {i18n.t("playoffs.dailyPicks.subtitle", {
              defaultValue: "Choisis les équipes gagnantes des matchs d’aujourd’hui.",
            })}
          </Text>
        </View>
      </View>

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
        <StatusChip
          label={i18n.t("playoffs.dailyPicks.open", { defaultValue: "Picks ouverts" })}
          bg="rgba(34,197,94,0.14)"
          color="#15803d"
          icon="clock-check-outline"
        />
        <StatusChip
          label={i18n.t("playoffs.dailyPicks.gamesCount", { defaultValue: "4 matchs aujourd’hui" })}
          bg={colors.card2}
          color={colors.text}
          icon="calendar-blank"
        />
      </View>

      <Text style={{ color: colors.text, marginBottom: 14 }}>
        {i18n.t("playoffs.dailyPicks.deadline", {
          defaultValue: "Date limite : 19:00",
        })}
      </Text>

      <PrimaryButton
        label={i18n.t("playoffs.dailyPicks.cta", { defaultValue: "Faire mes prédictions" })}
        onPress={onPress}
      />
    </SectionCard>
  );
}

function FirstGoalCard({ colors, onPress }) {
  return (
    <SectionCard colors={colors} accent="#f59e0b">
      <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 10 }}>
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: 14,
            backgroundColor: "rgba(245,158,11,0.14)",
            alignItems: "center",
            justifyContent: "center",
            marginRight: 10,
          }}
        >
          <Ionicons name="flash-outline" size={22} color="#f59e0b" />
        </View>

        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.text, fontSize: 18, fontWeight: "900" }}>
            {i18n.t("playoffs.fgc.title", { defaultValue: "Premier but des séries" })}
          </Text>
          <Text style={{ color: colors.subtext, marginTop: 2 }}>
            {i18n.t("playoffs.fgc.subtitle", {
              defaultValue: "Choisis le premier buteur. En prolongation, un nouveau pick peut s’ouvrir.",
            })}
          </Text>
        </View>
      </View>

      <View
        style={{
          borderRadius: 14,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.card2,
          padding: 12,
          marginBottom: 14,
        }}
      >
        <Text style={{ color: colors.text, fontWeight: "900" }}>MTL vs BOS</Text>
        <Text style={{ color: colors.subtext, marginTop: 4 }}>
          {i18n.t("playoffs.fgc.status", { defaultValue: "Disponible maintenant" })}
        </Text>
      </View>

      <SecondaryButton
        label={i18n.t("playoffs.fgc.cta", { defaultValue: "Participer au premier but" })}
        onPress={onPress}
      />
    </SectionCard>
  );
}

function PersonalStatsCard({ colors }) {
  return (
    <SectionCard colors={colors} accent="#ef4444">
      <Text style={{ color: colors.text, fontSize: 18, fontWeight: "900" }}>
        {i18n.t("playoffs.stats.title", { defaultValue: "Mon parcours" })}
      </Text>

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        <MiniStat
          colors={colors}
          value="12"
          label={i18n.t("playoffs.stats.points", { defaultValue: "Points" })}
          icon="star-four-points"
        />
        <MiniStat
          colors={colors}
          value="6/9"
          label={i18n.t("playoffs.stats.correct", { defaultValue: "Bons choix" })}
          icon="check-decagram"
        />
        <MiniStat
          colors={colors}
          value="67%"
          label={i18n.t("playoffs.stats.rate", { defaultValue: "Taux" })}
          icon="chart-line"
        />
      </View>

      <Text style={{ color: colors.subtext, marginTop: 4 }}>
        {i18n.t("playoffs.stats.hint", {
          defaultValue: "Encore 2 bons choix pour entrer dans le top 3.",
        })}
      </Text>
    </SectionCard>
  );
}

function LeaderboardCard({ colors, onPress }) {
  const rows = [
    { rank: 1, name: "Marcel", points: 18 },
    { rank: 2, name: "Liam", points: 16 },
    { rank: 3, name: "Gabriel", points: 14 },
  ];

  return (
    <SectionCard colors={colors} accent="#f59e0b">
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <View>
          <Text style={{ color: colors.text, fontSize: 18, fontWeight: "900" }}>
            {i18n.t("playoffs.leaderboard.title", { defaultValue: "Classement des séries" })}
          </Text>
          <Text style={{ color: colors.subtext, marginTop: 2 }}>
            {i18n.t("playoffs.leaderboard.subtitle", {
              defaultValue: "Les meilleurs prédicteurs du groupe pendant les séries.",
            })}
          </Text>
        </View>

        <MaterialCommunityIcons name="podium-gold" size={24} color="#f59e0b" />
      </View>

      <View
        style={{
          borderRadius: 14,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.card2,
          overflow: "hidden",
        }}
      >
        {rows.map((row, idx) => (
          <View
            key={row.rank}
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              paddingHorizontal: 12,
              paddingVertical: 12,
              borderBottomWidth: idx === rows.length - 1 ? 0 : 1,
              borderBottomColor: colors.border,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Text
                style={{
                  width: 28,
                  color: row.rank === 1 ? "#f59e0b" : colors.text,
                  fontWeight: "900",
                }}
              >
                #{row.rank}
              </Text>
              <Text style={{ color: colors.text, fontWeight: "800" }}>{row.name}</Text>
            </View>

            <Text style={{ color: colors.text, fontWeight: "900" }}>{row.points} pts</Text>
          </View>
        ))}

        <View
          style={{
            paddingHorizontal: 12,
            paddingVertical: 12,
            borderTopWidth: 1,
            borderTopColor: colors.border,
            backgroundColor: colors.card,
            flexDirection: "row",
            justifyContent: "space-between",
          }}
        >
          <Text style={{ color: "#b91c1c", fontWeight: "900" }}>
            {i18n.t("playoffs.leaderboard.you", { defaultValue: "Toi : #5" })}
          </Text>
          <Text style={{ color: "#b91c1c", fontWeight: "900" }}>10 pts</Text>
        </View>
      </View>

      <SecondaryButton
        label={i18n.t("playoffs.leaderboard.cta", { defaultValue: "Voir le classement complet" })}
        onPress={onPress}
      />
    </SectionCard>
  );
}

function ShortcutsRow({ colors, onHistoryPress, onBracketPress }) {
  return (
    <View style={{ flexDirection: "row", gap: 10 }}>
      <ShortcutCard
        colors={colors}
        title={i18n.t("playoffs.shortcuts.historyTitle", { defaultValue: "Mes picks passés" })}
        subtitle={i18n.t("playoffs.shortcuts.historySubtitle", { defaultValue: "Revois tes prédictions récentes." })}
        icon="history"
        onPress={onHistoryPress}
      />
      <ShortcutCard
        colors={colors}
        title={i18n.t("playoffs.shortcuts.bracketTitle", { defaultValue: "Voir les séries" })}
        subtitle={i18n.t("playoffs.shortcuts.bracketSubtitle", { defaultValue: "Tableau et progression des affrontements." })}
        icon="tournament"
        onPress={onBracketPress}
      />
    </View>
  );
}

export default function PlayoffsHubScreen() {
  const router = useRouter();
  const { colors } = useTheme();

  return (
    <>
      <Stack.Screen
        options={{
          title: i18n.t("playoffs.screenTitle", { defaultValue: "Playoffs" }),
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} style={{ paddingHorizontal: 10 }}>
              <Ionicons name="arrow-back" size={24} color={colors.text} />
            </TouchableOpacity>
          ),
        }}
      />

      <ScrollView
        contentContainerStyle={{
          padding: 16,
          paddingBottom: 32,
          gap: 14,
          backgroundColor: colors.background,
        }}
      >
        <PlayoffsHeroCard colors={colors} />

        <DailyPicksCard
          colors={colors}
          onPress={() => router.push("/(drawer)/playoffs/picks")}
        />

        <FirstGoalCard
          colors={colors}
          onPress={() => router.push("/(drawer)/playoffs/fgc")}
        />

        <PersonalStatsCard colors={colors} />

        <LeaderboardCard
          colors={colors}
          onPress={() => router.push("/(drawer)/playoffs/leaderboard")}
        />

        <ShortcutsRow
          colors={colors}
          onHistoryPress={() => router.push("/(drawer)/playoffs/history")}
          onBracketPress={() => router.push("/(drawer)/playoffs/bracket")}
        />
      </ScrollView>
    </>
  );
}