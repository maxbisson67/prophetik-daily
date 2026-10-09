import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { snapshotExists, snapshotData, snapshotId } from "@src/lib/safeSnapshot";
import {
  View,
  Text,
  ActivityIndicator,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Modal,
  ScrollView,
  Pressable,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useTheme } from "@src/theme/ThemeProvider";
import useLiveBoardGames from "@src/live/useLiveBoardGames";
import firestore from "@react-native-firebase/firestore";
import functions from "@react-native-firebase/functions";
import i18n from "@src/i18n/i18n";
import TeamLogoBadge from "@src/sports/TeamLogoBadge";
import MlbLiveSituation, { mlbLiveSituation } from "@src/sports/MlbLiveSituation";
import MlbLiveLineupPanel from "@src/sports/MlbLiveLineupPanel";
import MlbLinescoreTable from "@src/sports/MlbLinescoreTable";
import MlbScoringSummary from "@src/sports/MlbScoringSummary";
import { addDaysToYmd } from "@src/lib/prophetikBusinessDate";
import { useProphetikBusinessYmd } from "@src/hooks/useProphetikBusinessDate";
import { useTeamsBySport } from "@src/groups/hooks/useTeamsBySport";
import { lookupTeamByAbbr } from "@src/groups/data/fallbackTeams";
import {
  formatMlbLiveInningLabel,
} from "@src/mlb/mlbInningLabel";
import { isMlbGameDelayed } from "@src/mlb/mlbGameStatusUtils";
import { formatMlbTeamDisplayName } from "@src/mlb/mlbTeamDisplayName";
import { useAuth } from "@src/auth/SafeAuthProvider";
import { useSelectedGroup } from "@src/groups/SelectedGroupProvider";
import {
  lookupByGameId,
  liveBoardGameId,
} from "@src/live/liveChallengeModels";
import useTodayLiveChallenges from "@src/live/useTodayLiveChallenges";
import LiveGameChallengeTags, {
  getActiveLiveChallengeKinds,
  getLiveRowHighlightStyle,
} from "@src/live/LiveGameChallengeTags";
import useFgcMutualizedGamesMap from "@src/firstGoal/useFgcMutualizedGamesMap";
import useMlbScheduleGames from "@src/mlb/useMlbScheduleGames";
import FgcChallengeModal from "@src/defis/results/FgcChallengeModal";
import TpMyPicksModal from "@src/defis/results/TpMyPicksModal";
import TsMyResultsModal from "@src/defis/results/TsMyResultsModal";
import { useRouter } from "expo-router";
import { useIsFocused } from "@react-navigation/native";
import useMlbLinescorePoll from "@src/mlb/useMlbLinescorePoll";
import { mergeMlbLinescoreOverlay, pickMlbLinescoreOverlayFields } from "@src/mlb/mlbLinescoreClient";

