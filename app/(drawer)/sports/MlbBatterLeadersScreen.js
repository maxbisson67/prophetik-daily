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
import useAppConfig from "@src/hooks/useAppConfig";
import { SvgUri } from "react-native-svg";
import { mlbHeadshotUrl } from "@src/mlb/mlbPlayerAssets";
import { enrichMlbLeaderRowsWithTeams } from "@src/mlb/enrichMlbLeaderRowsWithTeams";
import { lookupMlbTeamById, lookupTeamByAbbr } from "@src/groups/data/fallbackTeams";
import {
  formatSeasonLabel,
  getMlbPreviousSeason,
  resolveMlbLeadersSeasonId,
  computeMlbRateStatMinPlateAppearances,
  isMlbRateStatSortField,
  isMlbBatterQualifiedForRateStat,
} from "@src/players/seasonStatsHelpers";

const PAGE_SIZE = 50;
const MAX_FETCH_BATCHES = 10;

const COLS = {
  rank: 26,
  avatar: 30,
  gap1: 6,
  logo: 28,
  gap2: 6,
  rbi: 28,
  hits: 24,
  hr: 24,
  avg: 32,
  ops: 36,
};

const STAT_COLUMNS = [
  { key: "rbi", header: "RBI", width: COLS.rbi },
  { key: "hits", header: "H", width: COLS.hits },
  { key: "homeRuns", header: "HR", width: COLS.hr },
  { key: "battingAverage", header: "%", width: COLS.avg },
  { key: "ops", header: "OPS", width: COLS.ops },
];

const SORT_OPTIONS = [
  { key: "rbi", labelKey: "mlb.batters.sort.rbi", fallback: "RBI" },
  { key: "hits", labelKey: "mlb.batters.sort.hits", fallback: "H" },
  { key: "homeRuns", labelKey: "mlb.batters.sort.homeRuns", fallback: "HR" },
  { key: "battingAverage", labelKey: "mlb.batters.sort.battingAverage", fallback: "%" },
  { key: "ops", labelKey: "mlb.batters.sort.ops", fallback: "OPS" },
];

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

function formatStatValue(item, key) {
  switch (key) {
    case "rbi":
      return pickNumber(item?.rbi, 0);
    case "hits":
      return pickNumber(item?.hits, 0);
    case "homeRuns":
      return pickNumber(item?.homeRuns, 0);
    case "battingAverage":
      return pickStr(item?.battingAverage, ".000");
    case "ops":
      return pickStr(item?.ops, ".000");
    default:
      return "—";
  }
}

function mlbLogoUrl(teamId) {
  const id = String(teamId || "").trim();
  return id ? `https://www.mlbstatic.com/team-logos/${id}.svg` : null;
}

function resolveMlbTeamForRow(item) {
  const teamId = pickStr(item?.teamId, "");
  const teamAbbr = pickStr(item?.teamAbbr, "").toUpperCase();

  if (teamId) {
    const byId = lookupMlbTeamById(teamId);
    return {
      sport: "MLB",
      teamId,
      abbreviation: teamAbbr || byId?.abbreviation || "",
    };
  }

  if (teamAbbr) {
    return lookupTeamByAbbr("MLB", teamAbbr);
  }

  return null;
}

function MlbTeamLogo({ team, colors, size = 18 }) {
  const url = team?.teamId ? mlbLogoUrl(team.teamId) : null;
  const abbr = team?.abbreviation || "—";

  return (
    <View
      style={{
        width: size + 10,
        height: size + 10,
        borderRadius: 8,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#fff",
        borderWidth: 1,
        borderColor: colors.border,
        overflow: "hidden",
      }}
    >
      {url ? (
        <SvgUri uri={url} width={size} height={size} />
      ) : (
        <Text style={{ color: colors.subtext, fontWeight: "900", fontSize: 9 }}>{abbr}</Text>
      )}
    </View>
  );
}

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
    fontSize: 9,
    fontWeight: isActive(field) ? "800" : "600",
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
        {i18n.t("mlb.batters.rank", { defaultValue: "Pos" })}
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
        {i18n.t("mlb.batters.player", { defaultValue: "Joueur" })}
      </Text>

      {STAT_COLUMNS.map((col) => (
        <Text key={col.key} numberOfLines={1} style={statHeaderStyle(col.key, col.width)}>
          {col.header}
        </Text>
      ))}
    </View>
  );
}

