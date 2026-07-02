import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import MlbLiveSituation from "@src/sports/MlbLiveSituation";
import { APP_TZ, toYmdInTz } from "@src/lib/prophetikBusinessDate";
import { useTeamsBySport } from "@src/groups/hooks/useTeamsBySport";
import { lookupTeamByAbbr } from "@src/groups/data/fallbackTeams";
import {
  formatMlbHalfInningLabel,
  formatMlbLiveInningLabel,
} from "@src/mlb/mlbInningLabel";

/** Aligné sur `todayAppYmd()` côté Functions (Toronto, sans bascule 4h/9h). */
function computeMlbLiveQueryYmd(now = new Date()) {
  return toYmdInTz(now, APP_TZ);
}

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
  const data = docSnap.data() || {};
  const gamePk = String(data.gamePk || docSnap.id || "").trim();
  return {
    ...data,
    id: docSnap.id,
    gamePk: gamePk || docSnap.id,
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
  if (!game?.isLive) return null;
  return formatMlbLiveInningLabel(game) || i18n.t("live.status.live", "LIVE");
}

function mlbDetailStatus(game) {
  if (!game) return "";
  if (game.isFinal) {
    return game.detailedState || i18n.t("live.status.final", "Final");
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

function halfInningLabel(half, inning) {
  const label = formatMlbHalfInningLabel(half, inning);
  if (label) return label;
  return String(half || "");
}

function scoringPlaysByInning(plays = []) {
  const map = new Map();

  for (const play of plays) {
    const inning = play?.inning ?? "?";
    const half = String(play?.halfInning || "");
    const key = `${inning}-${half}`;

    if (!map.has(key)) {
      map.set(key, { inning, halfInning: half, plays: [] });
    }
    map.get(key).plays.push(play);
  }

  return [...map.values()].sort((a, b) => {
    const ai = Number(a.inning) || 0;
    const bi = Number(b.inning) || 0;
    if (ai !== bi) return ai - bi;
    const order = { top: 0, bottom: 1 };
    return (order[String(a.halfInning).toLowerCase()] ?? 0) - (order[String(b.halfInning).toLowerCase()] ?? 0);
  });
}

function battingTeamAbbrForPlay(play, game) {
  const explicit = String(play?.battingTeamAbbr || "").trim();
  if (explicit) return explicit;
  const half = String(play?.halfInning || "").toLowerCase();
  if (half === "top") return game?.awayAbbr;
  if (half === "bottom") return game?.homeAbbr;
  return null;
}

function eventTypeChip(eventType, colors) {
  const key = String(eventType || "").toLowerCase();
  let i18nKey = "live.mlb.eventFallback";
  let defaultLabel = "Scoring play";
  let bg = colors.card2 || colors.card;
  let fg = colors.subtext;

  if (key.includes("home_run")) {
    i18nKey = "live.mlb.homeRun";
    defaultLabel = "HR";
    bg = "rgba(220,38,38,0.15)";
    fg = "#dc2626";
  } else if (key.includes("triple")) {
    i18nKey = "live.mlb.triple";
    defaultLabel = "3B";
    bg = "rgba(37,99,235,0.12)";
    fg = "#2563eb";
  } else if (key.includes("double")) {
    i18nKey = "live.mlb.double";
    defaultLabel = "2B";
    bg = "rgba(37,99,235,0.1)";
    fg = "#1d4ed8";
  } else if (key.includes("single")) {
    i18nKey = "live.mlb.single";
    defaultLabel = "1B";
  } else if (key.includes("sac_fly")) {
    i18nKey = "live.mlb.sacFly";
    defaultLabel = "Sac fly";
  } else if (key.includes("sac_bunt") || key.includes("sacrifice_bunt")) {
    i18nKey = "live.mlb.sacBunt";
    defaultLabel = "Sac bunt";
  } else if (key.includes("field_error") || key.includes("error")) {
    i18nKey = "live.mlb.fieldError";
    defaultLabel = "Field error";
  } else if (key.includes("wild_pitch")) {
    i18nKey = "live.mlb.wildPitch";
    defaultLabel = "Wild pitch";
  } else if (key.includes("passed_ball")) {
    i18nKey = "live.mlb.passedBall";
    defaultLabel = "Passed ball";
  } else if (key.includes("balk")) {
    i18nKey = "live.mlb.balk";
    defaultLabel = "Balk";
  } else if (key.includes("hit_by_pitch")) {
    i18nKey = "live.mlb.hitByPitch";
    defaultLabel = "HBP";
  } else if (key.includes("ground_rule")) {
    i18nKey = "live.mlb.groundRuleDouble";
    defaultLabel = "Ground-rule double";
  }

  const label = i18n.t(i18nKey, defaultLabel);
  if (!label) return null;

  return (
    <View
      style={{
        alignSelf: "flex-start",
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 999,
        backgroundColor: bg,
        marginTop: 6,
      }}
    >
      <Text style={{ color: fg, fontWeight: "800", fontSize: 11, textTransform: "uppercase" }}>
        {label}
      </Text>
    </View>
  );
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

function GameRow({ game, onPress, colors, isDark, teamForAbbr }) {
  const { homeAbbr, awayAbbr, homeScore, awayScore, startTimeUTC, isLive, isFinal } = game;
  const label = inningLabel(game);
  const awayTeam = teamForAbbr(awayAbbr);
  const homeTeam = teamForAbbr(homeAbbr);

  return (
    <TouchableOpacity
      onPress={() => onPress?.(game)}
      activeOpacity={0.85}
      style={{
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.card,
        marginBottom: 10,
      }}
    >
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 4 }}>
            <TeamLogoBadge team={awayTeam || { sport: "MLB", abbreviation: awayAbbr }} size={22} colors={colors} />
            <Text style={{ color: colors.text, fontWeight: "600", flex: 1, marginLeft: 8 }}>{awayAbbr}</Text>
            <Text style={{ color: colors.text, fontWeight: "700", width: 24, textAlign: "right" }}>
              {awayScore ?? "—"}
            </Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <TeamLogoBadge team={homeTeam || { sport: "MLB", abbreviation: homeAbbr }} size={22} colors={colors} />
            <Text style={{ color: colors.text, fontWeight: "600", flex: 1, marginLeft: 8 }}>{homeAbbr}</Text>
            <Text style={{ color: colors.text, fontWeight: "700", width: 24, textAlign: "right" }}>
              {homeScore ?? "—"}
            </Text>
          </View>
        </View>

        <View style={{ alignItems: "flex-end", marginLeft: 12, flexShrink: 0 }}>
          {isLive && (
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 2 }}>
              <View
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: "#dc2626",
                  marginRight: 6,
                }}
              />
              <Text style={{ color: "#dc2626", fontWeight: "700" }}>
                {i18n.t("live.status.live", "LIVE")}
              </Text>
            </View>
          )}
          {label ? (
            <Text style={{ color: isFinal ? colors.subtext : colors.text, fontWeight: "600" }}>{label}</Text>
          ) : (
            <Text style={{ color: colors.subtext }}>{fmtTime(startTimeUTC)}</Text>
          )}
          {isLive ? (
            <View style={{ marginTop: 8 }}>
              <MlbLiveSituation game={game} colors={colors} isDark={isDark} compact />
            </View>
          ) : null}
        </View>
      </View>
    </TouchableOpacity>
  );
}

