// app/(tabs)/ClassementScreen.js
import React, { useMemo, useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  ActivityIndicator,
  FlatList,
  RefreshControl,
  TouchableOpacity,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Stack, useRouter } from "expo-router";

import { useAuth } from "@src/auth/SafeAuthProvider";
import { useGroups } from "@src/groups/useGroups";
import { useTheme } from "@src/theme/ThemeProvider";
import i18n from "@src/i18n/i18n";

import firestore from "@react-native-firebase/firestore";
import useEntitlement from "../subscriptions/useEntitlement";

import GroupLeaderboardCard from "@src/leaderboard/GroupLeaderboardCard";
import { dedupeById } from "@src/leaderboard/utils";
import { getColumnsForTier } from "@src/leaderboard/leaderboardColumns";
import LeaderboardMemberModal from "@src/leaderboard/LeaderboardMemberModal";
import LeaderboardLegend from "@src/leaderboard/LeaderboardLegend";

// ✅ hooks (leaderboards saison)
import useCurrentSeason from "@src/hooks/useCurrentSeason";

const SUBSCRIBE_ROUTE = "/(drawer)/subscriptions";

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

function computeMode({ user, tierLower, tierActive }) {
  if (!user) return "anon";
  if (tierActive === false) return "free";
  if (tierLower === "vip") return "vip";
  if (tierLower === "pro") return "pro";
  if (tierLower === "starter") return "pro";
  return "free";
}

const RED = "#b91c1c";

function cardShadow() {
  return {
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  };
}

function prophetikCardStyle(colors, accent = RED) {
  return {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 16,
    overflow: "hidden",

    // ✅ signature Prophetik
    borderLeftWidth: 4,
    borderLeftColor: accent,
    borderBottomWidth: 2,
    borderBottomColor: accent,
  };
}

/**
 * ✅ hook: écoute un leaderboard "members" pour chaque groupeId / seasonId
 * - FREE: tri simple pointsTotal desc
 * - PRO/VIP: tri wins desc, pointsTotal desc, participations desc
 * Retour: { all: { [groupId]: rows[] }, loading }
 */
function useLeaderboardsSeasonForGroups({ groupIds, seasonId, enabled, mode }) {
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

      const q =
        mode === "free"
          ? base.orderBy("pointsTotal", "desc").limit(50)
          : base
              .orderBy("wins", "desc")
              .orderBy("pointsTotal", "desc")
              .orderBy("participations", "desc")
              .limit(50);

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
  }, [enabled, seasonId, mode, JSON.stringify(groupIds || [])]);

  return { all, loading };
}

// ✅ Normalisation: on s'assure que l'app utilise pointsTotal
function normalizeMemberRow(row) {
  const r = row || {};

  const pointsTotal = Number(r.pointsTotal ?? 0) || 0;

  const wins = Number(r.wins ?? 0) || 0;
  const participations = Number(r.participations ?? r.plays ?? 0) || 0;

  // winRate global (0..1)
  const winRate = participations > 0 ? wins / participations : 0;

  // sport-agnostique: garde les champs historiques si existants
  const nhlPointsTotal = Number(r.nhlPointsTotal ?? 0) || 0;
  const nhlGamesTotal = Number(r.nhlGamesTotal ?? 0) || 0;

  const nhlPPG = Number.isFinite(Number(r.nhlPPG))
    ? Number(r.nhlPPG)
    : nhlGamesTotal > 0
    ? nhlPointsTotal / nhlGamesTotal
    : 0;

  return {
    ...r,
    pointsTotal,
    wins,
    participations,
    winRate,
    nhlPointsTotal,
    nhlGamesTotal,
    nhlPPG,
  };
}

