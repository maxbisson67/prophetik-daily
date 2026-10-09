// app/defis/[defiId]/components/PlayerSelectModal.js

import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  Modal,
  FlatList,
  Platform,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  TextInput,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@src/theme/ThemeProvider";
import i18n from "@src/i18n/i18n";
import { mlbPlayerTsPoints } from "@src/defis/mlbTsScoring";
import {
  isMlbDefiPlayer,
  MlbOpponentMatchupLine,
  MlbProbablePitcherLine,
  MlbBvpLine,
  resolveMlbOpponentAbbr,
} from "@src/mlb/MlbDefiPlayerMeta";
import TeamLogoBadge from "@src/sports/TeamLogoBadge";
import { lookupTeamByAbbr } from "@src/groups/data/fallbackTeams";

import TeamMetaBadge from "./TeamMetaBadge"; // ✅ Rank: 2ième, +/-: 28
import { formatSeasonLabel } from "@src/players/seasonStatsHelpers";
import {
  NhlOpponentMatchupLine,
  resolveNhlOpponentAbbr,
} from "@src/nhl/NhlDefiPlayerMeta";
import { normalizeNhlSeasonStatRow } from "@src/nhl/nhlSeasonStatDisplay";

function PlayerTeamLogo({ teamAbbr, sport, teamLogo, colors, size = 18 }) {
  const abbr = String(teamAbbr || "").toUpperCase();
  if (!abbr) return null;

  if (String(sport || "").toUpperCase() === "MLB") {
    return <TeamLogoBadge team={lookupTeamByAbbr("MLB", abbr)} size={size} colors={colors} />;
  }

  if (!teamLogo) return null;
  const src = teamLogo(abbr);
  if (!src) return null;

  return <Image source={src} style={{ width: size, height: size }} resizeMode="contain" />;
}

function InjuryIcon({ injury, size = 16 }) {
  const { colors } = useTheme();
  const status = String(injury?.status || "").toLowerCase();
  if (!status || status === "active") return null;

  const iconName =
    status === "out"
      ? "medkit"
      : status === "daytoday"
      ? "warning"
      : status === "questionable"
      ? "help-circle"
      : status === "probable"
      ? "pulse"
      : "alert-circle";

  const color = status === "out" ? "#ef4444" : status === "daytoday" ? "#f59e0b" : colors.subtext;
  return <Ionicons name={iconName} size={size} color={color} style={{ marginLeft: 4 }} />;
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function shortPlayerName(fullName = "") {
  const s = String(fullName || "").trim();
  if (!s) return "—";
  const parts = s.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0];
  const first = parts[0];
  const last = parts[parts.length - 1];
  return `${first.slice(0, 1).toUpperCase()}. ${last}`;
}

