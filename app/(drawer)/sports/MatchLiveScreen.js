import React, { useEffect, useMemo, useState, useCallback } from "react";
import { snapshotExists, snapshotData, snapshotId } from "@src/lib/safeSnapshot";
import {
  View,
  Text,
  ActivityIndicator,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Image,
  Modal,
  ScrollView,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useAuth } from "@src/auth/SafeAuthProvider";
import FgcChallengeModal from "@src/defis/results/FgcChallengeModal";
import TpMyPicksModal from "@src/defis/results/TpMyPicksModal";
import TsMyResultsModal from "@src/defis/results/TsMyResultsModal";
import useFgcMutualizedGamesMap from "@src/firstGoal/useFgcMutualizedGamesMap";
import useTodayLiveChallenges from "@src/live/useTodayLiveChallenges";
import LiveGameChallengeTags, {
  getActiveLiveChallengeKinds,
  getLiveRowHighlightStyle,
} from "@src/live/LiveGameChallengeTags";
import { lookupTeamByAbbr } from "@src/groups/data/fallbackTeams";
import { lookupByGameId, liveBoardGameId } from "@src/live/liveChallengeModels";
import { getProphetikBusinessYmd } from "@src/lib/prophetikBusinessDate";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@src/theme/ThemeProvider";
import firestore from "@react-native-firebase/firestore";
import functions from "@react-native-firebase/functions";
import useLiveBoardGames from "@src/live/useLiveBoardGames";
import i18n from "@src/i18n/i18n";
import { useSelectedGroup } from "@src/groups/SelectedGroupProvider";
import { crashLog, setCrashContext, recordNonFatal } from "@src/services/crashlytics";
import Analytics from "@src/services/analytics";

/* ========================
   Helpers date / logos
========================= */

const LOGO_MAP = {
  ANA: require("../../../assets/nhl-logos/ANA.png"),
  ARI: require("../../../assets/nhl-logos/ARI.png"),
  BOS: require("../../../assets/nhl-logos/BOS.png"),
  BUF: require("../../../assets/nhl-logos/BUF.png"),
  CAR: require("../../../assets/nhl-logos/CAR.png"),
  CBJ: require("../../../assets/nhl-logos/CBJ.png"),
  CGY: require("../../../assets/nhl-logos/CGY.png"),
  CHI: require("../../../assets/nhl-logos/CHI.png"),
  COL: require("../../../assets/nhl-logos/COL.png"),
  DAL: require("../../../assets/nhl-logos/DAL.png"),
  DET: require("../../../assets/nhl-logos/DET.png"),
  EDM: require("../../../assets/nhl-logos/EDM.png"),
  FLA: require("../../../assets/nhl-logos/FLA.png"),
  LAK: require("../../../assets/nhl-logos/LAK.png"),
  MIN: require("../../../assets/nhl-logos/MIN.png"),
  MTL: require("../../../assets/nhl-logos/MTL.png"),
  NJD: require("../../../assets/nhl-logos/NJD.png"),
  NSH: require("../../../assets/nhl-logos/NSH.png"),
  NYI: require("../../../assets/nhl-logos/NYI.png"),
  NYR: require("../../../assets/nhl-logos/NYR.png"),
  OTT: require("../../../assets/nhl-logos/OTT.png"),
  PHI: require("../../../assets/nhl-logos/PHI.png"),
  PIT: require("../../../assets/nhl-logos/PIT.png"),
  SEA: require("../../../assets/nhl-logos/SEA.png"),
  SJS: require("../../../assets/nhl-logos/SJS.png"),
  STL: require("../../../assets/nhl-logos/STL.png"),
  TBL: require("../../../assets/nhl-logos/TBL.png"),
  TOR: require("../../../assets/nhl-logos/TOR.png"),
  UTA: require("../../../assets/nhl-logos/UTA.png"),
  VAN: require("../../../assets/nhl-logos/VAN.png"),
  VGK: require("../../../assets/nhl-logos/VGK.png"),
  WPG: require("../../../assets/nhl-logos/WPG.png"),
  WSH: require("../../../assets/nhl-logos/WSH.png"),
};

function teamLogo(abbr) {
  return LOGO_MAP[abbr] || null;
}

