import React, { useMemo } from "react";
import { View, Text } from "react-native";
import i18n from "@src/i18n/i18n";
import useLeaderboardProfiles, {
  resolveLeaderboardMember,
} from "@src/leaderboard/useLeaderboardProfiles";

function formatWinnerNames(winnerUids, profiles) {
  return (winnerUids || [])
    .map((uid) => {
      const id = String(uid);
      if (id.toLowerCase() === "ai") {
        return i18n.t("nova.title", { defaultValue: "Nova" });
      }
      return resolveLeaderboardMember({ id }, profiles).displayName || id;
    })
    .join(", ");
}

function ChampionCard({ title, subtitle, winnersLabel, points, colors, accent = "#F59E0B" }) {
  return (
    <View
      style={{
        borderWidth: 1,
        borderColor: colors.border,
        borderLeftWidth: 4,
        borderLeftColor: accent,
        borderRadius: 14,
        backgroundColor: colors.card,
        padding: 14,
        marginBottom: 12,
      }}
    >
      <Text style={{ color: colors.subtext, fontSize: 11, fontWeight: "800", letterSpacing: 0.8 }}>
        {title}
      </Text>
      {subtitle ? (
        <Text style={{ color: colors.text, fontWeight: "800", fontSize: 15, marginTop: 4 }}>
          {subtitle}
        </Text>
      ) : null}
      <Text style={{ color: colors.text, fontWeight: "700", fontSize: 14, marginTop: 8 }}>
        🏆 {winnersLabel}
      </Text>
      {Number.isFinite(Number(points)) ? (
        <Text style={{ color: colors.subtext, fontSize: 12, marginTop: 4, fontWeight: "600" }}>
          {i18n.t("leaderboard.champions.points", {
            count: Number(points) || 0,
            defaultValue: `${Number(points) || 0} pts`,
          })}
        </Text>
      ) : null}
    </View>
  );
}

export default function CompetitionChampionsSection({
  colors,
  currentMeta,
  historyRows = [],
  loading = false,
}) {
  const winnerUids = useMemo(() => {
    const fromCurrent = Array.isArray(currentMeta?.winnerUids) ? currentMeta.winnerUids : [];
    const fromHistory = (historyRows || []).flatMap((row) => row.winnerUids || []);
    return Array.from(new Set([...fromCurrent, ...fromHistory].map(String).filter(Boolean)));
  }, [currentMeta, historyRows]);

  const profiles = useLeaderboardProfiles(winnerUids);

  const currentWinners =
    currentMeta?.winnerUids?.length && currentMeta?.winnerDeclaredAt
      ? formatWinnerNames(currentMeta.winnerUids, profiles)
      : null;

  const pastRows = useMemo(() => {
    const currentKey = String(currentMeta?.competitionKey || "");
    return (historyRows || []).filter((row) => String(row.competitionKey) !== currentKey);
  }, [historyRows, currentMeta?.competitionKey]);

  if (loading) return null;
  if (!currentWinners && !pastRows.length) return null;

  return (
    <View style={{ marginBottom: 16 }}>
      <Text
        style={{
          color: colors.text,
          fontWeight: "900",
          fontSize: 16,
          marginBottom: 10,
        }}
      >
        {i18n.t("leaderboard.champions.title", { defaultValue: "Champions de saison" })}
      </Text>

      {currentWinners ? (
        <ChampionCard
          colors={colors}
          title={i18n.t("leaderboard.champions.current", { defaultValue: "Compétition en cours" })}
          subtitle={currentMeta?.label || currentMeta?.competitionKey}
          winnersLabel={currentWinners}
          points={currentMeta?.winnerPoints}
        />
      ) : null}

      {pastRows.map((row) => (
        <ChampionCard
          key={row.competitionKey}
          colors={colors}
          accent="#7C3AED"
          title={i18n.t("leaderboard.champions.past", { defaultValue: "Compétition terminée" })}
          subtitle={row.label || row.competitionKey}
          winnersLabel={formatWinnerNames(row.winnerUids, profiles)}
          points={row.winnerPoints}
        />
      ))}
    </View>
  );
}
