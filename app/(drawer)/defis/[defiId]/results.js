// app/(drawer)/defis/[defiId]/results.js
// Résultats (riche) + Chat repliable (hors FlatList)
// - Résolution noms/avatars via profiles_public/{uid} (plus de lecture participants/* ou group_memberships côté client)
// - Classement live + contributions (G/A)
// - Chat accordéon autonome (hors FlatList)

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, ActivityIndicator, Image, TouchableOpacity,
  ScrollView, TextInput, KeyboardAvoidingView, Platform, Animated, Keyboard
} from 'react-native';
import { SvgUri } from 'react-native-svg';
import Toast from 'react-native-toast-message';
import { Stack, useLocalSearchParams, useFocusEffect , useRouter} from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import firestore from '@react-native-firebase/firestore'; // ✅ RNFirebase
// Safe auth
import { useAuth } from '@src/auth/SafeAuthProvider';

import { useTheme } from '@src/theme/ThemeProvider';
import { useDefiChat } from '@src/defiChat/useDefiChat';
import { useUnreadCount } from '@src/defiChat/useUnreadCount';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { useHeaderHeight } from '@react-navigation/elements';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DrawerToggleButton } from '@react-navigation/drawer';
import { HeaderBackButton } from '@react-navigation/elements';


/* ----------------------------- Utils ----------------------------- */
const AVATAR_PLACEHOLDER = require('@src/assets/avatar-placeholder.png');
const GROUP_PLACEHOLDER  = require('@src/assets/group-placeholder.png');

const CACHE_VERSION = 'v3_profiles_public_names';
const PARTICIPANTS_CACHE_KEY = `${CACHE_VERSION}`;

/* ----- NHL helpers ----- */
const teamLogoUrl = (abbr) => {
  const a = String(abbr || '').trim().toUpperCase();
  return a ? `https://assets.nhle.com/logos/nhl/svg/${encodeURIComponent(a)}_light.svg` : null;
};

function fmtTSLocalHM(v) {
  try {
    const d = v?.toDate?.() ? v.toDate() : (v instanceof Date ? v : v ? new Date(v) : null);
    if (!d) return '—';
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
  } catch { return '—'; }
}

function statusStyleBase(status) {
  switch ((status || '').toLowerCase()) {
    case 'open':     return { bg:'#ECFEFF', fg:'#0E7490', icon:'clock-outline', label:'Ouvert' };
    case 'live':     return { bg:'#F0FDF4', fg:'#166534', icon:'broadcast',    label:'En cours' };
    case 'awaiting_result': return { bg:'#FFF7ED', fg:'#9A3412', icon:'timer-sand', label:'Calcul en cours' };
    case 'closed':   return { bg:'#FEF2F2', fg:'#991B1B', icon:'lock',          label:'Terminé' };
    default:         return { bg:'#EFEFEF', fg:'#111827', icon:'help-circle',   label:String(status||'—') };
  }
}

/* ---------------------- Cache noms participants ---------------------- */
const memNames = { map: {}, info: {} }; // {uid -> name}, {uid -> {photoURL}}

