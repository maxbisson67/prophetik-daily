// app/(drawer)/(tabs)/AccueilScreen.js
import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import i18n from '@src/i18n/i18n';
import {
  View,
  Text,
  ActivityIndicator,
  TouchableOpacity,
  ScrollView,
  Image,
  StyleSheet,
} from 'react-native';

import {
  fmtTSLocalHM,
  toDateOrNull,
  computeUiStatus,
  statusStyle,
  allowedTypesForTierUi,
  canJoinDefiUi,
  friendlyError,
  readPointsBalanceAny,
  shortUid,
  withCacheBust,
  isAscensionDefi,
  ascLabel,
  normalDefiLabel,
} from "@src/home/homeUtils";

import useMeDoc from "@src/home/hooks/useMeDoc";

// Components UI
import ProfileHeaderCard from "@src/home/components/ProfileHeaderCard";
import DefiListSection from "@src/home/components/DefiListSection";
import QuickStatsRow from "@src/home/components/QuickStatsRow";
import MainMetricsRow from "@src/home/components/MainMetricsRow";
import ProphetikIcons from "@src/ui/ProphetikIcons";

// Ascensions
import useAscensionGlobalState from "@src/ascensions/useAscensionGlobalState";
import { ascGlobalUi } from "@src/ascensions/utils/ascensionGlobalUi";
import AscensionSection from "@src/ascensions/components/AscensionSection";
import AscensionProgressModal from "@src/ascensions/components/AscensionProgressModal";


import { useRouter, Stack } from 'expo-router';
import firestore from '@react-native-firebase/firestore';
import { useAuth } from '@src/auth/SafeAuthProvider';
import { MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import { useTheme } from '@src/theme/ThemeProvider';
import CreateDefiModal from '../defis/CreateDefiModal';
import CreateAscensionModal from "@src/ascensions/CreateAscensionModal";


import useEntitlement from '../subscriptions/useEntitlement'; // ajuste le chemin si besoin

import useCurrentSeason from "@src/hooks/useCurrentSeason";

const AVATAR_PLACEHOLDER = require('../../../assets/avatar-placeholder.png');


function usePublicProfilesFor(uids) {
  const [map, setMap] = useState({}); // uid -> { displayName, avatarUrl, updatedAt }

  useEffect(() => {
    const ids = Array.from(new Set((uids || []).filter(Boolean).map(String)));
    if (!ids.length) {
      setMap({});
      return;
    }

    const unsubs = new Map();

    ids.forEach((uid) => {
      const ref = firestore().collection('profiles_public').doc(uid);
      const un = ref.onSnapshot(
        (snap) => {
          if (!snap.exists) {
            setMap((prev) => {
              if (!prev[uid]) return prev;
              const next = { ...prev };
              delete next[uid];
              return next;
            });
            return;
          }
          const d = snap.data() || {};
          setMap((prev) => ({
            ...prev,
            [uid]: {
              displayName: d.displayName || null,
              avatarUrl: d.avatarUrl || null,
              updatedAt: d.updatedAt || null,
            },
          }));
        },
        () => {}
      );
      unsubs.set(uid, un);
    });

    return () => {
      for (const [, un] of unsubs) {
        try {
          un();
        } catch {}
      }
    };
  }, [JSON.stringify(uids || [])]);

  return map;
}

/* ----------------------------- Helpers ----------------------------- */


function isSignupClosed(defi) {
  const now = new Date();
  const d = toDateOrNull(defi?.signupDeadline);
  if (!d) return false;
  return d.getTime() <= now.getTime();
}

function Chip({ bg, fg, icon, label }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        paddingVertical: 4,
        paddingHorizontal: 8,
        borderRadius: 999,
        backgroundColor: bg,
      }}
    >
      <MaterialCommunityIcons name={icon} size={14} color={fg} />
      <Text style={{ color: fg, marginLeft: 6, fontWeight: '700' }}>
        {label}
      </Text>
    </View>
  );
}


// Petit helper homogène pour onSnapshot
function listenRNFB(refOrQuery, onNext, tag, onError) {
  return refOrQuery.onSnapshot(
    onNext,
    (e) => {
      console.log(`[FS:${tag}]`, e?.code, e?.message);
      onError?.(e);
    }
  );
}

