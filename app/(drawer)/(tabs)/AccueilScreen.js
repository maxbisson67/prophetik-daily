// app/(drawer)/(tabs)/AccueilScreen.js
import React, { useEffect, useRef, useState, useMemo } from 'react';
import i18n from '@src/i18n/i18n';
import {
  View,
  Text,
  ActivityIndicator,
  TouchableOpacity,
  ScrollView,
  Image,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import firestore from '@react-native-firebase/firestore';
import { useAuth } from '@src/auth/SafeAuthProvider';
import { MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import { useTheme } from '@src/theme/ThemeProvider';
import CreateDefiModal from '../defis/CreateDefiModal';

import DailyShotCard from "@src/credits/DailyShotCard";



/* ----------------------------- Helpers ----------------------------- */
function fmtTSLocalHM(v) {
  try {
    const d = v?.toDate?.()
      ? v.toDate()
      : v instanceof Date
      ? v
      : v
      ? new Date(v)
      : null;
    if (!d) return '—';
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
  } catch {
    return '—';
  }
}

function toDateOrNull(v) {
  try {
    if (!v) return null;
    if (v?.toDate) return v.toDate();
    if (v instanceof Date) return v;
    return new Date(v);
  } catch {
    return null;
  }
}

// Status UI basé sur le temps réel (firstGameUTC)
function computeUiStatus(defi) {
  const raw = String(defi?.status || '').toLowerCase();
  const now = new Date();
  const firstGame = toDateOrNull(defi.firstGameUTC); // ⚠️ bien "firstGameUTC"

  // Ces statuts-là ne sont pas surchargés
  if (raw === 'completed' || raw === 'awaiting_result' || raw === 'live') {
    return raw;
  }

  // Si statut Firestore = open mais que le premier match a commencé → live
  if (raw === 'open') {
    if (firstGame && firstGame.getTime() <= now.getTime()) {
      return 'live';
    }
    return 'open';
  }

  // Fallback
  return raw;
}

function statusStyle(s) {
  const k = String(s || '').toLowerCase();
  if (k === 'open')
    return {
      bg: '#ECFDF5',
      fg: '#065F46',
      icon: 'clock-outline',
      label: i18n.t('home.status.open'),
    };
  if (k === 'live')
    return {
      bg: '#EFF6FF',
      fg: '#1D4ED8',
      icon: 'broadcast',
      label: i18n.t('home.status.live'),
    };
  if (k === 'awaiting_result')
    return {
      bg: '#FFF7ED',
      fg: '#9A3412',
      icon: 'timer-sand',
      label: i18n.t('home.status.awaiting'),
    };
  if (k === 'completed')
    return {
      bg: '#F3F4F6',
      fg: '#111827',
      icon: 'check-decagram',
      label: i18n.t('home.status.completed'),
    };
  return {
    bg: '#F3F4F6',
    fg: '#374151',
    icon: 'help-circle-outline',
    label: s || '—',
  };
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

function friendlyError(e) {
  if (!e) return i18n.t('common.unknownError');
  if (e?.code === 'permission-denied')
    return i18n.t('errors.firestorePermission');
  return String(e?.message || e);
}

// Petit helper homogène pour onSnapshot
function listenRNFB(refOrQuery, onNext, tag) {
  return refOrQuery.onSnapshot(onNext, (e) => {
    console.log(`[FS:${tag}]`, e?.code, e?.message);
  });
}

function GoalStatusIcon({ done }) {
  return (
    <MaterialCommunityIcons
      name={done ? 'check-circle' : 'progress-clock'}
      size={18}
      color={done ? '#059669' : '#6B7280'}
      style={{ marginRight: 6 }}
    />
  );
}

// --- Date helpers (APP_TZ côté client) ---
const APP_TZ = 'America/Toronto';

function toYmdInTzClient(date = new Date(), timeZone = 'UTC') {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const y = parts.find((p) => p.type === 'year')?.value;
  const m = parts.find((p) => p.type === 'month')?.value;
  const d = parts.find((p) => p.type === 'day')?.value;

  return `${y}-${m}-${d}`;
}

function periodKeyYYYYMMInTz(date = new Date(), timeZone = APP_TZ) {
  const ymd = toYmdInTzClient(date, timeZone); // YYYY-MM-DD
  return ymd.slice(0, 7).replace('-', ''); // YYYYMM
}

function msUntilNextLocalMidnight() {
  const now = new Date();
  const next = new Date(now);
  next.setHours(24, 0, 0, 0);
  return Math.max(1000, next.getTime() - now.getTime());
}

/* ----------------------------- Screen ----------------------------- */
export default function AccueilScreen() {
  const { user, authReady } = useAuth();
  const router = useRouter();
  const { colors } = useTheme();

  // ---- participant / wallet ----
  const [meDoc, setMeDoc] = useState(null);
  const [loadingMe, setLoadingMe] = useState(true);

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

  // ---- Daily shot quota (lecture live) ----
  const [dailyShot, setDailyShot] = useState({
    periodKey: null,
    creditsGranted: 0,
    monthlyCap: 10,
    lastDay: null,
  });

  // listeners refs
  const subs = useRef({
    me: null,
    byUid: null,
    byPid: null,
    ownerCreated: null,
    ownerOwnerId: null,
    dailyShot: null,
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
    setMeDoc(null);
    setGroupIds([]);
    setActiveDefis([]);
    setError(null);
    setLoadingMe(!!(authReady && user?.uid));
    setLoadingGroups(!!(authReady && user?.uid));
    setLoadingDefis(!!(authReady && user?.uid));
    setGroupsMeta({});
    setShowCreateModal(false);

    lastGroupIdsKeyRef.current = '';
    lastActiveKeyRef.current = '';

    // stop listeners
    const { me, ...rest } = subs.current;
    Object.values(rest).forEach((un) => {
      try {
        un?.();
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
      dailyShot: null,
    };

    for (const [, un] of groupMetaUnsubs.current) {
      try {
        un();
      } catch {}
    }
    groupMetaUnsubs.current.clear();

    setDailyShot({
      periodKey: null,
      creditsGranted: 0,
      monthlyCap: 10,
      lastDay: null,
    });
  }, [authReady, user?.uid, dayTick]);

  /* ---------- 1) Participant (wallet, profil) ---------- */
  useEffect(() => {
    if (!authReady || !user?.uid) {
      setLoadingMe(false);
      return;
    }
    if (subs.current.me) {
      setLoadingMe(false);
      return;
    }

    const ref = firestore().collection('participants').doc(user.uid);

    const un = listenRNFB(
      ref,
      (snap) => {
        setMeDoc(snap.exists ? { uid: snap.id, ...snap.data() } : null);
        setLoadingMe(false);
      },
      'participants/self'
    );

    subs.current.me = un;
    return () => {
      try {
        subs.current.me?.();
      } catch {}
      subs.current.me = null;
    };
  }, [authReady, user?.uid, dayTick]);

  /* ---------- 1b) Daily shot quota (system/daily_shot_YYYYMM) ---------- */
  useEffect(() => {
    if (!authReady || !user?.uid) return;
    if (subs.current.dailyShot) return;

    const periodKey = periodKeyYYYYMMInTz(new Date(), APP_TZ);
    const docId = `daily_shot_${periodKey}`;

    const ref = firestore()
      .collection('participants')
      .doc(user.uid)
      .collection('system')
      .doc(docId);

    const un = listenRNFB(
      ref,
      (snap) => {
        const data = snap.exists ? snap.data() || {} : {};
        setDailyShot({
          periodKey,
          creditsGranted: Number(data.creditsGranted || 0),
          monthlyCap: Number(data.monthlyCap || 10),
          lastDay: data.lastDay || null,
        });
      },
      `participants/self/system/${docId}`
    );

    subs.current.dailyShot = un;

    return () => {
      try {
        subs.current.dailyShot?.();
      } catch {}
      subs.current.dailyShot = null;
    };
  }, [authReady, user?.uid, dayTick]);

  /* ---------- 2) Mes groupes : memberships + ownership ---------- */
  useEffect(() => {
    setError(null);
    setGroupIds([]);
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
      const gidsFromMemberships = memberships
        .map((m) => m.groupId)
        .filter(Boolean);
      const gidsFromOwner = [...rowsOwnerCreated, ...rowsOwnerOwnerId]
        .map((g) => g.id)
        .filter(Boolean);
      const union = Array.from(
        new Set([...gidsFromMemberships, ...gidsFromOwner])
      );
      const unionSorted = union.sort();
      const key = JSON.stringify(unionSorted);

      if (key !== lastGroupIdsKeyRef.current) {
        lastGroupIdsKeyRef.current = key;
        setGroupIds(unionSorted);
        setLoadingGroups(false);
      }
    };

    // stop old listeners (except me + dailyShot)
    const { me: keepMe, dailyShot: keepDailyShot, ...rest } = subs.current;
    Object.values(rest).forEach((un) => {
      try {
        un?.();
      } catch {}
    });
    subs.current = {
      me: keepMe,
      dailyShot: keepDailyShot,
      byUid: null,
      byPid: null,
      ownerCreated: null,
      ownerOwnerId: null,
    };

    subs.current.byUid = listenRNFB(
      qByUid,
      (snap) => {
        rowsByUid = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        recompute();
      },
      'group_memberships:uid'
    );
    subs.current.byPid = listenRNFB(
      qByPid,
      (snap) => {
        rowsByPid = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        recompute();
      },
      'group_memberships:participantId'
    );
    subs.current.ownerCreated = listenRNFB(
      qOwnerCreated,
      (snap) => {
        rowsOwnerCreated = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        recompute();
      },
      'groups:createdBy'
    );
    subs.current.ownerOwnerId = listenRNFB(
      qOwnerOwnerId,
      (snap) => {
        rowsOwnerOwnerId = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        recompute();
      },
      'groups:ownerId'
    );

    return () => {
      const { me: keepMe2, dailyShot: keepDailyShot2, ...rest2 } = subs.current;
      Object.values(rest2).forEach((un) => {
        try {
          un();
        } catch {}
      });
      subs.current = {
        me: keepMe2,
        dailyShot: keepDailyShot2,
        byUid: null,
        byPid: null,
        ownerCreated: null,
        ownerOwnerId: null,
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
            },
          }));
        },
        `groups:meta:${gid}`
      );
      groupMetaUnsubs.current.set(gid, un);
    });
  }, [authReady, user?.uid, groupIds]);

  /* ---------- 3) Défis actifs/live par groupId ---------- */
  useEffect(() => {
    if (!authReady || !user?.uid) return;

    for (const [gid, un] of defisUnsubsRef.current) {
      if (!groupIds.includes(gid)) {
        try {
          un();
        } catch {}
        defisUnsubsRef.current.delete(gid);
      }
    }

    if (!groupIds.length) {
      setActiveDefis([]);
      setLoadingDefis(false);
      return;
    }

    groupIds.forEach((gid) => {
      if (defisUnsubsRef.current.has(gid)) return;

      const qActiveLive = firestore()
        .collection('defis')
        .where('groupId', '==', gid)
        .where('status', 'in', ['open', 'live'])
        .limit(50);

      const un = listenRNFB(
        qActiveLive,
        (snap) => {
          const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
          setActiveDefis((prev) => {
            const others = prev.filter((x) => x.groupId !== gid);
            const merged = [...others, ...rows];
            merged.sort((a, b) => {
              const va =
                (
                  a.signupDeadline?.toDate?.() ??
                  a.firstGameUTC?.toDate?.() ??
                  a.createdAt?.toDate?.() ??
                  0
                ).valueOf?.() || 0;
              const vb =
                (
                  b.signupDeadline?.toDate?.() ??
                  b.firstGameUTC?.toDate?.() ??
                  b.createdAt?.toDate?.() ??
                  0
                ).valueOf?.() || 0;
              return va - vb;
            });

            const k = JSON.stringify(
              merged.map((d) => ({
                id: d.id,
                status: d.status,
                pot: Number(d.pot || 0),
                sd: d.signupDeadline?.seconds,
                fg: d.firstGameUTC?.seconds,
              }))
            );
            if (k !== lastActiveKeyRef.current) {
              lastActiveKeyRef.current = k;
              return merged;
            }
            return prev;
          });
          setLoadingDefis(false);
        },
        `defis:active:${gid}`
      );

      defisUnsubsRef.current.set(gid, un);
    });
  }, [authReady, user?.uid, groupIds]);

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
        dailyShot: null,
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
  const credits =
    typeof meDoc?.credits === 'number'
      ? meDoc.credits
      : typeof meDoc?.credits?.balance === 'number'
      ? meDoc.credits.balance
      : typeof meDoc?.balance === 'number'
      ? meDoc.balance
      : 0;

  const st = meDoc?.stats || {};
  const streak = Number(st.currentStreakDays ?? 0);

  const totalParticipations = Number(st.totalParticipations ?? 0);

  // 🔁 Progression cyclique sur 5 participations
  const cycle5 = totalParticipations % 5;
  const displayCount5 = totalParticipations === 0 ? 0 : cycle5 === 0 ? 5 : cycle5;

  // 🔁 Progression cyclique sur 3 jours consécutifs
  const cycle3 = streak % 3;
  const displayStreak3 = streak === 0 ? 0 : cycle3 === 0 ? 3 : cycle3;

  const RED_DARK = '#b91c1c';

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

  // Daily shot progression
  const dailyGranted = Number(dailyShot.creditsGranted || 0);
  const dailyCap = Number(dailyShot.monthlyCap || 10);
  const dailyPct = dailyCap > 0 ? Math.min(100, Math.round((dailyGranted / dailyCap) * 100)) : 0;

  /* ----------------------------- UI ----------------------------- */
  return (
    <>
      <Stack.Screen options={{ title: i18n.t('home.title') }} />

      {/* 👉 Modal centralisée pour création de défi */}
      <CreateDefiModal
        visible={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        groups={userGroups}
        initialGroupId={favoriteGroupId}
        onCreated={() => {
          setShowCreateModal(false);
        }}
      />

      <View style={{ flex: 1, backgroundColor: colors.background }}>
        {!authReady ? (
          <View
            style={{
              flex: 1,
              alignItems: 'center',
              justifyContent: 'center',
              padding: 24,
            }}
          >
            <ActivityIndicator />
            <Text style={{ marginTop: 8, color: colors.subtext }}>
              {i18n.t('common.initializing')}
            </Text>
          </View>
        ) : !user ? (
          <View
            style={{
              flex: 1,
              alignItems: 'center',
              justifyContent: 'center',
              padding: 24,
            }}
          >
            <Text style={{ color: colors.text }}>
              {i18n.t('home.loginToAccess')}
            </Text>
            <TouchableOpacity
              onPress={() => router.push('/(auth)/auth-choice')}
              style={{
                marginTop: 12,
                backgroundColor: '#111',
                paddingHorizontal: 16,
                paddingVertical: 10,
                borderRadius: 10,
              }}
            >
              <Text style={{ color: '#fff', fontWeight: '700' }}>
                {i18n.t('auth.login')}
              </Text>
            </TouchableOpacity>
          </View>
        ) : error ? (
          <View
            style={{
              flex: 1,
              alignItems: 'center',
              justifyContent: 'center',
              padding: 16,
            }}
          >
            <Text style={{ color: colors.text }}>
              {i18n.t('common.errorLabel')} {friendlyError(error)}
            </Text>
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 32 }}
          >
            {/* === Header profil === */}
            <View
              style={{
                padding: 14,
                borderWidth: 1,
                borderRadius: 12,
                backgroundColor: colors.card,
                borderColor: colors.border,
                elevation: 4,
                shadowColor: RED_DARK,
                shadowOpacity: 0.18,
                shadowRadius: 8,
                shadowOffset: { width: 0, height: 4 },
              }}
            >
              <View style={{ alignItems: 'center', marginBottom: 12 }}>
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel={i18n.t('home.editAvatar')}
                  onPress={() => router.push('/avatars/AvatarsScreen')}
                  activeOpacity={0.8}
                >
                  <Image
                    source={
                      avatarUrl
                        ? { uri: avatarUrl }
                        : require('@src/assets/avatar-placeholder.png')
                    }
                    style={{
                      width: 120,
                      height: 120,
                      borderRadius: 60,
                      borderWidth: 3,
                      borderColor: '#eee',
                      backgroundColor: '#f3f4f6',
                    }}
                  />
                  <View
                    style={{
                      position: 'absolute',
                      bottom: 6,
                      right: 6,
                      backgroundColor: colors.card,
                      borderRadius: 12,
                      padding: 4,
                      shadowColor: '#000',
                      shadowOpacity: 0.15,
                      shadowRadius: 3,
                      shadowOffset: { width: 0, height: 1 },
                      elevation: 3,
                    }}
                  >
                    <Feather name="edit-2" size={14} color={colors.text} />
                  </View>
                </TouchableOpacity>
                <Text
                  style={{
                    fontWeight: '800',
                    fontSize: 16,
                    marginTop: 8,
                    color: colors.text,
                  }}
                >
                  {i18n.t('home.hello')}{' '}
                  {meDoc?.displayName || meDoc?.name || '—'}
                </Text>
              </View>

              {/* Crédits */}
              <TouchableOpacity
                onPress={() => router.push('/(drawer)/credits')}
                hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
                accessibilityRole="button"
                accessibilityLabel={i18n.t('home.viewCredits')}
              >
                <View />
                <View style={{ alignItems: 'flex-end', paddingRight: 6 }}>
                  <Text style={{ fontSize: 12, color: colors.subtext }}>
                    {i18n.t('home.credits')}
                  </Text>
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <Text
                      style={{
                        fontWeight: '900',
                        fontSize: 20,
                        color: colors.text,
                      }}
                    >
                      {credits}
                    </Text>
                    <MaterialCommunityIcons
                      name="chevron-right"
                      size={18}
                      color={colors.subtext}
                    />
                  </View>
                </View>
              </TouchableOpacity>

              {/* Bouton "Créer un défi" */}
              <View style={{ marginTop: 12 }}>
                <TouchableOpacity
                  onPress={onPressCreateDefi}
                  style={{
                    backgroundColor: RED_DARK,
                    paddingVertical: 12,
                    borderRadius: 10,
                    alignItems: 'center',
                    elevation: 2,
                  }}
                >
                  <Text style={{ color: '#fff', fontWeight: '800' }}>
                    ⚡ {i18n.t('home.createChallenge')}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* === Stats rapides === */}
            <View
              style={{
                padding: 12,
                borderWidth: 1,
                borderRadius: 12,
                backgroundColor: colors.card,
                borderColor: colors.border,
                elevation: 3,
                shadowColor: '#000',
                shadowOpacity: 0.08,
                shadowRadius: 6,
                shadowOffset: { width: 0, height: 3 },
              }}
            >
              <View style={{ flexDirection: 'row', gap: 12 }}>
                {/* Défis actifs */}
                <View
                  style={{
                    flex: 1,
                    padding: 12,
                    borderRadius: 10,
                    backgroundColor: colors.card,
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}
                >
                  <Text style={{ fontSize: 12, color: colors.subtext }}>
                    {i18n.t('home.activeChallenges')}
                  </Text>
                  <Text
                    style={{
                      fontWeight: '900',
                      fontSize: 20,
                      marginTop: 6,
                      color: '#ef4444',
                    }}
                  >
                    {activeDefis.length}
                  </Text>
                </View>

                {/* Cagnotte totale */}
                <View
                  style={{
                    flex: 1,
                    padding: 12,
                    borderRadius: 10,
                    backgroundColor: colors.card,
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}
                >
                  <Text style={{ fontSize: 12, color: colors.subtext }}>
                    {i18n.t('home.totalPot')}
                  </Text>
                  <Text
                    style={{
                      fontWeight: '900',
                      fontSize: 20,
                      marginTop: 6,
                      color: '#ef4444',
                    }}
                  >
                    {activeDefis.reduce((sum, d) => sum + Number(d.pot || 0), 0)}
                  </Text>
                </View>
              </View>
            </View>

            {/* === Mes défis du jour === */}
            <View
              style={{
                padding: 12,
                borderWidth: 1,
                borderRadius: 12,
                backgroundColor: colors.card,
                borderColor: colors.border,
                elevation: 3,
                shadowColor: '#000',
                shadowOpacity: 0.08,
                shadowRadius: 6,
                shadowOffset: { width: 0, height: 3 },
              }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 8,
                }}
              >
                <Text
                  style={{
                    fontWeight: '800',
                    fontSize: 16,
                    color: colors.text,
                  }}
                >
                  {i18n.t('home.todayChallenge')}
                </Text>
                {loadingGroups || loadingDefis ? <ActivityIndicator /> : null}
              </View>

              {!groupIds.length && !loadingGroups ? (
                <Text style={{ color: colors.subtext }}>
                  {i18n.t('home.noGroups')}
                </Text>
              ) : activeDefis.length === 0 && !loadingDefis ? (
                <Text style={{ color: colors.subtext }}>
                  {i18n.t('home.noActiveChallenges')}
                </Text>
              ) : (
                <View>
                  {activeDefis.map((item) => {
                    const uiStatus = computeUiStatus(item);
                    const st2 = statusStyle(uiStatus);
                    const pot = Number(item.pot || 0);

                    return (
                      <TouchableOpacity
                        key={item.id}
                        onPress={() => router.push(`/(drawer)/defis/${item.id}`)}
                        style={{
                          paddingVertical: 10,
                          borderBottomWidth: 1,
                          borderColor: colors.border,
                        }}
                      >
                        <View
                          style={{
                            flexDirection: 'row',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                          }}
                        >
                          <Text style={{ fontWeight: '700', color: colors.text }}>
                            {item.type
                              ? `${i18n.t('home.challenge')} ${item.type}x${item.type}`
                              : i18n.t('home.challenge')}
                          </Text>

                          <View style={{ alignItems: 'flex-end' }}>
                            <Chip
                              bg={st2.bg}
                              fg={st2.fg}
                              icon={st2.icon}
                              label={st2.label}
                            />
                            <View
                              style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                marginTop: 4,
                              }}
                            >
                              <MaterialCommunityIcons
                                name="sack"
                                size={16}
                                color={colors.text}
                              />
                              <Text
                                style={{
                                  marginLeft: 4,
                                  fontWeight: '700',
                                  color: colors.text,
                                }}
                              >
                                {pot}
                              </Text>
                            </View>
                          </View>
                        </View>

                        <View style={{ marginTop: 4 }}>
                          <View
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              gap: 6,
                            }}
                          >
                            <MaterialCommunityIcons
                              name="calendar-blank-outline"
                              size={16}
                              color={colors.subtext}
                            />
                            <Text style={{ color: colors.subtext }}>
                              {i18n.t('home.challengeDate')}: {item.gameDate || '—'}
                            </Text>
                          </View>

                          <View
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              gap: 6,
                              marginTop: 2,
                            }}
                          >
                            <MaterialCommunityIcons
                              name="clock-outline"
                              size={16}
                              color={colors.subtext}
                            />
                            <Text style={{ color: colors.subtext }}>
                              {item.signupDeadline
                                ? `${i18n.t('home.challengeLimit')} ${fmtTSLocalHM(
                                    item.signupDeadline
                                  )}`
                                : item.firstGameUTC
                                ? `${i18n.t('home.challengeStarts')} ${fmtTSLocalHM(
                                    item.firstGameUTC
                                  )}`
                                : '—'}
                            </Text>
                          </View>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>

            {/* === Gamification (simplifiée) === */}
            <View
              style={{
                padding: 14,
                borderWidth: 1,
                borderRadius: 12,
                backgroundColor: colors.card,
                borderColor: colors.border,
                elevation: 3,
                shadowColor: '#000',
                shadowOpacity: 0.08,
                shadowRadius: 6,
                shadowOffset: { width: 0, height: 3 },
              }}
            >
              <Text
                style={{
                  fontWeight: '800',
                  fontSize: 16,
                  marginBottom: 8,
                  color: colors.text,
                }}
              >
                {i18n.t('home.creditsToEarn')}
              </Text>

              {/* Daily Shot Bonus (max 10 / mois) */}
              <DailyShotCard
                variant="card"
                monthlyCap={10}
              />

              {/* 5 participations */}
              <View
                style={{
                  padding: 10,
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.card,
                  marginBottom: 10,
                }}
              >
                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <GoalStatusIcon done={displayCount5 === 5} />
                    <Text style={{ fontWeight: '700', color: colors.text }}>
                      {i18n.t('home.fiveParticipationsTitle')}
                    </Text>
                  </View>
                  <Text
                    style={{
                      fontWeight: '800',
                      color: displayCount5 === 5 ? '#059669' : colors.text,
                    }}
                  >
                    +1
                  </Text>
                </View>

                <Text style={{ color: colors.subtext, fontSize: 12, marginTop: 4 }}>
                  {i18n.t('home.progressLabel', { current: displayCount5, max: 5 })}
                </Text>

                <View
                  style={{
                    height: 8,
                    borderRadius: 99,
                    backgroundColor: '#f3f4f6',
                    marginTop: 6,
                    overflow: 'hidden',
                  }}
                >
                  <View
                    style={{
                      width: `${Math.round(((displayCount5 || 0) / 5) * 100)}%`,
                      height: 8,
                      borderRadius: 99,
                      backgroundColor: '#ef4444',
                    }}
                  />
                </View>
              </View>

              {/* 3 jours consécutifs */}
              <View
                style={{
                  padding: 10,
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.card,
                }}
              >
                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <GoalStatusIcon done={displayStreak3 === 3} />
                    <Text style={{ fontWeight: '700', color: colors.text }}>
                      {i18n.t('home.threeDaysTitle')}
                    </Text>
                  </View>
                  <Text
                    style={{
                      fontWeight: '800',
                      color: displayStreak3 === 3 ? '#059669' : colors.text,
                    }}
                  >
                    +1
                  </Text>
                </View>

                <Text style={{ color: colors.subtext, fontSize: 12, marginTop: 4 }}>
                  {i18n.t('home.streakLabel', { current: displayStreak3, max: 3 })}
                </Text>

                <View
                  style={{
                    height: 8,
                    borderRadius: 99,
                    backgroundColor: '#f3f4f6',
                    marginTop: 6,
                    overflow: 'hidden',
                  }}
                >
                  <View
                    style={{
                      width: `${Math.round(((displayStreak3 || 0) / 3) * 100)}%`,
                      height: 8,
                      borderRadius: 99,
                      backgroundColor: '#ef4444',
                    }}
                  />
                </View>
              </View>
            </View>
          </ScrollView>
        )}
      </View>
    </>
  );
}