import React, { useMemo, useState, useCallback, useEffect, useRef } from "react";
import {
  View,
  Text,
  ActivityIndicator,
  FlatList,
  RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Stack, useRouter } from "expo-router";

import { useAuth } from "@src/auth/SafeAuthProvider";
import { useGroups } from "@src/groups/useGroups";
import { useTheme } from "@src/theme/ThemeProvider";
import i18n from "@src/i18n/i18n";

import firestore from "@react-native-firebase/firestore";

import GroupLeaderboardCard from "@src/leaderboard/GroupLeaderboardCard";
import { dedupeById } from "@src/leaderboard/utils";
import LeaderboardMemberModal from "@src/leaderboard/LeaderboardMemberModal";
import LeaderboardLegend from "@src/leaderboard/LeaderboardLegend";
import ProphetikIcons from "@src/ui/ProphetikIcons";

// ✅ hooks (leaderboards saison)
import useCurrentSeason from "@src/hooks/useCurrentSeason";
import Analytics from "@src/services/analytics";

/* 🔎 hook: tous les groupes dont je suis owner (ownerId == uid OU createdBy == uid) */
function useOwnedGroups(uid) {
  const [owned, setOwned] = useState([]);
  const [loading, setLoading] = useState(!!uid);

  useEffect(() => {
    if (!uid) {
      setOwned([]);
      setLoading(false);
      return;
    }

    const results = { ownerId: [], createdBy: [] };
    const unsubs = [];

    function attach(qRef, key) {
      const un = qRef.onSnapshot(
        (snap) => {
          results[key] = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

          const merged = dedupeById([...results.ownerId, ...results.createdBy]).filter((g) => {
            const status = String(g?.status || "").toLowerCase();
            if (g?.active === false) return false;
            if (status === "archived" || status === "deleted") return false;
            return true;
          });

          setOwned(merged);
          setLoading(false);
        },
        () => setLoading(false)
      );

      unsubs.push(un);
    }

    try {
      attach(firestore().collection("groups").where("ownerId", "==", String(uid)), "ownerId");
    } catch {}
    try {
      attach(firestore().collection("groups").where("createdBy", "==", String(uid)), "createdBy");
    } catch {}

    return () => {
      unsubs.forEach((u) => {
        try {
          u?.();
        } catch {}
      });
    };
  }, [uid]);

  return { owned, loading };
}

/**
 * ✅ hook: écoute un leaderboard "members" pour chaque groupeId / seasonId
 * MVP:
 * - tri simple par pointsTotal desc pour tous
 */
function useLeaderboardsSeasonForGroups({ groupIds, seasonId, enabled }) {
  const [all, setAll] = useState({});
  const [loading, setLoading] = useState(!!enabled);

  useEffect(() => {
    if (!enabled || !seasonId || !Array.isArray(groupIds)) {
      setAll({});
      setLoading(false);
      return;
    }

    if (!groupIds.length) {
      setAll({});
      setLoading(false);
      return;
    }

    setLoading(true);

    const unsubs = [];
    let alive = true;

    const initial = {};
    groupIds.forEach((gid) => (initial[String(gid)] = []));
    setAll(initial);

    groupIds.forEach((gid) => {
      const groupId = String(gid);
      const base = firestore().collection(`groups/${groupId}/leaderboards/${seasonId}/members`);
      const q = base.orderBy("pointsTotal", "desc").limit(50);

      const un = q.onSnapshot(
        (snap) => {
          if (!alive) return;
          const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
          setAll((prev) => ({ ...(prev || {}), [groupId]: rows }));
          setLoading(false);
        },
        (err) => {
          console.log("[LB] ERROR", err?.code, err?.message);
          setLoading(false);
        }
      );

      unsubs.push(un);
    });

    return () => {
      alive = false;
      unsubs.forEach((u) => {
        try {
          u?.();
        } catch {}
      });
    };
  }, [enabled, seasonId, JSON.stringify(groupIds || [])]);

  return { all, loading };
}

