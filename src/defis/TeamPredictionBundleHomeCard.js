// src/defis/TeamPredictionBundleHomeCard.js

import React, { useMemo } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import i18n from "@src/i18n/i18n";
import TeamLogoBadge from "@src/sports/TeamLogoBadge";
import { lookupTeamByAbbr } from "@src/groups/data/fallbackTeams";
import TpHomeDeadlineBlock from "@src/defis/TpHomeDeadlineBlock";
import { getEarliestOpenSlot, isSlotLocked } from "@src/defis/tpDeadlineHelpers";
import { isMlbGamePostponed } from "@src/mlb/mlbGameStatusUtils";
import {
  formatPickPoints,
  formatResultWinnerLine,
  formatTpPickLine,
  isBundleDecided,
  isSlotDecided,
  hasOpenPostponedTpSlot,
} from "@src/defis/tpBundleDisplayHelpers";
import ResultsTabHint from "@src/home/components/ResultsTabHint";
import ParticipantTaskStatusChip from "@src/defis/participant/ParticipantTaskStatusChip";
import MatchTaskStatusChip from "@src/defis/match/MatchTaskStatusChip";
import {
  formatParticipantCtaLabel,
  resolveParticipantTaskStatus,
} from "@src/defis/participant/participantTaskStatus";
import { resolveTpSlotMatchStatus } from "@src/defis/match/matchTaskStatus";

function safeAbbr(v) {
  return String(v || "").trim().toUpperCase();
}

function PostponedLabel({ colors }) {
  return (
    <Text style={{ color: "#d97706", fontWeight: "900", fontSize: 12 }}>
      {i18n.t("tp.home.postponed", { defaultValue: "Reporté" })}
    </Text>
  );
}

