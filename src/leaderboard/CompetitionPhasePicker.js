import React, { useMemo } from "react";
import { View, Text, TouchableOpacity, ScrollView } from "react-native";
import i18n from "@src/i18n/i18n";
import { getProphetikBusinessYmd } from "@src/lib/prophetikBusinessDate";
import { competitionTimelineStatus } from "@src/season/seasonCompetitionCore";

function phaseLabel(phase) {
  const p = String(phase || "").toLowerCase();
  if (p === "regular") {
    return i18n.t("leaderboard.competitionPhase.regular", {
      defaultValue: "Saison régulière",
    });
  }
  if (p === "playoffs") {
    return i18n.t("leaderboard.competitionPhase.playoffs", {
      defaultValue: "Séries éliminatoires",
    });
  }
  return String(phase || "—");
}

function statusLabel(status) {
  if (status === "finalized") {
    return i18n.t("leaderboard.competitionStatus.finalized", {
      defaultValue: "Terminée",
    });
  }
  if (status === "upcoming") {
    return i18n.t("leaderboard.competitionStatus.upcoming", {
      defaultValue: "À venir",
    });
  }
  return i18n.t("leaderboard.competitionStatus.active", {
    defaultValue: "En cours",
  });
}

export default function CompetitionPhasePicker({
  colors,
  competitions = [],
  value,
  onChange,
  accentColor,
}) {
  const todayYmd = useMemo(() => getProphetikBusinessYmd(), []);
  const accent = accentColor || colors.primary;

  const options = useMemo(() => {
    return (competitions || []).map((entry) => {
      const timelineStatus = competitionTimelineStatus(entry, todayYmd);
      return {
        ...entry,
        timelineStatus,
        chipLabel: String(entry.label || "").trim() || phaseLabel(entry.phase),
        shortLabel: phaseLabel(entry.phase),
      };
    });
  }, [competitions, todayYmd]);

  const selected = useMemo(
    () => options.find((o) => o.competitionKey === value) || null,
    [options, value]
  );

  if (!options.length) return null;

  return (
    <View style={{ marginBottom: 12 }}>
      <Text
        style={{
          color: colors.subtext,
          fontSize: 11,
          fontWeight: "800",
          marginBottom: 8,
          paddingHorizontal: 2,
        }}
      >
        {i18n.t("leaderboard.selectCompetitionLabel", {
          defaultValue: "Compétition",
        })}
      </Text>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8, paddingVertical: 2 }}
      >
        {options.map((option) => {
          const active = value === option.competitionKey;

          return (
            <TouchableOpacity
              key={option.competitionKey}
              onPress={() => onChange?.(option.competitionKey)}
              activeOpacity={0.85}
              style={{
                paddingVertical: 8,
                paddingHorizontal: 14,
                borderRadius: 6,
                borderWidth: 1.5,
                borderColor: active ? accent : colors.border,
                backgroundColor: active ? accent : colors.card2,
                minWidth: 120,
              }}
            >
              <Text
                style={{
                  color: active ? "#fff" : colors.text,
                  fontWeight: "900",
                  fontSize: 13,
                }}
              >
                {option.shortLabel}
              </Text>
              <Text
                style={{
                  marginTop: 2,
                  color: active ? "rgba(255,255,255,0.85)" : colors.subtext,
                  fontWeight: "700",
                  fontSize: 10,
                }}
              >
                {statusLabel(option.timelineStatus)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {selected ? (
        <Text
          style={{
            marginTop: 8,
            color: colors.subtext,
            fontSize: 12,
            fontWeight: "700",
            paddingHorizontal: 2,
          }}
        >
          {selected.chipLabel}
          {" · "}
          {i18n.t("leaderboard.competitionDateLine", {
            from: selected.fromYmd,
            to: selected.toYmd,
            defaultValue: `${selected.fromYmd} → ${selected.toYmd}`,
          })}
        </Text>
      ) : null}
    </View>
  );
}