async function readNamesCache() {
  try {
    const raw = await AsyncStorage.getItem(PARTICIPANTS_CACHE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (parsed?.map) Object.assign(memNames.map, parsed.map);
    if (parsed?.info) Object.assign(memNames.info, parsed.info);
  } catch {}
}
async function writeNamesCache() {
  try {
    await AsyncStorage.setItem(PARTICIPANTS_CACHE_KEY, JSON.stringify(memNames));
  } catch {}
}
function mergeNames(partialMap, partialInfo) {
  let changed = false;
  if (partialMap) {
    for (const [uid, nm] of Object.entries(partialMap)) {
      const nextName = typeof nm === 'string' && nm.trim() ? nm.trim() : null;
      if (nextName && memNames.map[uid] !== nextName) {
        memNames.map[uid] = nextName; changed = true;
      }
    }
  }
  if (partialInfo) {
    for (const [uid, obj] of Object.entries(partialInfo)) {
      const old = memNames.info[uid] || {};
      const next = { ...old };
      if (obj && typeof obj === 'object') {
        if (typeof obj.photoURL === 'string' && obj.photoURL.trim()) next.photoURL = obj.photoURL.trim();
        for (const k of Object.keys(obj)) {
          if (k === 'photoURL') continue;
          if (obj[k] != null) next[k] = obj[k];
        }
      }
      if (JSON.stringify(old) !== JSON.stringify(next)) { memNames.info[uid] = next; changed = true; }
    }
  }
  if (changed) writeNamesCache();
  return changed;
}

/* ---------------- Toast config (statique) ---------------- */
export const toastConfig = {
  liveDelta: ({ props }) => {
    const items = Array.isArray(props?.items) ? props.items : [];
    return (
      <View
        style={{
          backgroundColor: '#111',
          padding: 12,
          borderRadius: 12,
          marginTop: 40,
          marginHorizontal: 8,
          maxWidth: '96%',
          elevation: 6,
        }}
      >
        <Text style={{ color: '#fff', fontWeight: '800', marginBottom: 8 }}>Mise à jour officielle</Text>
        {items.length === 0 ? (
          <Text style={{ color: '#fff', opacity: 0.85 }}>Ajustement appliqué.</Text>
        ) : (
          items.map((it, i) => (
            <Text key={i} style={{ color: '#fff', marginVertical: 2 }}>{it}</Text>
          ))
        )}
      </View>
    );
  },
};

function withCacheBust(url, tsMillis) {
  if (!url) return null;
  const v = Number.isFinite(tsMillis) ? tsMillis : Date.now();
  return url.includes('?') ? `${url}&_cb=${v}` : `${url}?_cb=${v}`;
}

/* ----------------------------- Screen ----------------------------- */
export default function DefiResultsScreen() {
  const { defiId } = useLocalSearchParams();
  const { user } = useAuth();
  const router = useRouter();
  const { colors } = useTheme();

  const [defi, setDefi] = useState(null);
  const [group, setGroup] = useState(null);

  const [loadingDefi, setLoadingDefi] = useState(true);
  const [parts, setParts] = useState([]); // [{uid, livePoints, picks, updatedAt, _raw}]
  const [namesMap, setNamesMap] = useState({}); // ✅ uid -> displayName
  const [participantInfoMap, setParticipantInfoMap] = useState({}); // ✅ uid -> {photoURL}

  const [liveStats, setLiveStats] = useState({
    playerGoals: {}, playerA1: {}, playerA2: {}, playerAssists: {}, playerPoints: {},
  });
  const [playerMap, setPlayerMap] = useState({}); // { pid: {fullName, teamAbbr} }

  // Chat accordéon
  const [chatCollapsed, setChatCollapsed] = useState(true);
  const open = useRef(new Animated.Value(0)).current;

  const OPEN_HEIGHT = 360;
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();
  const [kbH, setKbH] = useState(0);

  const [nhlPlayersReadable, setNhlPlayersReadable] = useState(true);

  // 🔵 Chat (utilise les noms/avatars provenant de profiles_public via namesMap/participantInfoMap)
  const { messages, send, busy, markRead , canSend } = useDefiChat(defiId, {
    pageSize: 50,
    groupId: group?.id,
    namesMap,
    participantInfoMap,
  });

  // 🔔 Unread count
  const unread = useUnreadCount(
    defiId,
    user?.uid,
    group?.id
      ? { useCollectionGroup: true, groupId: group.id }
      : { useCollectionGroup: false }
  );

  const [showReveal, setShowReveal] = React.useState(false);
  const [celebrateNow, setCelebrateNow] = React.useState(false);
  const hasShownRevealRef = React.useRef(false);
  const hasCelebratedRef  = React.useRef(false);

  const handleCloseReveal = React.useCallback(() => setShowReveal(false), []);

  function computeCreditDelta(defi, winnersArr) {
    const pot = Number(defi?.pot ?? 0);
    const n = Math.max(1, winnersArr?.length ?? 1);
    const rule = String(defi?.splitRule ?? 'winner_takes_all').toLowerCase();
    return rule === 'split_even' ? Math.floor(pot / n) : pot;
  }

  /* ----- Leaderboard (mémo) ----- */
  const leaderboard = useMemo(() => {
    const rows = [...parts].sort((a,b) => b.livePoints - a.livePoints);
    if (!rows.length) return [];
    const top = rows[0].livePoints;
    return rows.map(r => ({ ...r, isTiedForFirst: r.livePoints === top }));
  }, [parts]);

  const chip = statusStyleBase(defi?.status);

  // construit les 3 finalistes
  const finalists = React.useMemo(() => {
    const src = Array.isArray(leaderboard) ? leaderboard : [];
    return src
      .filter(Boolean)
      .slice()
      .sort((a, b) => Number(b.livePoints || 0) - Number(a.livePoints || 0))
      .slice(0, 3)
      .map((r) => {
        const uid = String(r.uid || '');
        const displayName = (namesMap?.[uid]) || r.displayName || uid;
        const info = participantInfoMap?.[uid] || {};
        return {
          ...r,
          uid,
          displayName,
          avatarUrl: info.photoURL || null,
        };
      });
  }, [leaderboard, namesMap, participantInfoMap]);

  /* ----- Gagnants (ex-aequo) ----- */
  const winners = useMemo(() => {
    const rows = Array.isArray(leaderboard) ? leaderboard : [];
    if (!rows.length) return [];
    const top = Number(rows[0].livePoints || 0);
    return rows.filter(r => Number(r.livePoints || 0) === top);
  }, [leaderboard]);

  // Révélation / célébration (identique à ta logique)
  React.useEffect(() => {
    const iAmWinner = Array.isArray(winners) && winners.some(w => w.uid === user?.uid);
    if (!showReveal && iAmWinner && !hasCelebratedRef.current) {
      hasCelebratedRef.current = true;
      handleCelebrate();
    }
  }, [showReveal, winners, user?.uid]);

  React.useEffect(() => {
    if (!celebrateNow) hasCelebratedRef.current = false;
  }, [celebrateNow]);

  React.useEffect(() => {
    const closed = String(defi?.status || '').toLowerCase() === 'closed';
    if (!closed || !user?.uid) return;
    const storageKey = `finalReveal:${defi?.id}:${user?.uid}`;
    const iAmWinner = Array.isArray(winners) && winners.some(w => w.uid === user.uid);
    (async () => {
      try {
        if (hasShownRevealRef.current) return;
        const done = await AsyncStorage.getItem(storageKey);
        if (!done && iAmWinner) {
          hasShownRevealRef.current = true;
          setShowReveal(true);
          await AsyncStorage.setItem(storageKey, '1');
        }
      } catch {}
    })();
  }, [defi?.status, defi?.id, user?.uid, winners]);

  React.useEffect(() => {
    const closed = String(defi?.status || '').toLowerCase() === 'closed';
    if (!closed || !user?.uid || !finalists.length) return;
    const storageKey = `finalReveal:${defi.id}:${user.uid}`;
    (async () => {
      try {
        if (hasShownRevealRef.current) return;
        const done = await AsyncStorage.getItem(storageKey);
        const inTop = finalists.some(f => f.uid === user.uid);
        if (!done && inTop) {
          hasShownRevealRef.current = true;
          setShowReveal(true);
          await AsyncStorage.setItem(storageKey, '1');
        }
      } catch {}
    })();
  }, [defi?.status, defi?.id, user?.uid, finalists]);

  const handleCelebrate = React.useCallback(() => {
    setCelebrateNow(true);
    setTimeout(() => setCelebrateNow(false), 2400);
  }, []);

  const headerTitle = React.useMemo(
    () => (defi?.title || (defi?.type ? `Défi ${defi.type}x${defi.type}` : 'Résultats')),
    [defi]
  );

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const sh = Keyboard.addListener('keyboardDidShow', (e) => setKbH(e.endCoordinates?.height ?? 0));
    const hd = Keyboard.addListener('keyboardDidHide', () => setKbH(0));
    return () => { sh.remove(); hd.remove(); };
  }, []);

  // Lu quand focus
  useFocusEffect(React.useCallback(() => { if (defiId) markRead(); }, [defiId, markRead]));

  // Charger cache noms au boot
  useEffect(() => { readNamesCache().then(() => {
    setNamesMap({ ...memNames.map });
    setParticipantInfoMap({ ...memNames.info });
  }); }, []);

  /* ----- Defi doc (RNFirebase) ----- */
  useEffect(() => {
    if (!defiId) return;
    setLoadingDefi(true);
    const ref = firestore().doc(`defis/${String(defiId)}`);
    const un = ref.onSnapshot(
      (snap) => {
        setDefi(snap.exists ? ({ id: snap.id, ...snap.data() }) : null);
        setLoadingDefi(false);
      },
      () => setLoadingDefi(false)
    );
    return () => un();
  }, [defiId]);

  // Group doc
  useEffect(() => {
    if (!defi?.groupId) return;
    const ref = firestore().doc(`groups/${String(defi.groupId)}`);
    const un = ref.onSnapshot((snap) => {
      setGroup(snap.exists ? ({ id: snap.id, ...snap.data() }) : null);
    });
    return () => un();
  }, [defi?.groupId]);

  /* ----- Participations (RNFirebase chain) ----- */
  useEffect(() => {
    if (!defi?.id) return;
    const colRef = firestore().collection(`defis/${String(defi.id)}/participations`);
    const un = colRef.onSnapshot((snap) => {
      const next = [];
      snap.forEach((docSnap) => {
        const v = docSnap.data() || {};
        const uid = docSnap.id;
        next.push({
          uid,
          livePoints: Number(v.livePoints || 0),
          picks: Array.isArray(v.picks) ? v.picks : [],
          updatedAt: v.liveUpdatedAt || v.updatedAt || null,
          _raw: v,
        });
      });
      setParts(next);
    });
    return () => un();
  }, [defi?.id]);

  // ----- Résoudre noms/avatars via profiles_public/{uid} -----
  const profilesUnsubsRef = useRef(new Map()); // Map<uid, unsub>
  useEffect(() => {
    const neededUids = Array.from(new Set(parts.map(p => p.uid).filter(Boolean)));

    // retire les listeners devenus inutiles
    for (const [uid, un] of profilesUnsubsRef.current) {
      if (!neededUids.includes(uid)) { try { un(); } catch {} profilesUnsubsRef.current.delete(uid); }
    }

    // ajoute les listeners manquants
    neededUids.forEach((uid) => {
      if (profilesUnsubsRef.current.has(uid)) return;

      const ref = firestore().doc(`profiles_public/${uid}`);
      const un = ref.onSnapshot(
        (snap) => {
          const v = snap.exists ? (snap.data() || {}) : {};
          const displayName = v.displayName || v.name || v.username || v.email || uid;
          const avatarUrl   = v.avatarUrl || v.photoURL || null;

          // RNFirebase Timestamp → toMillis() ok; sinon fallback
          const version =
            v.updatedAt?.toMillis?.()
              ? v.updatedAt.toMillis()
              : (v.updatedAt?.toDate?.() ? v.updatedAt.toDate().getTime() : Date.now());

          const changed = mergeNames(
            { [uid]: displayName },
            { [uid]: avatarUrl ? { photoURL: avatarUrl, version } : { version } }
          );

          if (changed) {
            setNamesMap({ ...memNames.map });
            setParticipantInfoMap({ ...memNames.info });
          } else {
            setNamesMap(prev => ({ ...prev, [uid]: memNames.map[uid] || displayName }));
            setParticipantInfoMap(prev => ({
              ...prev,
              [uid]: memNames.info[uid] || (avatarUrl ? { photoURL: avatarUrl, version } : { version })
            }));
          }
        },
        () => {
          const changed = mergeNames({ [uid]: uid }, { [uid]: {} });
          if (changed) {
            setNamesMap({ ...memNames.map });
            setParticipantInfoMap({ ...memNames.info });
          }
        }
      );

      profilesUnsubsRef.current.set(uid, un);
    });
    // pas de cleanup ici (géré au démontage)
  }, [parts]);

  // Cleanup global des listeners profiles_public au démontage
  useEffect(() => {
    return () => {
      for (const [, un] of profilesUnsubsRef.current) { try { un(); } catch {} }
      profilesUnsubsRef.current.clear();
    };
  }, []);

  /* ----- Live tallies ----- */
  useEffect(() => {
    if (!defi?.id) return;
    const ref = firestore().doc(`defis/${String(defi.id)}/live/stats`);
    const un = ref.onSnapshot((snap) => {
      if (snap.exists) {
        const d = snap.data() || {};
        setLiveStats({
          playerGoals: d.playerGoals || {},
          playerA1: d.playerA1 || {},
          playerA2: d.playerA2 || {},
          playerAssists: d.playerAssists || d.assists || {},
          playerPoints: d.playerPoints || {},
        });
      } else {
        setLiveStats({ playerGoals:{}, playerA1:{}, playerA2:{}, playerAssists:{}, playerPoints:{} });
      }
    });
    return () => un();
  }, [defi?.id]);

  /* ----- Player meta (stabilisé) ----- */
  const allTalliedIds = useMemo(() => {
    return Array.from(new Set([
      ...Object.keys(liveStats.playerGoals || {}),
      ...Object.keys(liveStats.playerA1 || {}),
      ...Object.keys(liveStats.playerA2 || {}),
      ...Object.keys(liveStats.playerAssists || {}),
      ...Object.keys(liveStats.playerPoints || {}),
    ]));
  }, [liveStats]);

  const missingPlayerMeta = useMemo(() => {
    return allTalliedIds.filter((id) => !playerMap[id]);
  }, [allTalliedIds, playerMap]);

  useEffect(() => {
    if (missingPlayerMeta.length === 0 || !nhlPlayersReadable) return;
    let cancelled = false;
    (async () => {
      try {
        const updates = {};
        const CHUNK = 10;
        for (let i = 0; i < missingPlayerMeta.length; i += CHUNK) {
          const idsChunk = missingPlayerMeta.slice(i, i + CHUNK).map(String);
          const qRef = firestore()
            .collection('nhl_players')
            .where(firestore.FieldPath.documentId(), 'in', idsChunk);
          const s = await qRef.get();
          if (cancelled) return;
          s.forEach((docSnap) => {
            const v = docSnap.data() || {};
            updates[docSnap.id] = { fullName: v.fullName || '—', teamAbbr: v.teamAbbr || '' };
          });
        }
        if (!cancelled && Object.keys(updates).length) {
          setPlayerMap((prev) => ({ ...prev, ...updates }));
        }
      } catch (e){
        if (e?.code === 'permission-denied') setNhlPlayersReadable(false);
      }
    })();
    return () => { cancelled = true; };
  }, [missingPlayerMeta.join(','), nhlPlayersReadable]);

  /* ----------------------------- UI ----------------------------- */
  if (loadingDefi) {
    return (
      <>
        <Stack.Screen options={{ title: 'Résultats' }} />
        <View style={{ flex:1, alignItems:'center', justifyContent:'center', padding:16 }}>
          <ActivityIndicator size="large" />
          <Text style={{ marginTop:12 }}>Chargement…</Text>
        </View>
      </>
    );
  }
  if (!defi) {
    return (
      <>
        <Stack.Screen options={{ title: 'Résultats' }} />
        <View style={{ flex:1, alignItems:'center', justifyContent:'center', padding:16 }}>
          <Text>Aucun défi trouvé.</Text>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: headerTitle,
          headerLeft: ({ tintColor }) => (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <HeaderBackButton
                tintColor={tintColor}
                onPress={() => {
                  if (defi?.groupId) {
                    router.replace({ pathname: '/(drawer)/(tabs)/ChallengesScreen', params: { groupId: defi.groupId } });
                  } else {
                    router.replace('/(drawer)/(tabs)/ChallengesScreen');
                  }
                }}
              />
              <DrawerToggleButton tintColor={tintColor} />
            </View>
          ),
          headerRight: () => (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="chatbubble-ellipses" size={18} color={colors.text} />
              <View
                style={{
                  minWidth: 18,
                  height: 18,
                  marginLeft: 6,
                  borderRadius: 9,
                  backgroundColor: unread > 0 ? '#ef4444' : colors.border,
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingHorizontal: 4,
                }}
              >
                <Text style={{ color: '#fff', fontSize: 11, fontWeight: '800' }}>
                  {unread > 99 ? '99+' : unread}
                </Text>
              </View>
            </View>
          ),
        }}
      />

      {/* 🔑 KeyboardAvoidingView au niveau racine */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? headerHeight : 0}
      >
        <View style={{ flex: 1 }}>
          {/* ====== CONTENU PRINCIPAL ====== */}
          <ScrollView
            style={{ flex: 1 }}
            keyboardShouldPersistTaps="always"
            nestedScrollEnabled
            contentContainerStyle={{ paddingBottom: 24 }}
          >
            {/* ====== HEADER GROUPE / DÉFI ====== */}
            <View
              style={{
                padding: 12, borderWidth: 1, borderRadius: 12, backgroundColor: '#fff',
                elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4,
                shadowOffset: { width: 0, height: 2 }, margin: 16, marginBottom: 8,
              }}
            >
              {/* Ligne 1 */}
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                  <Image
                    source={group?.avatarUrl ? { uri: group.avatarUrl } : GROUP_PLACEHOLDER}
                    style={{ width: 40, height: 40, borderRadius: 20, marginRight: 10, backgroundColor: '#f3f4f6', borderWidth: 1, borderColor: '#e5e7eb' }}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: '800', fontSize: 16 }} numberOfLines={1}>
                      {group?.name || group?.title || group?.id || 'Groupe'}
                    </Text>
                    {!!defi?.title && (
                      <Text style={{ color: '#6b7280' }} numberOfLines={1}>{defi.title}</Text>
                    )}
                  </View>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 8 }}>
                  <MaterialCommunityIcons name="account-group" size={20} color="#555" />
                  <Text style={{ fontWeight: '700', marginLeft: 4 }}>{defi?.participantsCount ?? 0}</Text>
                </View>
              </View>

              {/* Ligne 2 */}
              <View style={{ marginTop: 4 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                  <MaterialCommunityIcons name="treasure-chest" size={20} color="#111" />
                  <Text style={{ fontSize: 16, fontWeight: '800', marginLeft: 6 }}>
                    Cagnotte de {Number(defi?.pot ?? 0)} crédits
                  </Text>
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', paddingVertical: 4, paddingHorizontal: 8, borderRadius: 999, backgroundColor: statusStyleBase(defi?.status).bg }}>
                  <MaterialCommunityIcons name={statusStyleBase(defi?.status).icon} size={14} color={statusStyleBase(defi?.status).fg} />
                  <Text style={{ color: statusStyleBase(defi?.status).fg, marginLeft: 6, fontWeight: '700' }}>
                    {statusStyleBase(defi?.status).label}
                  </Text>
                </View>

                <View style={{ marginTop: 8 }}>
                  <Text style={{ color: '#555' }}>
                    Débute à <Text style={{ fontWeight: '700' }}>{fmtTSLocalHM(defi?.firstGameUTC)}</Text>
                  </Text>
                  <Text style={{ color: '#555' }}>Barème : Buteur = +1 • Passe = +1</Text>
                </View>
              </View>
            </View>

            {/* ====== TABLEAU DES PARTICIPANTS ====== */}
            <ParticipantsCard
              leaderboard={leaderboard}
              namesMap={namesMap}
              participantInfoMap={participantInfoMap}
              colors={colors}
              liveStats={liveStats}
              playerMap={playerMap}
              currentUid={user?.uid}
            />
          </ScrollView>

          {/* ====== CHAT (hors ScrollView) ====== */}
          <View
            style={{
              marginHorizontal: 16,
              marginBottom: 16 + insets.bottom,
              paddingBottom: Platform.OS === 'android' ? Math.max(kbH, 8) : 0,
              borderWidth: 1, borderColor: colors.border, borderRadius: 12,
              overflow: 'hidden', backgroundColor: colors.card,
            }}
          >
            {/* Header accordéon */}
            <TouchableOpacity
              onPress={() => setChatCollapsed((v) => !v)}
              style={{
                paddingHorizontal: 12, paddingVertical: 10, backgroundColor: colors.card,
                flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="chatbubble-ellipses" size={16} color={colors.text} />
                <Text style={{ fontWeight: '800', color: colors.text }}>Chat du défi</Text>
                <Text style={{ color: colors.subtext, fontSize: 12 }}>{messages.length} messages</Text>
              </View>
              <Ionicons name={chatCollapsed ? 'chevron-down' : 'chevron-up'} size={18} color={colors.text} />
            </TouchableOpacity>

            {/* Corps */}
            {!chatCollapsed && (
              <View style={{ maxHeight: 360, backgroundColor: colors.card }}>
                <InlineChat  colors={colors}
                  messages={messages}
                  busy={busy}
                  onSend={send}
                  canSend={canSend}
                  namesMap={namesMap}
                  participantInfoMap={participantInfoMap}/>
              </View>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>

      {/* Toast en haut */}
      <Toast position="top" config={toastConfig} topOffset={60} />

    </>
  );
}

function InlineChat({ colors, messages, onSend, busy, canSend, namesMap, participantInfoMap }) {
  const [text, setText] = React.useState('');

  const INPUT_BAR_HEIGHT = 56;
  const OPEN_HEIGHT = 360;

  // tri sûr même si createdAt est un Timestamp Firestore RNFirebase
  const data = React.useMemo(() => {
    const millis = (v) =>
      v?.toMillis?.() ? v.toMillis() :
      (v?.toDate?.() ? v.toDate().getTime() : (typeof v === 'number' ? v : 0));
    return [...messages].sort((a, b) => millis(a?.createdAt) - millis(b?.createdAt));
  }, [messages]);

  const scrollRef = React.useRef(null);
  const atBottomRef = React.useRef(true);
  const [autoStick, setAutoStick] = React.useState(true);

  const handleScroll = React.useCallback((e) => {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    const dist = contentSize.height - (contentOffset.y + layoutMeasurement.height);
    const next = dist < 80;
    if (atBottomRef.current !== next) {
      atBottomRef.current = next;
      setAutoStick(next);
    }
  }, []);

  const scrollToEnd = React.useCallback((animated = true) => {
    scrollRef.current?.scrollToEnd?.({ animated });
  }, []);

  const handleContentSizeChange = React.useCallback(() => {
    if (autoStick) requestAnimationFrame(() => scrollToEnd(true));
  }, [autoStick, scrollToEnd]);

  const last = data[data.length - 1];
  const preview = last?.text
    ? (String(last.text).length > 48 ? String(last.text).slice(0, 48) + '…' : String(last.text))
    : 'Aucun message';

  return (
    <View style={{ borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.card }}>
      {/* Liste des messages */}
      <View style={{ height: OPEN_HEIGHT - INPUT_BAR_HEIGHT }}>
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={{ padding: 12 }}
          keyboardShouldPersistTaps="always"
          keyboardDismissMode="interactive"
          nestedScrollEnabled
          showsVerticalScrollIndicator
          onScroll={handleScroll}
          onContentSizeChange={handleContentSizeChange}
          scrollEventThrottle={16}
        >
          {data.length === 0 ? (
            <Text style={{ color: colors.subtext }}>
              {`Aucun message. ${preview}`}
            </Text>
          ) : (
            <View>
              {data.map((item) => {
                if (!item || typeof item !== 'object') return null;

                const uid = String(item.uid || '');
                const name = namesMap?.[uid] || item.displayName || uid;

                const info = participantInfoMap?.[uid] || {};
                const uri  = info.photoURL ? withCacheBust(info.photoURL, info.version) : null;
                const imgKey = `${uid}:${info.version || 0}`;

                return (
                  <View key={item.id} style={{ marginBottom: 10 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 2 }}>
                      <Image
                        key={imgKey}
                        source={uri ? { uri } : AVATAR_PLACEHOLDER}
                        style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: colors.border, marginRight: 6 }}
                        onError={() => {}}
                      />
                      <Text style={{ fontWeight: '700', color: colors.text }}>
                        {name}
                      </Text>
                    </View>
                    <Text style={{ color: colors.text }}>{String(item.text ?? '')}</Text>
                  </View>
                );
              })}
            </View>
          )}
        </ScrollView>
      </View>

      {/* Barre d'entrée */}
      <View
        style={{
          flexDirection: 'row', padding: 8, gap: 8,
          borderTopWidth: 1, borderTopColor: colors.border,
          height: INPUT_BAR_HEIGHT, backgroundColor: colors.card
        }}
      >
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="Écrire un message…"
          placeholderTextColor={colors.subtext}
          style={{ flex: 1, padding: 12, backgroundColor: colors.card2, color: colors.text, borderRadius: 10 }}
          textAlignVertical="center"
          returnKeyType="send"
          underlineColorAndroid="transparent"
          onSubmitEditing={() => {
            const t = text.trim();
            if (!t || busy || !canSend) return;
            setText('');
            onSend(t);
            requestAnimationFrame(() => scrollToEnd(true));
          }}
        />
        <TouchableOpacity
          onPress={() => {
            const t = text.trim();
            if (!t || busy || !canSend) return;
            setText('');
            onSend(t);
            requestAnimationFrame(() => scrollToEnd(true));
          }}
          disabled={busy || !text.trim() || !canSend}
          style={{
            paddingHorizontal: 14, justifyContent: 'center', borderRadius: 10,
            backgroundColor: busy || !text.trim() || !canSend ? colors.border : colors.primary
          }}
        >
          <Text style={{ color: '#fff', fontWeight: '800' }}>Envoyer</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function Avatar({ uri, size = 44 }) {
  const [ok, setOk] = React.useState(!!uri);
  const showUri = ok && typeof uri === 'string' && /^https?:\/\//i.test(uri);

  return showUri ? (
    <Image
      source={{ uri }}
      style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: '#e5e7eb', marginRight: 10 }}
      onError={() => setOk(false)}
    />
  ) : (
    <Image
      source={AVATAR_PLACEHOLDER}
      style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: '#e5e7eb', marginRight: 10 }}
    />
  );
}