function GameDetailModal({ visible, onClose, game, colors, isDark, teamForAbbr }) {
  const insets = useSafeAreaInsets();
  const [gameDoc, setGameDoc] = useState(null);
  const [scoringPlays, setScoringPlays] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!visible || !game?.id) {
      setGameDoc(null);
      setScoringPlays([]);
      setLoading(false);
      return undefined;
    }

    const ref = firestore().collection("mlb_live_games").doc(String(game.id));
    setLoading(true);

    const unsubGame = ref.onSnapshot(
      (snap) => setGameDoc(snap.exists ? { id: snap.id, ...snap.data() } : null),
      () => {}
    );

    const unsubPlays = ref
      .collection("scoring_plays")
      .orderBy("inning", "asc")
      .onSnapshot(
        (snap) => {
          setScoringPlays(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
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
  }, [visible, game?.id]);

  const g = gameDoc || game;
  const playGroups = useMemo(() => scoringPlaysByInning(scoringPlays), [scoringPlays]);

  if (!visible || !g) return null;

  const awayTeam = teamForAbbr(g.awayAbbr);
  const homeTeam = teamForAbbr(g.homeAbbr);
  const awayScore = g.awayScore ?? "—";
  const homeScore = g.homeScore ?? "—";
  const statusText = mlbDetailStatus(g);
  const isLive = !!g.isLive;
  const isFinal = !!g.isFinal;

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
              <View style={{ flex: 1, alignItems: "center" }}>
                <TeamLogoBadge
                  team={awayTeam || { sport: "MLB", abbreviation: g.awayAbbr }}
                  size={44}
                  colors={colors}
                />
                <Text
                  style={{
                    color: "#f8fafc",
                    fontWeight: "900",
                    fontSize: 16,
                    marginTop: 8,
                    letterSpacing: 0.5,
                  }}
                >
                  {g.awayAbbr}
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

              <View style={{ flex: 1, alignItems: "center" }}>
                <TeamLogoBadge
                  team={homeTeam || { sport: "MLB", abbreviation: g.homeAbbr }}
                  size={44}
                  colors={colors}
                />
                <Text
                  style={{
                    color: "#f8fafc",
                    fontWeight: "900",
                    fontSize: 16,
                    marginTop: 8,
                    letterSpacing: 0.5,
                  }}
                >
                  {g.homeAbbr}
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
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                marginBottom: 10,
              }}
            >
              <MaterialCommunityIcons name="lightning-bolt" size={18} color={colors.primary || colors.text} />
              <Text style={{ color: colors.text, fontWeight: "800", fontSize: 16 }}>
                {i18n.t("live.mlb.scoringPlays", "Actions marquantes")}
              </Text>
              {!loading && scoringPlays.length > 0 ? (
                <View
                  style={{
                    marginLeft: "auto",
                    backgroundColor: colors.card2 || colors.card,
                    paddingHorizontal: 8,
                    paddingVertical: 3,
                    borderRadius: 999,
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}
                >
                  <Text style={{ color: colors.subtext, fontWeight: "700", fontSize: 11 }}>
                    {scoringPlays.length}
                  </Text>
                </View>
              ) : null}
            </View>

            {loading ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12 }}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={{ color: colors.subtext }}>
                  {i18n.t("live.mlb.loadingPlays", "Chargement des actions…")}
                </Text>
              </View>
            ) : scoringPlays.length === 0 ? (
              <View
                style={{
                  padding: 16,
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.card,
                  alignItems: "center",
                }}
              >
                <MaterialCommunityIcons name="baseball-bat" size={28} color={colors.subtext} />
                <Text style={{ color: colors.subtext, textAlign: "center", marginTop: 8 }}>
                  {i18n.t("live.mlb.noScoringPlays", "Aucune action marquante pour le moment.")}
                </Text>
              </View>
            ) : (
              playGroups.map((group) => {
                const inningTitle =
                  group.inning != null
                    ? halfInningLabel(group.halfInning, group.inning)
                    : halfInningLabel(group.halfInning, null);

                return (
                  <View key={`${group.inning}-${group.halfInning}`} style={{ marginBottom: 14 }}>
                    <Text
                      style={{
                        color: colors.subtext,
                        fontWeight: "800",
                        fontSize: 12,
                        letterSpacing: 0.6,
                        textTransform: "uppercase",
                        marginBottom: 8,
                      }}
                    >
                      {inningTitle}
                    </Text>

                    {group.plays.map((play) => {
                      const battingAbbr = battingTeamAbbrForPlay(play, g);
                      const battingTeam = battingAbbr ? teamForAbbr(battingAbbr) : null;

                      return (
                      <View
                        key={play.id}
                        style={{
                          flexDirection: "row",
                          padding: 12,
                          borderRadius: 14,
                          borderWidth: 1,
                          borderColor: colors.border,
                          backgroundColor: colors.card,
                          marginBottom: 8,
                          gap: 10,
                        }}
                      >
                        <View
                          style={{
                            width: 36,
                            height: 36,
                            borderRadius: 10,
                            backgroundColor: colors.card2 || colors.background,
                            alignItems: "center",
                            justifyContent: "center",
                            borderWidth: 1,
                            borderColor: colors.border,
                            overflow: "hidden",
                          }}
                        >
                          {battingAbbr ? (
                            <TeamLogoBadge
                              team={battingTeam || { sport: "MLB", abbreviation: battingAbbr }}
                              size={28}
                              colors={colors}
                            />
                          ) : (
                            <Text style={{ color: colors.text, fontWeight: "900", fontSize: 15 }}>
                              {play.inning ?? "—"}
                            </Text>
                          )}
                        </View>

                        <View style={{ flex: 1 }}>
                          <Text style={{ color: colors.text, fontWeight: "600", lineHeight: 20 }}>
                            {play.description || play.eventType || "—"}
                          </Text>
                          {eventTypeChip(play.eventType, colors)}
                        </View>

                        <View style={{ alignItems: "flex-end", justifyContent: "center" }}>
                          {(play.awayScore != null || play.homeScore != null) && (
                            <Text
                              style={{
                                color: colors.text,
                                fontWeight: "900",
                                fontSize: 16,
                                fontVariant: ["tabular-nums"],
                              }}
                            >
                              {play.awayScore ?? "—"}–{play.homeScore ?? "—"}
                            </Text>
                          )}
                          {Number(play.rbi) > 0 ? (
                            <Text style={{ color: "#dc2626", fontWeight: "800", fontSize: 11, marginTop: 4 }}>
                              {i18n.t("live.mlb.rbi", {
                                defaultValue: "{{count}} RBI",
                                count: play.rbi,
                              })}
                            </Text>
                          ) : null}
                        </View>
                      </View>
                      );
                    })}
                  </View>
                );
              })
            )}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

