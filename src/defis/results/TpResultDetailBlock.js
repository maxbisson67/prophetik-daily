import React, { useEffect, useMemo, useState } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import firestore from "@react-native-firebase/firestore";

import i18n from "@src/i18n/i18n";
import { useTheme } from "@src/theme/ThemeProvider";
import { useAuth } from "@src/auth/SafeAuthProvider";
import TeamLogoBadge from "@src/sports/TeamLogoBadge";
import { lookupTeamByAbbr } from "@src/groups/data/fallbackTeams";
import TpParticipantsModal from "@src/defis/results/TpParticipantsModal";
import { tpEntryHasParticipation } from "@src/defis/results/challengeResultsModel";
import {
  formatParticipantTaskLabel,
  resolveParticipantTaskStatus,
} from "@src/defis/participant/participantTaskStatus";
import {
  MATCH_TASK_STATES,
  resolveTpSlotMatchStatus,
  shouldShowTpStartTimeLabel,
} from "@src/defis/match/matchTaskStatus";
import TpMatchMetaColumn from "@src/defis/TpMatchMetaColumn";
import {
  formatTpBravoBadgeLabel,
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
import { fmtTimeShort } from "@src/defis/tpDeadlineHelpers";
import useLiveGameScores, {
  normalizeMlbScheduleGameForLive,
} from "@src/defis/results/useLiveGameScores";
import {
  getPickBravoHighlightTheme,
  PickBravoBadge,
  PickOopsBadge,
} from "@src/defis/results/PickResultTags";
import {
  RESULTS_ACCENT,
  RESULTS_ACCENT_DIVIDER,
  RESULTS_ACCENT_DIVIDER_STRONG,
} from "@src/defis/results/resultsTheme";

function safeAbbr(v) {
  return String(v || "").trim().toUpperCase();
}

function formatScoreValue(v) {
  return v != null && Number.isFinite(Number(v)) ? String(v) : "—";
}

const LOGO_SIZE = 22;
const TEAM_COL_WIDTH = 56;
const AT_COL_WIDTH = 24;
const SCORE_COL_WIDTH = TEAM_COL_WIDTH;
const SCORE_BOX_HEIGHT = 44;
const SCORE_ROW_GAP = 8;
const SCORE_LABEL_COL_WIDTH = 92;

const ABBR_TEXT = {
  fontWeight: "900",
  fontSize: 14,
};

function scoreBoxBorderStyle(colors, highlight = null) {
  if (highlight) {
    return {
      borderWidth: highlight.borderWidth ?? 1.5,
      borderColor: highlight.borderColor,
    };
  }

  return {
    borderWidth: StyleSheet.hairlineWidth > 0 ? StyleSheet.hairlineWidth * 2 : 1,
    borderColor: colors.subtext,
  };
}

function ScoreBox({ value, colors, highlight = null }) {
  return (
    <View
      style={{
        width: SCORE_COL_WIDTH,
        minHeight: SCORE_BOX_HEIGHT,
        paddingVertical: 6,
        paddingHorizontal: 6,
        borderRadius: 8,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: highlight?.backgroundColor ?? colors.card,
        ...scoreBoxBorderStyle(colors, highlight),
      }}
    >
      <Text
        style={{
          color: colors.text,
          fontWeight: "900",
          fontSize: 17,
          fontVariant: ["tabular-nums"],
        }}
      >
        {formatScoreValue(value)}
      </Text>
    </View>
  );
}

function ScoreRowLabel({ children, colors }) {
  return (
    <Text
      style={{
        color: colors.subtext,
        fontSize: 12,
        fontWeight: "800",
        textAlign: "left",
      }}
      numberOfLines={2}
    >
      {children}
    </Text>
  );
}

/** Une rangée matchup : ABBR + logo | @ | logo + ABBR — partagée en-tête et scores. */
function MatchupColumnRow({
  awayAbbr,
  homeAbbr,
  colors,
  awaySlot,
  atSlot = null,
  homeSlot,
  abbrVisible = true,
  style = null,
}) {
  const abbrStyle = {
    ...ABBR_TEXT,
    color: colors.text,
    opacity: abbrVisible ? 1 : 0,
  };

  return (
    <View style={[{ flexDirection: "row", alignItems: "center" }, style]}>
      <Text style={[abbrStyle, { marginRight: 4 }]} numberOfLines={1}>
        {awayAbbr}
      </Text>

      <View style={{ width: TEAM_COL_WIDTH, alignItems: "center" }}>{awaySlot}</View>

      <View
        style={{
          width: AT_COL_WIDTH,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {atSlot}
      </View>

      <View style={{ width: TEAM_COL_WIDTH, alignItems: "center" }}>{homeSlot}</View>

      <Text style={[abbrStyle, { marginLeft: 4 }]} numberOfLines={1}>
        {homeAbbr}
      </Text>
    </View>
  );
}

/** Colonnes logos alignées entre l'en-tête matchup et les rangées de scores. */
function MatchupLogoGrid({
  awayAbbr,
  homeAbbr,
  awayTeam,
  homeTeam,
  colors,
  startTimeLabel = null,
  matchTask = null,
  periodLabel = null,
  scoreRows = [],
  footer = null,
  hideTimeWhenStarted = false,
}) {
  const showStartTime = shouldShowTpStartTimeLabel(startTimeLabel, matchTask, {
    hideWhenStarted: hideTimeWhenStarted,
  });

  return (
    <View>
      <View
        style={{
          flexDirection: "row",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 8,
        }}
      >
        <View style={{ flex: 1, minWidth: 0 }}>
          <MatchupColumnRow
            awayAbbr={awayAbbr}
            homeAbbr={homeAbbr}
            colors={colors}
            awaySlot={<TeamLogoBadge team={awayTeam} size={LOGO_SIZE} colors={colors} />}
            atSlot={
              <Text
                style={{
                  color: colors.subtext,
                  fontWeight: "900",
                  fontSize: 14,
                }}
              >
                @
              </Text>
            }
            homeSlot={<TeamLogoBadge team={homeTeam} size={LOGO_SIZE} colors={colors} />}
          />
        </View>

        <TpMatchMetaColumn
          colors={colors}
          startTimeLabel={startTimeLabel}
          showStartTime={showStartTime}
          matchTask={matchTask}
        />
      </View>

      {periodLabel ? (
        <Text
          style={{
            color: colors.subtext,
            fontSize: 11,
            fontWeight: "700",
            marginTop: 2,
            lineHeight: 14,
          }}
        >
          {periodLabel}
        </Text>
      ) : null}

      {scoreRows.length ? (
        <View style={{ flexDirection: "row", alignItems: "flex-start", marginTop: 8 }}>
          <View style={{ flex: 1, alignItems: "flex-start" }}>
            {scoreRows.map((row, rowIndex) => (
              <MatchupColumnRow
                key={row.key}
                awayAbbr={awayAbbr}
                homeAbbr={homeAbbr}
                colors={colors}
                abbrVisible={false}
                style={{ marginTop: rowIndex > 0 ? SCORE_ROW_GAP : 0 }}
                awaySlot={
                  <ScoreBox value={row.awayScore} colors={colors} highlight={row.highlight} />
                }
                homeSlot={
                  <ScoreBox value={row.homeScore} colors={colors} highlight={row.highlight} />
                }
              />
            ))}
          </View>

          <View
            style={{
              width: SCORE_LABEL_COL_WIDTH,
              paddingLeft: 8,
            }}
          >
            {scoreRows.map((row, rowIndex) => (
              <View
                key={`${row.key}-label`}
                style={{
                  minHeight: SCORE_BOX_HEIGHT,
                  justifyContent: "center",
                  marginTop: rowIndex > 0 ? SCORE_ROW_GAP : 0,
                }}
              >
                <ScoreRowLabel colors={colors}>{row.label}</ScoreRowLabel>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {footer}
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
  awayAbbr,
  homeAbbr,
  awayTeam,
  homeTeam,
  colors,
  startTimeLabel = null,
  matchTask = null,
  periodLabel = null,
  bravoLabel = null,
  showOopsTag = false,
  wrongPickProvisional = false,
  isProvisional = false,
  isDark = false,
  bravoHighlightTheme = null,
}) {
  const scoreRows = [];

  if (hasPick) {
    scoreRows.push({
      key: "pick",
      label: i18n.t("tp.results.myGuess", { defaultValue: "Ma prédiction" }),
      awayScore: pickAwayScore,
      homeScore: pickHomeScore,
      highlight: bravoLabel ? bravoHighlightTheme : null,
    });
  }

  scoreRows.push({
    key: "live",
    label: liveLabel,
    awayScore: postponed ? null : liveAwayScore,
    homeScore: postponed ? null : liveHomeScore,
  });

  const footer = hasPick ? (
    <>
      {bravoLabel ? (
        <View
          style={[bravoHighlightTheme?.bandeau, { alignItems: "flex-end", marginTop: 10 }]}
        >
          <PickBravoBadge label={bravoLabel} provisional={isProvisional} isDark={isDark} />
        </View>
      ) : showOopsTag || wrongPickProvisional ? (
        <View style={{ alignItems: "flex-end", marginTop: 10 }}>
          <PickOopsBadge isDark={isDark} provisional={wrongPickProvisional} />
        </View>
      ) : null}
    </>
  ) : (
    <Text
      style={{
        color: colors.subtext,
        fontSize: 12,
        marginTop: 8,
        textAlign: "center",
      }}
    >
      {i18n.t("challenges.noPickForMatch", { defaultValue: "Aucune prédiction" })}
    </Text>
  );

  return (
    <MatchupLogoGrid
      awayAbbr={awayAbbr}
      homeAbbr={homeAbbr}
      awayTeam={awayTeam}
      homeTeam={homeTeam}
      colors={colors}
      startTimeLabel={startTimeLabel}
      matchTask={matchTask}
      periodLabel={periodLabel}
      scoreRows={scoreRows}
      footer={footer}
      hideTimeWhenStarted
    />
  );
}

function MatchDivider({ color = "rgba(239,68,68,0.24)" }) {
  return (
    <View
      style={{
        height: 1,
        backgroundColor: color,
        marginVertical: 10,
      }}
    />
  );
}

function SectionDivider({ color = "rgba(239,68,68,0.32)" }) {
  return (
    <View
      style={{
        height: 1,
        backgroundColor: color,
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
  scheduleInfo,
  matchTask,
}) {
  if (postponed) return null;
  if (slotDecided) return formatOfficialPeriodSuffix(slot, league);

  const fromLive = String(effectiveLiveGame?.statusText || "").trim();
  if (fromLive) return fromLive;

  if (matchTask?.state !== MATCH_TASK_STATES.IN_PROGRESS) return null;

  const lg = String(league || "NHL").toUpperCase();
  if (lg === "MLB" && scheduleInfo) {
    const normalized = normalizeMlbScheduleGameForLive({
      ...scheduleInfo,
      status: scheduleInfo?.status || {},
    });
    const text = String(normalized?.statusText || "").trim();
    if (text) return text;
  }

  return null;
}

function TpMatchResultRow({ slot, league, pick, pickResult, bundle, colors, liveGame, scheduleInfo = null }) {
  const { isDark } = useTheme();
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

  const isProvisional = showLive && resolved?.provisional;
  const bravoLabel =
    resolved?.winnerCorrect && hasPick
      ? formatTpBravoBadgeLabel(resolved, bundle, i18n.t.bind(i18n), {
          provisional: isProvisional,
        })
      : null;

  const showWrongPickProvisionalTag =
    !!resolved && hasPick && !resolved.winnerCorrect && isProvisional;
  const showOopsTag =
    !!resolved && hasPick && !resolved.winnerCorrect && slotDecided;

  const bravoHighlightTheme = bravoLabel
    ? getPickBravoHighlightTheme(isDark, { provisional: isProvisional })
    : null;

  const matchTask = resolveTpSlotMatchStatus(slot, { scheduleStatus: scheduleInfo?.status });

  const periodLabel = resolveMatchPeriodLabel({
    slot,
    league,
    effectiveLiveGame,
    slotDecided,
    postponed,
    scheduleInfo,
    matchTask,
  });

  const liveAwayScore = slotDecided ? officialScores.away : showLive ? liveScores.away : null;
  const liveHomeScore = slotDecided ? officialScores.home : showLive ? liveScores.home : null;
  const liveLabel = slotDecided
    ? i18n.t("tp.results.officialScore", { defaultValue: "Résultat" })
    : i18n.t("tp.results.liveScoreLine", { defaultValue: "Score live" });

  const startTimeLabel = fmtTimeShort(
    slot?.gameStartTimeUTC ?? scheduleInfo?.startTimeUTC ?? scheduleInfo?.gameDate ?? null
  );

  return (
    <View style={{ paddingVertical: 2 }}>
      <TpMatchScorePanel
        liveLabel={liveLabel}
        liveAwayScore={liveAwayScore}
        liveHomeScore={liveHomeScore}
        pickAwayScore={pickScores.away}
        pickHomeScore={pickScores.home}
        hasPick={hasPick}
        postponed={postponed}
        awayAbbr={awayAbbr}
        homeAbbr={homeAbbr}
        awayTeam={awayTeam}
        homeTeam={homeTeam}
        colors={colors}
        startTimeLabel={startTimeLabel}
        matchTask={matchTask}
        periodLabel={periodLabel}
        bravoLabel={bravoLabel}
        showOopsTag={showOopsTag}
        wrongPickProvisional={showWrongPickProvisionalTag}
        isProvisional={isProvisional}
        isDark={isDark}
        bravoHighlightTheme={bravoHighlightTheme}
      />
    </View>
  );
}

export default function TpResultDetailBlock({
  item,
  colors,
  myEntry = null,
  showLiveScores = false,
  scheduleByGameId = {},
  accentColor = RESULTS_ACCENT,
  dividerColor = RESULTS_ACCENT_DIVIDER,
  dividerColorStrong = RESULTS_ACCENT_DIVIDER_STRONG,
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
        if (isSlotDecided(slot)) return false;

        const scheduleInfo = scheduleByGameId?.[gameId] || null;
        const matchTask = resolveTpSlotMatchStatus(slot, {
          scheduleStatus: scheduleInfo?.status,
        });
        if (matchTask.state === MATCH_TASK_STATES.IN_PROGRESS) return true;

        const slotStatus = String(slot?.status || "").toLowerCase();
        return ["live", "locked", "pending"].includes(slotStatus);
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
        const list = (snap?.docs ?? [])
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
            {index < games.length - 1 ? <MatchDivider color={dividerColor} /> : null}
          </View>
        );
      })}

      <SectionDivider color={dividerColorStrong} />

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
