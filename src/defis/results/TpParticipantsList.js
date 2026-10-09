import React, { useMemo } from "react";
import { View, Text, ActivityIndicator } from "react-native";

import i18n from "@src/i18n/i18n";
import TeamLogoBadge from "@src/sports/TeamLogoBadge";
import { lookupTeamByAbbr } from "@src/groups/data/fallbackTeams";
import {
  countTpPickStatsForEntry,
  formatTpEntryPickLines,
} from "@src/defis/tpBundleDisplayHelpers";

const PICK_LOGO_SIZE = 20;

function TpParticipantPickLine({ line, league, colors }) {
  const awayTeam = lookupTeamByAbbr(league, line.awayAbbr);
  const homeTeam = lookupTeamByAbbr(league, line.homeAbbr);

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        flexWrap: "wrap",
        gap: 6,
      }}
    >
      <TeamLogoBadge team={awayTeam} size={PICK_LOGO_SIZE} colors={colors} />
      <Text style={{ color: colors.text, fontWeight: "900", fontSize: 13 }}>
        {line.awayScore}-{line.homeScore}
      </Text>
      <TeamLogoBadge team={homeTeam} size={PICK_LOGO_SIZE} colors={colors} />
      {line.periodShort ? (
        <Text style={{ color: colors.subtext, fontSize: 11, fontWeight: "700" }}>
          ({line.periodShort})
        </Text>
      ) : null}
    </View>
  );
}

function entryDisplayName(entry) {
  return entry?.displayName || entry?.name || String(entry?.uid || "").slice(0, 6);
}

function entryTotalPoints(entry) {
  return Number(entry?.totalPoints ?? 0) || 0;
}

export default function TpParticipantsList({
  bundle = {},
  entries = [],
  loading = false,
  currentUid = "",
  colors,
  title = null,
  league = "NHL",
  hideOthersPicks = false,
  revealTimeLabel = null,
}) {
  const uid = String(currentUid || "");
  const gameCount = Number(bundle?.gameCount || bundle?.games?.length || 0);
  const leagueKey = String(league || "NHL").toUpperCase();

  const sorted = useMemo(() => {
    return [...entries].sort((a, b) => {
      const diff = entryTotalPoints(b) - entryTotalPoints(a);
      if (diff !== 0) return diff;
      return entryDisplayName(a).localeCompare(entryDisplayName(b));
    });
  }, [entries]);

  const participantCount = sorted.length;

  const defaultTitle = hideOthersPicks
    ? participantCount > 0
      ? i18n.t("tp.live.participantsPredictionsTitle", {
          defaultValue: "Prédictions des {{count}} participants",
          count: participantCount,
        })
      : i18n.t("tp.live.participantsPredictionsTitlePending", {
          defaultValue: "Prédictions des participants",
        })
    : i18n.t("firstGoal.live.picksTitle", { defaultValue: "Participants & choix" });

  return (
    <View style={{ marginTop: 12 }}>
      {hideOthersPicks && revealTimeLabel ? (
        <Text
          style={{
            fontSize: 12,
            color: colors.subtext,
            textAlign: "center",
            marginBottom: 8,
          }}
        >
          {i18n.t("defi.results.participants.hiddenUntil", { time: revealTimeLabel })}
        </Text>
      ) : null}

      <Text style={{ color: colors.text, fontWeight: "800", marginBottom: 8 }}>
        {title || defaultTitle}
        {!hideOthersPicks && !loading && sorted.length > 0 ? ` (${sorted.length})` : ""}
      </Text>

      {loading ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <ActivityIndicator size="small" color={colors.subtext} />
          <Text style={{ color: colors.subtext, fontSize: 13 }}>
            {i18n.t("common.loading", { defaultValue: "Chargement…" })}
          </Text>
        </View>
      ) : sorted.length === 0 ? (
        <Text style={{ color: colors.subtext, fontSize: 13 }}>
          {i18n.t("firstGoal.live.noEntriesYet", { defaultValue: "Aucune participation encore." })}
        </Text>
      ) : (
        <View style={{ gap: 6 }}>
          {sorted.map((entry, index) => {
            const who = entryDisplayName(entry);
            const points = entryTotalPoints(entry);
            const isMe = String(entry.uid) === uid;
            const hideThisPick = hideOthersPicks && !isMe;
            const { winnersCorrect, exactScores } = countTpPickStatsForEntry(entry, bundle);
            const pickLines = hideThisPick
              ? []
              : formatTpEntryPickLines(entry, bundle, leagueKey);

            return (
              <View
                key={String(entry.uid)}
                style={{
                  flexDirection: "row",
                  alignItems: "flex-start",
                  paddingVertical: 10,
                  paddingHorizontal: 10,
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: isMe ? "rgba(22,163,74,0.35)" : colors.border,
                  backgroundColor: isMe ? colors.card2 : colors.card,
                }}
              >
                <Text
                  style={{
                    color: colors.subtext,
                    fontWeight: "900",
                    width: 24,
                    fontSize: 13,
                    paddingTop: 2,
                  }}
                >
                  {index + 1}.
                </Text>

                <View style={{ flex: 1, minWidth: 0, paddingRight: 8 }}>
                  <Text style={{ color: colors.text, fontWeight: "900" }} numberOfLines={1}>
                    {who}
                    {isMe
                      ? ` ${i18n.t("challenges.youSuffix", { defaultValue: "(toi)" })}`
                      : ""}
                  </Text>

                  {hideThisPick ? (
                    <Text style={{ color: colors.subtext, fontSize: 12, marginTop: 4 }}>
                      {i18n.t("tp.live.pickHidden", {
                        defaultValue: "Prédiction masquée avant le début du match",
                      })}
                    </Text>
                  ) : pickLines.length > 0 ? (
                    <View style={{ marginTop: 6, gap: 6 }}>
                      {pickLines.map((pl) => (
                        <TpParticipantPickLine
                          key={pl.gameId}
                          line={pl}
                          league={leagueKey}
                          colors={colors}
                        />
                      ))}
                    </View>
                  ) : (
                    <Text style={{ color: colors.subtext, fontSize: 12, marginTop: 4 }}>
                      {i18n.t("tp.live.noPickYet", {
                        defaultValue: "Aucune prédiction enregistrée",
                      })}
                    </Text>
                  )}

                  {gameCount > 0 && !hideThisPick && (winnersCorrect > 0 || exactScores > 0) ? (
                    <Text style={{ color: colors.subtext, fontSize: 11, marginTop: 4 }}>
                      {i18n.t("tp.results.participantStats", {
                        defaultValue:
                          "{{winners}} bon(s) choix(s) · {{exact}} pointage(s) exact(s)",
                        winners: winnersCorrect,
                        exact: exactScores,
                      })}
                    </Text>
                  ) : null}
                </View>

                <Text
                  style={{
                    color: colors.text,
                    fontWeight: "900",
                    fontSize: 14,
                    paddingTop: 2,
                  }}
                >
                  {points}{" "}
                  <Text style={{ color: colors.subtext, fontWeight: "700", fontSize: 12 }}>
                    {i18n.t("challenges.pointsShort", { defaultValue: "pt(s)" })}
                  </Text>
                </Text>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}
