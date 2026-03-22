import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  ActivityIndicator,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  Image,
} from "react-native";
import { Stack } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@src/theme/ThemeProvider";
import firestore from "@react-native-firebase/firestore";
import i18n from "@src/i18n/i18n";

/* ========================
   Logos NHL
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
  return LOGO_MAP[String(abbr || "").toUpperCase()] || null;
}

function pickNumber(v, fallback = 0) {
  if (typeof v === "number") return Number.isFinite(v) ? v : fallback;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  }
  return fallback;
}

function pickStr(v, fallback = "") {
  return typeof v === "string" ? v : fallback;
}

function getCurrentSeasonId(date = new Date()) {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1;
  const startYear = month >= 7 ? year : year - 1;
  const endYear = startYear + 1;
  return `${startYear}${endYear}`;
}

function headshotUrl(abbr, playerId, seasonId) {
  return abbr && playerId
    ? `https://assets.nhle.com/mugs/nhl/${seasonId}/${String(abbr).toUpperCase()}/${playerId}.png`
    : null;
}

const PAGE_SIZE = 50;

const COLS = {
  rank: 26,
  avatar: 30,
  gap1: 6,
  logo: 22,
  gap2: 6,
  gp: 28,
  g: 24,
  a: 24,
  p: 26,
  ppm: 40,
};

const SORT_OPTIONS = [
  { key: "points", labelKey: "nhl.skaters.sort.points", fallback: "PTS" },
  { key: "goals", labelKey: "nhl.skaters.sort.goals", fallback: "G" },
  { key: "assists", labelKey: "nhl.skaters.sort.assists", fallback: "A" },
  { key: "pointsPerGame", labelKey: "nhl.skaters.sort.pointsPerGame", fallback: "PPM" },
];

function Pill({ active, label, onPress, colors }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: active ? colors.primary : colors.border,
        backgroundColor: active ? colors.primary : colors.card,
      }}
    >
      <Text style={{ color: active ? "#fff" : colors.text, fontWeight: "800", fontSize: 12 }}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function TableHeader({ colors, sortField }) {
  const isActive = (field) => sortField === field;

  const statHeaderStyle = (field, width) => ({
    width,
    color: colors.subtext,
    fontSize: 10,
    fontWeight: isActive(field) ? "900" : "600",
    textAlign: "left",
  });

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        marginTop: 4,
        marginBottom: 4,
      }}
    >
      <Text
        style={{
          width: COLS.rank,
          color: colors.subtext,
          fontSize: 10,
          fontWeight: "900",
        }}
      >
        {i18n.t("nhl.skaters.rank", { defaultValue: "Pos" })}
      </Text>

      <View style={{ width: COLS.avatar }} />
      <View style={{ width: COLS.gap1 }} />
      <View style={{ width: COLS.logo }} />
      <View style={{ width: COLS.gap2 }} />

      <Text
        style={{
          flex: 1,
          color: colors.subtext,
          fontSize: 10,
          fontWeight: "900",
        }}
      >
        {i18n.t("nhl.skaters.player", { defaultValue: "Joueur" })}
      </Text>

      <Text style={{ width: COLS.gp, color: colors.subtext, fontSize: 10, fontWeight: "600" }}>
        GP
      </Text>
      <Text style={statHeaderStyle("goals", COLS.g)}>G</Text>
      <Text style={statHeaderStyle("assists", COLS.a)}>A</Text>
      <Text style={statHeaderStyle("points", COLS.p)}>P</Text>
      <Text style={statHeaderStyle("pointsPerGame", COLS.ppm)}>PPM</Text>
    </View>
  );
}

function PlayerRow({ item, index, colors, seasonId, sortField }) {
  const lastName = pickStr(item?.lastName, "—");
  const gp = pickNumber(item?.gamesPlayed, 0);
  const goals = pickNumber(item?.goals, 0);
  const assists = pickNumber(item?.assists, 0);
  const points = pickNumber(item?.points, 0);
  const ppm = pickNumber(item?.pointsPerGame, 0);

  const playerId = pickStr(item?.playerId, "");
  const teamAbbrevs = pickStr(item?.teamAbbrevs || item?.teamAbbr, "");
  const headshot = headshotUrl(teamAbbrevs, playerId, seasonId);
  const logo = teamLogo(teamAbbrevs);

  const isActive = (field) => sortField === field;

  const statStyle = (field, width) => ({
    width,
    fontSize: 11,
    fontWeight: isActive(field) ? "900" : "400",
    color: colors.text,
  });

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
      }}
    >
      <Text
        style={{
          width: COLS.rank,
          color: colors.text,
          fontSize: 11,
          fontWeight: "800",
        }}
      >
        {index + 1}
      </Text>

      <View
        style={{
          width: COLS.avatar,
          height: COLS.avatar,
          borderRadius: COLS.avatar / 2,
          backgroundColor: colors.background,
          borderWidth: 1,
          borderColor: colors.border,
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
        }}
      >
        {headshot ? (
          <Image
            source={{ uri: headshot }}
            style={{ width: "100%", height: "100%" }}
            resizeMode="cover"
          />
        ) : (
          <Ionicons name="person-outline" size={14} color={colors.subtext} />
        )}
      </View>

      <View style={{ width: COLS.gap1 }} />

      <View
        style={{
          width: COLS.logo,
          height: COLS.logo,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {logo ? (
          <Image
            source={logo}
            style={{ width: 18, height: 18 }}
            resizeMode="contain"
          />
        ) : (
          <Text style={{ color: colors.subtext, fontSize: 9, fontWeight: "800" }}>
            {teamAbbrevs || "—"}
          </Text>
        )}
      </View>

      <View style={{ width: COLS.gap2 }} />

      <Text
        numberOfLines={1}
        style={{
          flex: 1,
          color: colors.text,
          fontSize: 12,
          fontWeight: "800",
        }}
      >
        {lastName}
      </Text>

      <Text
        style={{
          width: COLS.gp,
          color: colors.text,
          fontSize: 11,
          fontWeight: "400",
        }}
      >
        {gp}
      </Text>

      <Text style={statStyle("goals", COLS.g)}>{goals}</Text>
      <Text style={statStyle("assists", COLS.a)}>{assists}</Text>
      <Text style={statStyle("points", COLS.p)}>{points}</Text>
      <Text style={statStyle("pointsPerGame", COLS.ppm)}>{ppm.toFixed(2)}</Text>
    </View>
  );
}

export default function NhlSkaterLeadersScreen() {
  const { colors } = useTheme();

  const [seasonId, setSeasonId] = useState(getCurrentSeasonId());
  const [sortField, setSortField] = useState("points");

  const [rows, setRows] = useState([]);
  const [busy, setBusy] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");

  const [lastDoc, setLastDoc] = useState(null);
  const [hasMore, setHasMore] = useState(true);

  const headerTitle = i18n.t("nhl.skaters.title", {
    defaultValue: "Statistiques joueurs NHL",
  });

  const sortLabel = useMemo(() => {
    const option = SORT_OPTIONS.find((x) => x.key === sortField);
    return option
      ? i18n.t(option.labelKey, { defaultValue: option.fallback })
      : sortField;
  }, [sortField]);

  const buildQuery = useCallback((currentSeasonId, currentSortField, afterDoc = null) => {
    let q = firestore()
      .collection("nhl_player_stats_current")
      .where("seasonId", "==", String(currentSeasonId))
      .orderBy(currentSortField, "desc")
      .orderBy("playerId", "asc")
      .limit(PAGE_SIZE);

    if (afterDoc) {
      q = q.startAfter(afterDoc);
    }

    return q;
  }, []);

  const loadFirstPage = useCallback(async () => {
    try {
      setError("");
      setBusy(true);

      const currentSeason = getCurrentSeasonId();
      setSeasonId(currentSeason);

      const snap = await buildQuery(currentSeason, sortField).get();
      const docs = snap.docs || [];

      const data = docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      setRows(data);
      setLastDoc(docs.length ? docs[docs.length - 1] : null);
      setHasMore(docs.length === PAGE_SIZE);
    } catch (e) {
      console.log("[NhlSkaterLeaders] loadFirstPage error", e?.message || e);
      setError(
        i18n.t("nhl.skaters.error", {
          defaultValue: "Impossible de charger les joueurs.",
        })
      );
      setRows([]);
      setLastDoc(null);
      setHasMore(false);
    } finally {
      setBusy(false);
      setRefreshing(false);
    }
  }, [buildQuery, sortField]);

  const loadMore = useCallback(async () => {
    if (loadingMore || busy || !hasMore || !lastDoc) return;

    try {
      setLoadingMore(true);

      const snap = await buildQuery(seasonId, sortField, lastDoc).get();
      const docs = snap.docs || [];

      const data = docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      setRows((prev) => [...prev, ...data]);
      setLastDoc(docs.length ? docs[docs.length - 1] : lastDoc);
      setHasMore(docs.length === PAGE_SIZE);
    } catch (e) {
      console.log("[NhlSkaterLeaders] loadMore error", e?.message || e);
    } finally {
      setLoadingMore(false);
    }
  }, [buildQuery, busy, hasMore, lastDoc, loadingMore, seasonId, sortField]);

  useEffect(() => {
    loadFirstPage();
  }, [loadFirstPage]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadFirstPage();
  }, [loadFirstPage]);

  const onChangeSort = useCallback((next) => {
    setSortField((prev) => (prev === next ? prev : next));
  }, []);

  const renderItem = ({ item, index }) => {
    return (
      <PlayerRow
        item={item}
        index={index}
        colors={colors}
        seasonId={seasonId}
        sortField={sortField}
      />
    );
  };

  return (
    <>
      <Stack.Screen options={{ title: headerTitle }} />

      <View style={{ flex: 1, backgroundColor: colors.background }}>
        {busy ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <ActivityIndicator color={colors.primary} />
            <Text style={{ marginTop: 8, color: colors.subtext, fontSize: 12 }}>
              {i18n.t("nhl.skaters.loading", {
                defaultValue: "Chargement des joueurs…",
              })}
            </Text>
          </View>
        ) : (
          <FlatList
            data={rows}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={colors.primary}
              />
            }
            onEndReachedThreshold={0.4}
            onEndReached={loadMore}
            ListHeaderComponent={() => (
              <View style={{ marginBottom: 12, gap: 10 }}>
 

                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
                  {SORT_OPTIONS.map((opt) => (
                    <Pill
                      key={opt.key}
                      colors={colors}
                      active={sortField === opt.key}
                      label={i18n.t(opt.labelKey, { defaultValue: opt.fallback })}
                      onPress={() => onChangeSort(opt.key)}
                    />
                  ))}
                </View>

                <TableHeader colors={colors} sortField={sortField} />

                {!!error && (
                  <View
                    style={{
                      padding: 12,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: colors.border,
                      backgroundColor: colors.card,
                    }}
                  >
                    <Text style={{ color: colors.text, fontWeight: "800" }}>
                      {error}
                    </Text>
                  </View>
                )}
              </View>
            )}
            ListEmptyComponent={() => (
              <View style={{ marginTop: 40, alignItems: "center" }}>
                <Text style={{ color: colors.subtext }}>
                  {i18n.t("nhl.skaters.empty", { defaultValue: "Aucune donnée." })}
                </Text>
              </View>
            )}
            ListFooterComponent={() => (
              <View style={{ paddingTop: 8, paddingBottom: 8 }}>
                {loadingMore ? (
                  <View style={{ alignItems: "center", paddingVertical: 12 }}>
                    <ActivityIndicator color={colors.primary} />
                    <Text style={{ marginTop: 8, color: colors.subtext, fontSize: 12 }}>
                      {i18n.t("nhl.skaters.loadingMore", {
                        defaultValue: "Chargement de plus de joueurs…",
                      })}
                    </Text>
                  </View>
                ) : hasMore ? (
                  <TouchableOpacity
                    onPress={loadMore}
                    style={{
                      alignSelf: "center",
                      paddingVertical: 10,
                      paddingHorizontal: 14,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: colors.border,
                      backgroundColor: colors.card,
                    }}
                  >
                    <Text style={{ color: colors.text, fontWeight: "900", fontSize: 12 }}>
                      {i18n.t("nhl.skaters.loadMore", {
                        defaultValue: "Charger plus",
                      })}
                    </Text>
                  </TouchableOpacity>
                ) : rows.length > 0 ? (
                  <View style={{ alignItems: "center", paddingVertical: 8 }}>
                    <Text style={{ color: colors.subtext, fontSize: 12 }}>
                      {i18n.t("nhl.skaters.end", {
                        defaultValue: "Fin de la liste.",
                      })}
                    </Text>
                  </View>
                ) : null}
              </View>
            )}
          />
        )}
      </View>
    </>
  );
}