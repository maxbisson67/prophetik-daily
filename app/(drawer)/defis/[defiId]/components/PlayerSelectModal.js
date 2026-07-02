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
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@src/theme/ThemeProvider";
import i18n from "@src/i18n/i18n";
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

function mlbPointsValue(p) {
  const stored = num(p?.points);
  if (stored > 0) return stored;
  return num(p?.hits) + num(p?.rbi) + num(p?.homeRuns);
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
  pickerSlotIndex = 0,
  sport = "NHL",
  formatStandingsLine = null,
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

  useEffect(() => {
    if (!visible) return;

    setSortKey(defaultSortKey);

    const ft = String(forcedTier || "").toUpperCase();
    if (ft === "T1" || ft === "T2" || ft === "T3") {
      setTierFilter(ft);
    } else {
      setTierFilter("T1");
    }
  }, [visible, forcedTier, defaultSortKey]);

  const chosenSet = useMemo(() => new Set((alreadyChosenIds || []).map((x) => String(x))), [
    JSON.stringify(alreadyChosenIds || []),
  ]);

  useEffect(() => {
    if (!isMlbSport && isFree && sortKey === "ppg") setSortKey("points");
  }, [isMlbSport, isFree, sortKey]);

  function getStatLabel() {
    if (isMlbSport) {
      if (sortKey === "hits") {
        return i18n.t("defi.playerSelect.statHits", { defaultValue: "H" });
      }
      if (sortKey === "rbi") {
        return i18n.t("defi.playerSelect.statRbi", { defaultValue: "RBI" });
      }
      if (sortKey === "hr") {
        return i18n.t("defi.playerSelect.statHr", { defaultValue: "HR" });
      }
      return i18n.t("defi.playerSelect.statPoints", { defaultValue: "PTS" });
    }
    if (sortKey === "ppg" && !isFree) return "PPG";
    return "PTS";
  }

  function getStatValue(p) {
    if (isMlbSport) {
      if (sortKey === "hits") return String(Math.round(num(p?.hits)));
      if (sortKey === "rbi") return String(Math.round(num(p?.rbi)));
      if (sortKey === "hr") return String(Math.round(num(p?.homeRuns)));
      return String(Math.round(mlbPointsValue(p)));
    }
    if (sortKey === "ppg" && !isFree) return num(p?.pointsPerGame).toFixed(2);
    return String(Math.round(num(p?.points)));
  }

  function sortComparator(a, b) {
    if (isMlbSport) {
      if (sortKey === "hits") return num(b.hits) - num(a.hits);
      if (sortKey === "rbi") return num(b.rbi) - num(a.rbi);
      if (sortKey === "hr") return num(b.homeRuns) - num(a.homeRuns);
      if (sortKey === "points") return mlbPointsValue(b) - mlbPointsValue(a);
    }

    if (sortKey === "points") return num(b.points) - num(a.points);
    if (sortKey === "ppg" && !isFree) return num(b.pointsPerGame) - num(a.pointsPerGame);

    const ra = num(a.rank ?? 999999);
    const rb = num(b.rank ?? 999999);
    if (ra !== rb) return ra - rb;
    return String(a.fullName || "").localeCompare(String(b.fullName || ""));
  }

  const filtered = useMemo(() => {
    const base = Array.isArray(options) ? options.slice() : [];
    let list = base.filter((p) => String(p.tier || "").toUpperCase() === tierFilter);
    list.sort(sortComparator);
    return list;
  }, [options, tierFilter, sortKey, isFree, isMlbSport]);

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
        value: "hr",
        label: i18n.t("defi.playerSelect.sortHr", { defaultValue: "HR" }),
      },
    ],
    []
  );

  const mlbSelectionHint = useMemo(() => {
    if (!isMlbSport) return null;

    const tier = String(forcedTier || tierFilter || "").toUpperCase();
    const hintBody =
      tier === "T3"
        ? i18n.t("defi.playerSelect.hintOpen", {
            defaultValue:
              "Sélectionne un joueur parmi les choix suivants. Les points affichés pour un joueur correspondent à la somme des coups sûrs (HITS), des points produits (RBI) et des coups de circuit (HR).",
          })
        : i18n.t("defi.playerSelect.hintTop10", {
            defaultValue:
              "Sélectionne un joueur parmi les 10 choix suivants. Les points affichés pour un joueur correspondent à la somme des coups sûrs (HITS), des points produits (RBI) et des coups de circuit (HR).",
          });

    return i18n.t("defi.playerSelect.choiceHint", {
      index: Number(pickerSlotIndex) + 1,
      hint: hintBody,
      defaultValue: `Choix ${Number(pickerSlotIndex) + 1} : ${hintBody}`,
    });
  }, [isMlbSport, forcedTier, tierFilter, pickerSlotIndex]);

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

          {mlbSelectionHint ? (
            <Text
              style={{
                color: colors.subtext,
                fontSize: 13,
                lineHeight: 18,
                marginBottom: 10,
              }}
            >
              {mlbSelectionHint}
            </Text>
          ) : null}

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
                <>
                  <Chip label="Points" active={sortKey === "points"} onPress={() => setSortKey("points")} />
                  {!isFree ? (
                    <Chip
                      label="Points par partie"
                      active={sortKey === "ppg"}
                      onPress={() => setSortKey("ppg")}
                      locked={!isPro}
                    />
                  ) : null}
                </>
              )}
            </View>
          </View>

          {/* Players list */}
          <FlatList
            data={filtered}
            keyExtractor={(item, idx) => String(item?.playerId ?? item?.id ?? `player-${idx}`)}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: 24 }}
            initialNumToRender={20}
            maxToRenderPerBatch={20}
            updateCellsBatchingPeriod={50}
            windowSize={10}
            removeClippedSubviews={Platform.OS === "android"}
            renderItem={({ item }) => {
              const pid = String(item?.playerId ?? "");
              const isChosen = pid && chosenSet.has(pid);

              const team = String(item?.teamAbbr || "").toUpperCase();
              const opp = String(item?.matchup?.opponentAbbr || "").toUpperCase();
              const isMlb = isMlbDefiPlayer(item, sport);
              const oppAbbr = resolveMlbOpponentAbbr(item);

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

                            {!isFree && !!opp && teamLogo ? (
                              <>
                                <Text style={{ color: colors.subtext, fontWeight: "900" }}>@</Text>
                                <Image source={teamLogo(opp)} style={{ width: 16, height: 16 }} />
                              </>
                            ) : null}
                          </View>

                          {!isFree && item?.matchup ? (
                            <View style={{ marginTop: 6 }}>
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
        </View>
      </View>
    </Modal>
  );
}