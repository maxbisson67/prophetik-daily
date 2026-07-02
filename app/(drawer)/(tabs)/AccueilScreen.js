// AccueilScreen.js — ASC7-only + “3 façons de jouer” centré + kicker italique + CTA détails ascension
import React, { useEffect, useRef, useState, useMemo, useCallback } from "react";
import i18n from "@src/i18n/i18n";
import {
  View,
  Text,
  ActivityIndicator,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Platform,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { useIsFocused, useFocusEffect } from "@react-navigation/native";

import CreateTeamPredictionModal from "@src/defis/CreateTeamPredictionModal";

import TeamPredictionHomeSection from "@src/defis/TeamPredictionHomeSection";

import CreateFirstGoalModal from "@src/firstGoal/CreateFirstGoalModal";
import FirstGoalHomeSection from "@src/firstGoal/FirstGoalHomeSection";

import { friendlyError, readPointsBalanceAny, isAscensionDefi, isTsDefi, isTsDefiForHomeToday, getSignupDeadlineOrFallback, isSignupDeadlinePassed } from "@src/home/homeUtils";
import useMeDoc from "@src/home/hooks/useMeDoc";

// UI
import ProfileHeaderCard from "@src/home/components/ProfileHeaderCard";
import DefiListSection from "@src/home/components/DefiListSection";
import ProphetikIcons from "@src/ui/ProphetikIcons";

// Ascension
import useAscensionGlobalState from "@src/ascensions/useAscensionGlobalState";
import AscensionProgressModal from "@src/ascensions/components/AscensionProgressModal";
import AscensionHomeCard from "@src/ascensions/components/AscensionHomeCard";


import { useRouter, Stack, useLocalSearchParams, useSegments } from "expo-router";
import firestore from "@react-native-firebase/firestore";
import { useAuth } from "@src/auth/SafeAuthProvider";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTheme } from "@src/theme/ThemeProvider";
import CreateDefiModal from "../defis/CreateDefiModal";
import CreateAscensionModal from "@src/ascensions/CreateAscensionModal";

import useEntitlement from "../subscriptions/useEntitlement";
import useLeaderboardCompetitionKey from "@src/hooks/useLeaderboardCompetitionKey";
import useGroupLeaderboardSummary from "@src/leaderboard/useGroupLeaderboardSummary";
import DefiTypeLeading from "@src/home/components/DefiTypeLeading";
import DefiSectionIntroBand from "@src/home/components/DefiSectionIntroBand";
import DefiChallengeInfoBubble from "@src/home/components/DefiChallengeInfoBubble";
import HomeDefisToggle, {
  areAllHomeDefisComplete,
  countCompletedHomeDefis,
} from "@src/home/components/HomeDefisToggle";
import DailyDefisProgress from "@src/home/components/DailyDefisProgress";
import GroupChatSection from "@src/home/components/GroupChatSection";
import { openMesResultatsTab } from "@src/defis/results/navigateToMesResultats";
import { BADGES_TAB_HREF } from "@src/achievements/screens/ProgressionScreen";

import { listenRNFB } from "@src/dev/fsListen";
import { useMyGroups } from "@src/groups/MyGroupsProvider";
import { useSelectedGroup } from "@src/groups/SelectedGroupProvider";
import { useAppVisibilitySafe } from "@src/providers/AppVisibilityProvider";
import {
  PROPHETIK_RED,
  prophetikCardShadow,
  prophetikLeftAccentCardStyle,
} from "@src/achievements/components/prophetikCardStyles";

/* ----------------------------- Helpers UI ----------------------------- */