function fmtTime(d) {
  if (!d) return "—";
  let date;
  try {
    if (d?.toDate) date = d.toDate();
    else if (d instanceof Date) date = d;
    else date = new Date(d);
  } catch {
    return "—";
  }
  if (!date || isNaN(date.getTime())) return "—";
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function normalizeLiveGameDoc(docSnap) {
  const data = snapshotData(docSnap) || {};
  const gamePk = String(data.gamePk || snapshotId(docSnap) || "").trim();
  return {
    ...data,
    id: snapshotId(docSnap),
    gamePk: gamePk || snapshotId(docSnap),
  };
}

function dedupeLiveGames(list) {
  const byKey = new Map();
  for (const g of list) {
    const key = String(g.gamePk || g.id || "").trim();
    if (!key) continue;
    byKey.set(key, g);
  }
  return [...byKey.values()];
}
function gStartMillis(g) {
  const t = g?.startTimeUTC;
  if (!t) return 0;
  try {
    if (t?.toDate) return t.toDate().getTime();
    return new Date(t).getTime();
  } catch {
    return 0;
  }
}

function inningLabel(game) {
  if (game?.isFinal) return i18n.t("live.status.final", "Final");
  if (!game?.isLive && !isMlbGameDelayed(game)) return null;

  const inning = formatMlbLiveInningLabel(game);
  if (isMlbGameDelayed(game)) return inning || null;
  return inning || i18n.t("live.status.live", "LIVE");
}

function mlbDetailStatus(game) {
  if (!game) return "";
  if (game.isFinal) {
    return game.detailedState || i18n.t("live.status.final", "Final");
  }
  if (isMlbGameDelayed(game)) {
    return formatMlbLiveInningLabel(game) || i18n.t("live.mlb.delayed", "Retardé");
  }
  if (game.isLive) {
    const inning = inningLabel(game);
    return inning || i18n.t("live.status.live", "LIVE");
  }
  if (game.isPostponed) {
    return i18n.t("live.mlb.postponed", "Reporté");
  }
  return game.startTimeUTC
    ? i18n.t("live.detail.startAt", {
        defaultValue: "Début: {{time}}",
        time: fmtTime(game.startTimeUTC),
      })
    : i18n.t("live.detail.startUnknown", "Heure de début inconnue");
}

function useMlbTeamForAbbr() {
  const { teams } = useTeamsBySport("MLB");

  return useMemo(() => {
    const byAbbr = new Map(
      teams.map((team) => [String(team.abbreviation || "").trim().toUpperCase(), team])
    );

    return (abbr) => {
      const key = String(abbr || "").trim().toUpperCase();
      if (!key) return null;
      return byAbbr.get(key) || lookupTeamByAbbr("MLB", key);
    };
  }, [teams]);
}

function GameRow({
  game,
  onPress,
  colors,
  isDark,
  teamForAbbr,
  fgcItem = null,
  fgcMyPick = null,
  tpSlot = null,
  tpMyPick = null,
  tpPickResult = null,
  tsPlayers = [],
  mutualizedGame = null,
  onPressFgc,
  onPressTp,
  onPressTs,
}) {
  const challengeKinds = getActiveLiveChallengeKinds({
    fgcItem,
    fgcMyPick,
    tpSlot,
    tpMyPick,
    tsPlayers,
  });
  const highlightStyle = getLiveRowHighlightStyle(colors, challengeKinds, { isDark });

  const { homeAbbr, awayAbbr, homeScore, awayScore, startTimeUTC, isLive, isFinal } = game;
  const delayed = isMlbGameDelayed(game);
  const label = inningLabel(game);
  const awayTeam = teamForAbbr(awayAbbr);
  const homeTeam = teamForAbbr(homeAbbr);
  const awayLabel = formatMlbTeamDisplayName(awayTeam, awayAbbr);
  const homeLabel = formatMlbTeamDisplayName(homeTeam, homeAbbr);
  const gameId = String(game?.gamePk || game?.id || "").trim();

  const showLiveSituation = (isLive || delayed) && !!mlbLiveSituation(game);
  const liveStatusLabel = delayed
    ? i18n.t("live.mlb.delayed", "Retardé")
    : i18n.t("live.status.live", "LIVE");
  const liveStatusColor = delayed ? "#f59e0b" : "#dc2626";

  const showStatusRow = isLive || delayed;
  const rightMetaLabel = !showStatusRow ? label : null;

  const statusRow = showStatusRow ? (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "flex-end",
        flexWrap: "wrap",
        gap: 6,
        marginBottom: showLiveSituation ? 6 : 0,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <View
          style={{
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: liveStatusColor,
            marginRight: 6,
          }}
        />
        <Text style={{ color: liveStatusColor, fontWeight: "800", fontSize: 13 }}>
          {liveStatusLabel}
        </Text>
      </View>
      {label ? (
        <>
          <Text style={{ color: colors.subtext, fontWeight: "700" }}>·</Text>
          <Text
            style={{
              color: isFinal ? colors.subtext : colors.text,
              fontWeight: "700",
              fontSize: 13,
              textAlign: "right",
            }}
          >
            {label}
          </Text>
        </>
      ) : null}
    </View>
  ) : null;

  return (
    <View
      style={{
        padding: 12,
        borderRadius: 12,
        marginBottom: 10,
        ...highlightStyle,
      }}
    >
      <LiveGameChallengeTags
        colors={colors}
        sport="MLB"
        fgcItem={fgcItem}
        fgcMyPick={fgcMyPick}
        tpSlot={tpSlot}
        tpMyPick={tpMyPick}
        tpPickResult={tpPickResult}
        teamForAbbr={teamForAbbr}
        tsPlayers={tsPlayers}
        mutualizedGame={mutualizedGame}
        onPressFgc={onPressFgc}
        onPressTp={onPressTp}
        onPressTs={onPressTs}
      />

      <TouchableOpacity onPress={() => onPress?.(game)} activeOpacity={0.85}>
        <View
          style={{
            flexDirection: "row",
            alignItems: showLiveSituation || showStatusRow ? "flex-start" : "center",
            gap: 10,
          }}
        >
          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 4 }}>
              <TeamLogoBadge team={awayTeam || { sport: "MLB", abbreviation: awayAbbr }} size={22} colors={colors} />
              <Text
                style={{ color: colors.text, fontWeight: "600", flex: 1, marginLeft: 8 }}
                numberOfLines={1}
              >
                {awayLabel}
              </Text>
              <Text
                style={{
                  color: colors.text,
                  fontWeight: "700",
                  fontSize: 16,
                  minWidth: 28,
                  textAlign: "right",
                  fontVariant: ["tabular-nums"],
                }}
              >
                {awayScore ?? "—"}
              </Text>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <TeamLogoBadge team={homeTeam || { sport: "MLB", abbreviation: homeAbbr }} size={22} colors={colors} />
              <Text
                style={{ color: colors.text, fontWeight: "600", flex: 1, marginLeft: 8 }}
                numberOfLines={1}
              >
                {homeLabel}
              </Text>
              <Text
                style={{
                  color: colors.text,
                  fontWeight: "700",
                  fontSize: 16,
                  minWidth: 28,
                  textAlign: "right",
                  fontVariant: ["tabular-nums"],
                }}
              >
                {homeScore ?? "—"}
              </Text>
            </View>
          </View>

          {showLiveSituation || showStatusRow || rightMetaLabel ? (
            <View style={{ flexShrink: 0, alignItems: "flex-end", maxWidth: 148 }}>
              {statusRow}
              {showLiveSituation ? (
                <MlbLiveSituation game={game} colors={colors} isDark={isDark} compact />
              ) : rightMetaLabel ? (
                <Text
                  style={{
                    color: isFinal ? colors.subtext : colors.text,
                    fontWeight: "700",
                    fontSize: 13,
                    textAlign: "right",
                  }}
                >
                  {rightMetaLabel}
                </Text>
              ) : !showStatusRow ? (
                <Text style={{ color: colors.subtext, fontWeight: "600", fontSize: 13 }}>
                  {fmtTime(startTimeUTC)}
                </Text>
              ) : null}
            </View>
          ) : (
            <Text style={{ color: colors.subtext, fontWeight: "600", fontSize: 13, flexShrink: 0 }}>
              {fmtTime(startTimeUTC)}
            </Text>
          )}
        </View>
      </TouchableOpacity>
    </View>
  );
}

