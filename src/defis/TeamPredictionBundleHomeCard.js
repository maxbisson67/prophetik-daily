// src/defis/TeamPredictionBundleHomeCard.js

import React, { useMemo } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import i18n from "@src/i18n/i18n";
import TpHomeDeadlineBlock from "@src/defis/TpHomeDeadlineBlock";
import { getEarliestOpenSlot, getSlotLockedAt, isSlotLocked, fmtTimeShort } from "@src/defis/tpDeadlineHelpers";
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
import { resolveTpSlotMatchStatus, shouldShowTpStartTimeLabel } from "@src/defis/match/matchTaskStatus";
import TpMatchMetaColumn from "@src/defis/TpMatchMetaColumn";
import {
  formatParticipantCtaLabel,
  resolveParticipantTaskStatus,
} from "@src/defis/participant/participantTaskStatus";
import { PARTICIPANT_MODIFY_CTA, PARTICIPANT_PRIMARY_CTA } from "@src/defis/participant/participantCtaStyles";
import TpHomePredictionRow, { isCompleteTpPick } from "@src/defis/TpHomePredictionRow";

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

function BundleMatchRow({ slot, league, pick, pickResult, colors, scheduleInfo = null, hideResults = false }) {
  const awayAbbr = safeAbbr(slot?.awayAbbr);
  const homeAbbr = safeAbbr(slot?.homeAbbr);
  const pickLine = formatTpPickLine(pick, league);
  const slotDecided = isSlotDecided(slot);
  const postponed = league === "MLB" && isMlbGamePostponed(scheduleInfo?.status);
  const matchTask = resolveTpSlotMatchStatus(slot, { scheduleStatus: scheduleInfo?.status });
  const officialLine = slotDecided ? formatResultWinnerLine(slot, league) : null;
  const pointsLine = slotDecided ? formatPickPoints(pickResult) : null;
  const hasPick = isCompleteTpPick(pick);
  const startTimeLabel = hasPick
    ? fmtTimeShort(
        slot?.gameStartTimeUTC ?? scheduleInfo?.startTimeUTC ?? scheduleInfo?.gameDate ?? null
      )
    : null;
  const showStartTime = shouldShowTpStartTimeLabel(startTimeLabel, matchTask);

  return (
    <View
      style={{
        paddingVertical: 6,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 8,
          marginBottom: 5,
        }}
      >
        <Text
          style={{
            flex: 1,
            minWidth: 0,
            color: colors.text,
            fontWeight: "900",
            fontSize: 14,
          }}
          numberOfLines={1}
        >
          {awayAbbr} @ {homeAbbr}
        </Text>

        <TpMatchMetaColumn
          colors={colors}
          startTimeLabel={startTimeLabel}
          showStartTime={showStartTime}
          matchTask={matchTask}
        />
      </View>

      {hideResults ? (
        postponed ? (
          <View style={{ alignItems: "center" }}>
            <PostponedLabel colors={colors} />
          </View>
        ) : (
          <TpHomePredictionRow
            variant="scoreGrid"
            pick={pick}
            awayAbbr={awayAbbr}
            homeAbbr={homeAbbr}
            league={league}
            lockDeadline={getSlotLockedAt(slot)}
            colors={colors}
          />
        )
      ) : slotDecided && officialLine ? (
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

  const showPrimaryCta =
    showParticipateCta && participantTask.showPrimaryCta;
  const showModifyCta =
    showParticipateCta && participantTask.showModifyCta && !participantTask.showPrimaryCta;

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

      {games.map((slot) => (
        <BundleMatchRow
          key={String(slot.gameId)}
          slot={slot}
          league={league}
          pick={picks[String(slot.gameId)]}
          pickResult={pickResults[String(slot.gameId)]}
          colors={colors}
          scheduleInfo={scheduleByGameId[String(slot.gameId)] || null}
          hideResults
        />
      ))}

      {!bundleDecided ? (
        <TpHomeDeadlineBlock
          locked={deadlineLocked}
          deadline={deadline}
          nextSlot={nextSlot}
          postponed={hasOpenPostponedSlot && locked}
          colors={colors}
        />
      ) : null}

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
        <ResultsTabHint colors={colors} groupId={groupId} />

        {showParticipateCta ? (
          <>
            {showPrimaryCta ? (
              <TouchableOpacity
                onPress={onPressCta}
                activeOpacity={0.9}
                style={PARTICIPANT_PRIMARY_CTA.button}
              >
                <Text style={PARTICIPANT_PRIMARY_CTA.text}>{ctaLabel}</Text>
              </TouchableOpacity>
            ) : null}

            {showModifyCta ? (
              <TouchableOpacity
                onPress={onPressCta}
                activeOpacity={0.9}
                style={PARTICIPANT_MODIFY_CTA.button}
              >
                <Text style={PARTICIPANT_MODIFY_CTA.text}>{ctaLabel}</Text>
              </TouchableOpacity>
            ) : null}
          </>
        ) : null}
      </View>
    </View>
  );
}

export { isBundleLocked, isSlotLocked };