function Chip({ bg, fg, icon, label }) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 4,
        paddingHorizontal: 12,
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
  kicker,
  title,
  subtitle,
  rightAction,
  flat = false,
  compact = false,
}) {
  return (
    <View
      style={[
        {
          padding: compact ? 0 : 12,
          borderRadius: 16,
          borderWidth: compact ? 0 : 1,
          borderColor: colors.border,
          backgroundColor: colors.card,
          marginBottom: compact ? 0 : 8,
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
            <View style={{ marginRight: compact ? 8 : 10 }}>{leftIcon}</View>
          ) : icon ? (
            <View
              style={{
                width: compact ? 28 : 36,
                height: compact ? 28 : 36,
                borderRadius: compact ? 8 : 12,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: colors.card2,
                borderWidth: 1,
                borderColor: colors.border,
                marginRight: compact ? 8 : 10,
              }}
            >
              <MaterialCommunityIcons name={icon} size={compact ? 14 : 18} color={colors.text} />
            </View>
          ) : null}

          <View style={{ flexShrink: 1 }}>
            {kicker ? (
              <Text
                style={{
                  color: colors.subtext,
                  fontStyle: "italic",
                  fontWeight: "700",
                  fontSize: compact ? 11 : 12,
                  marginBottom: 2,
                }}
              >
                {kicker}
              </Text>
            ) : null}

            <Text
              style={{
                color: compact ? colors.subtext : colors.text,
                fontSize: compact ? 12 : 16,
                fontWeight: compact ? "800" : "900",
              }}
            >
              {title}
            </Text>

            {subtitle && !compact ? (
              <Text style={{ color: colors.subtext, marginTop: 2, fontSize: 12 }} numberOfLines={2}>
                {subtitle}
              </Text>
            ) : null}
          </View>
        </View>

        {/* ✅ évite que le bouton “Créer” sorte de la carte */}
        <View style={{ flexShrink: 0, alignItems: "flex-end", justifyContent: "center", marginLeft: 12 }}>
          {rightAction}
        </View>
      </View>
    </View>
  );
}

function SectionCreateAction({ onPress, label = "Créer" }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={{
        backgroundColor: PROPHETIK_RED,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 999,
        minHeight: 44,
        justifyContent: "center",
      }}
    >
      <Text style={{ color: "#fff", fontWeight: "900", fontSize: 12 }}>{label}</Text>
    </TouchableOpacity>
  );
}

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
          label={i18n.t("ascensions.status.inProgress", { defaultValue: "En cours" })}
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