function GameDetailModal({ visible, onClose, game, colors, isDark, teamForAbbr }) {
  const insets = useSafeAreaInsets();
  const [gameDoc, setGameDoc] = useState(null);
  const [scoringPlays, setScoringPlays] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const gamePk = String(game?.gamePk || game?.id || "").trim();
    if (!visible || !gamePk) {
      setGameDoc(null);
      setScoringPlays([]);
      setLoading(false);
      return undefined;
    }

    const ref = firestore().collection("mlb_live_games").doc(gamePk);
    setLoading(true);

    const unsubGame = ref.onSnapshot(
      (snap) => setGameDoc(snapshotExists(snap) ? { id: snapshotId(snap), ...snapshotData(snap) } : null),
      () => {}
    );

    const unsubPlays = ref
      .collection("scoring_plays")
      .orderBy("inning", "asc")
      .onSnapshot(
        (snap) => {
          setScoringPlays((snap?.docs ?? []).map((d) => ({ id: d.id, ...d.data() })));
          setLoading(false);
        },
        () => setLoading(false)
      );

    return () => {
      try {
        unsubGame();
      } catch {}
      try {
        unsubPlays();
      } catch {}
    };
  }, [visible, game?.gamePk, game?.id]);

  const g = useMemo(() => {
    if (!game) return null;
    const base = gameDoc ? { ...game, ...gameDoc } : game;
    const overlay = pickMlbLinescoreOverlayFields(game);
    return mergeMlbLinescoreOverlay(base, overlay);
  }, [game, gameDoc]);

  if (!visible || !g) return null;

  const awayTeam = teamForAbbr(g.awayAbbr);
  const homeTeam = teamForAbbr(g.homeAbbr);
  const awayLabel = formatMlbTeamDisplayName(awayTeam, g.awayAbbr);
  const homeLabel = formatMlbTeamDisplayName(homeTeam, g.homeAbbr);
  const awayScore = g.awayScore ?? "—";
  const homeScore = g.homeScore ?? "—";
  const statusText = mlbDetailStatus(g);
  const isLive = !!g.isLive;
  const isFinal = !!g.isFinal;

  const teamNameStyle = {
    color: "#f8fafc",
    fontWeight: "900",
    fontSize: 12,
    marginTop: 8,
    letterSpacing: 0.2,
    textAlign: "center",
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View
        style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" }}
      >
        <Pressable style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0 }} onPress={onClose} />

        <View
          style={{
            backgroundColor: colors.background,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            maxHeight: "88%",
            paddingBottom: Math.max(insets.bottom, 12),
          }}
        >
          <View style={{ alignItems: "center", paddingTop: 10, paddingBottom: 4 }}>
            <View
              style={{
                width: 48,
                height: 4,
                borderRadius: 2,
                backgroundColor: colors.border,
              }}
            />
          </View>

          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              paddingHorizontal: 16,
              paddingBottom: 8,
            }}
          >
            <Text style={{ flex: 1, fontSize: 18, fontWeight: "800", color: colors.text }}>
              {i18n.t("live.detail.title", "Détail du match")}
            </Text>
            <TouchableOpacity onPress={onClose} hitSlop={12}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: 16 }}
            showsVerticalScrollIndicator
            nestedScrollEnabled
          >
            <LinearGradient
              colors={["#041E42", "#0c2d52", "#132f4c"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{
                marginHorizontal: 16,
                borderRadius: 18,
                paddingVertical: 18,
                paddingHorizontal: 14,
                marginBottom: 12,
              }}
            >
            {isLive ? (
              <View
                style={{
                  alignSelf: "center",
                  flexDirection: "row",
                  alignItems: "center",
                  backgroundColor: "rgba(220,38,38,0.2)",
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                  borderRadius: 999,
                  marginBottom: 12,
                }}
              >
                <View
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: "#ef4444",
                    marginRight: 6,
                  }}
                />
                <Text style={{ color: "#fecaca", fontWeight: "900", fontSize: 12, letterSpacing: 1 }}>
                  {i18n.t("live.status.live", "LIVE")}
                </Text>
              </View>
            ) : null}

            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <View style={{ flex: 1, alignItems: "center", paddingHorizontal: 4 }}>
                <TeamLogoBadge
                  team={awayTeam || { sport: "MLB", abbreviation: g.awayAbbr }}
                  size={44}
                  colors={colors}
                />
                <Text
                  style={teamNameStyle}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  {awayLabel}
                </Text>
                <Text
                  style={{
                    color: "#fff",
                    fontWeight: "900",
                    fontSize: 40,
                    lineHeight: 44,
                    marginTop: 4,
                    fontVariant: ["tabular-nums"],
                  }}
                >
                  {awayScore}
                </Text>
              </View>

              <View style={{ alignItems: "center", paddingHorizontal: 8, minWidth: 72 }}>
                <MaterialCommunityIcons name="baseball" size={22} color="rgba(255,255,255,0.35)" />
                <Text
                  style={{
                    color: isLive ? "#fca5a5" : isFinal ? "#94a3b8" : "#cbd5e1",
                    fontWeight: "800",
                    fontSize: 13,
                    textAlign: "center",
                    marginTop: 8,
                  }}
                >
                  {statusText}
                </Text>
              </View>

              <View style={{ flex: 1, alignItems: "center", paddingHorizontal: 4 }}>
                <TeamLogoBadge
                  team={homeTeam || { sport: "MLB", abbreviation: g.homeAbbr }}
                  size={44}
                  colors={colors}
                />
                <Text
                  style={teamNameStyle}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  {homeLabel}
                </Text>
                <Text
                  style={{
                    color: "#fff",
                    fontWeight: "900",
                    fontSize: 40,
                    lineHeight: 44,
                    marginTop: 4,
                    fontVariant: ["tabular-nums"],
                  }}
                >
                  {homeScore}
                </Text>
              </View>
            </View>

            {isLive ? (
              <View
                style={{
                  marginTop: 14,
                  paddingTop: 12,
                  borderTopWidth: 1,
                  borderTopColor: "rgba(255,255,255,0.12)",
                  flexDirection: "row",
                  justifyContent: "center",
                }}
              >
                <MlbLiveSituation game={g} colors={colors} isDark={isDark} light showRunnersCount />
              </View>
            ) : null}

            {g.venue ? (
              <Text
                style={{
                  color: "rgba(255,255,255,0.55)",
                  textAlign: "center",
                  fontSize: 12,
                  marginTop: 12,
                }}
              >
                {g.venue}
              </Text>
            ) : null}
          </LinearGradient>

            <View style={{ paddingHorizontal: 16 }}>
            <MlbLinescoreTable game={g} colors={colors} />

            <MlbLiveLineupPanel
              game={g}
              colors={colors}
              teamForAbbr={teamForAbbr}
              enabled={visible}
            />

            <MlbScoringSummary
              game={g}
              plays={scoringPlays}
              loading={loading}
              colors={colors}
              teamForAbbr={teamForAbbr}
            />
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