function normalizeMemberRow(row) {
  const r = row || {};

  const fgcPoints = Number(r.fgcPoints ?? r?.families?.fgc?.points ?? 0) || 0;
  const tpPoints = Number(r.tpPoints ?? r?.families?.tp?.points ?? 0) || 0;
  const tsPoints =
    Number(
      r.tsPoints ??
        r.standardPoints ??
        r?.families?.ts?.points ??
        r?.families?.standard?.points ??
        0
    ) || 0;

  const pointsTotal =
    Number(r.pointsTotal ?? fgcPoints + tpPoints + tsPoints) || 0;

  const fgcWins = Number(r.fgcWins ?? r?.families?.fgc?.wins ?? 0) || 0;
  const tpWins = Number(r.tpWins ?? r?.families?.tp?.wins ?? 0) || 0;
  const tsWins =
    Number(
      r.tsWins ??
        r.standardWins ??
        r?.families?.ts?.wins ??
        r?.families?.standard?.wins ??
        0
    ) || 0;

  const wins = Number(r.wins ?? fgcWins + tpWins + tsWins) || 0;
  const participations = Number(r.participations ?? 0) || 0;
  const winRate = participations > 0 ? wins / participations : 0;

  const nhlPointsTotal = Number(r.nhlPointsTotal ?? 0) || 0;
  const nhlGamesTotal = Number(r.nhlGamesTotal ?? 0) || 0;
  const nhlPPG = Number.isFinite(Number(r.nhlPPG))
    ? Number(r.nhlPPG)
    : nhlGamesTotal > 0
    ? nhlPointsTotal / nhlGamesTotal
    : 0;

  return {
    ...r,
    fgcPoints,
    tpPoints,
    tsPoints,
    pointsTotal,
    fgcWins,
    tpWins,
    tsWins,
    wins,
    participations,
    winRate,
    nhlPointsTotal,
    nhlGamesTotal,
    nhlPPG,
  };
}

function HeaderEmoji({ children }) {
  return <Text style={{ fontSize: 16 }}>{children}</Text>;
}

