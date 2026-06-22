import React, { useEffect, useMemo, useState } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import firestore from "@react-native-firebase/firestore";

import i18n from "@src/i18n/i18n";
import { useAuth } from "@src/auth/SafeAuthProvider";
import TeamLogoBadge from "@src/sports/TeamLogoBadge";
import { lookupTeamByAbbr } from "@src/groups/data/fallbackTeams";
import TpParticipantsModal from "@src/defis/results/TpParticipantsModal";
import { tpEntryHasParticipation } from "@src/defis/results/challengeResultsModel";
import {
  formatParticipantTaskLabel,
  resolveParticipantTaskStatus,
} from "@src/defis/participant/participantTaskStatus";
import MatchTaskStatusChip from "@src/defis/match/MatchTaskStatusChip";
import { resolveTpSlotMatchStatus } from "@src/defis/match/matchTaskStatus";
import {
  formatPickPoints,
  getLiveScores,
  getPickScores,
  getSlotOfficialScores,
  formatOfficialPeriodSuffix,
  isSlotDecided,
  lookupPickByGameId,
  resolveTpPickResult,
  scoreTpPickAgainstLive,
} from "@src/defis/tpBundleDisplayHelpers";
import { isMlbGamePostponed } from "@src/mlb/mlbGameStatusUtils";
import useLiveGameScores, {
  normalizeMlbScheduleGameForLive,
} from "@src/defis/results/useLiveGameScores";

function safeAbbr(v) {
  return String(v || "").trim().toUpperCase();
}

function formatScoreValue(v) {
  return v != null && Number.isFinite(Number(v)) ? String(v) : "—";
}

const SCORE_LABEL_WIDTH = 88;
const SCORE_COL_WIDTH = 64;
const LOGO_SLOT_HEIGHT = 28;

function scoreBoxBorderStyle(colors) {
  return {
    borderWidth: StyleSheet.hairlineWidth > 0 ? StyleSheet.hairlineWidth * 2 : 1,
    borderColor: colors.subtext,
  };
}

function ScoreBox({ value, colors }) {
  return (
    <View
      style={{
        width: SCORE_COL_WIDTH,
        minHeight: 44,
        paddingVertical: 8,
        paddingHorizontal: 8,
        borderRadius: 8,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.card,
        ...scoreBoxBorderStyle(colors),
      }}
    >
      <Text style={{ color: colors.text, fontWeight: "900", fontSize: 18 }}>
        {formatScoreValue(value)}
      </Text>
    </View>
  );
}

function TeamScoreColumn({ team, score, showLogo, colors }) {
  return (
    <View style={{ width: SCORE_COL_WIDTH, alignItems: "center" }}>
      {showLogo ? (
        <View
          style={{
            height: LOGO_SLOT_HEIGHT,
            alignItems: "center",
            justifyContent: "flex-end",
            marginBottom: 6,
          }}
        >
          <TeamLogoBadge team={team} size={22} colors={colors} />
        </View>
      ) : null}
      <ScoreBox value={score} colors={colors} />
    </View>
  );
}

function ScoreGridRow({ label, awayTeam, homeTeam, awayScore, homeScore, showLogos, colors }) {
  const labelPadBottom = showLogos ? 12 : 4;

  return (
    <View style={{ flexDirection: "row", alignItems: "flex-end" }}>
      <Text
        style={{
          width: SCORE_LABEL_WIDTH,
          color: colors.subtext,
          fontSize: 12,
          fontWeight: "800",
          paddingBottom: labelPadBottom,
        }}
      >
        {label}
      </Text>

      <View
        style={{
          flex: 1,
          flexDirection: "row",
          alignItems: "flex-end",
          justifyContent: "center",
        }}
      >
        <TeamScoreColumn
          team={awayTeam}
          score={awayScore}
          showLogo={showLogos}
          colors={colors}
        />

        <Text
          style={{
            color: colors.subtext,
            fontWeight: "900",
            fontSize: 16,
            paddingHorizontal: 8,
            paddingBottom: labelPadBottom,
          }}
        >
          -
        </Text>

        <TeamScoreColumn
          team={homeTeam}
          score={homeScore}
          showLogo={showLogos}
          colors={colors}
        />
      </View>
    </View>
  );
}

