// AccueilScreen.js — ASC7-only + “3 façons de jouer” centré + kicker italique + CTA détails ascension
import React, { useEffect, useRef, useState, useMemo } from "react";
import i18n from "@src/i18n/i18n";
import {
  View,
  Text,
  ActivityIndicator,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
} from "react-native";

import CreateFirstGoalModal from "@src/firstGoal/CreateFirstGoalModal";
import FirstGoalHomeSection from "@src/firstGoal/FirstGoalHomeSection";

import { friendlyError, readPointsBalanceAny, isAscensionDefi } from "@src/home/homeUtils";
import useMeDoc from "@src/home/hooks/useMeDoc";

// UI
import ProfileHeaderCard from "@src/home/components/ProfileHeaderCard";
import DefiListSection from "@src/home/components/DefiListSection";
import ProphetikIcons from "@src/ui/ProphetikIcons";

// Ascension
import useAscensionGlobalState from "@src/ascensions/useAscensionGlobalState";
import AscensionProgressModal from "@src/ascensions/components/AscensionProgressModal";

import { useRouter, Stack, useLocalSearchParams } from "expo-router";
import firestore from "@react-native-firebase/firestore";
import { useAuth } from "@src/auth/SafeAuthProvider";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTheme } from "@src/theme/ThemeProvider";
import CreateDefiModal from "../defis/CreateDefiModal";
import CreateAscensionModal from "@src/ascensions/CreateAscensionModal";

import useEntitlement from "../subscriptions/useEntitlement";
import useCurrentSeason from "@src/hooks/useCurrentSeason";

import { listenRNFB } from "@src/dev/fsListen";

/* ----------------------------- Helpers UI ----------------------------- */

function Chip({ bg, fg, icon, label }) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 4,
        paddingHorizontal: 10,
        borderRadius: 999,
        backgroundColor: bg,
        borderWidth: 1,
        borderColor: "rgba(0,0,0,0.08)",
      }}
    >
      <MaterialCommunityIcons name={icon} size={14} color={fg} />
      <Text style={{ color: fg, marginLeft: 6, fontWeight: "800", fontSize: 12 }}>{label}</Text>
    </View>
  );
}

function SectionHeader({
  colors,
  icon,
  leftIcon,
  kicker, // ✅ italique au-dessus du titre
  title,
  subtitle,
  rightAction,
  flat = false,
}) {
  return (
    <View
      style={[
        {
          padding: 12,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.card,
          marginBottom: 8,
        },
        flat && {
          backgroundColor: "transparent",
          borderWidth: 0,
          padding: 0,
          marginBottom: 0,
        },
      ]}
    >
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <View style={{ flexDirection: "row", alignItems: "center", flexShrink: 1 }}>
          {leftIcon ? (
            <View style={{ marginRight: 10 }}>{leftIcon}</View>
          ) : icon ? (
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: 12,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: colors.card2,
                borderWidth: 1,
                borderColor: colors.border,
                marginRight: 10,
              }}
            >
              <MaterialCommunityIcons name={icon} size={18} color={colors.text} />
            </View>
          ) : null}

          <View style={{ flexShrink: 1 }}>
            {kicker ? (
              <Text style={{ color: colors.subtext, fontStyle: "italic", fontWeight: "700", marginBottom: 2 }}>
                {kicker}
              </Text>
            ) : null}

            <Text style={{ color: colors.text, fontSize: 16, fontWeight: "900" }}>{title}</Text>

            {subtitle ? (
              <Text style={{ color: colors.subtext, marginTop: 2 }} numberOfLines={2}>
                {subtitle}
              </Text>
            ) : null}
          </View>
        </View>

        {/* ✅ évite que le bouton “Créer” sorte de la carte */}
        <View style={{ flexShrink: 0, alignItems: "flex-end", justifyContent: "center", marginLeft: 10 }}>
          {rightAction}
        </View>
      </View>
    </View>
  );
}

function cardShadow() {
  return {
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  };
}

const RED = "#b91c1c";
const RED_BOTTOM = "#991b1b";

function sectionCardStyle(colors, accent = RED) {
  return {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 16,
    overflow: "hidden",
    padding: 12,
    borderLeftWidth: 4,
    borderLeftColor: accent,
    borderBottomWidth: 3,
    borderBottomColor: RED_BOTTOM,
  };
}