function BundleMatchRow({ slot, slotIndex, league, pick, pickResult, colors, scheduleInfo = null }) {
  const awayAbbr = safeAbbr(slot?.awayAbbr);
  const homeAbbr = safeAbbr(slot?.homeAbbr);
  const awayTeam = lookupTeamByAbbr(league, awayAbbr);
  const homeTeam = lookupTeamByAbbr(league, homeAbbr);
  const pickLine = formatTpPickLine(pick, league);
  const slotDecided = isSlotDecided(slot);
  const postponed = league === "MLB" && isMlbGamePostponed(scheduleInfo?.status);
  const matchTask = resolveTpSlotMatchStatus(slot, { scheduleStatus: scheduleInfo?.status });
  const officialLine = slotDecided ? formatResultWinnerLine(slot, league) : null;
  const pointsLine = slotDecided ? formatPickPoints(pickResult) : null;
  const slotLabel = Number(slot?.slot) > 0 ? Number(slot.slot) : slotIndex;

  return (
    <View
      style={{
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <Text
          style={{
            marginRight: 6,
            color: colors.subtext,
            fontWeight: "900",
            fontSize: 12,
            width: 14,
            textAlign: "center",
          }}
        >
          {slotLabel}
        </Text>

        <TeamLogoBadge team={awayTeam} size={18} colors={colors} />
        <Text style={{ color: colors.text, fontWeight: "900", marginHorizontal: 6, fontSize: 13 }}>
          {awayAbbr}
        </Text>
        <Text style={{ color: colors.subtext, fontWeight: "900" }}>@</Text>
        <Text style={{ color: colors.text, fontWeight: "900", marginHorizontal: 6, fontSize: 13 }}>
          {homeAbbr}
        </Text>
        <TeamLogoBadge team={homeTeam} size={18} colors={colors} />

        <View style={{ flex: 1 }} />

        <MatchTaskStatusChip task={matchTask} colors={colors} compact />
      </View>

      {slotDecided && officialLine ? (
        <View style={{ alignItems: "flex-end", marginTop: 4 }}>
          <Text style={{ color: colors.text, fontWeight: "900", fontSize: 12 }}>{officialLine}</Text>
          {pickLine ? (
            <Text style={{ color: colors.subtext, fontSize: 11, marginTop: 2 }}>
              {i18n.t("tp.home.myPickShort", { defaultValue: "Toi" })}: {pickLine}
              {pointsLine ? ` · ${pointsLine}` : ""}
            </Text>
          ) : null}
        </View>
      ) : !slotDecided && pickLine ? (
        <Text
          style={{
            color: colors.text,
            fontWeight: "900",
            fontSize: 12,
            textAlign: "right",
            marginTop: 4,
          }}
        >
          {pickLine}
        </Text>
      ) : !slotDecided && postponed ? (
        <View style={{ alignItems: "flex-end", marginTop: 4 }}>
          <PostponedLabel colors={colors} />
        </View>
      ) : null}
    </View>
  );
}

function isBundleLocked(bundle, games, isSlotLocked) {
  const status = String(bundle?.status || "open").toLowerCase();
  if (["decided", "closed"].includes(status)) return true;

  const slots = Array.isArray(games) ? games : [];
  if (!slots.length) return status === "locked";

  return slots.every((g) => isSlotLocked(g));
}

export default function TeamPredictionBundleHomeCard({
  bundle,
  entry,
  league,
  colors,
  groupId = null,
  scheduleByGameId = {},
}) {
  const router = useRouter();
  const games = Array.isArray(bundle?.games) ? bundle.games : [];
  const gameCount = Number(bundle?.gameCount || games.length || 0);
  const picks = entry?.picks || {};
  const pickResults = entry?.pickResults || {};
  const picksCompletedCount = Number(entry?.picksCompletedCount || 0);
  const totalPoints = Number(entry?.totalPoints ?? 0);
  const participants = Number(bundle?.participantsCount ?? 0);
  const bundleDecided = isBundleDecided(bundle);

  const hasOpenPostponedSlot = useMemo(
    () => hasOpenPostponedTpSlot(games, league, scheduleByGameId),
    [games, league, scheduleByGameId]
  );

  const locked = useMemo(
    () => isBundleLocked(bundle, games, (slot) => isSlotLocked(slot)),
    [bundle, games]
  );

  const { lockedAt: deadline, slot: nextSlot } = useMemo(() => {
    const eligibleGames =
      league === "MLB"
        ? games.filter((slot) => {
            const scheduleInfo = scheduleByGameId[String(slot.gameId)];
            return !isMlbGamePostponed(scheduleInfo?.status);
          })
        : games;

    return getEarliestOpenSlot(eligibleGames);
  }, [games, league, scheduleByGameId]);

  const allPicksComplete = gameCount > 0 && picksCompletedCount >= gameCount;

  const participantTask = useMemo(
    () =>
      resolveParticipantTaskStatus(
        { kind: "tp", subtype: "bundle", raw: bundle },
        {
          isToday: !bundleDecided,
          entry,
          scheduleByGameId,
        }
      ),
    [bundle, bundleDecided, entry, scheduleByGameId]
  );

  const showParticipateCta =
    !bundleDecided &&
    (participantTask.showPrimaryCta ||
      participantTask.showModifyCta ||
      (!locked || hasOpenPostponedSlot));

  const deadlineLocked = locked && !hasOpenPostponedSlot;

  const ctaLabel =
    formatParticipantCtaLabel(
      participantTask.showPrimaryCta
        ? participantTask.ctaKey
        : participantTask.showModifyCta
        ? "modify"
        : null
    ) ||
    (allPicksComplete
      ? i18n.t("tp.home.modifyTeams", { defaultValue: "Modifier mes équipes" })
      : i18n.t("common.participate", { defaultValue: "Participer" }));

  const onPressCta = () => {
    const challengeId = String(bundle?.id || "").trim();
    if (!challengeId) return;

    router.push({
      pathname: "/(drawer)/(team-prediction)/pick/[challengeId]",
      params: { challengeId },
    });
  };

  return (
    <View
      style={{
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.card,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 10,
          marginBottom: 8,
        }}
      >
        <Text style={{ color: colors.text, fontWeight: "900", fontSize: 14, flex: 1 }}>
          {i18n.t("tp.home.bundleTitle", {
            defaultValue: "{{count}} match(s) à prédire",
            count: gameCount,
          })}
        </Text>

        {!bundleDecided ? (
          <ParticipantTaskStatusChip task={participantTask} colors={colors} compact />
        ) : null}
      </View>

      {games.map((slot, index) => (
        <BundleMatchRow
          key={String(slot.gameId)}
          slot={slot}
          slotIndex={index + 1}
          league={league}
          pick={picks[String(slot.gameId)]}
          pickResult={pickResults[String(slot.gameId)]}
          colors={colors}
          scheduleInfo={scheduleByGameId[String(slot.gameId)] || null}
        />
      ))}

      {bundleDecided ? (
        <Text style={{ color: colors.text, marginTop: 10, fontSize: 13, fontWeight: "900" }}>
          {entry
            ? i18n.t("tp.home.myTotalPoints", {
                defaultValue: "Ton total : {{points}} pt(s)",
                points: totalPoints,
              })
            : i18n.t("tp.home.resultsAvailable", {
                defaultValue: "Résultats disponibles",
              })}
        </Text>
      ) : (
        <TpHomeDeadlineBlock
          locked={deadlineLocked}
          deadline={deadline}
          nextSlot={nextSlot}
          postponed={hasOpenPostponedSlot && locked}
          colors={colors}
        />
      )}

      {!bundleDecided && participantTask.state === "done_waiting" && picksCompletedCount > 0 ? (
        <Text style={{ color: colors.subtext, marginTop: 8, fontSize: 13 }}>
          {i18n.t("tp.home.bundleProgress", {
            defaultValue: "{{done}}/{{total}} prédictions complétées",
            done: picksCompletedCount,
            total: gameCount,
          })}
        </Text>
      ) : null}

      <View style={{ flexDirection: "row", alignItems: "center", marginTop: 8 }}>
        <MaterialCommunityIcons name="account-group" size={16} color={colors.subtext} />
        <Text style={{ color: colors.subtext, marginLeft: 6, fontSize: 13 }}>
          {participants}{" "}
          {i18n.t("common.participants", { defaultValue: "participant(s)" })}
        </Text>
      </View>

      <View style={{ marginTop: 12, gap: 10 }}>
        {showParticipateCta ? (
          <TouchableOpacity
            onPress={onPressCta}
            activeOpacity={0.9}
            style={{
              width: "100%",
              paddingVertical: 10,
              borderRadius: 12,
              alignItems: "center",
              backgroundColor:
                participantTask.showPrimaryCta || !participantTask.showModifyCta
                  ? "#b91c1c"
                  : colors.card2,
              borderWidth:
                participantTask.showModifyCta && !participantTask.showPrimaryCta ? 1 : 0,
              borderColor: colors.border,
            }}
          >
            <Text
              style={{
                color:
                  participantTask.showPrimaryCta || !participantTask.showModifyCta
                    ? "#fff"
                    : colors.text,
                fontWeight: "900",
              }}
            >
              {ctaLabel}
            </Text>
          </TouchableOpacity>
        ) : (
          <ResultsTabHint colors={colors} />
        )}
      </View>
    </View>
  );
}

export { isBundleLocked, isSlotLocked };
