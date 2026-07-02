import React, { useMemo, useState, useCallback, useEffect, useRef } from "react";
import {
  View,
  Text,
  ActivityIndicator,
  ScrollView,
  RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Stack, useLocalSearchParams } from "expo-router";

import { useAuth } from "@src/auth/SafeAuthProvider";
import { useGroups } from "@src/groups/useGroups";
import { useTheme } from "@src/theme/ThemeProvider";
import i18n from "@src/i18n/i18n";
import GroupsToggleRow from "@src/home/components/GroupsToggleRow";
import { useSelectedGroup } from "@src/groups/SelectedGroupProvider";

import firestore from "@react-native-firebase/firestore";

import { dedupeById } from "@src/leaderboard/utils";
import LeaderboardMemberModal from "@src/leaderboard/LeaderboardMemberModal";
import LeaderboardGroupDashboard from "@src/leaderboard/LeaderboardGroupDashboard";
import normalizeMemberRow from "@src/leaderboard/normalizeMemberRow";
import useLeaderboardGroupMembers from "@src/leaderboard/useLeaderboardGroupMembers";

import useActiveCompetition from "@src/hooks/useActiveCompetition";
import useSportCompetitions from "@src/hooks/useSportCompetitions";
import useGroupCompetitionHistory, {
  useLeaderboardCompetitionMeta,
} from "@src/hooks/useGroupCompetitionHistory";
import CompetitionChampionsSection from "@src/leaderboard/CompetitionChampionsSection";
import CompetitionPhasePicker from "@src/leaderboard/CompetitionPhasePicker";
import Analytics from "@src/services/analytics";
import { getProphetikBusinessYmd } from "@src/lib/prophetikBusinessDate";
import {
  competitionKeyMatchesSport,
  competitionTimelineStatus,
  normalizeSport,
  pickDefaultLeaderboardCompetition,
} from "@src/season/seasonCompetitionCore";

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
  const params = useLocalSearchParams();

  const insets = useSafeAreaInsets();

  const { selectedGroupId: currentGroupId, setSelectedGroupId } = useSelectedGroup();
  const paramGroupId = String(params?.groupId || "").trim();
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

  const currentGroup = useMemo(
    () => groups.find((g) => String(g.id) === String(currentGroupId)) || null,
    [groups, currentGroupId]
  );

  const currentSport = String(currentGroup?.sport || currentGroup?.league || "NHL").toUpperCase();
  const sportNorm = normalizeSport(currentSport);
  const todayYmd = getProphetikBusinessYmd();
  const {
    competitionKey: activeCompetitionKey,
    seasonId: activeSeasonId,
    loading: loadingSeason,
  } = useActiveCompetition({ sport: currentSport, enabled: !!currentGroupId });

  const seasonIdForCompetitions = useMemo(() => {
    if (!activeSeasonId) return "";
    if (!activeCompetitionKey) return "";
    return competitionKeyMatchesSport(activeCompetitionKey, currentSport) ? activeSeasonId : "";
  }, [activeSeasonId, activeCompetitionKey, currentSport]);

  const { competitions, loading: loadingCompetitions } = useSportCompetitions({
    sport: currentSport,
    seasonId: seasonIdForCompetitions,
    enabled: !!currentGroupId,
  });

  const [selectedCompetitionKey, setSelectedCompetitionKey] = useState("");

  useEffect(() => {
    setSelectedCompetitionKey("");
  }, [currentGroupId, sportNorm]);

  useEffect(() => {
    const keys = competitions.map((c) => c.competitionKey);

    if (
      selectedCompetitionKey &&
      !competitionKeyMatchesSport(selectedCompetitionKey, currentSport)
    ) {
      setSelectedCompetitionKey("");
      return;
    }

    if (!keys.length) {
      if (selectedCompetitionKey) setSelectedCompetitionKey("");
      return;
    }

    if (selectedCompetitionKey && keys.includes(selectedCompetitionKey)) return;

    const preferredKey =
      activeCompetitionKey && competitionKeyMatchesSport(activeCompetitionKey, currentSport)
        ? activeCompetitionKey
        : "";

    const defaultCompetition = pickDefaultLeaderboardCompetition(
      competitions,
      todayYmd,
      preferredKey
    );

    setSelectedCompetitionKey(defaultCompetition?.competitionKey || keys[0]);
  }, [
    competitions,
    activeCompetitionKey,
    selectedCompetitionKey,
    currentSport,
    sportNorm,
    todayYmd,
  ]);

  const selectedCompetition = useMemo(
    () => competitions.find((c) => c.competitionKey === selectedCompetitionKey) || null,
    [competitions, selectedCompetitionKey]
  );

  const isCompetitionSelectionReady =
    !!selectedCompetitionKey &&
    competitionKeyMatchesSport(selectedCompetitionKey, currentSport) &&
    competitions.some((c) => c.competitionKey === selectedCompetitionKey);

  const selectedCompetitionStatus = useMemo(() => {
    if (!selectedCompetition) return null;
    return competitionTimelineStatus(selectedCompetition, todayYmd);
  }, [selectedCompetition, todayYmd]);

  const isSelectedCompetitionUpcoming = selectedCompetitionStatus === "upcoming";

  const groupIds = useMemo(() => groups.map((g) => String(g.id)), [groups]);

  useEffect(() => {
    if (!paramGroupId || !groupIds.includes(paramGroupId)) return;
    if (String(currentGroupId) !== paramGroupId) {
      setSelectedGroupId(paramGroupId);
    }
  }, [paramGroupId, groupIds.join("|"), currentGroupId, setSelectedGroupId]);

  const canLoad =
    !!user &&
    !!currentGroupId &&
    isCompetitionSelectionReady &&
    !isSelectedCompetitionUpcoming;

  const { rows: rawRows, loading: loadingBoard } = useLeaderboardGroupMembers({
    groupId: currentGroupId,
    competitionKey: selectedCompetitionKey,
    sport: currentSport,
    enabled: canLoad,
  });

  const rows = useMemo(() => (rawRows || []).map(normalizeMemberRow), [rawRows]);

  const { rows: championHistory, loading: loadingChampions } = useGroupCompetitionHistory({
    groupId: currentGroupId,
    sport: currentSport,
    enabled: !!currentGroupId,
  });

  const { meta: currentCompetitionMeta, loading: loadingCurrentMeta } =
    useLeaderboardCompetitionMeta({
      groupId: currentGroupId,
      competitionKey: selectedCompetitionKey,
      enabled: !!currentGroupId && !!selectedCompetitionKey,
    });

  const [refreshing, setRefreshing] = useState(false);

  const baseUrl =
    "https://us-central1-capitaine.cloudfunctions.net/rebuildLeaderboardSeasonForGroup";

  const onRefresh = useCallback(async () => {
    if (!currentGroupId || !selectedCompetitionKey) return;

    try {
      setRefreshing(true);

      const fromYmd = String(selectedCompetition?.fromYmd || "");
      const toYmd = String(selectedCompetition?.toYmd || "");

      await fetch(
        `${baseUrl}?groupId=${encodeURIComponent(currentGroupId)}&seasonId=${encodeURIComponent(
          selectedCompetitionKey
        )}&fromYmd=${encodeURIComponent(fromYmd)}&toYmd=${encodeURIComponent(
          toYmd
        )}&clearDirty=1`
      );
    } catch (e) {
      console.log("refresh leaderboard season error:", e?.message || e);
    } finally {
      setRefreshing(false);
    }
  }, [currentGroupId, selectedCompetitionKey, selectedCompetition?.fromYmd, selectedCompetition?.toYmd]);

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
    if (loadingSeason || loadingCompetitions || loadingMemberGroups || loadingOwned || loadingBoard) return;
    if (error) return;

    if (hasLoggedLeaderboardViewRef.current) return;
    hasLoggedLeaderboardViewRef.current = true;

    Analytics.leaderboardView({
      seasonId: selectedCompetitionKey || null,
      groupsCount: Array.isArray(groups) ? groups.length : 0,
    });
  }, [
    user?.uid,
    loadingSeason,
    loadingCompetitions,
    loadingMemberGroups,
    loadingOwned,
    loadingBoard,
    error,
    selectedCompetitionKey,
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

  if (loadingSeason || loadingCompetitions) {
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
                onChange={setSelectedGroupId}
                hintKey="leaderboard.selectGroupLabel"
              />

              <CompetitionPhasePicker
                colors={colors}
                competitions={competitions}
                value={selectedCompetitionKey}
                onChange={setSelectedCompetitionKey}
              />

              <CompetitionChampionsSection
                colors={colors}
                currentMeta={currentCompetitionMeta}
                historyRows={championHistory}
                loading={loadingChampions || loadingCurrentMeta}
              />

              {isSelectedCompetitionUpcoming ? (
                <View style={{ paddingVertical: 40, alignItems: "center" }}>
                  <Text style={{ color: colors.subtext, fontWeight: "800", fontSize: 15 }}>
                    {t("leaderboard.competitionNotStarted", {
                      defaultValue: "Non débuté",
                    })}
                  </Text>
                </View>
              ) : loadingBoard || !isCompetitionSelectionReady ? (
                <View style={{ paddingVertical: 40, alignItems: "center" }}>
                  <ActivityIndicator color={colors.primary} />
                  <Text style={{ marginTop: 8, color: colors.subtext }}>
                    {t("leaderboard.loading")}
                  </Text>
                </View>
              ) : (
                <View style={{ marginTop: 16 }}>
                  <LeaderboardGroupDashboard
                    key={`${currentGroupId}:${selectedCompetitionKey}`}
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
