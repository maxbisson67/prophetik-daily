import React, { useMemo, useState, useCallback, useEffect, useRef } from "react";
import {
  View,
  Text,
  ActivityIndicator,
  ScrollView,
  RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Stack } from "expo-router";

import { useAuth } from "@src/auth/SafeAuthProvider";
import { useGroups } from "@src/groups/useGroups";
import { useTheme } from "@src/theme/ThemeProvider";
import i18n from "@src/i18n/i18n";
import useMeDoc from "@src/home/hooks/useMeDoc";
import GroupsToggleRow from "@src/home/components/GroupsToggleRow";

import firestore from "@react-native-firebase/firestore";

import { dedupeById } from "@src/leaderboard/utils";
import LeaderboardMemberModal from "@src/leaderboard/LeaderboardMemberModal";
import LeaderboardGroupDashboard from "@src/leaderboard/LeaderboardGroupDashboard";
import normalizeMemberRow from "@src/leaderboard/normalizeMemberRow";
import useLeaderboardGroupMembers from "@src/leaderboard/useLeaderboardGroupMembers";

import useCurrentSeason from "@src/hooks/useCurrentSeason";
import Analytics from "@src/services/analytics";

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

export default function ClassementScreen() {
  const { user, authReady } = useAuth();
  const { colors } = useTheme();
  const t = i18n.t.bind(i18n);

  const insets = useSafeAreaInsets();

  const { season, loading: loadingSeason } = useCurrentSeason();
  const seasonId = String(season?.seasonId || "");

  const { meDoc } = useMeDoc({ authReady, uid: user?.uid });
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
  const favoriteGroupId = meDoc?.favoriteGroupId || null;

  const [currentGroupId, setCurrentGroupId] = useState(null);

  useEffect(() => {
    if (!groupIds.length) {
      setCurrentGroupId(null);
      return;
    }

    if (currentGroupId && groupIds.includes(String(currentGroupId))) return;

    const fav =
      favoriteGroupId && groupIds.includes(String(favoriteGroupId))
        ? String(favoriteGroupId)
        : null;

    setCurrentGroupId(fav || groupIds[0]);
  }, [groupIds, currentGroupId, favoriteGroupId]);

  const canLoad = !!user && !!seasonId && !!currentGroupId;

  const { rows: rawRows, loading: loadingBoard } = useLeaderboardGroupMembers({
    groupId: currentGroupId,
    seasonId,
    enabled: canLoad,
  });

  const rows = useMemo(() => (rawRows || []).map(normalizeMemberRow), [rawRows]);

  const currentGroup = useMemo(
    () => groups.find((g) => String(g.id) === String(currentGroupId)) || null,
    [groups, currentGroupId]
  );

  const [refreshing, setRefreshing] = useState(false);

  const baseUrl =
    "https://us-central1-capitaine.cloudfunctions.net/rebuildLeaderboardSeasonForGroup";

  const onRefresh = useCallback(async () => {
    if (!currentGroupId || !seasonId) return;

    try {
      setRefreshing(true);

      const fromYmd = String(season?.fromYmd || "");
      const toYmd = String(season?.toYmd || "");

      await fetch(
        `${baseUrl}?groupId=${encodeURIComponent(currentGroupId)}&seasonId=${encodeURIComponent(
          seasonId
        )}&fromYmd=${encodeURIComponent(fromYmd)}&toYmd=${encodeURIComponent(
          toYmd
        )}&clearDirty=1`
      );
    } catch (e) {
      console.log("refresh leaderboard season error:", e?.message || e);
    } finally {
      setRefreshing(false);
    }
  }, [currentGroupId, seasonId, season?.fromYmd, season?.toYmd]);

  const [modalOpen, setModalOpen] = useState(false);
  const [selectedRow, setSelectedRow] = useState(null);
  const [selectedPeers, setSelectedPeers] = useState([]);

  function openMember(row) {
    setSelectedRow(row);
    setSelectedPeers(rows || []);
    setModalOpen(true);
  }

  const hasLoggedLeaderboardViewRef = useRef(false);

  useEffect(() => {
    if (!user?.uid) return;
    if (loadingSeason || loadingMemberGroups || loadingOwned || loadingBoard) return;
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
    loadingBoard,
    error,
    seasonId,
    groups,
  ]);

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

  if (loadingMemberGroups || loadingOwned) {
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

        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          automaticallyAdjustContentInsets
          contentContainerStyle={{
            padding: 16,
            paddingBottom: 16 + insets.bottom,
          }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          }
        >
          {!!seasonId ? (
            <Text
              style={{
                color: colors.subtext,
                fontSize: 12,
                fontWeight: "800",
                marginBottom: 12,
              }}
            >
              {t("leaderboard.seasonLine", {
                seasonId,
                from: season?.fromYmd,
                to: season?.toYmd,
                defaultValue: `Saison ${seasonId} · ${season?.fromYmd} → ${season?.toYmd}`,
              })}
            </Text>
          ) : null}

          {!groups.length ? (
            <View style={{ alignItems: "center", marginTop: 40 }}>
              <Text style={{ color: colors.subtext }}>{t("leaderboard.empty.noGroups")}</Text>
            </View>
          ) : (
            <>
              <GroupsToggleRow
                colors={colors}
                groups={groups}
                value={currentGroupId}
                onChange={setCurrentGroupId}
                hintKey="leaderboard.selectGroupLabel"
              />

              {loadingBoard ? (
                <View style={{ paddingVertical: 40, alignItems: "center" }}>
                  <ActivityIndicator color={colors.primary} />
                  <Text style={{ marginTop: 8, color: colors.subtext }}>
                    {t("leaderboard.loading")}
                  </Text>
                </View>
              ) : (
                <View style={{ marginTop: 16 }}>
                  <LeaderboardGroupDashboard
                    rows={rows}
                    colors={colors}
                    sport={currentGroup?.sport || currentGroup?.league}
                    onRowPress={openMember}
                    emptyText={t("leaderboard.group.noStats", {
                      defaultValue: "Aucun classement disponible.",
                    })}
                  />
                </View>
              )}
            </>
          )}
        </ScrollView>
      </View>
    </>
  );
}
