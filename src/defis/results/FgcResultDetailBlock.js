import React, { useEffect, useMemo, useState } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import firestore from "@react-native-firebase/firestore";

import i18n from "@src/i18n/i18n";
import { useTheme } from "@src/theme/ThemeProvider";
import { useAuth } from "@src/auth/SafeAuthProvider";
import FgcParticipantsModal from "@src/defis/results/FgcParticipantsModal";
import FgcParticipantsList from "@src/defis/results/FgcParticipantsList";
import TeamLogoBadge from "@src/sports/TeamLogoBadge";
import { lookupTeamByAbbr } from "@src/groups/data/fallbackTeams";
import {
  getFgcLeague,
  getFgcResultPlayerId,
  getFgcResultPrefix,
  getFgcResultOutcomeLabel,
  resolveFgcHideOthersPicks,
  resolveFgcRevealTimeLabel,
} from "@src/firstGoal/fgcChallengeUtils";
import {
  resolveFgcEffectiveResult,
} from "@src/firstGoal/fgcMutualizedGameUtils";
import useFgcMutualizedGame from "@src/firstGoal/useFgcMutualizedGame";
import MatchTaskStatusChip from "@src/defis/match/MatchTaskStatusChip";
import { MATCH_TASK_STATES, resolveFgcMatchStatus } from "@src/defis/match/matchTaskStatus";
import {
  RESULTS_ACCENT,
} from "@src/defis/results/resultsTheme";
import {
  formatPickBravoBadgeLabel,
  getPickBravoHighlightTheme,
  PickBravoBadge,
  PickOopsBadge,
} from "@src/defis/results/PickResultTags";
import { FGC_WIN_POINTS } from "@src/lib/challengeScoringConstants";

function safeAbbr(v) {
  const s = String(v || "").trim().toUpperCase();
  return s || "";
}

function MatchupRow({ awayAbbr, homeAbbr, sport, colors, matchTask = null }) {
  const away = safeAbbr(awayAbbr);
  const home = safeAbbr(homeAbbr);
  const league = String(sport || "NHL").toUpperCase() === "MLB" ? "MLB" : "NHL";

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 10,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", flex: 1, minWidth: 0 }}>
        <TeamLogoBadge team={lookupTeamByAbbr(league, away)} size={22} colors={colors} />
        <Text style={{ color: colors.text, fontWeight: "900", marginLeft: 8 }}>{away || "—"}</Text>
        <Text style={{ color: colors.subtext, marginHorizontal: 10, fontWeight: "900" }}>@</Text>
        <Text style={{ color: colors.text, fontWeight: "900", marginRight: 8 }}>{home || "—"}</Text>
        <TeamLogoBadge team={lookupTeamByAbbr(league, home)} size={22} colors={colors} />
      </View>

      {matchTask ? <MatchTaskStatusChip task={matchTask} colors={colors} compact /> : null}
    </View>
  );
}

function entryTeamAbbr(entry) {
  return safeAbbr(
    entry?.teamAbbr || entry?.playerTeamAbbr || entry?.selectedTeamAbbr || ""
  );
}

function entryPickName(entry) {
  return (
    entry?.playerName ||
    entry?.selectedPlayerName ||
    entry?.pickPlayerName ||
    "—"
  );
}

function entryPoints(entry) {
  if (entry?.payout != null) return Number(entry.payout) || 0;
  if (entry?.won === true) return Number(entry?.points ?? 0) || 0;
  return 0;
}

function isCorrectPick(entry, winnerPlayerId) {
  if (!winnerPlayerId || !entry?.playerId) return false;
  return String(entry.playerId) === String(winnerPlayerId);
}

function resolveFgcDefaultPoints(challenge) {
  return (
    Number(
      challenge?.stakePoints ?? challenge?.points ?? challenge?.potJoinIncrement ?? FGC_WIN_POINTS
    ) || FGC_WIN_POINTS
  );
}