/* ----------------------------- Date helpers ----------------------------- */
const APP_TZ = 'America/Toronto';

function msUntilNextLocalMidnight() {
  const now = new Date();
  const next = new Date(now);
  next.setHours(24, 0, 0, 0);
  return Math.max(1000, next.getTime() - now.getTime());
}


function AscBadge({ ascKey, colors }) {
  const k = String(ascKey || "");
  const label = k === "ASC7" ? "ASC7" : k === "ASC4" ? "ASC4" : "ASC";
  return (
    <View
      style={{
        alignSelf: "flex-start",
        paddingVertical: 3,
        paddingHorizontal: 8,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.card2,
      }}
    >
      <Text style={{ fontSize: 11, fontWeight: "900", color: colors.text }}>
        🏔 {label}
      </Text>
    </View>
  );
}

function SectionHeader({
  colors,
  icon,        // legacy (MaterialCommunityIcons)
  leftIcon,    // ✅ NOUVEAU (ReactNode)
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
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          
          {/* ✅ Priorité à leftIcon */}
          {leftIcon ? (
            <View style={{ marginRight: 10 }}>
              {leftIcon}
            </View>
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

          <View>
            <Text style={{ color: colors.text, fontSize: 16, fontWeight: "900" }}>
              {title}
            </Text>

            {subtitle ? (
              <Text style={{ color: colors.subtext, marginTop: 2 }}>
                {subtitle}
              </Text>
            ) : null}
          </View>
        </View>

        {rightAction}
      </View>
    </View>
  );
}

function cardShadow() {
  return {
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 }, // iOS
    elevation: 4, // Android
  };
}

/* ----------------------------- Screen ----------------------------- */
export default function AccueilScreen() {
  const { user, authReady } = useAuth();
  const router = useRouter();
  const { colors } = useTheme();

  const {
    tier: userTier,
    loading: loadingTier,
    active: tierActive,
  } = useEntitlement(user?.uid);

  const [myPlays, setMyPlays] = useState(0);
  const [myWins, setMyWins] = useState(0);
  const [myNhlPPG, setMyNhlPPG] = useState(0);

  // ✅ Leaderboard = uniquement selon entitlement participant (plus de group_entitlements)
  const tierLower = String(userTier || 'free').toLowerCase();


  // ---- groupes → ids ----
  const [groupIds, setGroupIds] = useState([]);
  const [loadingGroups, setLoadingGroups] = useState(true);

  // ---- défis actifs/live ----
  const [activeDefis, setActiveDefis] = useState([]);
  const [loadingDefis, setLoadingDefis] = useState(true);

  const [error, setError] = useState(null);

  // ---- Métadonnées des groupes (nom, status, avatar) ----
  const [groupsMeta, setGroupsMeta] = useState({});
  const groupMetaUnsubs = useRef(new Map());

  // ---- Groupe par défaut ----
  const [defaultGroupId, setDefaultGroupId] = useState(null);

  // ---- Groupe sélectionné (UI) ----
  const [currentGroupId, setCurrentGroupId] = useState(null);

  // ---- Classement top ----
  const [leaderboardRows, setLeaderboardRows] = useState([]);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(true);

  const [defaultGroupPoints, setDefaultGroupPoints] = useState(0);
  const [loadingDefaultGroupPoints, setLoadingDefaultGroupPoints] = useState(true);

  const groupsAttachedForUidRef = useRef(null);

  const { season, loading: loadingSeason } = useCurrentSeason();
  const seasonId = season?.seasonId;

  // Ascensions

  const [ascModalVisible, setAscModalVisible] = useState(false);
  const { state: asc4State, loading: loadingAsc4 } = useAscensionGlobalState({
    groupId: currentGroupId,
    ascKey: "ASC4",
    enabled: !!currentGroupId,
  });

  const { state: asc7State, loading: loadingAsc7 } = useAscensionGlobalState({
    groupId: currentGroupId,
    ascKey: "ASC7",
    enabled: !!currentGroupId,
  });

  const asc4Ui = ascGlobalUi("ASC4", asc4State);
  const asc7Ui = ascGlobalUi("ASC7", asc7State);

  const [ascProgressOpen, setAscProgressOpen] = useState(false);
  const [ascProgressKey, setAscProgressKey] = useState("ASC4"); // ou ASC7  



  // listeners refs
  const subs = useRef({
    me: null,
    byUid: null,
    byPid: null,
    ownerCreated: null,
    ownerOwnerId: null,
    leaderboard: null,
    defaultGroupPoints: null,
  });
  const defisUnsubsRef = useRef(new Map());

  // mémos clés
  const lastGroupIdsKeyRef = useRef('');
  const lastActiveKeyRef = useRef('');

  // 👉 Modal de création de défi
  const [showCreateModal, setShowCreateModal] = useState(false);

  // ✅ Tick quotidien : au prochain minuit (local device), on force un refresh logique
  const [dayTick, setDayTick] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => {
      setDayTick((x) => x + 1);
    }, msUntilNextLocalMidnight());
    return () => clearTimeout(t);
  }, [dayTick]);

  // Reset au changement d’auth OU au tick quotidien
  useEffect(() => {
    setGroupIds([]);
    setActiveDefis([]);
    setError(null);

    setLoadingGroups(!!(authReady && user?.uid));
    setLoadingDefis(!!(authReady && user?.uid));

    setGroupsMeta({});
    setShowCreateModal(false);

    setDefaultGroupId(null);

    setLeaderboardRows([]);
    setLoadingLeaderboard(true);

    setDefaultGroupPoints(0);
    setLoadingDefaultGroupPoints(true);

    lastGroupIdsKeyRef.current = '';
    lastActiveKeyRef.current = '';

    // stop listeners
    const { me, defaultGroupPoints, ...rest } = subs.current;

    Object.values(rest).forEach((un) => {
      try { un?.(); } catch {}
    });

    try { defaultGroupPoints?.(); } catch {}
    try { me?.(); } catch {}

    for (const [, un] of defisUnsubsRef.current) {
      try {
        un();
      } catch {}
    }
    defisUnsubsRef.current.clear();

    subs.current = {
      me: null,
      byUid: null,
      byPid: null,
      ownerCreated: null,
      ownerOwnerId: null,
      leaderboard: null,
      defaultGroupPoints: null,
    };

    for (const [, un] of groupMetaUnsubs.current) {
      try {
        un();
      } catch {}
    }
    groupMetaUnsubs.current.clear();
  }, [authReady, user?.uid, dayTick]);

  /* ---------- 1) Participant (wallet, profil) ---------- */
  const { meDoc, loadingMe, error: meError } = useMeDoc({ authReady, uid: user?.uid, dayTick });

  /* ---------- 2) Mes groupes : memberships + ownership ---------- */
  useEffect(() => {
    setError(null);

    // ✅ si pas connecté
    if (!authReady || !user?.uid) {
      groupsAttachedForUidRef.current = null;
      setGroupIds([]);
      setLoadingGroups(false);
      return;
    }

    // ✅ IMPORTANT: si déjà attaché pour ce user, on ne relance pas un loading infini
    if (groupsAttachedForUidRef.current === user.uid && subs.current.byUid && subs.current.byPid && subs.current.ownerCreated && subs.current.ownerOwnerId) {
      setLoadingGroups(false);
      return;
    }

    // ✅ ici, on sait qu'on va (ré)attacher des listeners
    groupsAttachedForUidRef.current = user.uid;
  

    if (!authReady || !user?.uid) {
      setLoadingGroups(false);
      return;
    }
    setLoadingGroups(true);

    const qByUid = firestore()
      .collection('group_memberships')
      .where('uid', '==', user.uid);
    const qByPid = firestore()
      .collection('group_memberships')
      .where('participantId', '==', user.uid);
    const qOwnerCreated = firestore()
      .collection('groups')
      .where('createdBy', '==', user.uid);
    const qOwnerOwnerId = firestore()
      .collection('groups')
      .where('ownerId', '==', user.uid);

    let rowsByUid = [];
    let rowsByPid = [];
    let rowsOwnerCreated = [];
    let rowsOwnerOwnerId = [];

    const recompute = () => {
      const memberships = [...rowsByUid, ...rowsByPid].filter((m) => {
        const st = String(m?.status || '').toLowerCase();
        if (st) return ['open', 'active', 'approved'].includes(st);
        return m?.active !== false;
      });

      const gidsFromMemberships = memberships.map((m) => m.groupId).filter(Boolean);
      const gidsFromOwner = [...rowsOwnerCreated, ...rowsOwnerOwnerId]
        .map((g) => g.id)
        .filter(Boolean);

      const unionSorted = Array.from(new Set([...gidsFromMemberships, ...gidsFromOwner])).sort();
      const key = JSON.stringify(unionSorted);

      if (key !== lastGroupIdsKeyRef.current) {
        lastGroupIdsKeyRef.current = key;
        setGroupIds(unionSorted);
      }

      setLoadingGroups(false);
    };

    // stop old listeners (except me + leaderboard)
    const { me: keepMe, leaderboard: keepLeaderboard, defaultGroupPoints: keepDefaultGroupPoints, ...rest } = subs.current;

    Object.values(rest).forEach((un) => {
      try { un?.(); } catch {}
    });

    subs.current = {
      me: keepMe,
      byUid: null,
      byPid: null,
      ownerCreated: null,
      ownerOwnerId: null,
      leaderboard: keepLeaderboard,
      defaultGroupPoints: keepDefaultGroupPoints, // ✅ on le conserve
    };

    subs.current.byUid = listenRNFB(
      qByUid,
      (snap) => {
        rowsByUid = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        recompute();
      },
      'group_memberships:uid',
      (e) => {
        setLoadingGroups(false);
        setError(e);
      }
    );

    subs.current.byPid = listenRNFB(
      qByPid,
      (snap) => {
        rowsByPid = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        recompute();
      },
      'group_memberships:participantId',
      (e) => {
        setLoadingGroups(false);
        setError(e);
      }
    );

    subs.current.ownerCreated = listenRNFB(
      qOwnerCreated,
      (snap) => {
        rowsOwnerCreated = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        recompute();
      },
      'groups:createdBy',
      (e) => {
        setLoadingGroups(false);
        setError(e);
      }
    );

    subs.current.ownerOwnerId = listenRNFB(
      qOwnerOwnerId,
      (snap) => {
        rowsOwnerOwnerId = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        recompute();
      },
      'groups:ownerId',
      (e) => {
        setLoadingGroups(false);
        setError(e);
      }
    );

    return () => {
      const {
        me: keepMe2,
        leaderboard: keepLeaderboard2,
        defaultGroupPoints: keepDefaultGroupPoints2,
        ...rest2
      } = subs.current;

      Object.values(rest2).forEach((un) => {
        try { un?.(); } catch {}
      });

      subs.current = {
        me: keepMe2,
        byUid: null,
        byPid: null,
        ownerCreated: null,
        ownerOwnerId: null,
        leaderboard: keepLeaderboard2,
        defaultGroupPoints: keepDefaultGroupPoints2, // ✅ on le conserve
      };
    };
  }, [authReady, user?.uid, dayTick]);

  /* ---------- 2b) Métadonnées des groupes ---------- */
  useEffect(() => {
    if (!authReady || !user?.uid) return;

    for (const [gid, un] of groupMetaUnsubs.current) {
      if (!groupIds.includes(gid)) {
        try {
          un();
        } catch {}
        groupMetaUnsubs.current.delete(gid);
      }
    }

    groupIds.forEach((gid) => {
      if (groupMetaUnsubs.current.has(gid)) return;

      const ref = firestore().collection('groups').doc(gid);
      const un = listenRNFB(
        ref,
        (snap) => {
          const data = snap.data() || {};
          setGroupsMeta((prev) => ({
            ...prev,
            [gid]: {
              ...(prev[gid] || {}),
              id: gid,
              name: data.name || data.title || gid,
              status: data.status || null,
              avatarUrl: data.avatarUrl || null,
              ownerId: data.ownerId || data.createdBy || null,
            },
          }));
        },
        `groups:meta:${gid}`,
        (e) => setError(e)
      );

      groupMetaUnsubs.current.set(gid, un);
    });
  }, [authReady, user?.uid, groupIds]);

  /* ---------- 2c) Déterminer groupe courant (sélection UI) ---------- */
  useEffect(() => {
    if (!authReady || !user?.uid) return;

    const fav = meDoc?.favoriteGroupId || null;

    // Si currentGroupId est valide, on ne touche pas
    if (currentGroupId && groupIds.includes(currentGroupId)) return;

    // Sinon, on choisit un groupe initial
    let next = null;
    if (fav && groupIds.includes(fav)) next = fav;
    else if (groupIds.length >= 1) next = groupIds[0];
    else next = null;

    setCurrentGroupId(next);
  }, [authReady, user?.uid, meDoc?.favoriteGroupId, groupIds, currentGroupId]);

  // ---- Points du groupe par défaut (leaderboards/{seasonId}/members/{uid}.pointsTotal) ----
  useEffect(() => {
    setDefaultGroupPoints(0);
    setLoadingDefaultGroupPoints(true);

    try { subs.current.defaultGroupPoints?.(); } catch {}
    subs.current.defaultGroupPoints = null;

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
        const data = snap.data() || {};
        setDefaultGroupPoints(Number(data.pointsTotal || 0));
        setLoadingDefaultGroupPoints(false);
        const plays = Number(data.participations ?? data.plays ?? 0);
        const wins = Number(data.wins ?? 0);
        setMyPlays(plays);
        setMyWins(wins);
        const nhlPPG = Number(data.nhlPPG ?? 0);
        setMyNhlPPG(nhlPPG);

      },
      `leaderboards:mePoints:${currentGroupId}:${seasonId}:${user.uid}`,
      (e) => {
        setLoadingDefaultGroupPoints(false);
        setError(e);
      }
    );

    subs.current.defaultGroupPoints = un;



    return () => {
      try { subs.current.defaultGroupPoints?.(); } catch {}
      subs.current.defaultGroupPoints = null;
    };
  }, [authReady, user?.uid, currentGroupId, seasonId, dayTick]);

  /* ---------- 2d) Leaderboard (seasonId) ---------- */
  useEffect(() => {
    setLeaderboardRows([]);
    setLoadingLeaderboard(true);

    try { subs.current.leaderboard?.(); } catch {}
    subs.current.leaderboard = null;

    if (!authReady || !user?.uid || !currentGroupId || !seasonId) {
      setLoadingLeaderboard(false);
      return;
    }

    const q = firestore()
      .collection("groups")
      .doc(String(currentGroupId))
      .collection("leaderboards")
      .doc(String(seasonId))
      .collection("members")
      .orderBy("pointsTotal", "desc")
      .limit(10);

    const un = listenRNFB(
      q,
      (snap) => {
        const rows = snap.docs.map((d) => {
          const data = d.data() || {};
          const uid = data.uid || d.id;
          return {
            id: d.id,
            uid,
            displayName: data.displayName || null,
            points: Number(data.pointsTotal || 0),
          };
        });

        setLeaderboardRows(rows);
        setLoadingLeaderboard(false);
      },
      `leaderboards:list:${currentGroupId}:${seasonId}`,
      (e) => {
        setLoadingLeaderboard(false);
        setError(e);
      }
    );

    subs.current.leaderboard = un;

    return () => {
      try { subs.current.leaderboard?.(); } catch {}
      subs.current.leaderboard = null;
    };
  }, [authReady, user?.uid, currentGroupId, seasonId, dayTick]);

  /* ---------- 3) Défis actifs/live par groupId ---------- */
  useEffect(() => {
    try {
      for (const [, un] of defisUnsubsRef.current) {
        try { un(); } catch {}
      }
      defisUnsubsRef.current.clear();
    } catch {}

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
        const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        rows.sort((a, b) => {
          const va = (
            a.signupDeadline?.toDate?.() ??
            a.firstGameUTC?.toDate?.() ??
            a.createdAt?.toDate?.() ??
            0
          ).valueOf?.() || 0;
          const vb = (
            b.signupDeadline?.toDate?.() ??
            b.firstGameUTC?.toDate?.() ??
            b.createdAt?.toDate?.() ??
            0
          ).valueOf?.() || 0;
          return va - vb;
        });

        setActiveDefis(rows);
        setLoadingDefis(false);
      },
      `defis:active:${currentGroupId}`,
      (e) => {
        setLoadingDefis(false);
        setError(e);
      }
    );

    defisUnsubsRef.current.set(currentGroupId, un);

    return () => {
      try { un?.(); } catch {}
      defisUnsubsRef.current.clear();
    };
  }, [authReady, user?.uid, currentGroupId]);

  /* ---------- Cleanup global ---------- */
  useEffect(() => {
    return () => {
      const { me, ...rest } = subs.current;
      Object.values(rest).forEach((un) => {
        try {
          un();
        } catch {}
      });

      for (const [, un] of defisUnsubsRef.current) {
        try {
          un();
        } catch {}
      }
      defisUnsubsRef.current.clear();

      try {
        me?.();
      } catch {}

      subs.current = {
        me: null,
        byUid: null,
        byPid: null,
        ownerCreated: null,
        ownerOwnerId: null,
        leaderboard: null,
        defaultGroupPoints: null, // ✅ manquant
      };

      for (const [, un] of groupMetaUnsubs.current) {
        try {
          un();
        } catch {}
      }
      groupMetaUnsubs.current.clear();
    };
  }, []);

  /* ----------------------------- Derived UI data ----------------------------- */
  const points = readPointsBalanceAny(meDoc || {});
  const RED_DARK = '#b91c1c';
  const combinedError = error || meError;


  const avatarUrl =
    meDoc?.photoURL ??
    meDoc?.photoUrl ??
    meDoc?.avatarUrl ??
    meDoc?.avatar?.url ??
    user?.photoURL ??
    null;

  const userGroups = useMemo(
    () =>
      groupIds.map((gid) => {
        const meta = groupsMeta[gid] || {};
        return {
          id: gid,
          name: meta.name || gid,
          status: meta.status || null,
          avatarUrl: meta.avatarUrl || null,
        };
      }),
    [groupIds, groupsMeta]
  );

  const favoriteGroupId = meDoc?.favoriteGroupId || null;

  function onPressCreateDefi() {
    if (loadingGroups) return;
    if (!userGroups.length) {
      router.push('/(drawer)/(tabs)/GroupsScreen');
      return;
    }
    setShowCreateModal(true);
  }

  function onSelectGroup(gid) {
    setCurrentGroupId(String(gid));

    // OPTIONNEL: mémoriser comme favori
    // firestore()
    //   .collection("participants")
    //   .doc(user.uid)
    //   .set({ favoriteGroupId: String(gid) }, { merge: true })
    //   .catch(() => {});
  }

  const defaultGroupName =
    (currentGroupId && groupsMeta[currentGroupId]?.name) ||
    (currentGroupId || i18n.t('home.unknownGroup'));

  const topRows = useMemo(() => leaderboardRows.slice(0, 5), [leaderboardRows]);
  const topUids = useMemo(() => topRows.map((r) => String(r.uid || r.id)), [topRows]);
  const publicProfiles = usePublicProfilesFor(topUids);

  const showLocked = false;

  /* ----------------------------- UI ----------------------------- */
  return (
    <>
      <Stack.Screen options={{ title: i18n.t('home.title') }} />

      <CreateDefiModal
        visible={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        groups={userGroups}
        initialGroupId={favoriteGroupId}
        onCreated={() => {
          setShowCreateModal(false);
        }}
      />

      <CreateAscensionModal
        visible={ascModalVisible}
        onClose={() => setAscModalVisible(false)}
        groups={userGroups}                 // ou groupId direct selon ton API
        initialGroupId={currentGroupId}     // ou favoriteGroupId
        onCreated={(defiId) => {
          setAscModalVisible(false);
          if (defiId) router.push("/(drawer)/defis/" + defiId);
        }}
      />

      <View style={{ flex: 1, backgroundColor: colors.background }}>
        {!authReady ? (
          <View style={styles.center}>
            <ActivityIndicator />
            <Text style={{ marginTop: 8, color: colors.subtext }}>
              {i18n.t('common.initializing')}
            </Text>
          </View>
        ) : !user ? (
          <View style={styles.center}>
            <Text style={{ color: colors.text }}>
              {i18n.t('home.loginToAccess')}
            </Text>
            <TouchableOpacity
              onPress={() => router.push('/(auth)/auth-choice')}
              style={styles.loginBtn}
            >
              <Text style={{ color: '#fff', fontWeight: '700' }}>
                {i18n.t('auth.login')}
              </Text>
            </TouchableOpacity>
          </View>
        ) : combinedError ? (
          <View style={styles.center}>
            <Text style={{ color: colors.text }}>
              {i18n.t("common.errorLabel")}{" "}
              {String(friendlyError(combinedError) ?? "")}
            </Text>
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 32 }}
          >
            {/* === Header profil === */}
        <View style={[cardShadow()]}>
          <ProfileHeaderCard
            colors={colors}
            avatarUrl={avatarUrl}
            displayName={meDoc?.displayName || meDoc?.name}
            points={defaultGroupPoints}
            onEditAvatar={() => router.push("/avatars/AvatarsScreen")}
            onPressPoints={() => router.push("/(drawer)/credits")}
            onCreateDefi={onPressCreateDefi}
            onCreateAscension={() => setAscModalVisible(true)}

            // ✅ nouveau: sélecteur de groupe DANS la carte
            groups={userGroups}
            currentGroupId={currentGroupId}
            onSelectGroup={onSelectGroup}
          />
        </View>

            <View style={[cardShadow()]}>
              <MainMetricsRow
                colors={colors}
                points={defaultGroupPoints}
                plays={myPlays}
                wins={myWins}
                ppg={myNhlPPG}
                tierLower={tierLower}
                onUpgrade={() => router.push("/(drawer)/subscriptions")}
              />
            </View>
    

            {/* === Stats rapides === */}
             <View style={[cardShadow()]}>
            <QuickStatsRow colors={colors} activeDefis={activeDefis} />
             </View>
           

            {/* === Mes défis du jour === */}
             <View style={[cardShadow()]}>
            <DefiListSection
              colors={colors}
              loadingGroups={loadingGroups}
              loadingDefis={loadingDefis}
              groupIds={groupIds}
              activeDefis={activeDefis}
              groupsMeta={groupsMeta}
              tierLower={tierLower}
              onOpenDefi={(defiId) => router.push("/(drawer)/defis/" + defiId)}
              onUpgrade={() => router.push("/(drawer)/subscriptions")}
            />

            </View>
            <AscensionProgressModal
              visible={ascProgressOpen}
              onClose={() => setAscProgressOpen(false)}
              colors={colors}
              groupId={currentGroupId}
              ascKey={ascProgressKey}
              includeAllGroupMembers={true}
            />

          {/* === SECTION: Ascensions (regroupée) === */}
          <View
            style={{
              backgroundColor: colors.card,
              borderColor: colors.border,
              borderWidth: 1,
              borderRadius: 16,
              padding: 12,

              // même ombre que le header (sur le groupe complet)
              shadowColor: "#000",
              shadowOpacity: 0.18,
              shadowRadius: 10,
              shadowOffset: { width: 0, height: 6 },
              elevation: 4,
            }}
          >
            {/* Header DANS la carte */}
            <View style={{ marginBottom: 10 }}>
              <SectionHeader
                flat
                colors={colors}
                icon={null}
                leftIcon={
                <ProphetikIcons
                  mode="emoji"
                  emoji="🎯"
                  size="lg"
                />
              }
                title="Mes Ascensions"
                subtitle="Quêtes multi-jours (progression)"
                rightAction={
                  <TouchableOpacity onPress={() => setAscModalVisible(true)}>
                    <Text style={{ color: colors.text, fontWeight: "800" }}>Créer</Text>
                  </TouchableOpacity>
                }
              />
            </View>

            {/* Contenu */}
            <View style={{ gap: 12 }}>
              <AscensionSection
                colors={colors}
                groupId={currentGroupId}
                ascKey="ASC4"
                tierLower={tierLower}
                onPressOpen={() => {
                  setAscProgressKey("ASC4");
                  setAscProgressOpen(true);
                }}
              />

              <View style={{ height: 1, backgroundColor: colors.border, opacity: 0.6 }} />

              <AscensionSection
                colors={colors}
                groupId={currentGroupId}
                ascKey="ASC7"
                tierLower={tierLower}
                onPressOpen={() => {
                  setAscProgressKey("ASC7");
                  setAscProgressOpen(true);
                }}
              />
            </View>
          </View>
          </ScrollView>
        )}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loginBtn: {
    marginTop: 12,
    backgroundColor: '#111',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
});