function formatShortDateLocalized(ymd, locale) {
  if (!ymd || typeof ymd !== "string" || ymd.length < 10) return "";
  const [y, m, d] = ymd.split("-").map((x) => parseInt(x, 10));
  const dt = new Date(y, (m || 1) - 1, d || 1);

  return new Intl.DateTimeFormat(locale || "en", {
    day: "numeric",
    month: "long",
  }).format(dt);
}

function todayYMD() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDaysToYMD(baseYmd, delta) {
  if (!baseYmd || typeof baseYmd !== "string" || baseYmd.length < 10) return baseYmd;
  const [y, m, d] = baseYmd.split("-").map((x) => parseInt(x, 10));
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + delta);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

/**
 * Règle NHL:
 * - Après 9h locale → date du jour
 * - Avant 9h locale → date de la veille
 */
function computeNhlYmd() {
  const now = new Date();
  const base = todayYMD();
  const hour = now.getHours();

  if (hour < 9) {
    return addDaysToYMD(base, -1);
  }
  return base;
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
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

function isGameToday(doc, ymdStr) {
  const t = doc.startTimeUTC;
  if (!t) return false;

  let dt;
  try {
    dt = t?.toDate ? t.toDate() : new Date(t);
  } catch {
    return false;
  }
  if (!dt || isNaN(dt.getTime())) return false;

  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const d = String(dt.getDate()).padStart(2, "0");
  const ymd = `${y}-${m}-${d}`;

  return ymd === ymdStr;
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

function periodLabelFromGame(game) {
  const { period, periodType, isLive, isFinal } = game || {};
  const pt = String(periodType || "").toUpperCase();

  if (isFinal) {
    if (pt === "SO" || period === 5) {
      return i18n.t("live.status.finalSO", "Final (TB)");
    }
    if (pt === "OT" || period === 4) {
      return i18n.t("live.status.finalOT", "Final (P)");
    }
    return i18n.t("live.status.final", "Final");
  }

  if (!isLive) return null;

  if (pt === "OT") {
    return i18n.t("live.detail.ot", "Prolongation");
  }
  if (pt === "SO") {
    return i18n.t("live.detail.so", "Tirs de barrage");
  }
  if (period != null) {
    return i18n.t("live.detail.period", {
      defaultValue: "Période {{period}}",
      period,
    });
  }

  return null;
}

function shortName(fullName) {
  if (!fullName || typeof fullName !== "string") return "";
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];

  const last = parts[parts.length - 1];
  const first = parts[0];
  const initial = first.charAt(0).toUpperCase();

  return `${initial}. ${last}`;
}

function statusRank(status) {
  const s = String(status || "").toLowerCase();
  if (s === "open") return 0;
  if (s === "locked") return 1;
  if (s === "pending") return 2;
  if (s === "decided") return 3;
  if (s === "closed") return 4;
  return 5;
}

/* ========================
   Composant de ligne
========================= */

function GameRow({
  game,
  onPress,
  colors,
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
  const { isDark } = useTheme();
  const challengeKinds = getActiveLiveChallengeKinds({
    fgcItem,
    fgcMyPick,
    tpSlot,
    tpMyPick,
    tsPlayers,
  });
  const highlightStyle = getLiveRowHighlightStyle(colors, challengeKinds, { isDark });

  const {
    homeAbbr,
    awayAbbr,
    homeScore,
    awayScore,
    startTimeUTC,
    statusText,
    isLive,
    isFinal,
    inIntermission,
  } = game;

  const timeRemaining = game.timeRemaining ?? null;
  const periodLabel = periodLabelFromGame(game);
  const isIntermission = !!inIntermission;
  const displayStatusText = isFinal ? null : statusText;

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
        sport="NHL"
        fgcItem={fgcItem}
        fgcMyPick={fgcMyPick}
        tpSlot={tpSlot}
        tpMyPick={tpMyPick}
        tpPickResult={tpPickResult}
        teamForAbbr={(abbr) => lookupTeamByAbbr("NHL", abbr)}
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
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 4 }}>
              {teamLogo(awayAbbr) && (
                <Image source={teamLogo(awayAbbr)} style={{ width: 26, height: 26, marginRight: 8 }} />
              )}
              <Text style={{ color: colors.text, fontWeight: "600", flex: 1 }}>{awayAbbr}</Text>
              <Text style={{ color: colors.text, fontWeight: "700", width: 24, textAlign: "right" }}>
                {awayScore}
              </Text>
            </View>

            <View style={{ flexDirection: "row", alignItems: "center" }}>
              {teamLogo(homeAbbr) && (
                <Image source={teamLogo(homeAbbr)} style={{ width: 26, height: 26, marginRight: 8 }} />
              )}
              <Text style={{ color: colors.text, fontWeight: "600", flex: 1 }}>{homeAbbr}</Text>
              <Text style={{ color: colors.text, fontWeight: "700", width: 24, textAlign: "right" }}>
                {homeScore}
              </Text>
            </View>
          </View>

          <View style={{ alignItems: "flex-end", marginLeft: 12 }}>
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

            {periodLabel && (
              <Text style={{ color: colors.subtext, fontSize: 12, marginBottom: 2 }}>
                {periodLabel}
              </Text>
            )}

            {isLive ? (
              isIntermission ? (
                <Text style={{ color: colors.subtext, fontSize: 12 }}>
                  {i18n.t("live.detail.intermission", "Entracte")}
                </Text>
              ) : timeRemaining ? (
                <Text style={{ color: colors.subtext, fontSize: 12 }}>
                  {i18n.t("live.detail.timeRemaining", {
                    defaultValue: "Temps restant: {{time}}",
                    time: timeRemaining,
                  })}
                </Text>
              ) : null
            ) : isFinal ? null : (
              <Text style={{ color: colors.subtext, fontSize: 12 }}>
                {startTimeUTC
                  ? i18n.t("live.row.startAt", {
                      defaultValue: "Début: {{time}}",
                      time: fmtTime(startTimeUTC),
                    })
                  : i18n.t("live.row.startUnknown", "Heure inconnue")}
              </Text>
            )}

            {displayStatusText ? (
              <Text style={{ color: colors.subtext, fontSize: 11, marginTop: 2 }}>
                {displayStatusText}
              </Text>
            ) : null}
          </View>
        </View>
      </TouchableOpacity>
    </View>
  );
}