export default function MlbMatchLiveScreen() {
  const { colors, isDark } = useTheme();
  const teamForAbbr = useMlbTeamForAbbr();
  const [refreshing, setRefreshing] = useState(false);
  const [todayKey, setTodayKey] = useState(() => computeMlbLiveQueryYmd());
  const [selectedGame, setSelectedGame] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);

  const { games: boardGames, loading } = useLiveBoardGames({
    league: "mlb",
    ymd: todayKey,
  });

  const games = useMemo(() => {
    const list = dedupeLiveGames(
      (boardGames || []).map((g) => ({
        ...g,
        id: g.id || g.gamePk,
        gamePk: g.gamePk || g.id,
      }))
    );
    list.sort((a, b) => gStartMillis(a) - gStartMillis(b));
    return list;
  }, [boardGames]);

  useEffect(() => {
    const id = setInterval(() => {
      const next = computeMlbLiveQueryYmd();
      setTodayKey((prev) => (prev === next ? prev : next));
    }, 60_000);
    return () => clearInterval(id);
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const liveFn = functions().httpsCallable("updateMlbLiveGamesNow");
      let res = await liveFn({ date: todayKey });
      const scheduleCount = res?.data?.stats?.games ?? -1;

      if (scheduleCount === 0) {
        const schedFn = functions().httpsCallable("updateMlbScheduleWindowNow");
        await schedFn({ startYmd: todayKey, endYmd: todayKey });
        await liveFn({ date: todayKey });
      }
    } catch (e) {
      console.log("[MlbMatchLive] refresh error", e?.message || e);
    } finally {
      setRefreshing(false);
    }
  }, [todayKey]);

  const lastBootstrapKeyRef = useRef(null);

  useEffect(() => {
    if (lastBootstrapKeyRef.current === todayKey) return;
    lastBootstrapKeyRef.current = todayKey;
    onRefresh();
  }, [todayKey, onRefresh]);

  const sortedGames = useMemo(() => {
    const live = games.filter((g) => g.isLive);
    const upcoming = games.filter((g) => !g.isLive && !g.isFinal);
    const final = games.filter((g) => g.isFinal);
    return [...live, ...upcoming, ...final];
  }, [games]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, padding: 16 }}>
      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 24 }} />
      ) : (
        <FlatList
          data={sortedGames}
          keyExtractor={(item) => String(item.gamePk || item.id)}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <Text style={{ color: colors.subtext, textAlign: "center", marginTop: 24 }}>
              {i18n.t("live.mlb.noGames", "Aucun match pour cette journée.")}
            </Text>
          }
          renderItem={({ item }) => (
            <GameRow
              game={item}
              colors={colors}
              isDark={isDark}
              teamForAbbr={teamForAbbr}
              onPress={(g) => {
                setSelectedGame(g);
                setModalVisible(true);
              }}
            />
          )}
        />
      )}

      <GameDetailModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        game={selectedGame}
        colors={colors}
        isDark={isDark}
        teamForAbbr={teamForAbbr}
      />
    </View>
  );
}