function canScoreFgcPick(matchTask, challenge, winnerPlayerId) {
  const state = matchTask?.state;

  if (state === MATCH_TASK_STATES.NOT_STARTED || state === MATCH_TASK_STATES.POSTPONED) {
    return false;
  }

  if (state === MATCH_TASK_STATES.COMPLETED) return true;

  if (state === MATCH_TASK_STATES.IN_PROGRESS && winnerPlayerId) return true;

  const challengeStatus = String(challenge?.status || "").toLowerCase();
  return ["decided", "closed", "completed"].includes(challengeStatus);
}

export default function FgcResultDetailBlock({
  item,
  colors,
  scheduleStatus = null,
  accentColor = RESULTS_ACCENT,
  showParticipantsInline = false,
}) {
  const { isDark } = useTheme();
  const { user } = useAuth();
  const uid = String(user?.uid || "");

  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showParticipantsModal, setShowParticipantsModal] = useState(false);

  const challenge = item?.raw || {};
  const challengeId = String(item?.id || challenge?.id || "");
  const challengeLeague = getFgcLeague(challenge);
  const { data: mutualizedGame } = useFgcMutualizedGame(challenge);
  const effectiveResult = resolveFgcEffectiveResult(challenge, mutualizedGame);
  const winnerPlayerId = getFgcResultPlayerId(challenge);
  const winnerName = effectiveResult?.playerName || null;
  const winnerTeam = effectiveResult?.teamAbbr || null;
  const awaitingFinalConfirmation = !!effectiveResult?.awaitingFinalConfirmation;

  useEffect(() => {
    if (!challengeId) {
      setEntries([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const ref = firestore()
      .collection("first_goal_challenges")
      .doc(challengeId)
      .collection("entries");

    const unsub = ref.onSnapshot(
      (snap) => {
        const list = (snap?.docs ?? [])
          .map((d) => ({ uid: d.id, ...d.data() }))
          .filter((e) => !!e.playerId)
          .sort((a, b) =>
            String(a.displayName || a.uid || "").localeCompare(
              String(b.displayName || b.uid || "")
            )
          );
        setEntries(list);
        setLoading(false);
      },
      () => {
        setEntries([]);
        setLoading(false);
      }
    );

    return () => {
      try {
        unsub();
      } catch {}
    };
  }, [challengeId]);

  const myEntry = useMemo(
    () => entries.find((e) => String(e.uid) === uid) || null,
    [entries, uid]
  );

  const myPoints = entryPoints(myEntry);
  const myCorrect = isCorrectPick(myEntry, winnerPlayerId);
  const myTeamAbbr = entryTeamAbbr(myEntry);
  const matchTask = resolveFgcMatchStatus(challenge, { scheduleStatus });

  const pickScored = canScoreFgcPick(matchTask, challenge, winnerPlayerId);
  const bravoPoints = myPoints > 0 ? myPoints : resolveFgcDefaultPoints(challenge);
  const bravoLabel =
    myEntry && myCorrect && pickScored
      ? formatPickBravoBadgeLabel(bravoPoints, i18n.t.bind(i18n))
      : null;
  const showOopsTag = !!myEntry && pickScored && !myCorrect;
  const bravoHighlightTheme = bravoLabel
    ? getPickBravoHighlightTheme(isDark, { provisional: false })
    : null;

  const hideOthersPicks = resolveFgcHideOthersPicks(challenge, scheduleStatus);
  const revealTimeLabel = resolveFgcRevealTimeLabel(challenge);

  return (
    <View style={{ marginTop: 10 }}>
      <MatchupRow
        awayAbbr={challenge?.awayAbbr}
        homeAbbr={challenge?.homeAbbr}
        sport={challengeLeague}
        colors={colors}
        matchTask={matchTask}
      />

      <View
        style={{
          marginTop: 10,
          paddingVertical: 8,
          paddingHorizontal: 10,
          borderRadius: 10,
          backgroundColor: colors.card2,
          borderWidth: 1,
          borderColor: colors.border,
        }}
      >
        <Text style={{ color: colors.subtext, fontSize: 12, fontWeight: "700" }}>
          {getFgcResultPrefix(challenge, i18n.t.bind(i18n))}
        </Text>
        {winnerName ? (
          <View style={{ flexDirection: "row", alignItems: "center", marginTop: 4 }}>
            {winnerTeam ? (
              <TeamLogoBadge
                team={lookupTeamByAbbr(challengeLeague, safeAbbr(winnerTeam))}
                size={22}
                colors={colors}
              />
            ) : null}
            <Text
              style={{
                color: colors.text,
                fontWeight: "900",
                marginLeft: winnerTeam ? 8 : 0,
                flexShrink: 1,
              }}
              numberOfLines={1}
            >
              {winnerName}
            </Text>
          </View>
        ) : null}
        {awaitingFinalConfirmation ? (
          <Text style={{ color: "#d97706", fontSize: 12, fontWeight: "700", marginTop: 4 }}>
            {i18n.t("firstGoal.awaitingFinalConfirmation", {
              defaultValue: "En attente de confirmation finale",
            })}
          </Text>
        ) : null}
        {!winnerName ? (
          <Text style={{ color: colors.text, fontWeight: "900", marginTop: 2 }}>
            {getFgcResultOutcomeLabel(challenge, i18n.t.bind(i18n), matchTask?.state)}
          </Text>
        ) : null}
      </View>

      {myEntry ? (
        <View style={{ marginTop: 10 }}>
          <View style={bravoLabel ? bravoHighlightTheme?.bandeau : null}>
            <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap" }}>
              <Text style={{ color: colors.subtext, fontSize: 13 }}>
                {i18n.t("challenges.myPick", { defaultValue: "Mon choix" })}
                {": "}
              </Text>
              {myTeamAbbr ? (
                <TeamLogoBadge
                  team={lookupTeamByAbbr(challengeLeague, myTeamAbbr)}
                  size={22}
                  colors={colors}
                />
              ) : null}
              <Text
                style={{
                  color: colors.text,
                  fontWeight: "900",
                  fontSize: 13,
                  marginLeft: myTeamAbbr ? 8 : 0,
                  flexShrink: 1,
                }}
                numberOfLines={1}
              >
                {entryPickName(myEntry)}
              </Text>
            </View>

            {bravoLabel ? (
              <View style={{ alignItems: "flex-end", marginTop: 8 }}>
                <PickBravoBadge label={bravoLabel} isDark={isDark} />
              </View>
            ) : showOopsTag ? (
              <View style={{ alignItems: "flex-end", marginTop: 8 }}>
                <PickOopsBadge isDark={isDark} />
              </View>
            ) : null}
          </View>
        </View>
      ) : (
        <Text style={{ color: colors.subtext, marginTop: 10, fontSize: 13 }}>
          {i18n.t("challenges.notJoined", { defaultValue: "Non inscrit" })}
        </Text>
      )}

      {showParticipantsInline ? (
        <FgcParticipantsList
          entries={entries}
          loading={loading}
          winnerPlayerId={winnerPlayerId}
          currentUid={uid}
          colors={colors}
          league={challengeLeague}
          hideOthersPicks={hideOthersPicks}
          revealTimeLabel={revealTimeLabel}
        />
      ) : !loading && entries.length > 0 ? (
        <TouchableOpacity
          onPress={() => setShowParticipantsModal(true)}
          activeOpacity={0.85}
          style={{
            marginTop: 12,
            flexDirection: "row",
            alignItems: "center",
            alignSelf: "flex-start",
          }}
        >
          <Text style={{ color: accentColor, fontWeight: "800", fontSize: 13 }}>
            {i18n.t("challenges.viewOtherParticipantsPicks", {
              defaultValue: "Voir les choix des autres participants",
            })}
          </Text>
          <Text style={{ color: colors.subtext, fontSize: 13, marginLeft: 6 }}>
            ({entries.length})
          </Text>
          <Ionicons name="chevron-forward" size={14} color={accentColor} style={{ marginLeft: 2 }} />
        </TouchableOpacity>
      ) : loading ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 12 }}>
          <ActivityIndicator size="small" color={colors.subtext} />
        </View>
      ) : null}

      {!showParticipantsInline ? (
        <FgcParticipantsModal
          visible={showParticipantsModal}
          onClose={() => setShowParticipantsModal(false)}
          challenge={challenge}
          entries={entries}
          loading={loading}
          currentUid={uid}
          matchTask={matchTask}
          colors={colors}
        />
      ) : null}
    </View>
  );
}