function LeaderboardUpgradeFooterFree({ colors, onPress }) {
  const t = i18n.t.bind(i18n);
  return (
    <View style={[cardShadow(), prophetikCardStyle(colors), { marginTop: 12, padding: 12 }]}>
      <Text style={{ color: colors.text, fontWeight: "900" }}>
        {t("leaderboard.upgradeCta.freeTitle", { defaultValue: "Débloque Pro & VIP" })}
      </Text>
      <Text style={{ color: colors.subtext, marginTop: 6 }}>
        {t("leaderboard.upgradeCta.freeBody", {
          defaultValue:
            "Passe à Pro pour voir ton win rate et ouvrir le détail des participants. VIP ajoute aussi les stats avancées et graphiques.",
        })}
      </Text>

      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.85}
        style={{
          marginTop: 10,
          alignSelf: "flex-start",
          paddingHorizontal: 12,
          paddingVertical: 10,
          borderRadius: 10,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.card,
        }}
      >
        <Text style={{ color: colors.primary, fontWeight: "900" }}>
          {t("leaderboard.upgradeCta.button", { defaultValue: "Voir les forfaits" })}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

function LeaderboardUpgradeFooterPro({ colors, onPress }) {
  const t = i18n.t.bind(i18n);
  return (
    <View
      style={{
        marginTop: 12,
        padding: 12,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 12,
        backgroundColor: colors.card,
      }}
    >
      <Text style={{ color: colors.text, fontWeight: "900" }}>
        {t("leaderboard.upgradeCta.proTitle", { defaultValue: "Passe VIP pour la version complète" })}
      </Text>
      <Text style={{ color: colors.subtext, marginTop: 6 }}>
        {t("leaderboard.upgradeCta.proBody", {
          defaultValue:
            "VIP ajoute les stats avancées, les graphiques réels, et la colonne PPG (plus de détails par participant).",
        })}
      </Text>

      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.85}
        style={{
          marginTop: 10,
          alignSelf: "flex-start",
          paddingHorizontal: 12,
          paddingVertical: 10,
          borderRadius: 10,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.card,
        }}
      >
        <Text style={{ color: colors.primary, fontWeight: "900" }}>
          {t("leaderboard.upgradeCta.vipButton", { defaultValue: "Passer VIP" })}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

export default function ClassementScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { colors } = useTheme();
  const t = i18n.t.bind(i18n);

  const insets = useSafeAreaInsets();

  const { tier: userTier, loading: loadingTier, active: tierActive } = useEntitlement(user?.uid);
  const tierLower = String(userTier || "free").toLowerCase();
  const mode = computeMode({ user, tierLower, tierActive });

  // ✅ Saison courante
  const { season, loading: loadingSeason } = useCurrentSeason();
  const seasonId = String(season?.seasonId || "");

  // groupes membre
  const { groups: memberGroups, loading: loadingMemberGroups, error } = useGroups(user?.uid);
  // groupes owner
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

  // ✅ FREE inclut maintenant la charge
  const canLoad = mode !== "anon" && !!seasonId;

  const { all, loading: loadingBoards } = useLeaderboardsSeasonForGroups({
    groupIds: canLoad ? groupIds : [],
    seasonId,
    enabled: canLoad,
    mode,
  });

  const [refreshing, setRefreshing] = useState(false);

  // ✅ endpoint saison (HTTP)
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
            )}&fromYmd=${encodeURIComponent(fromYmd)}&toYmd=${encodeURIComponent(toYmd)}`
          )
        )
      );
    } catch (e) {
      console.log("refresh leaderboard season error:", e?.message || e);
    } finally {
      setRefreshing(false);
    }
  }, [groupIds, seasonId, season?.fromYmd, season?.toYmd]);

  // ✅ IMPORTANT: getColumnsForTier(tierLower) seulement
  const columns = useMemo(
    () => getColumnsForTier(tierLower, colors),
    [tierLower, colors]
  );

  const [modalOpen, setModalOpen] = useState(false);
  const [selectedRow, setSelectedRow] = useState(null);
  const [selectedPeers, setSelectedPeers] = useState([]);

  function openMember(row, peers) {
    setSelectedRow(row);
    setSelectedPeers(peers || []);
    setModalOpen(true);
  }

  const canOpenMember = mode === "pro" || mode === "vip";

  // ✅ CTA stratégiques
  const showFooterFree = mode === "free";
  const showFooterPro = mode === "pro";

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

  if (loadingTier || loadingSeason) {
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
        {/* ✅ Modal seulement PRO/VIP */}
        <LeaderboardMemberModal
          visible={modalOpen && canOpenMember}
          onClose={() => setModalOpen(false)}
          row={selectedRow ? normalizeMemberRow(selectedRow) : null}
          peerRows={selectedPeers}
          colors={colors}
          tierLower={tierLower}
          onUpgrade={() => router.push(SUBSCRIBE_ROUTE)}
        />

        <FlatList
          ListHeaderComponent={
            <View style={{ gap: 12 }}>
              <LeaderboardLegend colors={colors} tierLower={tierLower} onUpgrade={() => router.push(SUBSCRIBE_ROUTE)}/>
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
          ListFooterComponent={
            showFooterFree ? (
              <LeaderboardUpgradeFooterFree
                colors={colors}
                onPress={() => router.push(SUBSCRIBE_ROUTE)}
              />
            ) : showFooterPro ? (
              <LeaderboardUpgradeFooterPro
                colors={colors}
                onPress={() => router.push(SUBSCRIBE_ROUTE)}
              />
            ) : null
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
                  if (!canOpenMember) {
                    // ✅ CTA soft: en FREE, un tap sur un participant amène aux forfaits
                    router.push(SUBSCRIBE_ROUTE);
                    return;
                  }
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