function normalizePlayerSearchText(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function playerMatchesSearchQuery(player, queryRaw) {
  const query = normalizePlayerSearchText(queryRaw);
  if (!query) return true;

  const name = normalizePlayerSearchText(player?.fullName);
  const team = normalizePlayerSearchText(player?.teamAbbr);
  const pid = normalizePlayerSearchText(player?.playerId);

  if (name.includes(query)) return true;
  if (team.includes(query)) return true;
  if (pid.includes(query)) return true;

  const parts = String(player?.fullName || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length >= 2) {
    const lastFirst = normalizePlayerSearchText(`${parts[parts.length - 1]} ${parts[0]}`);
    if (lastFirst.includes(query)) return true;
  }

  return false;
}

function mlbSeasonPoints(p) {
  const stored = num(p?.points);
  if (stored > 0) return stored;
  return mlbPlayerTsPoints({
    hits: p?.hits,
    doubles: p?.doubles,
    triples: p?.triples,
    homeRuns: p?.homeRuns,
    rbi: p?.rbi,
    runs: p?.runs,
  });
}

export default function PlayerSelectModal({
  visible,
  onClose,
  options,
  onPick,
  alreadyChosenIds = [],
  tierLower = "free",
  teamLogo,
  headshotUrl,
  forcedTier = null,
  rankExcludeTop = null,
  pickerSlotIndex = 0,
  sport = "NHL",
  formatStandingsLine = null,
  loading = false,
  poolStatsEpoch = 0,
  nhlDisplaySeasonIds = null,
}) {
  const { colors } = useTheme();

  const tier = String(tierLower || "free").toLowerCase();
  const isVip = tier === "vip";
  const isPro = tier === "pro" || isVip;
  const isFree = !isPro;
  const isMlbSport = String(sport || "").toUpperCase() === "MLB";
  const defaultSortKey = "points";

  const [tierFilter, setTierFilter] = useState("T1");
  const [sortKey, setSortKey] = useState(defaultSortKey);
  const [nhlShowPreviousSeason, setNhlShowPreviousSeason] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const usesRankExclusion = Number.isFinite(Number(rankExcludeTop)) && Number(rankExcludeTop) >= 0;

  const nhlCurrentSeasonId = String(nhlDisplaySeasonIds?.current || "");
  const nhlPreviousSeasonId = String(nhlDisplaySeasonIds?.previous || "");

  const nhlStatsToggleVisible =
    !isMlbSport && Boolean(nhlCurrentSeasonId && nhlPreviousSeasonId);

  const nhlActiveDisplaySeasonId = useMemo(() => {
    if (!nhlStatsToggleVisible) return null;
    return nhlShowPreviousSeason ? nhlPreviousSeasonId : nhlCurrentSeasonId;
  }, [
    nhlStatsToggleVisible,
    nhlShowPreviousSeason,
    nhlCurrentSeasonId,
    nhlPreviousSeasonId,
  ]);

  function readStatsBySeasonRow(player, seasonId) {
    const map = player?.statsBySeason;
    if (!map || !seasonId) return null;
    const sid = String(seasonId);
    if (map[sid] != null && typeof map[sid] === "object") return map[sid];
    const alt = map[Number(sid)];
    if (alt != null && typeof alt === "object") return alt;
    return null;
  }

  const emptyNhlSeasonStats = {
    points: 0,
    goals: 0,
    assists: 0,
    gamesPlayed: 0,
    pointsPerGame: 0,
  };

  function resolveNhlDisplayStats(player) {
    if (!player) return null;
    const sid = nhlActiveDisplaySeasonId;

    if (sid) {
      const row = readStatsBySeasonRow(player, sid);
      if (row) return normalizeNhlSeasonStatRow(row);
      if (nhlStatsToggleVisible && sid === nhlCurrentSeasonId) {
        return emptyNhlSeasonStats;
      }
      if (nhlStatsToggleVisible && sid === nhlPreviousSeasonId) {
        return readStatsBySeasonRow(player, nhlPreviousSeasonId) || {
          points: num(player?.points),
          pointsPerGame: num(player?.pointsPerGame),
          goals: num(player?.goals),
          assists: num(player?.assists),
          gamesPlayed: num(player?.gamesPlayed),
        };
      }
    }

    return {
      points: num(player?.points),
      pointsPerGame: num(player?.pointsPerGame),
      goals: num(player?.goals),
      assists: num(player?.assists),
      gamesPlayed: num(player?.gamesPlayed),
    };
  }

  useEffect(() => {
    if (!visible) {
      setSearchQuery("");
      return;
    }

    setSortKey(defaultSortKey);
    setNhlShowPreviousSeason(false);
    setSearchQuery("");

    if (usesRankExclusion) return;

    const ft = String(forcedTier || "").toUpperCase();
    if (ft === "T1" || ft === "T2" || ft === "T3") {
      setTierFilter(ft);
    } else {
      setTierFilter("T1");
    }
  }, [visible, forcedTier, defaultSortKey, usesRankExclusion]);

  const chosenSet = useMemo(() => new Set((alreadyChosenIds || []).map((x) => String(x))), [
    JSON.stringify(alreadyChosenIds || []),
  ]);

  function getStatLabel() {
    if (isMlbSport) {
      if (sortKey === "points") {
        return i18n.t("defi.playerSelect.statPoints", { defaultValue: "PTS" });
      }
      if (sortKey === "hits") {
        return i18n.t("defi.playerSelect.statHits", { defaultValue: "H" });
      }
      if (sortKey === "rbi") {
        return i18n.t("defi.playerSelect.statRbi", { defaultValue: "RBI" });
      }
      if (sortKey === "runs") {
        return i18n.t("defi.playerSelect.statRuns", { defaultValue: "R" });
      }
      return i18n.t("defi.playerSelect.statPoints", { defaultValue: "PTS" });
    }
    if (sortKey === "ppg") {
      return i18n.t("defi.playerSelect.statPpgShort", { defaultValue: "Moy." });
    }
    return "PTS";
  }

  function getStatValue(p) {
    if (isMlbSport) {
      if (sortKey === "hits") return String(Math.round(num(p?.hits)));
      if (sortKey === "rbi") return String(Math.round(num(p?.rbi)));
      if (sortKey === "runs") return String(Math.round(num(p?.runs)));
      return String(Math.round(mlbSeasonPoints(p)));
    }
    if (sortKey === "ppg") {
      const st = resolveNhlDisplayStats(p);
      let ppg = num(st?.pointsPerGame);
      if (ppg <= 0) {
        const gp = num(st?.gamesPlayed);
        const pts = num(st?.points);
        if (gp > 0) ppg = pts / gp;
      }
      return ppg > 0 ? ppg.toFixed(2) : "0.00";
    }
    const st = resolveNhlDisplayStats(p);
    return String(Math.round(num(st?.points ?? p?.points)));
  }

  function sortComparator(a, b) {
    if (isMlbSport) {
      if (sortKey === "points") return mlbSeasonPoints(b) - mlbSeasonPoints(a);
      if (sortKey === "hits") return num(b.hits) - num(a.hits);
      if (sortKey === "rbi") return num(b.rbi) - num(a.rbi);
      if (sortKey === "runs") return num(b.runs) - num(a.runs);
    }

    if (sortKey === "points") {
      const bp = num(resolveNhlDisplayStats(b)?.points ?? b.points);
      const ap = num(resolveNhlDisplayStats(a)?.points ?? a.points);
      return bp - ap;
    }
    if (sortKey === "ppg") {
      const ppgOf = (pl) => {
        const st = resolveNhlDisplayStats(pl);
        let ppg = num(st?.pointsPerGame ?? pl?.pointsPerGame);
        if (ppg <= 0) {
          const gp = num(st?.gamesPlayed ?? pl?.gamesPlayed);
          const pts = num(st?.points ?? pl?.points);
          if (gp > 0) ppg = pts / gp;
        }
        return ppg;
      };
      return ppgOf(b) - ppgOf(a);
    }

    const ra = num(a.rank ?? 999999);
    const rb = num(b.rank ?? 999999);
    if (ra !== rb) return ra - rb;
    return String(a.fullName || "").localeCompare(String(b.fullName || ""));
  }

  const filtered = useMemo(() => {
    const base = Array.isArray(options) ? options.slice() : [];
    let list;

    if (usesRankExclusion) {
      const excludeTop = Number(rankExcludeTop);
      if (excludeTop <= 0) {
        list = base.slice();
      } else {
        list = base.filter((p) => {
          const rank = num(p?.rank);
          return rank <= 0 || rank > excludeTop;
        });
      }
    } else {
      list = base.filter((p) => String(p.tier || "").toUpperCase() === tierFilter);
    }

    list.sort(sortComparator);

    const q = String(searchQuery || "").trim();
    if (q) {
      list = list.filter((p) => playerMatchesSearchQuery(p, q));
    }

    return list;
  }, [
    options,
    tierFilter,
    sortKey,
    isFree,
    isMlbSport,
    usesRankExclusion,
    rankExcludeTop,
    nhlActiveDisplaySeasonId,
    poolStatsEpoch,
    searchQuery,
  ]);

  const mlbSortTabs = useMemo(
    () => [
      {
        value: "points",
        label: i18n.t("defi.playerSelect.sortPoints", { defaultValue: "Points" }),
      },
      {
        value: "hits",
        label: i18n.t("defi.playerSelect.sortHits", { defaultValue: "Hits" }),
      },
      {
        value: "rbi",
        label: i18n.t("defi.playerSelect.sortRbi", { defaultValue: "RBI" }),
      },
      {
        value: "runs",
        label: i18n.t("defi.playerSelect.sortRuns", { defaultValue: "Points marqués" }),
      },
    ],
    []
  );

  const mlbStatLegend = useMemo(() => {
    if (!isMlbSport) return null;
    return i18n.t("defi.playerSelect.mlbStatLegend", {
      defaultValue:
        "PTS = coups sûrs + points marqués + points produits + 1 pt par double, triple ou circuit (saison). Les onglets affichent cette stat ou H, RBI, R individuellement.",
    });
  }, [isMlbSport]);

  const selectionHint = useMemo(() => {
    if (usesRankExclusion) {
      const excludeTop = Number(rankExcludeTop);
      const hintBody =
        excludeTop <= 0
          ? i18n.t("defi.playerSelect.hintAll", {
              defaultValue: "Sélectionne un joueur parmi tous les choix disponibles.",
            })
          : excludeTop === 10
          ? i18n.t("defi.playerSelect.hintExcludeTop10", {
              defaultValue: "Sélectionne un joueur hors du top 10.",
            })
          : i18n.t("defi.playerSelect.hintExcludeTop20", {
              defaultValue: "Sélectionne un joueur hors du top 20.",
            });

      return i18n.t("defi.playerSelect.choiceHint", {
        index: Number(pickerSlotIndex) + 1,
        hint: hintBody,
        defaultValue: `Choix ${Number(pickerSlotIndex) + 1} : ${hintBody}`,
      });
    }

    if (!isMlbSport) return null;

    const tier = String(forcedTier || tierFilter || "").toUpperCase();
    const hintBody =
      tier === "T3"
        ? i18n.t("defi.playerSelect.hintOpen", {
            defaultValue: "Sélectionne un joueur parmi les choix suivants.",
          })
        : i18n.t("defi.playerSelect.hintTop10", {
            defaultValue: "Sélectionne un joueur parmi les 10 choix suivants.",
          });

    return i18n.t("defi.playerSelect.choiceHint", {
      index: Number(pickerSlotIndex) + 1,
      hint: hintBody,
      defaultValue: `Choix ${Number(pickerSlotIndex) + 1} : ${hintBody}`,
    });
  }, [usesRankExclusion, rankExcludeTop, isMlbSport, forcedTier, tierFilter, pickerSlotIndex]);

  function Chip({ label, active, onPress, locked }) {
    const tierStyles = {
      T1: { bg: "rgba(245,158,11,0.18)", border: "rgba(245,158,11,0.45)", fg: "#b45309" },
      T2: { bg: "rgba(59,130,246,0.18)", border: "rgba(59,130,246,0.45)", fg: "#1d4ed8" },
      T3: { bg: "rgba(107,114,128,0.18)", border: colors.border, fg: colors.subtext },
      POINTS: { bg: "rgba(239,68,68,0.14)", border: "rgba(239,68,68,0.40)", fg: "#ef4444" },
      PPG: { bg: "rgba(99,102,241,0.14)", border: "rgba(99,102,241,0.40)", fg: "#6366f1" },
    };

    const key = String(label || "").toUpperCase();
    const cfg = tierStyles[key];

    const bgColor = active ? cfg?.bg ?? "rgba(59,130,246,0.14)" : colors.background;
    const borderColor = active ? cfg?.border ?? colors.primary : colors.border;
    const textColor = active ? cfg?.fg ?? colors.text : colors.subtext;

    return (
      <TouchableOpacity
        onPress={onPress}
        disabled={locked}
        activeOpacity={0.85}
        style={{
          paddingHorizontal: 10,
          paddingVertical: 7,
          borderRadius: 999,
          borderWidth: 1,
          borderColor,
          backgroundColor: bgColor,
          opacity: locked ? 0.45 : 1,
        }}
      >
        <Text style={{ color: textColor, fontWeight: "900", fontSize: 12 }}>
          {label}
          {locked ? " 🔒" : ""}
        </Text>
      </TouchableOpacity>
    );
  }

  function Avatar({ player, size = 36, style }) {
    const primary =
      headshotUrl?.(player?.teamAbbr, player?.playerId) || player?.photoUrl || player?.avatarUrl || null;

    const fallback = `https://ui-avatars.com/api/?name=${encodeURIComponent(
      player?.fullName || "Player"
    )}&background=111827&color=f9fafb&size=${Math.max(64, size * 2)}`;

    const [uri, setUri] = React.useState(primary || fallback);

    React.useEffect(() => {
      setUri(primary || fallback);
    }, [player?.playerId, primary]);

    return (
      <Image
        source={{ uri }}
        onError={() => setUri(fallback)}
        style={[{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.card }, style]}
      />
    );
  }

  return (
    <Modal animationType="slide" transparent visible={visible} onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: "flex-end" }}>
        <View
          style={{
            backgroundColor: colors.card,
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
            paddingTop: 8,
            paddingHorizontal: 12,
            maxHeight: "88%",
            minHeight: 320,
            flex: 1,
            borderTopWidth: 1,
            borderColor: colors.border,
          }}
        >
          {/* Handle */}
          <View style={{ alignItems: "center", paddingVertical: 6 }}>
            <View style={{ width: 44, height: 4, borderRadius: 2, backgroundColor: colors.border }} />
          </View>

          {/* Header */}
          <View style={{ flexDirection: "row", alignItems: "center", paddingBottom: 6 }}>
            <Text style={{ fontSize: 18, fontWeight: "700", flex: 1, color: colors.text }}>
              {i18n.t("defi.playerSelect.title", { defaultValue: "Choisir un joueur" })}
            </Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={{ fontSize: 16, color: colors.primary, fontWeight: "800" }}>
                {i18n.t("defi.playerSelect.close", { defaultValue: "Fermer" })}
              </Text>
            </TouchableOpacity>
          </View>

          {nhlStatsToggleVisible ? (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
              <Chip
                label={formatSeasonLabel("NHL", nhlCurrentSeasonId)}
                active={!nhlShowPreviousSeason}
                onPress={() => setNhlShowPreviousSeason(false)}
              />
              <Chip
                label={formatSeasonLabel("NHL", nhlPreviousSeasonId)}
                active={nhlShowPreviousSeason}
                onPress={() => setNhlShowPreviousSeason(true)}
              />
            </View>
          ) : null}

          {selectionHint ? (
            <Text
              style={{
                color: colors.subtext,
                fontSize: 13,
                lineHeight: 18,
                marginBottom: mlbStatLegend ? 6 : 10,
              }}
            >
              {selectionHint}
            </Text>
          ) : null}

          {mlbStatLegend ? (
            <Text
              style={{
                color: colors.subtext,
                fontSize: 11,
                lineHeight: 16,
                marginBottom: 10,
                fontWeight: "600",
              }}
            >
              {mlbStatLegend}
            </Text>
          ) : null}

          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              marginBottom: 10,
              paddingHorizontal: 10,
              paddingVertical: Platform.OS === "ios" ? 10 : 8,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.card2,
            }}
          >
            <Ionicons name="search" size={18} color={colors.subtext} />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder={i18n.t("defi.playerSelect.searchPlaceholder", {
                defaultValue: "Rechercher un joueur…",
              })}
              placeholderTextColor={colors.subtext}
              autoCorrect={false}
              autoCapitalize="words"
              returnKeyType="search"
              clearButtonMode={Platform.OS === "ios" ? "while-editing" : "never"}
              style={{
                flex: 1,
                color: colors.text,
                fontSize: 15,
                fontWeight: "600",
                paddingVertical: 0,
              }}
            />
            {searchQuery.trim() && Platform.OS !== "ios" ? (
              <TouchableOpacity
                onPress={() => setSearchQuery("")}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close-circle" size={20} color={colors.subtext} />
              </TouchableOpacity>
            ) : null}
          </View>

          {/* Filters */}
          <View style={{ gap: 10, marginBottom: 10 }}>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {isMlbSport ? (
                <View
                  style={{
                    flexDirection: "row",
                    flex: 1,
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: 6,
                    overflow: "hidden",
                    backgroundColor: colors.card2,
                  }}
                >
                  {mlbSortTabs.map((tab) => {
                    const active = sortKey === tab.value;

                    return (
                      <TouchableOpacity
                        key={tab.value}
                        onPress={() => setSortKey(tab.value)}
                        activeOpacity={0.85}
                        style={{
                          flex: 1,
                          paddingVertical: 8,
                          paddingHorizontal: 4,
                          alignItems: "center",
                          justifyContent: "center",
                          backgroundColor: active ? colors.primary : "transparent",
                        }}
                      >
                        <Text
                          style={{
                            color: active ? "#fff" : colors.subtext,
                            fontWeight: "900",
                            fontSize: 11,
                          }}
                          numberOfLines={1}
                        >
                          {tab.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ) : (
                <View
                  style={{
                    flexDirection: "row",
                    flex: 1,
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: 6,
                    overflow: "hidden",
                    backgroundColor: colors.card2,
                  }}
                >
                  {[
                    {
                      value: "points",
                      label: i18n.t("defi.playerSelect.sortPoints", { defaultValue: "Points" }),
                    },
                    {
                      value: "ppg",
                      label: i18n.t("defi.playerSelect.sortPpg", {
                        defaultValue: "Moy. / match",
                      }),
                    },
                  ].map((tab) => {
                    const active = sortKey === tab.value;
                    return (
                      <TouchableOpacity
                        key={tab.value}
                        onPress={() => setSortKey(tab.value)}
                        activeOpacity={0.85}
                        style={{
                          flex: 1,
                          paddingVertical: 8,
                          paddingHorizontal: 4,
                          alignItems: "center",
                          justifyContent: "center",
                          backgroundColor: active ? colors.primary : "transparent",
                        }}
                      >
                        <Text
                          style={{
                            color: active ? "#fff" : colors.subtext,
                            fontWeight: "900",
                            fontSize: 11,
                          }}
                          numberOfLines={1}
                        >
                          {tab.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>
          </View>

          {/* Players list */}
          {loading ? (
            <View
              style={{
                flex: 1,
                alignItems: "center",
                justifyContent: "center",
                paddingVertical: 48,
                gap: 10,
              }}
            >
              <ActivityIndicator color={colors.primary} size="large" />
              <Ionicons name="hourglass-outline" size={22} color={colors.subtext} />
              <Text style={{ color: colors.subtext, fontWeight: "700", fontSize: 14 }}>
                {i18n.t("defi.loading.inProgress", { defaultValue: "Chargement en cours" })}
              </Text>
            </View>
          ) : (
          <FlatList
            data={filtered}
            extraData={`${sortKey}|${nhlActiveDisplaySeasonId}|${nhlShowPreviousSeason}|${poolStatsEpoch}|${searchQuery}`}
            keyExtractor={(item, idx) => String(item?.playerId ?? item?.id ?? `player-${idx}`)}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: 24, flexGrow: 1 }}
            ListEmptyComponent={
              !loading && String(searchQuery || "").trim() ? (
                <View style={{ paddingVertical: 28, paddingHorizontal: 12, alignItems: "center" }}>
                  <Text style={{ color: colors.subtext, fontWeight: "700", textAlign: "center" }}>
                    {i18n.t("defi.playerSelect.searchNoResults", {
                      defaultValue: "Aucun joueur ne correspond à ta recherche.",
                    })}
                  </Text>
                </View>
              ) : null
            }
            initialNumToRender={20}
            maxToRenderPerBatch={20}
            updateCellsBatchingPeriod={50}
            windowSize={10}
            removeClippedSubviews={Platform.OS === "android"}
            renderItem={({ item }) => {
              const pid = String(item?.playerId ?? "");
              const isChosen = pid && chosenSet.has(pid);

              const team = String(item?.teamAbbr || "").toUpperCase();
              const isMlb = isMlbDefiPlayer(item, sport);
              const oppAbbr = resolveMlbOpponentAbbr(item);
              const nhlOppAbbr = resolveNhlOpponentAbbr(item);

              const injuryStatus = String(item?.injury?.status || "").toLowerCase();
              const isOut = injuryStatus === "out";

              const oppRankOverall = item?.matchup?.oppRankOverall;
              const oppGoalDifferential = item?.matchup?.oppGoalDifferential;

              const displayName = isMlb
                ? String(item?.fullName || "—").trim() || "—"
                : shortPlayerName(item?.fullName);

              return (
                <TouchableOpacity
                  disabled={isChosen}
                  onPress={() => {
                    onPick?.(item);
                    onClose?.();
                  }}
                  activeOpacity={0.85}
                  style={{
                    paddingVertical: 10,
                    paddingHorizontal: 8,
                    borderBottomWidth: 1,
                    borderBottomColor: colors.border,
                    opacity: isChosen ? 0.45 : 1,
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
                    <Avatar player={item} size={isMlb ? 42 : 36} style={{ marginRight: 10 }} />

                    <View style={{ flex: 1, minWidth: 0, gap: isMlb ? 6 : 0 }}>
                      {isMlb ? (
                        <>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, minWidth: 0 }}>
                            <PlayerTeamLogo
                              teamAbbr={team}
                              sport={sport}
                              teamLogo={teamLogo}
                              colors={colors}
                              size={18}
                            />
                            <Text
                              numberOfLines={1}
                              style={{
                                fontSize: 16,
                                fontWeight: "800",
                                color: isOut ? colors.subtext : colors.text,
                                flexShrink: 1,
                              }}
                            >
                              {displayName}
                            </Text>
                            <InjuryIcon injury={item?.injury} size={16} />
                          </View>

                          <MlbOpponentMatchupLine
                            opponentAbbr={oppAbbr}
                            colors={colors}
                            formatStandingsLine={formatStandingsLine}
                          />

                          <MlbProbablePitcherLine
                            pitcher={item?.opponentProbablePitcher}
                            colors={colors}
                          />
                          <MlbBvpLine
                            bvp={item?.bvpVsOpposingStarter}
                            pitcher={item?.opponentProbablePitcher}
                            colors={colors}
                          />
                        </>
                      ) : (
                        <>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, minWidth: 0 }}>
                            <PlayerTeamLogo
                              teamAbbr={team}
                              sport={sport}
                              teamLogo={teamLogo}
                              colors={colors}
                              size={16}
                            />

                            <Text
                              numberOfLines={1}
                              style={{
                                fontSize: 16,
                                fontWeight: "800",
                                color: isOut ? colors.subtext : colors.text,
                                flexShrink: 1,
                              }}
                            >
                              {displayName}
                            </Text>

                            <InjuryIcon injury={item?.injury} size={16} />
                          </View>

                          {item?.matchup && nhlOppAbbr ? (
                            <View style={{ marginTop: 6, gap: 4 }}>
                              <NhlOpponentMatchupLine
                                opponentAbbr={nhlOppAbbr}
                                colors={colors}
                                formatStandingsLine={formatStandingsLine}
                              />
                              <TeamMetaBadge
                                compact
                                rankOverall={oppRankOverall}
                                goalDifferential={oppGoalDifferential}
                              />
                            </View>
                          ) : null}
                        </>
                      )}
                    </View>

                    {/* Stats droite */}
                    <View
                      style={{
                        marginLeft: 10,
                        paddingHorizontal: 10,
                        paddingVertical: 6,
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: colors.border,
                        backgroundColor: colors.background,
                        alignItems: "flex-end",
                        minWidth: 72,
                      }}
                    >
                      <Text style={{ color: colors.subtext, fontSize: 11, fontWeight: "900" }}>{getStatLabel()}</Text>
                      <Text
                        style={{
                          color: colors.text,
                          fontSize: 13,
                          fontWeight: "900",
                          fontVariant: ["tabular-nums"],
                        }}
                      >
                        {getStatValue(item)}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            }}
          />
          )}
        </View>
      </View>
    </Modal>
  );
}