function TpMatchScorePanel({
  liveLabel,
  liveAwayScore,
  liveHomeScore,
  pickAwayScore,
  pickHomeScore,
  hasPick,
  postponed,
  awayTeam,
  homeTeam,
  colors,
}) {
  return (
    <View>
      <ScoreGridRow
        label={`${liveLabel}:`}
        awayTeam={awayTeam}
        homeTeam={homeTeam}
        awayScore={postponed ? null : liveAwayScore}
        homeScore={postponed ? null : liveHomeScore}
        showLogos={false}
        colors={colors}
      />

      {hasPick ? (
        <>
          <View style={{ height: 10 }} />
          <ScoreGridRow
            label={`${i18n.t("tp.results.predictionLine", { defaultValue: "Prédiction" })}:`}
            awayTeam={awayTeam}
            homeTeam={homeTeam}
            awayScore={pickAwayScore}
            homeScore={pickHomeScore}
            showLogos
            colors={colors}
          />
        </>
      ) : (
        <Text
          style={{
            color: colors.subtext,
            fontSize: 12,
            marginLeft: SCORE_LABEL_WIDTH,
            marginTop: 4,
          }}
        >
          {i18n.t("challenges.noPickForMatch", { defaultValue: "Aucune prédiction" })}
        </Text>
      )}
    </View>
  );
}

function MatchDivider() {
  return (
    <View
      style={{
        height: 1,
        backgroundColor: "rgba(239,68,68,0.24)",
        marginVertical: 10,
      }}
    />
  );
}

function SectionDivider() {
  return (
    <View
      style={{
        height: 1,
        backgroundColor: "rgba(239,68,68,0.32)",
        marginTop: 4,
        marginBottom: 12,
      }}
    />
  );
}

function SectionTitle({ children, colors }) {
  return (
    <Text style={{ color: colors.text, fontWeight: "800", fontSize: 13, marginBottom: 6 }}>
      {children}
    </Text>
  );
}

function resolveMatchPeriodLabel({
  slot,
  league,
  effectiveLiveGame,
  slotDecided,
  postponed,
}) {
  if (postponed) return null;
  if (slotDecided) return formatOfficialPeriodSuffix(slot, league);
  return String(effectiveLiveGame?.statusText || "").trim() || null;
}