/* Helpers */
function pluralFR(n, sing, plur) { return `${n} ${n > 1 ? plur : sing}`; }
function normId(v) { if (v == null) return null; const s = String(v).trim(); return /^\d+$/.test(s) ? String(Number(s)) : s; }
function formatGA(goals, assists) { return `${pluralFR(goals, 'but', 'buts')}, ${pluralFR(assists, 'passe', 'passes')}`; }

function ParticipantsCard({
  leaderboard,
  namesMap,
  participantInfoMap,
  colors,
  liveStats,
  playerMap,
  currentUid,
}) {
  if (!Array.isArray(leaderboard) || leaderboard.length === 0) {
    return (
      <View style={{ marginHorizontal: 16, marginBottom: 12 }}>
        <Text style={{ color: '#666', textAlign: 'center' }}>Aucune participation.</Text>
      </View>
    );
  }

  return (
    <View
      style={{
        marginHorizontal: 16,
        marginBottom: 12,
        padding: 12,
        borderWidth: 1,
        borderRadius: 12,
        backgroundColor: '#fff',
        elevation: 2,
        shadowColor: '#000',
        shadowOpacity: 0.06,
        shadowRadius: 4,
        shadowOffset: { width: 0, height: 2 },
      }}
    >
      {/* 🔸 LÉGENDE */}
      <View style={{ alignItems: 'center', marginBottom: 8 }}>
        <Text style={{ fontSize: 12, color: '#555' }}>Format : buts – passes = total</Text>
      </View>

      {leaderboard.map((item) => {
        const info = participantInfoMap[item.uid] || {};
        const name = namesMap[item.uid] || item.uid;
        const photo = info.photoURL || null;

        const picks = Array.isArray(item.picks) ? item.picks : [];
        const rows = [];
        const seen = new Set();

        for (const p of picks) {
          const pid = normId(p?.playerId ?? p?.id ?? p?.nhlId ?? p?.player?.id);
          if (!pid || seen.has(pid)) continue;
          seen.add(pid);

          const g = Number(liveStats.playerGoals?.[pid] || 0);
          const a1 = Number(liveStats.playerA1?.[pid] || 0);
          const a2 = Number(liveStats.playerA2?.[pid] || 0);
          const aC = Number(liveStats.playerAssists?.[pid] || 0);
          const pts = Number(liveStats.playerPoints?.[pid] || 0);
          const derived = Math.max(0, pts - g);
          const assists = Math.max(a1 + a2, aC, derived);

          rows.push({
            playerId: pid,
            playerName: playerMap[pid]?.fullName ?? p?.fullName ?? p?.name ?? 'Joueur',
            teamAbbr: playerMap[pid]?.teamAbbr ?? p?.teamAbbr ?? '',
            goals: g,
            assists,
          });
        }

        rows.sort(
          (a, b) =>
            (b.goals + b.assists) - (a.goals + a.assists) ||
            b.goals - a.goals ||
            a.playerName.localeCompare(b.playerName)
        );

        const isSelf = currentUid && item.uid === currentUid;
        const cardBg = isSelf ? '#E0ECFF' : '#F7F9FB';
        const cardBorder = isSelf ? '#3B82F6' : '#D1D5DB';

        return (
          <View
            key={item.uid}
            style={{
              paddingVertical: 12,
              paddingHorizontal: 10,
              backgroundColor: cardBg,
              borderWidth: 1,
              borderColor: cardBorder,
              borderRadius: 10,
              marginBottom: 12,
            }}
          >
            {/* En-tête participant */}
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Avatar uri={photo} size={48} />
              <View style={{ flex: 1 }}>
                <Text numberOfLines={1} style={{ fontWeight: '700' }}>{name}</Text>
              </View>
              <View style={{ width: 72, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
                <MaterialCommunityIcons name="star-circle" size={24} color="#111" />
                <Text style={{ fontSize: 20, fontWeight: '800' }}>
                  {Number(item.livePoints || 0).toFixed(1)}
                </Text>
              </View>
            </View>

            {/* Liste joueurs */}
            {rows.length > 0 ? (
              <View style={{ marginTop: 8, gap: 6 }}>
                {rows.map((row) => {
                  const total = row.goals + row.assists;
                  return (
                    <View key={row.playerId} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 6 }}>
                      <View style={{ width: 28, height: 28, marginRight: 10, alignItems: 'center', justifyContent: 'center' }}>
                        {row.teamAbbr ? (
                          <SvgUri uri={teamLogoUrl(row.teamAbbr)} width={28} height={28} />
                        ) : (
                          <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: '#eee' }} />
                        )}
                      </View>
                      <View style={{ flex: 1, marginRight: 8 }}>
                        <Text numberOfLines={1}>{row.playerName}</Text>
                      </View>
                      <Text style={{ fontWeight: '700', color: '#111', minWidth: 72, textAlign: 'right' }}>
                        {`${row.goals} – ${row.assists} = ${total}`}
                      </Text>
                    </View>
                  );
                })}
              </View>
            ) : (
              <Text style={{ color: '#666', marginTop: 6 }}>Aucun joueur sélectionné.</Text>
            )}
          </View>
        );
      })}
    </View>
  );
}