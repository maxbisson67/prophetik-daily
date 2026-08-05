import React, { useMemo } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import i18n from "@src/i18n/i18n";
import { useAuth } from "@src/auth/SafeAuthProvider";
import { resolveChallengeDisplayStatus } from "@src/defis/results/challengeResultsModel";
import {
  buildParticipantPickRows,
  isTsFinalizedStatus,
  isTsLiveLeaderboardStatus,
  resolveTsHideOthersPicks,
  resolveTsLiveLeaderSummary,
  resolveTsSport,
  resolveTsWinnerBadge,
  toDateAny,
} from "@src/defis/results/tsResultsUtils";
import TsLiveLeaderBanner from "@src/defis/results/TsLiveLeaderBanner";
import useTsLiveResults from "@src/defis/results/useTsLiveResults";
import TsParticipantsLeaderboard, { PickRow } from "@src/defis/results/TsParticipantsLeaderboard";
import TsWinnerBadge from "@src/defis/results/TsWinnerBadge";

function fmtHM(v) {
  const d = toDateAny(v);
  if (!d) return "—";
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

function statusBadge(status, colors) {
  const key = String(status || "").toLowerCase();
  const cfg =
    key === "live"
      ? { bg: "#F0FDF4", fg: "#166534", icon: "broadcast", label: i18n.t("defi.results.status.live") }
      : key === "open"
      ? { bg: "#ECFEFF", fg: "#0E7490", icon: "clock-outline", label: i18n.t("defi.results.status.open") }
      : key === "closed"
      ? { bg: "#FEF2F2", fg: "#991B1B", icon: "lock", label: i18n.t("defi.results.status.closed") }
      : { bg: colors.card2, fg: colors.subtext, icon: "help-circle", label: key || "—" };

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        alignSelf: "flex-start",
        paddingVertical: 4,
        paddingHorizontal: 8,
        borderRadius: 10,
        backgroundColor: cfg.bg,
        gap: 6,
      }}
    >
      <MaterialCommunityIcons name={cfg.icon} size={14} color={cfg.fg} />
      <Text style={{ color: cfg.fg, fontWeight: "700", fontSize: 12 }}>{cfg.label}</Text>
    </View>
  );
}