function PlayerRow({ item, index, colors, sortField }) {
  const lastName = pickStr(item?.lastName, pickStr(item?.fullName, "—"));

  const playerId = pickStr(item?.playerId, "");
  const headshot = mlbHeadshotUrl(playerId);
  const team = resolveMlbTeamForRow(item);

  const isActive = (field) => sortField === field;

  const statStyle = (field, width) => ({
    width,
    fontSize: 10,
    fontWeight: isActive(field) ? "800" : "400",
    color: colors.text,
    fontVariant: ["tabular-nums"],
    includeFontPadding: false,
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
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <MlbTeamLogo team={team} colors={colors} size={18} />
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

      {STAT_COLUMNS.map((col) => (
        <Text key={col.key} numberOfLines={1} style={statStyle(col.key, col.width)}>
          {formatStatValue(item, col.key)}
        </Text>
      ))}
    </View>
  );
}

export default function MlbBatterLeadersScreen() {
  const { colors } = useTheme();
  const { config: seasonConfig } = useAppConfig();

  const [seasonId, setSeasonId] = useState("");
  const [isPreviousSeason, setIsPreviousSeason] = useState(false);
  const [sortField, setSortField] = useState("rbi");

  const [rows, setRows] = useState([]);
  const [busy, setBusy] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");

  const [lastDoc, setLastDoc] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [minRateStatPa, setMinRateStatPa] = useState(null);

  const headerTitle = i18n.t("mlb.batters.title", {
    defaultValue: "Statistiques frappeurs MLB",
  });

  const buildQuery = useCallback((currentSeasonId, currentSortField, afterDoc = null) => {
    let q = firestore()
      .collection("mlb_player_stats_current")
      .where("seasonId", "==", String(currentSeasonId))
      .orderBy(currentSortField, "desc")
      .orderBy("playerId", "asc")
      .limit(PAGE_SIZE);

    if (afterDoc) {
      q = q.startAfter(afterDoc);
    }

    return q;
  }, []);

  const fetchQualifiedLeaders = useCallback(
    async ({
      currentSeasonId,
      currentSortField,
      minPa = 0,
      afterDoc = null,
      limit = PAGE_SIZE,
    }) => {
      const needsFilter = isMlbRateStatSortField(currentSortField);
      const qualified = [];
      let cursor = afterDoc;
      let lastFetchedDoc = afterDoc;
      let exhausted = false;

      for (let batch = 0; batch < MAX_FETCH_BATCHES; batch += 1) {
        const snap = await buildQuery(currentSeasonId, currentSortField, cursor).get();
        const docs = snap?.docs ?? [];

        if (!docs.length) {
          exhausted = true;
          break;
        }

        lastFetchedDoc = docs[docs.length - 1];
        cursor = lastFetchedDoc;

        for (const doc of docs) {
          const row = { id: doc.id, ...doc.data() };
          if (!needsFilter || isMlbBatterQualifiedForRateStat(row, minPa)) {
            qualified.push(row);
            if (qualified.length >= limit) break;
          }
        }

        if (qualified.length >= limit) break;

        if (docs.length < PAGE_SIZE) {
          exhausted = true;
          break;
        }
      }

      return {
        rows: qualified,
        lastDoc: lastFetchedDoc,
        hasMore: !exhausted,
      };
    },
    [buildQuery]
  );

  const loadFirstPage = useCallback(async () => {
    try {
      setError("");
      setBusy(true);

      const resolved = resolveMlbLeadersSeasonId({ seasonConfig });
      let targetSeasonId = resolved.seasonId;
      let showingPrevious = resolved.isPreviousSeason;

      let page = await fetchQualifiedLeaders({
        currentSeasonId: targetSeasonId,
        currentSortField: sortField,
        minPa: computeMlbRateStatMinPlateAppearances({
          seasonConfig,
          seasonId: targetSeasonId,
          isPreviousSeason: showingPrevious,
        }),
      });

      if (!page.rows.length && !showingPrevious) {
        const previousId = getMlbPreviousSeason();
        if (previousId && previousId !== targetSeasonId) {
          targetSeasonId = previousId;
          showingPrevious = true;
          page = await fetchQualifiedLeaders({
            currentSeasonId: targetSeasonId,
            currentSortField: sortField,
            minPa: computeMlbRateStatMinPlateAppearances({
              seasonConfig,
              seasonId: targetSeasonId,
              isPreviousSeason: true,
            }),
          });
        }
      }

      const minPa = computeMlbRateStatMinPlateAppearances({
        seasonConfig,
        seasonId: targetSeasonId,
        isPreviousSeason: showingPrevious,
      });

      setSeasonId(targetSeasonId);
      setIsPreviousSeason(showingPrevious);
      setMinRateStatPa(isMlbRateStatSortField(sortField) ? minPa : null);

      const enriched = await enrichMlbLeaderRowsWithTeams(page.rows);

      setRows(enriched);
      setLastDoc(page.lastDoc);
      setHasMore(page.hasMore);
    } catch (e) {
      console.log("[MlbBatterLeaders] loadFirstPage error", e?.message || e);
      setError(
        i18n.t("mlb.batters.error", {
          defaultValue: "Impossible de charger les joueurs.",
        })
      );
      setRows([]);
      setLastDoc(null);
      setHasMore(false);
      setMinRateStatPa(null);
    } finally {
      setBusy(false);
      setRefreshing(false);
    }
  }, [fetchQualifiedLeaders, seasonConfig, sortField]);

  const loadMore = useCallback(async () => {
    if (loadingMore || busy || !hasMore || !lastDoc) return;

    try {
      setLoadingMore(true);

      const minPa =
        minRateStatPa ??
        computeMlbRateStatMinPlateAppearances({
          seasonConfig,
          seasonId,
          isPreviousSeason,
        });

      const page = await fetchQualifiedLeaders({
        currentSeasonId: seasonId,
        currentSortField: sortField,
        minPa,
        afterDoc: lastDoc,
      });

      const enriched = await enrichMlbLeaderRowsWithTeams(page.rows);

      setRows((prev) => [...prev, ...enriched]);
      setLastDoc(page.lastDoc || lastDoc);
      setHasMore(page.hasMore);
    } catch (e) {
      console.log("[MlbBatterLeaders] loadMore error", e?.message || e);
    } finally {
      setLoadingMore(false);
    }
  }, [
    busy,
    fetchQualifiedLeaders,
    hasMore,
    isPreviousSeason,
    lastDoc,
    loadingMore,
    minRateStatPa,
    seasonConfig,
    seasonId,
    sortField,
  ]);

  const qualificationNotice = useMemo(() => {
    if (!isMlbRateStatSortField(sortField) || !minRateStatPa) return null;
    return i18n.t("mlb.batters.qualificationNotice", {
      minPa: minRateStatPa,
      defaultValue: `Qualifiés : ≥ ${minRateStatPa} PA (seuil dynamique selon la progression de la saison)`,
    });
  }, [minRateStatPa, sortField]);

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

  const renderItem = ({ item, index }) => (
    <PlayerRow item={item} index={index} colors={colors} sortField={sortField} />
  );

  return (
    <>
      <Stack.Screen options={{ title: headerTitle }} />

      <View style={{ flex: 1, backgroundColor: colors.background }}>
        {busy ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <ActivityIndicator color={colors.primary} />
            <Text style={{ marginTop: 8, color: colors.subtext, fontSize: 12 }}>
              {i18n.t("mlb.batters.loading", {
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
                {isPreviousSeason && !!seasonId ? (
                  <View
                    style={{
                      padding: 12,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: colors.border,
                      backgroundColor: colors.card,
                    }}
                  >
                    <Text style={{ color: colors.subtext, fontSize: 12, lineHeight: 18 }}>
                      {i18n.t("mlb.batters.previousSeasonNotice", {
                        season: formatSeasonLabel("MLB", seasonId),
                        defaultValue:
                          "Saison {{season}} — la prochaine saison n'a pas encore débuté.",
                      })}
                    </Text>
                  </View>
                ) : null}

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

                {!!qualificationNotice && (
                  <Text style={{ color: colors.subtext, fontSize: 11, lineHeight: 16 }}>
                    {qualificationNotice}
                  </Text>
                )}

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
                    <Text style={{ color: colors.text, fontWeight: "800" }}>{error}</Text>
                  </View>
                )}
              </View>
            )}
            ListEmptyComponent={() => (
              <View style={{ marginTop: 40, alignItems: "center" }}>
                <Text style={{ color: colors.subtext }}>
                  {i18n.t("mlb.batters.empty", { defaultValue: "Aucune donnée." })}
                </Text>
              </View>
            )}
            ListFooterComponent={() => (
              <View style={{ paddingTop: 8, paddingBottom: 8 }}>
                {loadingMore ? (
                  <View style={{ alignItems: "center", paddingVertical: 12 }}>
                    <ActivityIndicator color={colors.primary} />
                    <Text style={{ marginTop: 8, color: colors.subtext, fontSize: 12 }}>
                      {i18n.t("mlb.batters.loadingMore", {
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
                      {i18n.t("mlb.batters.loadMore", {
                        defaultValue: "Charger plus",
                      })}
                    </Text>
                  </TouchableOpacity>
                ) : rows.length > 0 ? (
                  <View style={{ alignItems: "center", paddingVertical: 8 }}>
                    <Text style={{ color: colors.subtext, fontSize: 12 }}>
                      {i18n.t("mlb.batters.end", {
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