function TpMatchResultRow({ slot, league, pick, pickResult, bundle, colors, liveGame, scheduleInfo = null }) {
  const awayAbbr = safeAbbr(slot?.awayAbbr);
  const homeAbbr = safeAbbr(slot?.homeAbbr);
  const awayTeam = lookupTeamByAbbr(league, awayAbbr);
  const homeTeam = lookupTeamByAbbr(league, homeAbbr);

  const slotDecided = isSlotDecided(slot);
  const slotStatus = String(slot?.status || "").toLowerCase();
  const postponed = isMlbGamePostponed(scheduleInfo?.status);
  const scheduleLive =
    league === "MLB" && scheduleInfo
      ? normalizeMlbScheduleGameForLive(scheduleInfo)
      : null;
  const effectiveLiveGame = liveGame || scheduleLive;
  const liveScores = getLiveScores(effectiveLiveGame);
  const hasLiveScores = liveScores.away != null && liveScores.home != null;
  const showLive =
    !postponed &&
    !slotDecided &&
    hasLiveScores &&
    (["live", "locked", "pending"].includes(slotStatus) || !!effectiveLiveGame?.isLive);

  const officialScores = getSlotOfficialScores(slot);
  const pickScores = getPickScores(pick);
  const hasPick = pickScores.away != null && pickScores.home != null;

  const resolved = slotDecided
    ? resolveTpPickResult({ pick, slot, pickResult, bundle })
    : showLive
    ? scoreTpPickAgainstLive(pick, slot, effectiveLiveGame, bundle)
    : null;

  const pointsLine = formatPickPoints(pickResult || resolved);
  const isProvisional = showLive && resolved?.provisional;

  const periodLabel = resolveMatchPeriodLabel({
    slot,
    league,
    effectiveLiveGame,
    slotDecided,
    postponed,
  });

  const liveAwayScore = slotDecided ? officialScores.away : showLive ? liveScores.away : null;
  const liveHomeScore = slotDecided ? officialScores.home : showLive ? liveScores.home : null;
  const liveLabel = slotDecided
    ? i18n.t("tp.results.officialScore", { defaultValue: "Résultat" })
    : i18n.t("tp.results.liveScore", { defaultValue: "Live" });

  const matchTask = resolveTpSlotMatchStatus(slot, { scheduleStatus: scheduleInfo?.status });

  return (
    <View style={{ paddingVertical: 2 }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 4,
          gap: 8,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", flex: 1, minWidth: 0 }}>
          <TeamLogoBadge team={awayTeam} size={22} colors={colors} />
          <Text
            style={{
              color: colors.text,
              fontWeight: "900",
              fontSize: 14,
              marginLeft: 8,
              marginRight: 8,
            }}
          >
            {awayAbbr}
          </Text>
          <Text style={{ color: colors.subtext, fontWeight: "900", fontSize: 14, marginRight: 8 }}>
            -
          </Text>
          <Text style={{ color: colors.text, fontWeight: "900", fontSize: 14, marginRight: 8 }}>
            {homeAbbr}
          </Text>
          <TeamLogoBadge team={homeTeam} size={22} colors={colors} />
        </View>

        <MatchTaskStatusChip task={matchTask} colors={colors} compact />
      </View>

      {periodLabel ? (
        <Text
          style={{
            color: colors.subtext,
            fontSize: 11,
            fontWeight: "700",
            marginTop: 1,
            lineHeight: 14,
          }}
        >
          {periodLabel}
        </Text>
      ) : null}

      <TpMatchScorePanel
        liveLabel={liveLabel}
        liveAwayScore={liveAwayScore}
        liveHomeScore={liveHomeScore}
        pickAwayScore={pickScores.away}
        pickHomeScore={pickScores.home}
        hasPick={hasPick}
        postponed={postponed}
        awayTeam={awayTeam}
        homeTeam={homeTeam}
        colors={colors}
      />

      {resolved != null && (isProvisional || slotDecided) ? (
        <View
          style={{
            marginTop: 8,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Text
            style={{
              color: isProvisional ? colors.subtext : colors.text,
              fontSize: 12,
              fontWeight: isProvisional ? "700" : "900",
              flex: 1,
            }}
          >
            {isProvisional
              ? i18n.t("tp.results.unconfirmedPoints", {
                  defaultValue: "{{points}} pt(s) non confirmés",
                  points: Number(resolved?.points ?? 0),
                })
              : pointsLine ||
                i18n.t("tp.results.noPoints", { defaultValue: "0 pt" })}
          </Text>
          {hasPick ? (
            <Ionicons
              name={resolved.winnerCorrect ? "checkmark-circle" : "close-circle"}
              size={18}
              color={resolved.winnerCorrect ? "#16a34a" : "#dc2626"}
              style={{ marginLeft: 8 }}
            />
          ) : null}
        </View>
      ) : null}

    </View>
  );
}

export default function TpResultDetailBlock({
  item,
  colors,
  myEntry = null,
  showLiveScores = false,
  scheduleByGameId = {},
}) {
  const { user } = useAuth();
  const uid = String(user?.uid || "");

  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showParticipantsModal, setShowParticipantsModal] = useState(false);

  const bundle = item?.raw || {};
  const bundleId = String(item?.id || bundle?.id || "");
  const league = String(bundle?.league || "NHL").toUpperCase() === "MLB" ? "MLB" : "NHL";
  const games = Array.isArray(bundle?.games) ? bundle.games : [];
  const gameCount = Number(bundle?.gameCount || games.length || 0);

  const myEntryEffective = useMemo(() => {
    const fromList = entries.find((e) => String(e.uid) === uid);
    return fromList || myEntry;
  }, [entries, uid, myEntry]);

  const picks = myEntryEffective?.picks || {};
  const pickResults = myEntryEffective?.pickResults || {};
  const totalPoints = Number(myEntryEffective?.totalPoints ?? 0);
  const hasParticipation = tpEntryHasParticipation(myEntryEffective);

  const participantTask = useMemo(
    () =>
      resolveParticipantTaskStatus(
        { kind: "tp", subtype: "bundle", raw: bundle },
        {
          isToday: showLiveScores,
          entry: myEntryEffective,
          scheduleByGameId,
        }
      ),
    [bundle, showLiveScores, myEntryEffective, scheduleByGameId]
  );

  const liveGameIds = useMemo(() => {
    if (!showLiveScores) return [];
    return games
      .filter((slot) => {
        const gameId = String(slot.gameId || "");
        if (isMlbGamePostponed(scheduleByGameId?.[gameId]?.status)) return false;
        return !isSlotDecided(slot);
      })
      .map((slot) => String(slot.gameId || ""))
      .filter(Boolean);
  }, [games, showLiveScores, scheduleByGameId]);

  const liveScores = useLiveGameScores(
    liveGameIds,
    league,
    bundle?.gameYmd || item?.dateKey
  );

  useEffect(() => {
    if (!bundleId) {
      setEntries([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const ref = firestore()
      .collection("team_prediction_bundles")
      .doc(bundleId)
      .collection("entries");

    const unsub = ref.onSnapshot(
      (snap) => {
        const list = snap.docs
          .map((d) => ({ uid: d.id, ...d.data() }))
          .filter((e) => tpEntryHasParticipation(e))
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
        unsub?.();
      } catch {}
    };
  }, [bundleId]);

  return (
    <View style={{ marginTop: 10 }}>
      <SectionTitle colors={colors}>
        {i18n.t("tp.results.matchupsSectionTitle", {
          defaultValue: "Matchs ({{count}})",
          count: gameCount,
        })}
      </SectionTitle>

      {games.map((slot, index) => {
        const gameId = String(slot.gameId || "");
        return (
          <View key={gameId}>
            <TpMatchResultRow
              slot={slot}
              league={league}
              bundle={bundle}
              pick={lookupPickByGameId(picks, gameId)}
              pickResult={lookupPickByGameId(pickResults, gameId)}
              colors={colors}
              liveGame={liveScores[gameId] || null}
              scheduleInfo={scheduleByGameId[gameId] || null}
            />
            {index < games.length - 1 ? <MatchDivider /> : null}
          </View>
        );
      })}

      <SectionDivider />

      <SectionTitle colors={colors}>
        {i18n.t("tp.results.summarySectionTitle", {
          defaultValue: "Mon bilan",
        })}
      </SectionTitle>

      {hasParticipation ? (
        <Text style={{ color: colors.text, fontSize: 13, fontWeight: "900" }}>
          {i18n.t("tp.results.myTotalPoints", {
            defaultValue: "Mes points : {{points}} pt(s)",
            points: totalPoints,
          })}
        </Text>
      ) : (
        <Text style={{ color: colors.subtext, fontSize: 13 }}>
          {formatParticipantTaskLabel(participantTask)}
        </Text>
      )}

      {!loading && entries.length > 0 ? (
        <TouchableOpacity
          onPress={() => setShowParticipantsModal(true)}
          activeOpacity={0.85}
          style={{
            marginTop: 10,
            flexDirection: "row",
            alignItems: "center",
            alignSelf: "flex-start",
          }}
        >
          <Text style={{ color: "#b91c1c", fontWeight: "800", fontSize: 13 }}>
            {i18n.t("challenges.viewOtherParticipantsPicks", {
              defaultValue: "Voir les choix des autres participants",
            })}
          </Text>
          <Text style={{ color: colors.subtext, fontSize: 13, marginLeft: 6 }}>
            ({entries.length})
          </Text>
          <Ionicons name="chevron-forward" size={14} color="#b91c1c" style={{ marginLeft: 2 }} />
        </TouchableOpacity>
      ) : loading ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 12 }}>
          <ActivityIndicator size="small" color={colors.subtext} />
        </View>
      ) : null}

      <TpParticipantsModal
        visible={showParticipantsModal}
        onClose={() => setShowParticipantsModal(false)}
        bundle={bundle}
        entries={entries}
        loading={loading}
        currentUid={uid}
        colors={colors}
      />
    </View>
  );
}