export default function MlbMatchLiveScreen() {
  const { colors, isDark } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const { selectedGroupId: currentGroupId } = useSelectedGroup();
  const teamForAbbr = useMlbTeamForAbbr();
  const [refreshing, setRefreshing] = useState(false);
  const todayKey = useProphetikBusinessYmd();
  const yesterdayKey = useMemo(() => addDaysToYmd(todayKey, -1), [todayKey]);
  const [selectedGame, setSelectedGame] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [fgcModalItem, setFgcModalItem] = useState(null);
  const [tpModalItem, setTpModalItem] = useState(null);
  const [tsModalOpen, setTsModalOpen] = useState(false);

  const challengeExtraYmds = useMemo(() => [yesterdayKey], [yesterdayKey]);

  const {
    fgcByGameId,
    fgcItems,
    fgcPickByGameId,
    tpByGameId,
    tpBundleItem,
    tpEntry,
    tpEntryByBundleId,
    tpPickByGameId,
    tpPickResultByGameId,
    tsItem,
    tsByGameId,
    tsEntry,
  } = useTodayLiveChallenges({
    groupId: currentGroupId,
    league: "MLB",
    extraYmds: challengeExtraYmds,
    userId: user?.uid,
    enabled: !!currentGroupId,
  });

  const mutualizedChallenges = useMemo(
    () => fgcItems.map((item) => item?.raw || item),
    [fgcItems]
  );
  const mutualizedGamesByGameId = useFgcMutualizedGamesMap(mutualizedChallenges, {
    enabled: mutualizedChallenges.length > 0,
  });

  const mlbScheduleTargets = useMemo(() => {
    const targets = [];
    const seen = new Set();

    Object.values(fgcByGameId).forEach((item) => {
      const gameYmd = item?.raw?.gameYmd || item?.dateKey;
      const gameId = item?.raw?.gameId || item?.raw?.gamePk;
      const key = `${gameYmd}|${gameId}`;
      if (gameYmd && gameId && !seen.has(key)) {
        seen.add(key);
        targets.push({ gameYmd, gameId });
      }
    });

    if (tpBundleItem?.raw?.games) {
      const gameYmd = tpBundleItem?.raw?.gameYmd || tpBundleItem?.dateKey;
      tpBundleItem.raw.games.forEach((slot) => {
        const gameId = slot?.gameId;
        const key = `${gameYmd}|${gameId}`;
        if (gameYmd && gameId && !seen.has(key)) {
          seen.add(key);
          targets.push({ gameYmd, gameId });
        }
      });
    }

    return targets;
  }, [fgcByGameId, tpBundleItem]);

  const scheduleByGameId = useMlbScheduleGames(mlbScheduleTargets);

  const handlePressFgc = useCallback((item) => {
    setFgcModalItem(item);
  }, []);

  const handlePressTp = useCallback((item) => {
    setTpModalItem(item);
  }, []);

  const handlePressTs = useCallback(() => {
    setTsModalOpen(true);
  }, []);

  const { games: todayBoardGames, loading: loadingToday } = useLiveBoardGames({
    league: "mlb",
    ymd: todayKey,
  });

  const { games: yesterdayBoardGames, loading: loadingYesterday } = useLiveBoardGames({
    league: "mlb",
    ymd: yesterdayKey,
  });

  const loading = loadingToday || loadingYesterday;

  const games = useMemo(() => {
    const carryover = (yesterdayBoardGames || []).filter(
      (g) => g.isLive || (!g.isFinal && !g.isPostponed)
    );
    const list = dedupeLiveGames(
      [...carryover, ...(todayBoardGames || [])].map((g) => ({
        ...g,
        id: g.id || g.gamePk,
        gamePk: g.gamePk || g.id,
      }))
    );
    list.sort((a, b) => gStartMillis(a) - gStartMillis(b));
    return list;
  }, [todayBoardGames, yesterdayBoardGames]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const liveFn = functions().httpsCallable("updateMlbLiveGamesNow");
      const schedFn = functions().httpsCallable("updateMlbScheduleWindowNow");

      for (const ymd of [todayKey, yesterdayKey]) {
        let res = await liveFn({ date: ymd });
        const scheduleCount = res?.data?.stats?.games ?? -1;

        if (scheduleCount === 0) {
          await schedFn({ startYmd: ymd, endYmd: ymd });
          await liveFn({ date: ymd });
        }
      }
    } catch (e) {
      console.log("[MlbMatchLive] refresh error", e?.message || e);
    } finally {
      setRefreshing(false);
    }
  }, [todayKey, yesterdayKey]);

  const lastBootstrapKeyRef = useRef(null);

  useEffect(() => {
    if (lastBootstrapKeyRef.current === todayKey) return;
    lastBootstrapKeyRef.current = todayKey;
    onRefresh();
  }, [todayKey, onRefresh]);

  const sortedGames = useMemo(() => {
    const isLiveGame = (g) =>
      g.isLive || String(g.abstractGameState || "").toLowerCase() === "live";
    const live = games.filter(isLiveGame);
    const upcoming = games.filter((g) => !isLiveGame(g) && !g.isFinal);
    const final = games.filter((g) => g.isFinal);
    return [...live, ...upcoming, ...final];
  }, [games]);

  const isFocused = useIsFocused();
  const livePollPks = useMemo(
    () =>
      sortedGames
        .filter((g) => (g.isLive || String(g.abstractGameState || "").toLowerCase() === "live") && !g.isPostponed)
        .map((g) => String(g.gamePk || g.id || "").trim())
        .filter(Boolean),
    [sortedGames]
  );

  const linescoreOverlays = useMlbLinescorePoll({
    gamePks: livePollPks,
    enabled: isFocused && livePollPks.length > 0,
  });

  const displayGames = useMemo(
    () =>
      sortedGames.map((game) => {
        const pk = String(game.gamePk || game.id || "").trim();
        return mergeMlbLinescoreOverlay(game, linescoreOverlays[pk]);
      }),
    [sortedGames, linescoreOverlays]
  );

  const selectedGameDisplay = useMemo(() => {
    if (!selectedGame) return null;
    const pk = String(selectedGame.gamePk || selectedGame.id || "").trim();
    const fromList = displayGames.find((g) => String(g.gamePk || g.id || "").trim() === pk);
    return fromList || mergeMlbLinescoreOverlay(selectedGame, linescoreOverlays[pk]);
  }, [selectedGame, displayGames, linescoreOverlays]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, padding: 16 }}>
      <FgcChallengeModal
        visible={!!fgcModalItem}
        item={fgcModalItem}
        colors={colors}
        hidePickCta
        onClose={() => setFgcModalItem(null)}
      />

      <TpMyPicksModal
        visible={!!tpModalItem}
        item={tpModalItem}
        myEntry={tpEntryByBundleId[String(tpModalItem?.id || "")] || tpEntry}
        colors={colors}
        scheduleByGameId={scheduleByGameId}
        onClose={() => setTpModalItem(null)}
      />

      <TsMyResultsModal
        visible={tsModalOpen}
        item={tsItem}
        myEntry={tsEntry}
        colors={colors}
        onClose={() => setTsModalOpen(false)}
      />

      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 24 }} />
      ) : (
        <FlatList
          data={displayGames}
          keyExtractor={(item) => String(item.gamePk || item.id)}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <Text style={{ color: colors.subtext, textAlign: "center", marginTop: 24 }}>
              {i18n.t("live.mlb.noGames", "Aucun match pour cette journée.")}
            </Text>
          }
          renderItem={({ item }) => {
            const gameId = liveBoardGameId(item);
            return (
              <GameRow
                game={item}
                colors={colors}
                isDark={isDark}
                teamForAbbr={teamForAbbr}
                fgcItem={lookupByGameId(fgcByGameId, gameId)}
                fgcMyPick={lookupByGameId(fgcPickByGameId, gameId)}
                tpSlot={lookupByGameId(tpByGameId, gameId)}
                tpMyPick={lookupByGameId(tpPickByGameId, gameId)}
                tpPickResult={lookupByGameId(tpPickResultByGameId, gameId)}
                tsPlayers={lookupByGameId(tsByGameId, gameId) || []}
                mutualizedGame={lookupByGameId(mutualizedGamesByGameId, gameId)}
                onPressFgc={handlePressFgc}
                onPressTp={handlePressTp}
                onPressTs={handlePressTs}
                onPress={(g) => {
                  setSelectedGame(g);
                  setModalVisible(true);
                }}
              />
            );
          }}
        />
      )}

      <GameDetailModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        game={selectedGameDisplay}
        colors={colors}
        isDark={isDark}
        teamForAbbr={teamForAbbr}
      />
    </View>
  );
}