function SectionCreateAction({ onPress, label = "Créer" }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={{
        backgroundColor: RED,
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 999,
      }}
    >
      <Text style={{ color: "#fff", fontWeight: "900", fontSize: 12 }}>{label}</Text>
    </TouchableOpacity>
  );
}

function ProgressBar({ value, max, colors }) {
  const pct = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;

  return (
    <View style={{ marginTop: 10 }}>
      <View
        style={{
          height: 12,
          borderRadius: 999,
          backgroundColor: colors.card2,
          borderWidth: 1,
          borderColor: colors.border,
          overflow: "hidden",
        }}
      >
        <View style={{ width: `${pct * 100}%`, height: "100%", backgroundColor: RED }} />
      </View>

      {/* ✅ sans “Base / Sommet” */}
      <View style={{ marginTop: 6, alignItems: "center" }}>
        <Text style={{ color: colors.subtext, fontWeight: "900" }}>
          {value} / {max} défis
        </Text>
      </View>
    </View>
  );
}

/** ✅ Mini-banner ASC7-only (si tu veux en haut de la home) */
function AscensionJackpotBannerASC7({ colors, asc7InProgress, pointsBonisTotal, onPressDetails }) {
  if (!asc7InProgress) return null;

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={onPressDetails}
      style={{
        borderRadius: 16,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.card,
        padding: 12,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <View style={{ flexDirection: "row", alignItems: "center", flexShrink: 1 }}>
          <View style={{ marginRight: 10 }}>
            <ProphetikIcons mode="emoji" emoji="🏔" size="lg" />
          </View>
          <View style={{ flexShrink: 1 }}>
            <Text style={{ color: colors.text, fontWeight: "900" }}>
              {i18n.t("ascensions.summit.title", { defaultValue: "Sommet Prophetik" })}
            </Text>
            <Text style={{ color: colors.subtext, marginTop: 2 }} numberOfLines={1}>
              {i18n.t("ascensions.labels.pointsBonis", { defaultValue: "Points bonis" })}:{" "}
              <Text style={{ color: colors.text, fontWeight: "900" }}>{pointsBonisTotal}</Text>
              {"  "}•{"  "}
              {i18n.t("ascensions.labels.dailyPlus", { defaultValue: "+2 par jour" })}
            </Text>
          </View>
        </View>

        <Chip
          bg={colors.card2}
          fg={colors.text}
          icon="progress-clock"
          label={i18n.t("common.inProgress", { defaultValue: "En cours" })}
        />
      </View>
    </TouchableOpacity>
  );
}

/* ----------------------------- Date tick ----------------------------- */

function msUntilNextLocalMidnight() {
  const now = new Date();
  const next = new Date(now);
  next.setHours(24, 0, 0, 0);
  return Math.max(1000, next.getTime() - now.getTime());
}

function defiPrimaryCta(defi, i18n) {
  const st = String(defi?.status || "").toLowerCase();

  if (st === "open") {
    return {
      label: i18n.t("defi.cta.pick", { defaultValue: "Choisir mes joueurs" }),
      intent: "pick",
    };
  }

  if (st === "live") {
    return {
      label: i18n.t("defi.cta.live", { defaultValue: "Voir résultat en direct" }),
      intent: "live",
    };
  }

  if (st === "awaiting_result" || st === "closed") {
    return {
      label: i18n.t("defi.cta.results", { defaultValue: "Voir résultats" }),
      intent: "results",
    };
  }

  return {
    label: i18n.t("defi.cta.open", { defaultValue: "Ouvrir" }),
    intent: "open",
  };
}


/* =========================
   SCREEN
========================= */

export default function AccueilScreen() {
  const { user, authReady } = useAuth();
  const router = useRouter();
  const { colors } = useTheme();

  const { tier: userTier } = useEntitlement(user?.uid);
  const tierLower = String(userTier || "free").toLowerCase();

  const [groupIds, setGroupIds] = useState([]);
  const [loadingGroups, setLoadingGroups] = useState(true);

  const [activeDefis, setActiveDefis] = useState([]);
  const [loadingDefis, setLoadingDefis] = useState(true);

  const [error, setError] = useState(null);

  const [groupsMeta, setGroupsMeta] = useState({});
  const groupMetaUnsubs = useRef(new Map());

  const [currentGroupId, setCurrentGroupId] = useState(null);

  const [defaultGroupPoints, setDefaultGroupPoints] = useState(0);
  const [loadingDefaultGroupPoints, setLoadingDefaultGroupPoints] = useState(true);

  const groupsAttachedForUidRef = useRef(null);

  const { season } = useCurrentSeason();
  const seasonId = season?.seasonId;

  // Ascension
  const [ascModalVisible, setAscModalVisible] = useState(false);
  const asc7 = useAscensionGlobalState({ groupId: currentGroupId, ascKey: "ASC7" });

  const asc7PointsBonisTotal = asc7?.state?.jackpotTotal ?? 0; // (ton champ actuel; on l’affiche comme “Points bonis”)
  const asc7InProgress = useMemo(() => {
    const st = asc7?.state || null;
    if (!st) return false;
    if (st.enabled === false) return false;
    if (!st.activeRunId) return false;
    return st.completed !== true;
  }, [asc7?.state]);
  

  const [ascProgressOpen, setAscProgressOpen] = useState(false);
  const [showFirstGoalModal, setShowFirstGoalModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const params = useLocalSearchParams();

  const [hasFirstGoalForGroup, setHasFirstGoalForGroup] = useState(false);

  const [asc7Member, setAsc7Member] = useState(null);
  const [loadingAsc7Member, setLoadingAsc7Member] = useState(false);
  
  useEffect(() => {
    if (params?.cold === "1") setError(null);
  }, [params?.t, params?.cold]);

  useEffect(() => {
    if (!authReady || !user?.uid || !currentGroupId) return;

    const runId = asc7?.state?.activeRunId ? String(asc7.state.activeRunId) : null;

    // important: si pas de run actif, on nettoie
    if (!runId) {
      setAsc7Member(null);
      setLoadingAsc7Member(false);
      return;
    }

    setAsc7Member(null);          // évite d’afficher une vieille progression
    setLoadingAsc7Member(true);

    const ref = firestore()
      .collection("groups").doc(String(currentGroupId))
      .collection("ascensions").doc("ASC7")
      .collection("runs").doc(runId)
      .collection("members").doc(String(user.uid));

    const un = listenRNFB(
      ref,
      (snap) => {
        const data = snap?.data?.() || null;
        setAsc7Member(data);
        setLoadingAsc7Member(false);
      },
      `asc7:member:${currentGroupId}:${runId}:${user.uid}`,
      (e) => {
        setLoadingAsc7Member(false);
        setAsc7Member(null);
        setError(e);
      },
      { logAttach: true }
    );

    return () => { try { un?.(); } catch {} };
  }, [authReady, user?.uid, currentGroupId, asc7?.state?.activeRunId]);

  const asc7Progress = useMemo(() => {
    const w =
      asc7Member?.winsByType && typeof asc7Member.winsByType === "object"
        ? asc7Member.winsByType
        : {};

    let stepsDone = 0;
    for (let i = 1; i <= 7; i++) {
      if ((w[String(i)] ?? 0) >= 1) stepsDone++;
    }

    return { stepsDone, maxSteps: 7, winsByType: w };
  }, [asc7Member]);

  // day tick
  const [dayTick, setDayTick] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setDayTick((x) => x + 1), msUntilNextLocalMidnight());
    return () => clearTimeout(t);
  }, [dayTick]);

  // Reset auth/day
  useEffect(() => {
    setGroupIds([]);
    setActiveDefis([]);
    setError(null);
    setLoadingGroups(!!(authReady && user?.uid));
    setLoadingDefis(!!(authReady && user?.uid));
    setGroupsMeta({});
    setCurrentGroupId(null);
    setDefaultGroupPoints(0);
    setLoadingDefaultGroupPoints(true);

    for (const [, un] of groupMetaUnsubs.current) {
      try {
        un?.();
      } catch {}
    }
    groupMetaUnsubs.current.clear();

    groupsAttachedForUidRef.current = null;
  }, [authReady, user?.uid, dayTick]);

  // Participant doc
  const { meDoc, error: meError } = useMeDoc({ authReady, uid: user?.uid, dayTick });

  // Groups list
  useEffect(() => {
    setError(null);

    if (!authReady || !user?.uid) {
      groupsAttachedForUidRef.current = null;
      setGroupIds([]);
      setLoadingGroups(false);
      return;
    }

    if (groupsAttachedForUidRef.current === user.uid) {
      setLoadingGroups(false);
      return;
    }

    groupsAttachedForUidRef.current = user.uid;
    setLoadingGroups(true);

    const qByUid = firestore().collection("group_memberships").where("uid", "==", user.uid);
    const qByPid = firestore().collection("group_memberships").where("participantId", "==", user.uid);
    const qOwnerCreated = firestore().collection("groups").where("createdBy", "==", user.uid);
    const qOwnerOwnerId = firestore().collection("groups").where("ownerId", "==", user.uid);

    let rowsByUid = [];
    let rowsByPid = [];
    let rowsOwnerCreated = [];
    let rowsOwnerOwnerId = [];

    const recompute = () => {
      const memberships = [...rowsByUid, ...rowsByPid].filter((m) => {
        const st = String(m?.status || "").toLowerCase();
        if (st) return ["open", "active", "approved"].includes(st);
        return m?.active !== false;
      });

      const gidsFromMemberships = memberships.map((m) => m.groupId).filter(Boolean);
      const gidsFromOwner = [...rowsOwnerCreated, ...rowsOwnerOwnerId].map((g) => g.id).filter(Boolean);
      const unionSorted = Array.from(new Set([...gidsFromMemberships, ...gidsFromOwner])).sort();

      setGroupIds(unionSorted);
      setLoadingGroups(false);
    };

    const un1 = listenRNFB(
      qByUid,
      (snap) => {
        rowsByUid = (snap?.docs ?? []).map((d) => ({ id: d.id, ...d.data() }));
        recompute();
      },
      "group_memberships:uid",
      (e) => {
        setLoadingGroups(false);
        setError(e);
      },
      { logAttach: true }
    );

    const un2 = listenRNFB(
      qByPid,
      (snap) => {
        rowsByPid = (snap?.docs ?? []).map((d) => ({ id: d.id, ...d.data() }));
        recompute();
      },
      "group_memberships:participantId",
      (e) => {
        setLoadingGroups(false);
        setError(e);
      },
      { logAttach: true }
    );

    const un3 = listenRNFB(
      qOwnerCreated,
      (snap) => {
        rowsOwnerCreated = (snap?.docs ?? []).map((d) => ({ id: d.id, ...d.data() }));
        recompute();
      },
      "groups:createdBy",
      (e) => {
        setLoadingGroups(false);
        setError(e);
      },
      { logAttach: true }
    );

    const un4 = listenRNFB(
      qOwnerOwnerId,
      (snap) => {
        rowsOwnerOwnerId = (snap?.docs ?? []).map((d) => ({ id: d.id, ...d.data() }));
        recompute();
      },
      "groups:ownerId",
      (e) => {
        setLoadingGroups(false);
        setError(e);
      },
      { logAttach: true }
    );

    return () => {
      try { un1?.(); } catch {}
      try { un2?.(); } catch {}
      try { un3?.(); } catch {}
      try { un4?.(); } catch {}
    };
  }, [authReady, user?.uid, dayTick]);

  // Groups meta
  useEffect(() => {
    if (!authReady || !user?.uid) return;

    for (const [gid, un] of groupMetaUnsubs.current) {
      if (!groupIds.includes(gid)) {
        try { un?.(); } catch {}
        groupMetaUnsubs.current.delete(gid);
      }
    }

    groupIds.forEach((gid) => {
      if (groupMetaUnsubs.current.has(gid)) return;

      const ref = firestore().collection("groups").doc(gid);
      const un = listenRNFB(
        ref,
        (snap) => {
          const data = snap?.data?.() || {};
          setGroupsMeta((prev) => ({
            ...prev,
            [gid]: {
              id: gid,
              name: data.name || data.title || gid,
              avatarUrl: data.avatarUrl || null,
              ownerId: data.ownerId || null,
              createdBy: data.createdBy || null,
              status: data.status || null,
            },
          }));
        },
        `groups:meta:${gid}`,
        (e) => setError(e),
        { logAttach: true }
      );

      groupMetaUnsubs.current.set(gid, un);
    });
  }, [authReady, user?.uid, groupIds.join("|")]);

  // current group
  const readableGroupIds = useMemo(() => groupIds.filter((gid) => !!groupsMeta[gid]), [groupIds, groupsMeta]);
  useEffect(() => {
    if (!authReady || !user?.uid) return;

    const fav = meDoc?.favoriteGroupId || null;
    if (currentGroupId && readableGroupIds.includes(currentGroupId)) return;

    let next = null;
    if (fav && readableGroupIds.includes(fav)) next = fav;
    else if (readableGroupIds.length >= 1) next = readableGroupIds[0];

    setCurrentGroupId(next);
  }, [authReady, user?.uid, meDoc?.favoriteGroupId, readableGroupIds, currentGroupId]);

  // points
  useEffect(() => {
    setDefaultGroupPoints(0);
    setLoadingDefaultGroupPoints(true);

    if (!authReady || !user?.uid || !currentGroupId || !seasonId) {
      setLoadingDefaultGroupPoints(false);
      return;
    }

    const ref = firestore()
      .collection("groups")
      .doc(String(currentGroupId))
      .collection("leaderboards")
      .doc(String(seasonId))
      .collection("members")
      .doc(String(user.uid));

    const un = listenRNFB(
      ref,
      (snap) => {
        const data = snap?.data?.() || {};
        setDefaultGroupPoints(Number(data.pointsTotal || 0));
        setLoadingDefaultGroupPoints(false);
      },
      `leaderboards:mePoints:${currentGroupId}:${seasonId}:${user.uid}`,
      (e) => {
        setLoadingDefaultGroupPoints(false);
        setError(e);
      },
      { logAttach: true }
    );

    return () => {
      try { un?.(); } catch {}
    };
  }, [authReady, user?.uid, currentGroupId, seasonId, dayTick]);

  // active defis
  useEffect(() => {
    if (!authReady || !user?.uid || !currentGroupId) {
      setActiveDefis([]);
      setLoadingDefis(false);
      return;
    }

    setLoadingDefis(true);

    const qActiveLive = firestore()
      .collection("defis")
      .where("groupId", "==", String(currentGroupId))
      .where("status", "in", ["open", "live"])
      .limit(50);

    const un = listenRNFB(
      qActiveLive,
      (snap) => {
        const rows = (snap?.docs ?? []).map((d) => ({ id: d.id, ...(d?.data?.() || {}) }));
        rows.sort((a, b) => {
          const va =
            (a.signupDeadline?.toDate?.() ??
              a.firstGameUTC?.toDate?.() ??
              a.createdAt?.toDate?.() ??
              0).valueOf?.() || 0;
          const vb =
            (b.signupDeadline?.toDate?.() ??
              b.firstGameUTC?.toDate?.() ??
              b.createdAt?.toDate?.() ??
              0).valueOf?.() || 0;
          return va - vb;
        });

        setActiveDefis(rows);
        setLoadingDefis(false);

        const ascCount = rows.filter((x) => isAscensionDefi?.(x)).length;
        console.log(`[HOME DBG] activeDefis=${rows.length} ascDefis=${ascCount}`);
      },
      `defis:active:${currentGroupId}`,
      (e) => {
        setLoadingDefis(false);
        setError(e);
      },
      { logAttach: true }
    );

    return () => {
      try { un?.(); } catch {}
    };
  }, [authReady, user?.uid, currentGroupId]);

  // Derived
  const combinedError = error || meError;


  const avatarUrl =
    meDoc?.photoURL ??
    meDoc?.photoUrl ??
    meDoc?.avatarUrl ??
    meDoc?.avatar?.url ??
    user?.photoURL ??
    null;

  const ascensionDefis = useMemo(() => {
  const rows = Array.isArray(activeDefis) ? activeDefis : [];
    return rows.filter((d) => isAscensionDefi?.(d));
  }, [activeDefis]);

  const normalDefis = useMemo(() => {
    const rows = Array.isArray(activeDefis) ? activeDefis : [];
    return rows.filter((d) => !isAscensionDefi?.(d));
  }, [activeDefis]);

  // ✅ choix du “défi ascension” à afficher
  const asc7Defi = useMemo(() => {
    if (!ascensionDefis.length) return null;

    // Priorité: live, sinon open
    const live = ascensionDefis.find((d) => String(d.status || "").toLowerCase() === "live");
    if (live) return live;

    // Sinon le plus proche (signupDeadline / firstGameUTC / createdAt)
    const sorted = [...ascensionDefis].sort((a, b) => {
      const ta =
        (a.signupDeadline?.toDate?.() ??
          a.firstGameUTC?.toDate?.() ??
          a.createdAt?.toDate?.() ??
          0).valueOf?.() || 0;
      const tb =
        (b.signupDeadline?.toDate?.() ??
          b.firstGameUTC?.toDate?.() ??
          b.createdAt?.toDate?.() ??
          0).valueOf?.() || 0;
      return ta - tb;
    });

    return sorted[0] || null;
  }, [ascensionDefis]);

  const userGroups = useMemo(
    () =>
      groupIds.map((gid) => {
        const meta = groupsMeta[gid] || {};
        return {
          id: gid,
          name: meta.name || gid,
          status: meta.status || null,
          avatarUrl: meta.avatarUrl || null,
          ownerId: meta.ownerId || null,
          createdBy: meta.createdBy || null,
        };
      }),
    [groupIds.join("|"), JSON.stringify(groupsMeta)]
  );

  const favoriteGroupId = meDoc?.favoriteGroupId || null;

  function requireGroupOrExplain({ onOk }) {
    if (loadingGroups) return false;

    if (!userGroups.length) {
      Alert.alert(
        i18n.t("home.noGroups", { defaultValue: "Aucun groupe disponible" }),
        i18n.t("home.noGroupCreateDefiBody", { defaultValue: "Vous devez d’abord créer un groupe avant de continuer." }),
        [
          { text: i18n.t("common.cancel", { defaultValue: "Annuler" }), style: "cancel" },
          {
            text: i18n.t("home.createGroup", { defaultValue: "Créer un groupe" }),
            onPress: () => router.push("/(drawer)/(tabs)/GroupsScreen"),
          },
        ]
      );
      return false;
    }

    onOk?.();
    return true;
  }

  function openDefi(router, defi, intent) {
    const id = String(defi?.id || "").trim();
    if (!id) return;

    // ✅ Uniforme: tu peux garder la page /defis/:id qui redirige elle-même
    // vers participate/live/results selon l’état (ou l’UI interne).
    router.push("/(drawer)/defis/" + id);

    // OPTION (si tu veux des routes dédiées plus tard):
    // if (intent === "pick") router.push(`/(drawer)/defis/${id}/participate`);
    // else if (intent === "live") router.push(`/(drawer)/defis/${id}/live`);
    // else if (intent === "results") router.push(`/(drawer)/defis/${id}/results`);
    // else router.push(`/(drawer)/defis/${id}`);
  }

  function onPressCreateDefi() {
    requireGroupOrExplain({ onOk: () => setShowCreateModal(true) });
  }

  const onPressCreateFirstGoal = () => {
    requireGroupOrExplain({ onOk: () => setShowFirstGoalModal(true) });
  };

  const onPressCreateAscension = () => {
    requireGroupOrExplain({ onOk: () => setAscModalVisible(true) });
  };

  function onSelectGroup(gid) {
    setCurrentGroupId(String(gid));
  }

  /* ----------------------------- UI ----------------------------- */
  return (
    <>
      <Stack.Screen options={{ title: i18n.t("home.title") }} />

      <CreateFirstGoalModal
        visible={showFirstGoalModal}
        onClose={() => setShowFirstGoalModal(false)}
        groups={userGroups}
        initialGroupId={favoriteGroupId}
        onCreated={() => setShowFirstGoalModal(false)}
      />

      <CreateDefiModal
        visible={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        groups={userGroups}
        initialGroupId={favoriteGroupId}
        onCreated={() => setShowCreateModal(false)}
      />

      <CreateAscensionModal
        visible={ascModalVisible}
        onClose={() => setAscModalVisible(false)}
        groups={userGroups}
        initialGroupId={currentGroupId}
        onCreated={() => {
          setAscModalVisible(false);
          router.replace({
            pathname: "/(drawer)/(tabs)/AccueilScreen",
            params: { cold: "1", t: String(Date.now()) },
          });
        }}
      />

      <View style={{ flex: 1, backgroundColor: colors.background }}>
        {!authReady ? (
          <View style={styles.center}>
            <ActivityIndicator />
            <Text style={{ marginTop: 8, color: colors.subtext }}>{i18n.t("common.initializing")}</Text>
          </View>
        ) : !user ? (
          <View style={styles.center}>
            <Text style={{ color: colors.text }}>{i18n.t("home.loginToAccess")}</Text>
            <TouchableOpacity onPress={() => router.push("/(auth)/auth-choice")} style={styles.loginBtn}>
              <Text style={{ color: "#fff", fontWeight: "700" }}>{i18n.t("auth.login")}</Text>
            </TouchableOpacity>
          </View>
        ) : combinedError ? (
          <View style={styles.center}>
            <Text style={{ color: colors.text }}>
              {i18n.t("common.errorLabel")} {String(friendlyError(combinedError) ?? "")}
            </Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 32 }}>


            {/* Header profil */}
            <View style={[cardShadow()]}>
              <View style={sectionCardStyle(colors, RED)}>
                <ProfileHeaderCard
                  colors={colors}
                  avatarUrl={avatarUrl}
                  displayName={meDoc?.displayName || meDoc?.name}
                  points={defaultGroupPoints}
                  onEditAvatar={() => router.push("/avatars/AvatarsScreen")}
                  onPressPoints={() => router.push("/(drawer)/credits")}
                  onCreateDefi={onPressCreateDefi}
                  onCreateAscension={onPressCreateAscension}
                  onCreateFirstGoal={onPressCreateFirstGoal}
                  groups={userGroups}
                  currentGroupId={currentGroupId}
                  onSelectGroup={onSelectGroup}
                />
              </View>
            </View>

            {/* ✅ “Trois façons…” entre Profil et First Goal + centré */}
            <View style={{ marginTop: 2, marginBottom: 2, alignItems: "center" }}>
              <Text style={{ color: colors.text, fontWeight: "900", fontSize: 18, textAlign: "center" }}>
                {i18n.t("home.threeWays", { defaultValue: "Trois façons de jouer sur Prophetik" })}
              </Text>
              <Text style={{ color: colors.subtext, marginTop: 4, textAlign: "center" }}>
                {i18n.t("home.threeWaysSub", { defaultValue: "Choisis ton style aujourd’hui." })}
              </Text>
            </View>

            {/* 1) First goal */}
            <View style={[cardShadow()]}>
              <View style={sectionCardStyle(colors, RED)}>
                <SectionHeader
                  flat
                  colors={colors}
                  kicker={i18n.t("home.way1", { defaultValue: "Première façon de jouer" })}
                  leftIcon={<ProphetikIcons mode="emoji" emoji="🏒" size="lg" />}
                  title={i18n.t("firstGoal.home.title")}
                  rightAction={
                    hasFirstGoalForGroup ? null : (
                      <SectionCreateAction
                        onPress={onPressCreateFirstGoal}
                        label={i18n.t("common.create")}
                      />
                    )
                  }
                />
                <FirstGoalHomeSection groups={userGroups} currentGroupId={currentGroupId} colors={colors} onHasChallengeChange={setHasFirstGoalForGroup}/>
              </View>
            </View>

            {/* 2) Défis du jour */}
            <View style={[cardShadow()]}>
              <View style={sectionCardStyle(colors, RED)}>
                <SectionHeader
                  flat
                  colors={colors}
                  kicker={i18n.t("home.way2", { defaultValue: "Deuxième façon de jouer" })}
                  leftIcon={<ProphetikIcons mode="emoji" emoji="🎯" size="lg" />}
                  title={i18n.t("home.todayChallenge", { defaultValue: "Mes défis du jour" })}
                  rightAction={<SectionCreateAction onPress={onPressCreateDefi} label={i18n.t("common.create")} />}
                />
                <DefiListSection
                  hideHeader
                  colors={colors}
                  loadingGroups={loadingGroups}
                  loadingDefis={loadingDefis}
                  groupIds={groupIds}
                  activeDefis={normalDefis}
                  groupsMeta={groupsMeta}
                  tierLower={tierLower}
                  onOpenDefi={(defiId) => router.push("/(drawer)/defis/" + defiId)}
                  onUpgrade={() => router.push("/(drawer)/subscriptions")}
                />
              </View>
            </View>

            {/* Modal détails ascension */}
            <AscensionProgressModal
              visible={ascProgressOpen}
              onClose={() => setAscProgressOpen(false)}
              colors={colors}
              groupId={currentGroupId}
              ascKey="ASC7"
              includeAllGroupMembers={true}
            />

            {/* 3) ASC7 only */}
            <View style={[cardShadow()]}>
              <View style={sectionCardStyle(colors, RED)}>
                <SectionHeader
                  flat
                  colors={colors}
                  kicker={i18n.t("home.way3", { defaultValue: "Troisième façon de jouer" })}
                  leftIcon={<ProphetikIcons mode="emoji" emoji="🏔" size="lg" />}
                  title={i18n.t("ascensions.summit.title", { defaultValue: "Sommet Prophetik" })}
                  rightAction={
                    asc7InProgress ? (
                      <Chip
                        bg={colors.card2}
                        fg={colors.text}
                        icon="progress-clock"
                        label={i18n.t("common.inProgress", { defaultValue: "En cours" })}
                      />
                    ) : (
                      <SectionCreateAction onPress={onPressCreateAscension} label={i18n.t("common.create")} />
                    )
                  }
                />

              {loadingAsc7Member ? (
                <View style={{ marginTop: 10, alignItems: "center" }}>
                  <ActivityIndicator />
                </View>
              ) : (
                <ProgressBar value={asc7Progress.stepsDone} max={asc7Progress.maxSteps} colors={colors} />
              )}

                {/* ✅ “Jackpot” => “Points bonis” */}
                <View style={{ marginTop: 10 }}>
                  <Text style={{ color: colors.subtext }}>
                    {i18n.t("ascensions.labels.pointsBonis", { defaultValue: "Points bonis" })}:{" "}
                    <Text style={{ color: colors.text, fontWeight: "900" }}>{asc7PointsBonisTotal}</Text>
                  </Text>
                  <Text style={{ color: colors.subtext, marginTop: 4 }}>
                    {i18n.t("ascensions.labels.dailyPlus2", { defaultValue: "+2 points ajoutés par jour" })}
                  </Text>
                </View>

                {/* ✅ Défi lié à l’ascension (super clair) */}
                {asc7Defi ? (
                  <View style={{ marginTop: 12 }}>
                    <View
                      style={{
                        padding: 12,
                        borderRadius: 14,
                        borderWidth: 1,
                        borderColor: colors.border,
                        backgroundColor: colors.card2,
                      }}
                    >


                      <Text style={{ color: colors.text, fontWeight: "900", marginTop: 6 }}>
                        {String(asc7Defi.title || asc7Defi.name || i18n.t("common.challenge", { defaultValue: "Défi" }))}
                      </Text>

                      {(() => {
                        const cta = defiPrimaryCta(asc7Defi, i18n);

                        return (
                          <TouchableOpacity
                            onPress={() => openDefi(router, asc7Defi, cta.intent)}
                            activeOpacity={0.9}
                            style={{
                              marginTop: 10,
                              paddingVertical: 10,
                              borderRadius: 12,
                              alignItems: "center",
                              backgroundColor: RED,
                            }}
                          >
                            <Text style={{ color: "#fff", fontWeight: "900" }}>{cta.label}</Text>
                          </TouchableOpacity>
                        );
                      })()}


                    </View>
                  </View>
                ) : (
                  <View style={{ marginTop: 12 }}>
                    <Text style={{ color: colors.subtext }}>
                      {i18n.t("ascensions.labels.noLinkedDefi", { defaultValue: "Aucun défi d’ascension actif pour l’instant." })}
                    </Text>
                  </View>
                )}

                                {/* ✅ CTA “Détails de l’ascension” (au lieu d’un libellé interne type “Ascensions sur 7 jours”) */}
                <TouchableOpacity
                  onPress={() => setAscProgressOpen(true)}
                  style={{
                    marginTop: 12,
                    paddingVertical: 12,
                    borderRadius: 14,
                    alignItems: "center",
                    borderWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: colors.card2,
                  }}
                >
                  <Text style={{ color: colors.text, fontWeight: "900" }}>
                    {i18n.t("ascensions.cta.details", { defaultValue: "Détails de l’ascension" })}
                  </Text> 
                </TouchableOpacity>

                {/* Historique */}
                <TouchableOpacity
                  onPress={() => router.push(`/(drawer)/groups/${currentGroupId}/ascensions/history`)}
                  style={{
                    marginTop: 10,
                    paddingVertical: 12,
                    borderRadius: 14,
                    alignItems: "center",
                    borderWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: colors.card2,
                  }}
                >
                  <Text style={{ color: colors.text, fontWeight: "900" }}>
                    {i18n.t("ascensions.cta.past", { defaultValue: "Voir les ascensions passées" })}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        )}
      </View>
    </>
  );
}
 
const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  loginBtn: { marginTop: 12, backgroundColor: "#111", paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10 },
});