/* ========================
   Modale détails de match
========================= */

function GameDetailModal({ visible, onClose, game, colors }) {
  const [gameDoc, setGameDoc] = useState(null);
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!visible || !game?.id) {
      setGameDoc(null);
      setGoals([]);
      setLoading(false);
      return;
    }

    const ref = firestore().collection("nhl_live_games").doc(String(game.id));
    const goalsRef = ref.collection("goals");

    setLoading(true);

    const unsubGame = ref.onSnapshot(
      (snap) => {
        setGameDoc(snapshotExists(snap) ? { id: snapshotId(snap), ...snapshotData(snap) } : null);
      },
      (err) => {
        console.log("[MatchLive] game doc error", err?.message || err);
      }
    );

    const unsubGoals = goalsRef
      .orderBy("period", "asc")
      .orderBy("timeInPeriod", "asc")
      .onSnapshot(
        (snap) => {
          const list = (snap?.docs ?? []).map((d) => ({ id: d.id, ...d.data() }));
          setGoals(list);
          setLoading(false);
        },
        (err) => {
          console.log("[MatchLive] goals error", err?.message || err);
          setLoading(false);
        }
      );

    return () => {
      try {
        unsubGame();
      } catch {}
      try {
        unsubGoals();
      } catch {}
    };
  }, [visible, game?.id]);

  const g = gameDoc || game || null;

  const goalsByPeriod = useMemo(() => {
    const map = {
      P1: [],
      P2: [],
      P3: [],
      OT: [],
      SO: [],
      UNKNOWN: [],
    };

    goals.forEach((goal) => {
      const p = goal.period;
      const pt = String(goal.periodType || "").toUpperCase();

      let code = "UNKNOWN";
      if (pt === "SO") code = "SO";
      else if (pt === "OT") code = "OT";
      else if (p === 1) code = "P1";
      else if (p === 2) code = "P2";
      else if (p === 3) code = "P3";

      map[code].push(goal);
    });

    const order = ["P1", "P2", "P3", "OT", "SO", "UNKNOWN"];

    return order.filter((code) => map[code]?.length).map((code) => ({ code, goals: map[code] }));
  }, [goals]);

  if (!visible || !g) return null;

  const {
    homeAbbr,
    awayAbbr,
    homeScore,
    awayScore,
    startTimeUTC,
    statusText,
    isLive,
    isFinal,
    period,
    periodType,
    inIntermission,
  } = g;

  const timeRemaining = g.timeRemaining ?? null;
  const isIntermission = !!inIntermission;

  let periodLabel = null;
  const ptModal = String(periodType || "").toUpperCase();

  if (isFinal) {
    if (ptModal === "SO" || period === 5) {
      periodLabel = i18n.t("live.status.finalSO", "Final (TB)");
    } else if (ptModal === "OT" || period === 4) {
      periodLabel = i18n.t("live.status.finalOT", "Final (P)");
    } else {
      periodLabel = i18n.t("live.status.final", "Final");
    }
  } else if (period != null) {
    periodLabel = i18n.t("live.detail.periodWithSuffix", {
      defaultValue: "Période {{period}}{{suffix}}",
      period,
      suffix: ptModal === "OT" ? " (Prolong.)" : ptModal === "SO" ? " (TB)" : "",
    });
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.4)",
          justifyContent: "flex-end",
        }}
      >
        <View
          style={{
            backgroundColor: colors.background,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            padding: 16,
            maxHeight: "80%",
          }}
        >
          <View style={{ alignItems: "center", marginBottom: 8 }}>
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
              marginBottom: 12,
            }}
          >
            <Text
              style={{
                flex: 1,
                fontSize: 18,
                fontWeight: "800",
                color: colors.text,
              }}
            >
              {i18n.t("live.detail.title", "Détail du match")}
            </Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 16 }}>
            <View style={{ alignItems: "center", marginBottom: 16 }}>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 8,
                }}
              >
                <View style={{ alignItems: "center", marginRight: 16 }}>
                  {teamLogo(awayAbbr) && (
                    <Image source={teamLogo(awayAbbr)} style={{ width: 40, height: 40, marginBottom: 4 }} />
                  )}
                  <Text style={{ color: colors.text, fontWeight: "700" }}>{awayAbbr}</Text>
                </View>

                <View style={{ alignItems: "center", marginHorizontal: 8 }}>
                  <Text
                    style={{
                      fontSize: 28,
                      fontWeight: "900",
                      color: colors.text,
                    }}
                  >
                    {awayScore} - {homeScore}
                  </Text>
                  <Text
                    style={{
                      marginTop: 4,
                      color: isLive ? "#dc2626" : isFinal ? colors.subtext : colors.text,
                      fontWeight: "700",
                    }}
                  >
                    {statusText}
                  </Text>
                </View>

                <View style={{ alignItems: "center", marginLeft: 16 }}>
                  {teamLogo(homeAbbr) && (
                    <Image source={teamLogo(homeAbbr)} style={{ width: 40, height: 40, marginBottom: 4 }} />
                  )}
                  <Text style={{ color: colors.text, fontWeight: "700" }}>{homeAbbr}</Text>
                </View>
              </View>

              {isLive ? (
                <Text style={{ color: colors.subtext, fontSize: 13 }}>
                  {isIntermission
                    ? periodLabel
                      ? i18n.t("live.detail.intermissionWithPeriod", {
                          defaultValue: "{{period}} • {{label}}",
                          period: periodLabel,
                          label: i18n.t("live.detail.intermission", "Entracte"),
                        })
                      : i18n.t("live.detail.intermission", "Entracte")
                    : periodLabel
                    ? i18n.t("live.detail.liveWithPeriod", {
                        defaultValue: "{{period}}{{time}}",
                        period: periodLabel,
                        time: timeRemaining
                          ? ` • ${i18n.t("live.detail.timeRemaining", {
                              defaultValue: "Temps restant: {{time}}",
                              time: timeRemaining,
                            })}`
                          : "",
                      })
                    : timeRemaining
                    ? i18n.t("live.detail.timeRemaining", {
                        defaultValue: "Temps restant: {{time}}",
                        time: timeRemaining,
                      })
                    : i18n.t("live.detail.inProgress", "En cours")}
                </Text>
              ) : isFinal ? (
                <Text style={{ color: colors.subtext, fontSize: 13 }}>
                  {periodLabel || i18n.t("live.status.final", "Final")}
                </Text>
              ) : (
                <Text style={{ color: colors.subtext, fontSize: 13 }}>
                  {startTimeUTC
                    ? i18n.t("live.detail.startAt", {
                        defaultValue: "Début: {{time}}",
                        time: fmtTime(startTimeUTC),
                      })
                    : i18n.t("live.detail.startUnknown", "Heure de début inconnue")}
                </Text>
              )}
            </View>

            <View
              style={{
                padding: 12,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.card,
                marginBottom: 12,
              }}
            >
              <Text
                style={{
                  fontWeight: "700",
                  marginBottom: 6,
                  color: colors.text,
                }}
              >
                {i18n.t("live.detail.summaryTitle", "Sommaire du match")}
              </Text>

              {loading && (
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 8,
                    marginTop: 4,
                  }}
                >
                  <ActivityIndicator size="small" color={colors.subtext} />
                  <Text style={{ color: colors.subtext, fontSize: 13 }}>
                    {i18n.t("live.detail.loadingGoals", "Chargement des buts…")}
                  </Text>
                </View>
              )}

              {!loading && goalsByPeriod.length === 0 && (
                <Text style={{ color: colors.subtext, fontSize: 13 }}>
                  {i18n.t(
                    "live.detail.noGoals",
                    "Aucun but ou statistiques non disponibles pour ce match."
                  )}
                </Text>
              )}

              {!loading &&
                goalsByPeriod.map((group) => {
                  let label;
                  switch (group.code) {
                    case "P1":
                      label = i18n.t("live.goals.period1", "Période 1");
                      break;
                    case "P2":
                      label = i18n.t("live.goals.period2", "Période 2");
                      break;
                    case "P3":
                      label = i18n.t("live.goals.period3", "Période 3");
                      break;
                    case "OT":
                      label = i18n.t("live.goals.ot", "Prolongation");
                      break;
                    case "SO":
                      label = i18n.t("live.goals.so", "Tirs de barrage");
                      break;
                    default:
                      label = i18n.t("live.goals.unknown", "Inconnu");
                  }

                  return (
                    <View key={group.code} style={{ marginTop: 8 }}>
                      <Text
                        style={{
                          color: colors.text,
                          fontWeight: "700",
                          marginBottom: 4,
                        }}
                      >
                        {label}
                      </Text>

                      {group.goals.map((goal) => {
                        const time = goal.timeInPeriod || "??:??";
                        const scorerShort = shortName(goal.scoringPlayerName || "");

                        const scoringTotal =
                          typeof goal.scoringPlayerTotal === "number"
                            ? goal.scoringPlayerTotal
                            : typeof goal.scoringPlayerTotal === "string" && goal.scoringPlayerTotal !== ""
                            ? goal.scoringPlayerTotal
                            : null;

                        const assists = [];
                        if (goal.assist1PlayerName) assists.push(shortName(goal.assist1PlayerName));
                        if (goal.assist2PlayerName) assists.push(shortName(goal.assist2PlayerName));

                        let assistsText = "";
                        if (assists.length === 1) {
                          assistsText = i18n.t("live.detail.assistOne", {
                            defaultValue: "Assisté de {{player}}",
                            player: assists[0],
                          });
                        } else if (assists.length === 2) {
                          assistsText = i18n.t("live.detail.assistTwo", {
                            defaultValue: "Assisté de {{player1}} et {{player2}}",
                            player1: assists[0],
                            player2: assists[1],
                          });
                        }

                        const strength = goal.strength && goal.strength !== "EV" ? ` • ${goal.strength}` : "";
                        const avatarUrl = goal.scoringPlayerAvatarUrl;
                        const smallLogo = teamLogo(goal.scoringPlayerTeamAbbr || goal.teamAbbr);

                        return (
                          <View key={goal.id} style={{ flexDirection: "row", paddingVertical: 6 }}>
                            <View
                              style={{
                                width: 32,
                                height: 32,
                                borderRadius: 16,
                                overflow: "hidden",
                                marginRight: 8,
                                alignItems: "center",
                                justifyContent: "center",
                                backgroundColor: colors.card,
                                borderWidth: 1,
                                borderColor: colors.border,
                              }}
                            >
                              {avatarUrl ? (
                                <Image source={{ uri: avatarUrl }} style={{ width: 32, height: 32 }} resizeMode="cover" />
                              ) : (
                                <Text
                                  style={{
                                    fontSize: 10,
                                    fontWeight: "700",
                                    color: colors.text,
                                  }}
                                >
                                  {goal.teamAbbr || "??"}
                                </Text>
                              )}
                            </View>

                            <View style={{ flex: 1 }}>
                              <View style={{ flexDirection: "row", alignItems: "center" }}>
                                {smallLogo && (
                                  <Image
                                    source={smallLogo}
                                    style={{
                                      width: 12,
                                      height: 12,
                                      marginRight: 4,
                                      borderRadius: 2,
                                    }}
                                  />
                                )}
                                <Text
                                  style={{
                                    color: colors.text,
                                    fontWeight: "700",
                                  }}
                                  numberOfLines={1}
                                >
                                  {scorerShort || i18n.t("live.detail.goalFallback", "But")}
                                  {scoringTotal != null ? ` (${scoringTotal})` : ""}
                                  {strength}
                                </Text>
                              </View>

                              <Text
                                style={{
                                  color: colors.subtext,
                                  fontSize: 12,
                                  marginTop: 2,
                                }}
                                numberOfLines={2}
                              >
                                {time}
                                {assistsText ? ` - ${assistsText}` : ""}
                              </Text>
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  );
                })}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

/* ========================
   Screen principal
========================= */

export default function MatchLiveScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const router = useRouter();

  const params = useLocalSearchParams();
  const requestedGameId = String(params?.gameId || "");
  const openedFromFgc = String(params?.from || "") === "fgc";

  const [todayKey, setTodayKey] = useState(() => computeNhlYmd());

  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const { games: boardGames, loading: boardLoading } = useLiveBoardGames({
    league: "nhl",
    ymd: todayKey,
  });

  useEffect(() => {
    const sorted = [...(boardGames || [])].sort((a, b) => gStartMillis(a) - gStartMillis(b));
    setGames(sorted);
    setLoading(boardLoading);
  }, [boardGames, boardLoading]);

  const [selectedGame, setSelectedGame] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);

  const { selectedGroupId: currentGroupId } = useSelectedGroup();
  const businessYmd = useMemo(() => getProphetikBusinessYmd(), [todayKey]);
  const challengeExtraYmds = useMemo(() => {
    const extras = [];
    if (todayKey && todayKey !== businessYmd) extras.push(todayKey);
    return extras;
  }, [todayKey, businessYmd]);

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
    league: "NHL",
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

  const [fgcModalItem, setFgcModalItem] = useState(null);
  const [tpModalItem, setTpModalItem] = useState(null);
  const [tsModalOpen, setTsModalOpen] = useState(false);

  useEffect(() => {
    crashLog("Opened MatchLiveScreen");

    setCrashContext({
      screen: "MatchLiveScreen",
      requestedGameId: requestedGameId || "",
      openedFromFgc: openedFromFgc ? "true" : "false",
      uid: user?.uid || "anonymous",
    });
  }, [requestedGameId, openedFromFgc, user?.uid]);



  useEffect(() => {
    const id = setInterval(() => {
      const next = computeNhlYmd();
      setTodayKey((prev) => (prev === next ? prev : next));
    }, 60_000);

    return () => clearInterval(id);
  }, []);

  const handlePressFgc = useCallback(
    (item) => {
      crashLog(`Open FGC challenge: ${String(item?.id || "")}`);

      setCrashContext({
        screen: "MatchLiveScreen",
        challengeId: String(item?.id || ""),
        challengeStatus: String(item?.status || item?.raw?.status || ""),
        groupId: String(item?.groupId || item?.raw?.groupId || ""),
        gameId: String(item?.raw?.gameId || ""),
        uid: user?.uid || "anonymous",
      });

      Analytics.matchLiveFgcOpen({
        challengeId: String(item?.id || ""),
        challengeStatus: String(item?.status || item?.raw?.status || "").toLowerCase(),
        groupId: String(item?.groupId || item?.raw?.groupId || ""),
        gameId: String(item?.raw?.gameId || ""),
      });

      setFgcModalItem(item);
    },
    [user?.uid]
  );

  const handlePressTp = useCallback((item) => {
    setTpModalItem(item);
  }, []);

  const handlePressTs = useCallback(() => {
    setTsModalOpen(true);
  }, []);

  const hasLoggedMatchLiveViewRef = React.useRef(false);

  useEffect(() => {
    if (loading) return;

    if (hasLoggedMatchLiveViewRef.current) return;
    hasLoggedMatchLiveViewRef.current = true;

    Analytics.matchLiveView({
      date: todayKey || null,
      gamesCount: Array.isArray(games) ? games.length : 0,
      from: openedFromFgc ? "fgc" : "app",
    });
  }, [loading, todayKey, games, openedFromFgc]);

  const sortedGames = useMemo(() => {
    const s = [...games];
    const weight = (g) => (g.isLive ? 0 : g.isFinal ? 2 : 1);

    s.sort((a, b) => {
      const w = weight(a) - weight(b);
      if (w !== 0) return w - 0;

      const ta = gStartMillis(a);
      const tb = gStartMillis(b);
      return ta - tb;
    });

    return s;
  }, [games]);

  const handlePressGame = useCallback((game) => {
    crashLog(`Open game details: ${String(game?.id || "")}`);

    setCrashContext({
      screen: "MatchLiveScreen",
      selectedGameId: String(game?.id || ""),
      homeAbbr: String(game?.homeAbbr || ""),
      awayAbbr: String(game?.awayAbbr || ""),
      uid: user?.uid || "anonymous",
    });

    Analytics.matchLiveGameOpen({
      gameId: String(game?.id || ""),
      homeAbbr: String(game?.homeAbbr || ""),
      awayAbbr: String(game?.awayAbbr || ""),
      status: game?.isLive ? "live" : game?.isFinal ? "final" : "scheduled",
    });

    setSelectedGame(game);
    setModalVisible(true);
  }, [user?.uid]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      crashLog("MatchLiveScreen manual refresh");
      const fn = functions().httpsCallable("updateNhlLiveGamesNow");
      await fn({});
    } catch (e) {
      console.log("[MatchLive] manual refresh error", e?.message || e);

      recordNonFatal(e, {
        screen: "MatchLiveScreen",
        action: "manualRefresh",
        todayKey: todayKey || "",
        uid: user?.uid || "anonymous",
      });
    } finally {
      setRefreshing(false);
    }
  }, [todayKey, user?.uid]);

  const locale = i18n.language?.startsWith("fr") ? "fr-CA" : "en-CA";

  const prettyDateLabel = useMemo(
    () => formatShortDateLocalized(todayKey, locale),
    [todayKey, locale]
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
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
        scheduleByGameId={{}}
        onClose={() => setTpModalItem(null)}
      />

      <TsMyResultsModal
        visible={tsModalOpen}
        item={tsItem}
        myEntry={tsEntry}
        colors={colors}
        onClose={() => setTsModalOpen(false)}
      />

      {openedFromFgc ? (
        <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
          <TouchableOpacity
            onPress={() => {
              if (router.canGoBack?.()) router.back();
              else router.replace("/(drawer)/(tabs)/AccueilScreen");
            }}
            style={{
              alignSelf: "flex-start",
              flexDirection: "row",
              alignItems: "center",
              paddingVertical: 8,
              paddingHorizontal: 12,
              borderRadius: 999,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.card,
            }}
          >
            <Ionicons name="chevron-back" size={18} color={colors.text} />
            <Text style={{ marginLeft: 6, color: colors.text, fontWeight: "800" }}>
              Fermer
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={colors.primary} />
          <Text style={{ marginTop: 8, color: colors.subtext }}>
            {i18n.t("live.loading", "Chargement des matchs…")}
          </Text>
        </View>
      ) : (
        <FlatList
          data={sortedGames}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }
          ListHeaderComponent={() => (
            <View style={{ marginBottom: 12 }}>
              <Text
                style={{
                  fontSize: 18,
                  fontWeight: "800",
                  color: colors.text,
                  marginBottom: 4,
                }}
              >
                {prettyDateLabel
                  ? i18n.t("live.headerWithDate", {
                      defaultValue: "Matchs NHL du {{date}}",
                      date: prettyDateLabel,
                    })
                  : i18n.t("live.headerNoDate", "Matchs NHL")}
              </Text>
              <Text style={{ color: colors.subtext, fontSize: 13 }}>
                {i18n.t(
                  "live.tapHint",
                  "Touchez un match pour voir les buts et les buteurs en temps réel."
                )}
              </Text>
            </View>
          )}
          renderItem={({ item }) => {
            const gameId = liveBoardGameId(item);
            return (
              <GameRow
                game={item}
                onPress={handlePressGame}
                colors={colors}
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
              />
            );
          }}
          ListEmptyComponent={() => (
            <View style={{ marginTop: 40, alignItems: "center" }}>
              <Text style={{ color: colors.subtext }}>
                {prettyDateLabel
                  ? i18n.t("live.emptyWithDate", {
                      defaultValue: "Aucun match trouvé pour le {{date}}.",
                      date: prettyDateLabel,
                    })
                  : i18n.t("live.emptyNoDate", "Aucun match trouvé.")}
              </Text>
            </View>
          )}
        />
      )}

      <GameDetailModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        game={selectedGame}
        colors={colors}
      />
    </View>
  );
}