function InfoBubbleAscension({ colors }) {
  const [open, setOpen] = React.useState(false);

  return (
    <View
      style={{
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.card2,
        marginTop: 10,
        marginBottom: 10,
        overflow: "hidden",
      }}
    >
      <TouchableOpacity
        onPress={() => setOpen((v) => !v)}
        activeOpacity={0.85}
        style={{
          paddingHorizontal: 12,
          paddingVertical: 10,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
          <MaterialCommunityIcons
            name="information-outline"
            size={18}
            color={colors.subtext}
            style={{ marginTop: 1 }}
          />
          <Text style={{ color: colors.text, fontWeight: "900", marginLeft: 8, flex: 1 }}>
            {i18n.t("ascensions.infoTitle", {
              defaultValue: "What is an Ascension?",
            })}
          </Text>
        </View>

        <MaterialCommunityIcons
          name={open ? "chevron-up" : "chevron-down"}
          size={22}
          color={colors.subtext}
        />
      </TouchableOpacity>

      {open ? (
        <View
          style={{
            paddingHorizontal: 12,
            paddingBottom: 12,
            borderTopWidth: 1,
            borderTopColor: colors.border,
          }}
        >
          <Text style={{ color: colors.subtext, marginTop: 10, lineHeight: 18 }}>
            {i18n.t("ascensions.infoBody", {
              defaultValue:
                "An Ascension is a multi-day challenge where you progress step by step. Each completed challenge advances your climb, and daily bonus points can increase the reward at the summit.",
            })}
          </Text>
        </View>
      ) : null}
    </View>
  );
}



/* =========================
   SCREEN
========================= */

function isDefiPickerRoute(segments) {
  const path = (segments || []).map(String).join("/");
  return (
    path.includes("team-prediction") ||
    path.includes("first-goal") ||
    /defis\/[^/]+/.test(path)
  );
}

export default function AccueilScreen() {
  const { user, authReady } = useAuth();
  const router = useRouter();
  const { colors } = useTheme();
  const isFocused = useIsFocused();
  const segments = useSegments();
  const skipDefiTabResetRef = useRef(false);
  const { isActive: appActive } = useAppVisibilitySafe();
  const listenersEnabled = isFocused && appActive;
  const homeScrollRef = useRef(null);
  const bindHomeScrollRef = useCallback((ref) => {
    homeScrollRef.current = ref;
  }, []);

  const {
    readableGroupIds: groupIds,
    groupsMeta,
    userGroups,
    loading: loadingGroups,
    error: groupsError,
  } = useMyGroups();

  const { tier: userTier } = useEntitlement(user?.uid);
  const tierLower = String(userTier || "free").toLowerCase();

  const [activeDefis, setActiveDefis] = useState([]);
  const [loadingDefis, setLoadingDefis] = useState(true);

  const [error, setError] = useState(null);

  const { selectedGroupId: currentGroupId, setSelectedGroupId } = useSelectedGroup();

  const currentGroupMeta = currentGroupId ? groupsMeta[currentGroupId] || null : null;
  const currentSport = String(currentGroupMeta?.sport || currentGroupMeta?.league || "NHL").toUpperCase();

  const {
    competitionKey,
    daysRemaining,
    competitionLabel,
    loading: loadingCompetition,
  } = useLeaderboardCompetitionKey({
    sport: currentSport,
    enabled: listenersEnabled && !!currentGroupId,
  });

  const groupLeaderboardSummary = useGroupLeaderboardSummary({
    groupId: currentGroupId,
    competitionKey,
    sport: currentSport,
    uid: user?.uid,
    enabled: listenersEnabled && !!currentGroupId && !!competitionKey,
  });

  const streakGroupSummary = useMemo(
    () => ({
      show: !!(currentGroupId && competitionKey && user?.uid),
      loading: groupLeaderboardSummary.loading || loadingCompetition,
      myPoints: groupLeaderboardSummary.myPoints,
      myRank: groupLeaderboardSummary.myRank,
      totalMembers: groupLeaderboardSummary.totalMembers,
      daysRemaining,
      competitionLabel,
    }),
    [
      currentGroupId,
      competitionKey,
      user?.uid,
      groupLeaderboardSummary,
      daysRemaining,
      competitionLabel,
      loadingCompetition,
    ]
  );
  

  const [showFirstGoalModal, setShowFirstGoalModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const params = useLocalSearchParams();

  const [hasFirstGoalForGroup, setHasFirstGoalForGroup] = useState(false);

  const [loadingAsc7Member, setLoadingAsc7Member] = useState(false);

const [showTeamPredictionModal, setShowTeamPredictionModal] = useState(false);

const [hasTeamPredictionForGroup, setHasTeamPredictionForGroup] = useState(false);
const [canCreateTpBundle, setCanCreateTpBundle] = useState(true);
const [tpBundleHintId, setTpBundleHintId] = useState(null);
const [fgcHintChallengeId, setFgcHintChallengeId] = useState(null);
const [tsHintDefiId, setTsHintDefiId] = useState(null);
const [selectedDefiTab, setSelectedDefiTab] = useState("fgc");
const handledAccueilOpenRef = useRef("");

  useEffect(() => {
    if (!isFocused && isDefiPickerRoute(segments)) {
      skipDefiTabResetRef.current = true;
    }
  }, [isFocused, segments]);

  useFocusEffect(
    useCallback(() => {
      if (skipDefiTabResetRef.current) {
        skipDefiTabResetRef.current = false;
        return;
      }
      const openId = String(params?.openChallengeId || "").trim();
      const kind = String(params?.kind || params?.defiTab || "").trim().toLowerCase();
      if (openId && kind) return;
      setSelectedDefiTab("fgc");
    }, [params?.openChallengeId, params?.kind, params?.defiTab])
  );

const [fgcProgress, setFgcProgress] = useState({ done: 0, total: 0 });
const [tpProgress, setTpProgress] = useState({ done: 0, total: 0 });

const [myParticipationsByDefiId, setMyParticipationsByDefiId] = useState({});
  

  // day tick
  const [dayTick, setDayTick] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setDayTick((x) => x + 1), msUntilNextLocalMidnight());
    return () => clearTimeout(t);
  }, [dayTick]);

  // Reset auth/day
  useEffect(() => {
    setActiveDefis([]);
    setError(null);
    setLoadingDefis(!!(authReady && user?.uid));
    setMyParticipationsByDefiId({});
  }, [authReady, user?.uid, dayTick]);

  // Participant doc
  const { meDoc, error: meError } = useMeDoc({
    authReady,
    uid: user?.uid,
    dayTick,
    enabled: listenersEnabled,
  });

  const avatarKind = meDoc?.avatarKind || null;

  const jerseyFrontUrl = meDoc?.jerseyFrontUrl || null;
  const jerseyBackUrl = meDoc?.jerseyBackUrl || null;

  // Derived
  const combinedError = error || meError || groupsError;

  // active defis
  useEffect(() => {
    if (!listenersEnabled || !authReady || !user?.uid || !currentGroupId || !currentGroupMeta) {
      setActiveDefis([]);
      setLoadingDefis(false);
      return;
    }

    setLoadingDefis(true);

    console.log("[HOME DEFIS QUERY]", {
      currentGroupId,
      currentSport,
    });

    const qActiveLive = firestore()
      .collection("defis")
      .where("groupId", "==", String(currentGroupId))
      .limit(50);

    const un = listenRNFB(
      qActiveLive,
      (snap) => {
        const rowsRaw = (snap?.docs ?? []).map((d) => ({
          id: d.id,
          ...(d?.data?.() || {}),
        }));

        console.log(
          "[HOME DEFIS RAW]",
          rowsRaw.map((r) => ({
            id: r.id,
            groupId: r.groupId,
            sport: r.sport,
            status: r.status,
            type: r.type,
          }))
        );

        const rows = rowsRaw.filter((d) => {
          const sport = String(d?.sport || "NHL").toUpperCase();
          const status = String(d?.status || "").toLowerCase();

          return sport === currentSport && ["open", "live"].includes(status);
        });


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
      },
      `defis:active:${currentGroupId}:${currentSport}`,
      (e) => {
        console.log("[HOME DEFIS ERROR]", e?.code, e?.message || e);
        setLoadingDefis(false);
        setError(e);
      },
      { screen: "AccueilScreen" }
    );

    return () => {
      try {
        un?.();
      } catch {}
    };
  }, [listenersEnabled, authReady, user?.uid, currentGroupId, currentGroupMeta?.id, currentSport]);

useEffect(() => {

  setActiveDefis([]);

  setMyParticipationsByDefiId({});

  setHasFirstGoalForGroup(false);

  setHasTeamPredictionForGroup(false);
  setCanCreateTpBundle(true);
  setTpBundleHintId(null);
  setFgcHintChallengeId(null);
  setTsHintDefiId(null);
  setFgcProgress({ done: 0, total: 0 });
  setTpProgress({ done: 0, total: 0 });

}, [currentGroupId, currentSport]);

  const normalDefisBase = useMemo(() => {
    const rows = Array.isArray(activeDefis) ? activeDefis : [];
    return rows.filter((d) => !isAscensionDefi?.(d) && isTsDefiForHomeToday(d));
  }, [activeDefis]);

  const hasTsForGroup = useMemo(() => {
    return (normalDefisBase || []).some((d) => isTsDefi(d));
  }, [normalDefisBase]);

  const tsParticipated = useMemo(() => {
    return (normalDefisBase || []).some((d) => {
      const participation = myParticipationsByDefiId[String(d.id)];
      return !!participation;
    });
  }, [normalDefisBase, myParticipationsByDefiId]);

  const defiCompletionByTab = useMemo(
    () => {
      const tsDefi = (normalDefisBase || []).find((d) => isTsDefi(d));
      const tsDone = tsParticipated ? 1 : 0;
      const tsDeadline = getSignupDeadlineOrFallback(tsDefi);
      const tsExpired = tsDone < 1 && isSignupDeadlinePassed(tsDeadline);

      return {
        fgc: hasFirstGoalForGroup ? fgcProgress : { done: 0, total: 0 },
        tp: tpProgress,
        ts: hasTsForGroup
          ? { done: tsDone, total: 1, ...(tsExpired ? { expired: true } : {}) }
          : { done: 0, total: 0 },
      };
    },
    [fgcProgress, hasFirstGoalForGroup, tpProgress, tsParticipated, hasTsForGroup, normalDefisBase]
  );

  const allDailyDefisEnrolled = useMemo(
    () => areAllHomeDefisComplete(defiCompletionByTab),
    [defiCompletionByTab]
  );

  const dailyDefisCompletedCount = useMemo(
    () => countCompletedHomeDefis(defiCompletionByTab),
    [defiCompletionByTab]
  );

  const normalDefis = useMemo(() => {
    const hintId = String(tsHintDefiId || "").trim();
    const rows = (normalDefisBase || []).map((defi) => ({
      ...defi,
      myParticipation: myParticipationsByDefiId[String(defi.id)] || null,
    }));

    if (!hintId) return rows;

    return [...rows].sort((a, b) => {
      const aHint = String(a.id) === hintId;
      const bHint = String(b.id) === hintId;
      if (aHint === bHint) return 0;
      return aHint ? -1 : 1;
    });
  }, [normalDefisBase, myParticipationsByDefiId, tsHintDefiId]);

  // Les participations du user  // Les participations TS du user
  useEffect(() => {
    if (!listenersEnabled || !authReady || !user?.uid) {
      return;
    }

    const tsIds = (normalDefisBase || [])
      .filter((d) => isTsDefi(d))
      .map((d) => String(d?.id || "").trim())
      .filter(Boolean)
      .sort();

    // Ne pas vider brutalement si la liste est transitoirement vide pendant un refresh
    if (!tsIds.length) {
      return;
    }

    const unsubs = [];

    // Conserver les participations déjà connues pour les défis encore visibles
    setMyParticipationsByDefiId((prev) => {
      const next = {};
      tsIds.forEach((id) => {
        next[id] = prev?.[id] ?? null;
      });
      return next;
    });

    tsIds.forEach((defiId) => {
      const ref = firestore()
        .collection("defis")
        .doc(defiId)
        .collection("participations")
        .doc(String(user.uid));

      const unsub = ref.onSnapshot(
        (snap) => {
          const data = snap?.exists ? snap.data() || null : null;

          //console.log("[HOME TS SNAP]", defiId, "exists=", snap?.exists, "data=", data);

          setMyParticipationsByDefiId((prev) => ({
            ...prev,
            [defiId]: data,
          }));
        },
        (err) => {
          console.log("[HOME] TS participation error", defiId, err?.message || err);

          setMyParticipationsByDefiId((prev) => ({
            ...prev,
            [defiId]: null,
          }));
        }
      );

      unsubs.push(unsub);
    });

    return () => {
      unsubs.forEach((u) => {
        try {
          u?.();
        } catch {}
      });
    };
  }, [
    listenersEnabled,
    authReady,
    user?.uid,
    JSON.stringify(
      (normalDefisBase || [])
        .filter((d) => isTsDefi(d))
        .map((d) => String(d?.id || "").trim())
        .filter(Boolean)
        .sort()
    ),
  ]);



const isCurrentGroupOwner =
  !!user?.uid &&
  !!currentGroupMeta &&
  (currentGroupMeta.ownerId === user.uid || currentGroupMeta.createdBy === user.uid); 

const avatarUrl =
  meDoc?.avatarKind === "jersey"
    ? meDoc?.jerseyFrontUrl || meDoc?.avatarUrl || null
    : meDoc?.avatarUrl ??
      meDoc?.photoURL ??
      meDoc?.photoUrl ??
      meDoc?.avatar?.url ??
      user?.photoURL ??
      null;




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

  function openDefi(router, defi) {
    const id = String(defi?.id || "").trim();
    if (!id) return;

    router.push({
      pathname: "/(drawer)/defis/[defiId]",
      params: { defiId: id },
    });
  }

  function onPressCreateDefi() {
    requireGroupOrExplain({ onOk: () => setShowCreateModal(true) });
  }

  const onPressCreateFirstGoal = () => {
    requireGroupOrExplain({ onOk: () => setShowFirstGoalModal(true) });
  };


  function onSelectGroup(gid) {
    setSelectedGroupId(String(gid));
  }

  useEffect(() => {
    const raw = params?.groupId;
    const gid = Array.isArray(raw) ? raw[0] : raw;
    if (!gid) return;
    if (!groupIds.includes(String(gid))) return;
    setSelectedGroupId(String(gid));
  }, [params?.groupId, groupIds.join("|"), setSelectedGroupId]);

  useEffect(() => {
    const openId = String(params?.openChallengeId || "").trim();
    const kind = String(params?.kind || params?.defiTab || "").trim().toLowerCase();
    if (!openId && !kind) return;

    const key = `${openId}:${kind}`;
    if (handledAccueilOpenRef.current === key) return;
    handledAccueilOpenRef.current = key;

    if (kind === "fgc" || kind === "tp" || kind === "ts") {
      setSelectedDefiTab(kind);
    }
    if (kind === "tp" && openId) {
      setTpBundleHintId(openId);
    }
    if (kind === "fgc" && openId) {
      setFgcHintChallengeId(openId);
    }
    if (kind === "ts" && openId) {
      setTsHintDefiId(openId);
    }
  }, [params?.openChallengeId, params?.kind, params?.defiTab]);

  const onPressCreateTeamPrediction = () => {
  requireGroupOrExplain({ onOk: () => setShowTeamPredictionModal(true) });
};

  /* ----------------------------- UI ----------------------------- */
  return (
    <>
      <Stack.Screen options={{ title: i18n.t("home.title") }} />

      <CreateFirstGoalModal
        visible={showFirstGoalModal}
        onClose={() => setShowFirstGoalModal(false)}
        groups={userGroups.filter((g) => String(g.sport || "NHL").toUpperCase() === currentSport)}
        initialGroupId={currentGroupId || favoriteGroupId}
        initialSport={currentSport}
        league={currentSport}
        onCreated={() => {
          setShowFirstGoalModal(false);
          setHasFirstGoalForGroup(true);
        }}
      />

      <CreateTeamPredictionModal
        visible={showTeamPredictionModal}
        onClose={() => setShowTeamPredictionModal(false)}
        groups={userGroups.filter((g) => String(g.sport || "NHL").toUpperCase() === currentSport)}
        initialGroupId={currentGroupId || favoriteGroupId}
        initialSport={currentSport}
        league={currentSport}
        onCreated={(data) => {
          const bundleId = String(data?.bundleId || "").trim();
          if (bundleId) setTpBundleHintId(bundleId);
          setShowTeamPredictionModal(false);
          router.replace({
            pathname: "/(drawer)/(tabs)/AccueilScreen",
            params: { cold: "1", t: String(Date.now()) },
          });
        }}
      />

      <CreateDefiModal
        visible={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        groups={userGroups}
        initialGroupId={favoriteGroupId}
        initialSport={currentSport}
        onCreated={() => setShowCreateModal(false)}
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
          <KeyboardAwareScrollView
            style={{ flex: 1 }}
            innerRef={bindHomeScrollRef}
            contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 80 }}
            keyboardShouldPersistTaps="handled"
            enableOnAndroid
            enableAutomaticScroll
            extraScrollHeight={100}
            extraHeight={Platform.OS === "ios" ? 100 : 80}
            keyboardOpeningTime={0}
          >
            {/* Header profil */}
            <View style={[prophetikCardShadow()]}>
              <View style={prophetikLeftAccentCardStyle(colors, PROPHETIK_RED)}>
              <ProfileHeaderCard
                colors={colors}
                avatarKind={avatarKind}
                avatarUrl={avatarUrl}
                jerseyFrontUrl={jerseyFrontUrl}
                jerseyBackUrl={jerseyBackUrl}
                displayName={meDoc?.displayName || meDoc?.name}
                onEditAvatar={() => router.push("/avatars/JerseysScreen")}
                onCreateDefi={onPressCreateDefi}
                onCreateFirstGoal={onPressCreateFirstGoal}
                groups={userGroups}
                currentGroupId={currentGroupId}
                onSelectGroup={onSelectGroup}
                stats={meDoc?.stats}
                achievements={meDoc?.achievements}
                onPressProgression={() => router.push(BADGES_TAB_HREF)}
                groupSummary={streakGroupSummary}
              />
              </View>
            </View>

            {allDailyDefisEnrolled ? (
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => openMesResultatsTab(router, { groupId: currentGroupId })}
                style={{
                  marginTop: 2,
                  marginBottom: 2,
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  borderRadius: 6,
                  backgroundColor: "rgba(22,163,74,0.12)",
                  borderWidth: 1,
                  borderColor: "rgba(22,163,74,0.35)",
                  width: "100%",
                  maxWidth: 420,
                  alignSelf: "center",
                }}
              >
                <Text style={{ color: "#16a34a", fontWeight: "900", fontSize: 13, textAlign: "center" }}>
                  {i18n.t("home.dailyDefisAllEnrolled", {
                    defaultValue: "Bravo, tu es inscrit à tous les défis!",
                  })}
                </Text>
                <Text
                  style={{
                    color: "#16a34a",
                    fontSize: 12,
                    lineHeight: 17,
                    textAlign: "center",
                    marginTop: 4,
                    fontWeight: "600",
                  }}
                >
                  {i18n.t("home.dailyDefisResultsHintPrefix", {
                    defaultValue: "Regarde tes performances dans l'onglet ",
                  })}
                  <Text style={{ textDecorationLine: "underline", fontWeight: "900" }}>
                    {i18n.t("tabs.challenges", { defaultValue: "Mes résultats" })}
                  </Text>
                </Text>
              </TouchableOpacity>
            ) : null}

            <View style={[prophetikCardShadow()]}>
              <View style={prophetikLeftAccentCardStyle(colors, PROPHETIK_RED)}>
                <HomeDefisToggle
                  title={i18n.t("home.dailyDefisTitle")}
                  headerBleed={12}
                  accentColor={PROPHETIK_RED}
                  neutralHeader
                  value={selectedDefiTab}
                  onChange={setSelectedDefiTab}
                  colors={colors}
                  completedByTab={defiCompletionByTab}
                />

                <DailyDefisProgress completedCount={dailyDefisCompletedCount} colors={colors} />

                <View style={selectedDefiTab === "fgc" ? undefined : { display: "none" }}>
                  <DefiSectionIntroBand>
                    <SectionHeader
                      flat
                      compact
                      colors={colors}
                      title={
                        currentSport === "MLB"
                          ? i18n.t("firstGoal.firstRbi.title", { defaultValue: "Premier point produit" })
                          : i18n.t("firstGoal.home.title")
                      }
                      leftIcon={<DefiTypeLeading kind="fgc" sport={currentSport} colors={colors} glyphSize={20} />}
                      rightAction={
                        isCurrentGroupOwner && !hasFirstGoalForGroup ? (
                          <SectionCreateAction
                            onPress={onPressCreateFirstGoal}
                            label={i18n.t("common.create")}
                          />
                        ) : null
                      }
                    />
                    <DefiChallengeInfoBubble kind="fgc" colors={colors} inIntroBand />
                  </DefiSectionIntroBand>
                  <FirstGoalHomeSection
                    groups={userGroups}
                    currentGroupId={currentGroupId}
                    currentSport={currentSport}
                    colors={colors}
                    listenersEnabled={listenersEnabled}
                    hintChallengeId={fgcHintChallengeId}
                    onHasChallengeChange={setHasFirstGoalForGroup}
                    onUserParticipatedChange={setFgcProgress}
                  />
                </View>

                <View style={selectedDefiTab === "tp" ? undefined : { display: "none" }}>
                  <DefiSectionIntroBand>
                    <SectionHeader
                      flat
                      compact
                      colors={colors}
                      leftIcon={<DefiTypeLeading kind="tp" sport={currentSport} colors={colors} glyphSize={20} />}
                      title={i18n.t("tp.home.title", { defaultValue: "Prédire l'issue des matchs" })}
                      rightAction={
                        isCurrentGroupOwner && canCreateTpBundle ? (
                          <SectionCreateAction
                            onPress={onPressCreateTeamPrediction}
                            label={i18n.t("common.create", { defaultValue: "Créer" })}
                          />
                        ) : null
                      }
                    />
                    <DefiChallengeInfoBubble kind="tp" colors={colors} inIntroBand />
                  </DefiSectionIntroBand>
                  <TeamPredictionHomeSection
                    groups={userGroups}
                    colors={colors}
                    currentGroupId={currentGroupId}
                    currentSport={currentSport}
                    listenersEnabled={listenersEnabled}
                    hintBundleId={tpBundleHintId}
                    onHasChallengeChange={setHasTeamPredictionForGroup}
                    onCanCreateBundleChange={setCanCreateTpBundle}
                    onUserParticipatedChange={setTpProgress}
                  />
                </View>

                <View style={selectedDefiTab === "ts" ? undefined : { display: "none" }}>
                  <DefiSectionIntroBand>
                    <SectionHeader
                      flat
                      compact
                      colors={colors}
                      leftIcon={<DefiTypeLeading kind="ts" sport={currentSport} colors={colors} glyphSize={20} />}
                      title={i18n.t("home.todayChallenge", { defaultValue: "Le trio du jour" })}
                      rightAction={
                        isCurrentGroupOwner && !hasTsForGroup ? (
                          <SectionCreateAction
                            onPress={onPressCreateDefi}
                            label={i18n.t("common.create")}
                          />
                        ) : null
                      }
                    />
                    <DefiChallengeInfoBubble kind="ts" colors={colors} inIntroBand />
                  </DefiSectionIntroBand>
                  <DefiListSection
                    hideHeader
                    colors={colors}
                    loadingGroups={loadingGroups}
                    loadingDefis={loadingDefis}
                    groupIds={groupIds}
                    currentSport={currentSport}
                    activeDefis={normalDefis}
                    groupsMeta={groupsMeta}
                    tierLower={tierLower}
                    onOpenDefi={(defiId) => router.push("/(drawer)/defis/" + defiId)}
                    onUpgrade={() => router.push("/(drawer)/subscriptions")}
                  />
                </View>
              </View>
            </View>

            {currentGroupId ? (
              <View style={[prophetikCardShadow()]}>
                <View style={prophetikLeftAccentCardStyle(colors, PROPHETIK_RED)}>
                  <GroupChatSection
                    groupId={currentGroupId}
                    groupName={currentGroupMeta?.name || currentGroupMeta?.title || null}
                    colors={colors}
                    onInputFocus={() => {
                      requestAnimationFrame(() => {
                        const scroll = homeScrollRef.current;
                        if (typeof scroll?.scrollToEnd === "function") {
                          scroll.scrollToEnd({ animated: true });
                          return;
                        }
                        scroll?.getScrollResponder?.()?.scrollToEnd?.({ animated: true });
                      });
                    }}
                  />
                </View>
              </View>
            ) : null}

          </KeyboardAwareScrollView>
        )}
      </View>
    </>
  );
}
 
const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  loginBtn: { marginTop: 12, backgroundColor: "#111", paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10 },
});