export default function TsResultDetailBlock({
  item,
  colors,
  myEntry = null,
  compact = true,
  onOpenFullResults,
  hideWinnerBadge = false,
}) {
  const { user } = useAuth();
  const defiRaw = item?.raw || {};
  const defiId = String(item?.id || defiRaw?.id || "");
  const sport = resolveTsSport(defiRaw);
  const displayStatus = resolveChallengeDisplayStatus(item);

  const hasMyPicks = Array.isArray(myEntry?.picks) && myEntry.picks.length > 0;
  const showLiveData =
    hasMyPicks ||
    ["open", "live", "locked", "closed", "awaiting_result", "completed"].includes(
      String(displayStatus || "").toLowerCase()
    );

  const {
    loading,
    leaderboard,
    liveStats,
    playerMap,
    namesMap,
    participantInfoMap,
    isMlbTs,
  } = useTsLiveResults(defiId, { sport, enabled: showLiveData && !!defiId });

  const hideOthersPicks = resolveTsHideOthersPicks(defiRaw);
  const revealTimeLabel = fmtHM(defiRaw?.firstGameUTC);

  const myLeaderboardEntry = useMemo(() => {
    if (!user?.uid) return null;
    return leaderboard.find((r) => r.uid === user.uid) || null;
  }, [leaderboard, user?.uid]);

  const myRank = myLeaderboardEntry?.rank ?? null;
  const myLivePoints = Number(myLeaderboardEntry?.livePoints ?? myEntry?.livePoints ?? 0);

  const myPickRows = useMemo(() => {
    const picks = Array.isArray(myEntry?.picks) ? myEntry.picks : [];
    return buildParticipantPickRows({ picks, liveStats, playerMap, isMlbTs });
  }, [myEntry?.picks, liveStats, playerMap, isMlbTs]);

  const isFinalized = isTsFinalizedStatus(displayStatus, defiRaw);
  const showLiveLeader = isTsLiveLeaderboardStatus(displayStatus);

  const liveLeaderSummary = useMemo(() => {
    if (!showLiveLeader || isFinalized) return null;
    return resolveTsLiveLeaderSummary(leaderboard, namesMap, user?.uid);
  }, [showLiveLeader, isFinalized, leaderboard, namesMap, user?.uid]);

  const winnerBadge = useMemo(() => {
    if (!isFinalized) return null;
    return resolveTsWinnerBadge(defiRaw, leaderboard, namesMap);
  }, [isFinalized, defiRaw, leaderboard, namesMap]);

  const winnerBadgeBlock =
    isFinalized && !hideWinnerBadge ? <TsWinnerBadge summary={winnerBadge} /> : null;

  if (!showLiveData) return null;

  if (loading && !leaderboard.length && !myPickRows.length) {
    return (
      <View style={{ paddingVertical: 12, alignItems: "center" }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!compact) {
    return (
      <View style={{ gap: 10 }}>
        {liveLeaderSummary ? <TsLiveLeaderBanner summary={liveLeaderSummary} /> : null}
        {winnerBadgeBlock}
        <TsParticipantsLeaderboard
          leaderboard={leaderboard}
          namesMap={namesMap}
          participantInfoMap={participantInfoMap}
          colors={colors}
          liveStats={liveStats}
          playerMap={playerMap}
          currentUid={user?.uid}
          hideOthersPicks={hideOthersPicks}
          revealTimeLabel={revealTimeLabel}
          isMlbTs={isMlbTs}
          sport={sport}
          compact={false}
        />
      </View>
    );
  }

  return (
    <View style={{ gap: 10 }}>
      {String(displayStatus || "").toLowerCase() !== "open"
        ? statusBadge(displayStatus, colors)
        : null}

      {liveLeaderSummary ? <TsLiveLeaderBanner summary={liveLeaderSummary} /> : null}

      {winnerBadgeBlock}

      {hasMyPicks ? (
        <>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              paddingVertical: 8,
              paddingHorizontal: 10,
              borderRadius: 10,
              backgroundColor: colors.card2,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Text style={{ color: colors.text, fontWeight: "800" }}>
              {i18n.t("challenges.tsLiveYourScore", { defaultValue: "Ton score" })}
            </Text>
            <Text style={{ color: colors.text, fontWeight: "900", fontSize: 18 }}>
              {myLivePoints.toFixed(0)} pts
              {myRank ? (
                <Text style={{ color: colors.subtext, fontWeight: "800", fontSize: 13 }}>
                  {" "}
                  · {myRank}
                  {i18n.t("challenges.tsLiveRankSuffix", { defaultValue: "e" })} / {leaderboard.length}
                </Text>
              ) : null}
            </Text>
          </View>

          <View
            style={{
              padding: 8,
              borderRadius: 10,
              backgroundColor: colors.background,
              borderWidth: 1,
              borderColor: colors.border,
              gap: 2,
            }}
          >
            {myPickRows.map((row) => (
              <PickRow key={row.playerId} row={row} sport={sport} isMlbTs={isMlbTs} colors={colors} compact />
            ))}
          </View>
        </>
      ) : (
        <Text style={{ color: colors.subtext, fontWeight: "700" }}>
          {i18n.t("challenges.tsLiveNoPicks", { defaultValue: "Tu n'as pas participé à ce défi." })}
        </Text>
      )}

      {leaderboard.length > 0 ? (
        <View
          style={{
            padding: 8,
            borderRadius: 10,
            backgroundColor: colors.card2,
            borderWidth: 1,
            borderColor: colors.border,
            gap: 4,
          }}
        >
          <Text style={{ color: colors.subtext, fontWeight: "800", fontSize: 12, marginBottom: 2 }}>
            {i18n.t("challenges.tsLiveTop", { defaultValue: "Classement" })}
          </Text>
          {leaderboard.slice(0, 3).map((entry) => (
            <View key={entry.uid} style={{ flexDirection: "row", alignItems: "center", paddingVertical: 2 }}>
              <Text style={{ width: 24, color: colors.subtext, fontWeight: "900" }}>{entry.rank}.</Text>
              <Text style={{ flex: 1, color: colors.text, fontWeight: "700" }} numberOfLines={1}>
                {entry.uid === user?.uid
                  ? i18n.t("challenges.tsLiveYou", { defaultValue: "Toi" })
                  : namesMap[entry.uid] || entry.uid}
              </Text>
              <Text style={{ color: colors.text, fontWeight: "900", fontVariant: ["tabular-nums"] }}>
                {Number(entry.livePoints || 0).toFixed(0)}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      {hideOthersPicks && revealTimeLabel ? (
        <Text style={{ fontSize: 12, color: colors.subtext, textAlign: "center" }}>
          {i18n.t("defi.results.participants.hiddenUntil", { time: revealTimeLabel })}
        </Text>
      ) : null}

      {onOpenFullResults ? (
        <TouchableOpacity
          onPress={onOpenFullResults}
          activeOpacity={0.85}
          style={{
            paddingVertical: 10,
            borderRadius: 10,
            alignItems: "center",
            backgroundColor: colors.card2,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <Text style={{ color: colors.text, fontWeight: "900" }}>
            {i18n.t("challenges.tsLiveSeeFull", { defaultValue: "Voir le classement complet" })}
          </Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}