export default function ClassementScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { colors } = useTheme();
  const t = i18n.t.bind(i18n);

  const insets = useSafeAreaInsets();

  const { season, loading: loadingSeason } = useCurrentSeason();
  const seasonId = String(season?.seasonId || "");

  const { groups: memberGroups, loading: loadingMemberGroups, error } = useGroups(user?.uid);
  const { owned: ownedGroups, loading: loadingOwned } = useOwnedGroups(user?.uid);

  const groups = useMemo(() => {
    return dedupeById([...(memberGroups || []), ...(ownedGroups || [])]).filter((g) => {
      const status = String(g?.status || "").toLowerCase();
      if (g?.active === false) return false;
      if (status === "archived" || status === "deleted") return false;
      return true;
    });
  }, [memberGroups, ownedGroups]);

  const groupIds = useMemo(() => groups.map((g) => String(g.id)), [groups]);

  const canLoad = !!user && !!seasonId;

  const { all, loading: loadingBoards } = useLeaderboardsSeasonForGroups({
    groupIds: canLoad ? groupIds : [],
    seasonId,
    enabled: canLoad,
  });

  const [refreshing, setRefreshing] = useState(false);

  const baseUrl =
    "https://us-central1-capitaine.cloudfunctions.net/rebuildLeaderboardSeasonForGroup";

  const onRefresh = useCallback(async () => {
    if (!groupIds.length || !seasonId) return;

    try {
      setRefreshing(true);

      const fromYmd = String(season?.fromYmd || "");
      const toYmd = String(season?.toYmd || "");

      await Promise.all(
        groupIds.map((gid) =>
          fetch(
            `${baseUrl}?groupId=${encodeURIComponent(gid)}&seasonId=${encodeURIComponent(
              seasonId
            )}&fromYmd=${encodeURIComponent(fromYmd)}&toYmd=${encodeURIComponent(
              toYmd
            )}&clearDirty=1`
          )
        )
      );
    } catch (e) {
      console.log("refresh leaderboard season error:", e?.message || e);
    } finally {
      setRefreshing(false);
    }
  }, [groupIds, seasonId, season?.fromYmd, season?.toYmd]);

  // ✅ Colonnes MVP avec icônes seulement
  const columns = useMemo(
    () => [
      {
        key: "fgcPoints",
        header: <Text style={{ fontSize: 16 }}>🏒</Text>,
        flex: 0.85,
        align: "center",
        render: (row) => String(Number(row?.fgcPoints ?? 0) || 0),
      },
      {
        key: "tpPoints",
        header: <Text style={{ fontSize: 16 }}>🏆</Text>,
        flex: 0.85,
        align: "center",
        render: (row) => String(Number(row?.tpPoints ?? 0) || 0),
      },
      {
        key: "tsPoints",
        header: <Text style={{ fontSize: 16 }}>🎯</Text>,
        flex: 0.85,
        align: "center",
        render: (row) => String(Number(row?.tsPoints ?? 0) || 0),
      },
      {
        key: "pointsTotal",
        header: <ProphetikIcons mode="points" amount={null} size="sm" iconOnly />,
        flex: 0.95,
        align: "right",
        render: (row) => String(Number(row?.pointsTotal ?? 0) || 0),
      },
    ],
    []
  );

  const [modalOpen, setModalOpen] = useState(false);
  const [selectedRow, setSelectedRow] = useState(null);
  const [selectedPeers, setSelectedPeers] = useState([]);

  function openMember(row, peers) {
    setSelectedRow(row);
    setSelectedPeers(peers || []);
    setModalOpen(true);
  }

  const hasLoggedLeaderboardViewRef = useRef(false);

    useEffect(() => {
      if (!user?.uid) return;
      if (loadingSeason || loadingMemberGroups || loadingOwned || loadingBoards) return;
      if (error) return;

      if (hasLoggedLeaderboardViewRef.current) return;
      hasLoggedLeaderboardViewRef.current = true;

      Analytics.leaderboardView({
        seasonId: seasonId || null,
        groupsCount: Array.isArray(groups) ? groups.length : 0,
      });
    }, [
      user?.uid,
      loadingSeason,
      loadingMemberGroups,
      loadingOwned,
      loadingBoards,
      error,
      seasonId,
      groups,
    ]);

  // ✅ MVP: tout le monde a accès
  const canOpenMember = true;

  if (!user) {
    return (
      <>
        <Stack.Screen options={{ title: t("leaderboard.title") }} />
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            backgroundColor: colors.background,
          }}
        >
          <Text style={{ color: colors.text }}>{t("leaderboard.loginToSee")}</Text>
        </View>
      </>
    );
  }

  if (loadingSeason) {
    return (
      <>
        <Stack.Screen options={{ title: t("leaderboard.title") }} />
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: colors.background,
          }}
        >
          <ActivityIndicator color={colors.primary} />
          <Text style={{ marginTop: 8, color: colors.subtext }}>
            {t("common.loading", { defaultValue: "Chargement…" })}
          </Text>
        </View>
      </>
    );
  }

  if (loadingMemberGroups || loadingOwned || loadingBoards) {
    return (
      <>
        <Stack.Screen options={{ title: t("leaderboard.title") }} />
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: colors.background,
          }}
        >
          <ActivityIndicator color={colors.primary} />
          <Text style={{ marginTop: 8, color: colors.subtext }}>
            {t("leaderboard.loading")}
          </Text>
        </View>
      </>
    );
  }

  if (error) {
    return (
      <>
        <Stack.Screen options={{ title: t("leaderboard.title") }} />
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            backgroundColor: colors.background,
          }}
        >
          <Text style={{ color: colors.text }}>
            {t("leaderboard.errorPrefix", { message: String(error) })}
          </Text>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: t("leaderboard.title") }} />
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <LeaderboardMemberModal
          visible={modalOpen && canOpenMember}
          onClose={() => setModalOpen(false)}
          row={selectedRow ? normalizeMemberRow(selectedRow) : null}
          peerRows={selectedPeers}
          colors={colors}
          tierLower="vip"
          onUpgrade={() => {}}
        />

        <FlatList
          ListHeaderComponent={
            <View style={{ gap: 12 }}>
              <LeaderboardLegend colors={colors} />
              {!!seasonId ? (
                <Text style={{ color: colors.subtext, fontSize: 12, fontWeight: "800" }}>
                  {t("leaderboard.seasonLine", {
                    seasonId,
                    from: season?.fromYmd,
                    to: season?.toYmd,
                    defaultValue: `Saison ${seasonId} · ${season?.fromYmd} → ${season?.toYmd}`,
                  })}
                </Text>
              ) : null}
            </View>
          }
          contentInsetAdjustmentBehavior="automatic"
          automaticallyAdjustContentInsets
          contentContainerStyle={{
            padding: 16,
            gap: 16,
            paddingBottom: 16 + insets.bottom,
          }}
          data={groups}
          keyExtractor={(g) => String(g.id)}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          }
          renderItem={({ item }) => {
            const gid = String(item.id);
            const rawRows = all?.[gid] || [];
            const rows = rawRows.map(normalizeMemberRow);

            return (
              <GroupLeaderboardCard
                group={item}
                rows={rows}
                colors={colors}
                columns={columns}
                emptyText={t("leaderboard.group.noStats", {
                  defaultValue: "Aucun classement disponible.",
                })}
                onRowPress={(row) => {
                  openMember(row, rows);
                }}
              />
            );
          }}
          ListEmptyComponent={() => (
            <View style={{ alignItems: "center", marginTop: 40 }}>
              <Text style={{ color: colors.subtext }}>{t("leaderboard.empty.noGroups")}</Text>
            </View>
          )}
        />
      </View>
    </>
  );
}