// app/defis/[defiId]/results.js
import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import {
  View, Text, ActivityIndicator, FlatList, Image, TouchableOpacity, ScrollView, TextInput, KeyboardAvoidingView, Platform , Animated, Easing
} from 'react-native';
import { Stack, useLocalSearchParams, useFocusEffect } from 'expo-router';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  where,
  documentId,
} from 'firebase/firestore';
import { db } from '@src/lib/firebase';
import { useAuth } from '@src/auth/AuthProvider';
import { useTheme } from '@src/theme/ThemeProvider';
import { useDefiChat } from '@src/defiChat/useDefiChat';
import { useUnreadCount } from '@src/defiChat/useUnreadCount';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';


/* ----------------------------- Helpers ----------------------------- */
function fmtTSLocalHM(v) {
  try {
    const d = v?.toDate?.() ? v.toDate() : (v instanceof Date ? v : v ? new Date(v) : null);
    if (!d) return '—';
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
  } catch { return '—'; }
}
function isPast(dateLike) {
  try {
    const d = dateLike?.toDate?.() ? dateLike.toDate() : (dateLike ? new Date(dateLike) : null);
    if (!d) return false;
    return Date.now() > d.getTime();
  } catch { return false; }
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
function statusStyleWithOverride(defi) {
  const st = statusStyleBase(defi?.status || '—');
  if ((defi?.status === 'awaiting_result' || defi?.status === 'AWAITING_RESULT') && isPast(defi?.endAt)) {
    return { ...st, bg:'#FEF2F2', fg:'#991B1B', icon:'lock-clock', label:'Terminé (à valider)' };
  }
  return st;
}
function Chip({ bg, fg, icon, label }) {
  return (
    <View style={{ flexDirection:'row', alignItems:'center', alignSelf:'flex-start',
      paddingVertical:4, paddingHorizontal:8, borderRadius:999, backgroundColor:bg }}>
      <MaterialCommunityIcons name={icon} size={14} color={fg} />
      <Text style={{ color:fg, marginLeft:6, fontWeight:'700' }}>{label}</Text>
    </View>
  );
}
// NHL headshot (fallback "latest" by playerId)
const headshotUrl = (playerId) =>
  `https://assets.nhle.com/mugs/nhl/latest/${encodeURIComponent(String(playerId))}.png`;

function pickFirstString(...vals) {
  for (const v of vals) {
    if (!v) continue;
    const s = String(v).trim();
    if (s.length > 0) return s;
  }
  return null;
}
function initialsFrom(s = '') {
  const t = String(s || '').trim();
  if (!t) return '?';
  const p = t.replace(/\s+/g, ' ').split(' ');
  if (p.length === 1) return p[0].slice(0, 2).toUpperCase();
  return (p[0][0] + p[p.length - 1][0]).toUpperCase();
}
function resolveDisplayNameFromParticipation(partData) {
  if (!partData) return null;
  const direct = pickFirstString(
    partData.participans?.displayName,
    partData.participants?.displayName,
    partData.displayName,
    partData.name,
    partData.username,
    partData.userDisplayName,
    partData.fullName,
    partData.profile?.name,
    partData.profile?.displayName,
    partData.user?.displayName,
    partData.user?.name,
    partData.email
  );
  if (direct) return direct;
  if (Array.isArray(partData.picks) && partData.picks.length) {
    const who = pickFirstString(
      partData.picks[0]?.ownerName,
      partData.picks[0]?.ownerDisplayName,
      partData.picks[0]?.owner?.name
    );
    if (who) return who;
  }
  return null;
}

/* ----------------------------- Screen ----------------------------- */
export default function DefiResultsScreen() {
  const { defiId } = useLocalSearchParams();
  const { user } = useAuth();
  const { colors } = useTheme();
  const [chatCollapsed, setChatCollapsed] = useState(true);

  // 🔵 Chat hooks
  const { messages, send, busy, markRead } = useDefiChat(defiId);
  const unread = useUnreadCount(defiId, user?.uid);

  const toggleChat = React.useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setChatCollapsed(v => !v);
  }, []);


  // Marquer lu quand l’écran est focus
  useFocusEffect(
    React.useCallback(() => {
      if (!defiId) return;
       markRead();
       return () => {};
   }, [markRead, defiId])
  );

  const [defi, setDefi] = useState(null);
  const [loadingDefi, setLoadingDefi] = useState(true);

  const [parts, setParts] = useState([]);           // [{uid, livePoints, picks, updatedAt, _raw}]
  const [namesMap, setNamesMap] = useState({});     // uid -> displayName/email/placeholder

  // Live name listeners for root participants/{uid}
  const nameUnsubsRef = useRef(new Map());          // Map<uid, unsub>
  const prefetchedRef = useRef(new Set());          // track immediate getDoc calls to avoid duplicates

  const [liveStats, setLiveStats] = useState({
    playerGoals: {}, playerA1: {}, playerA2: {}, playerAssists: {}, playerPoints: {}, events: [], updatedAt: null
  });
  const [playerMap, setPlayerMap] = useState({});   // { playerId: { fullName, teamAbbr } }

  const GROUP_PLACEHOLDER = require('@src/assets/group-placeholder.png');
  const AVATAR_PLACEHOLDER = require('@src/assets/avatar-placeholder.png');

  const [participantInfoMap, setParticipantInfoMap] = useState({}); // uid -> { name, photoURL }
  const [group, setGroup] = useState(null);

  /* ----- Defi doc ----- */
  useEffect(() => {
    if (!defiId) return;
    setLoadingDefi(true);
    const ref = doc(db, 'defis', String(defiId));
    const un = onSnapshot(ref, (snap) => {
      setDefi(snap.exists() ? ({ id: snap.id, ...snap.data() }) : null);
      setLoadingDefi(false);
    });
    return () => un();
  }, [defiId]);

  // charger le groupe
  useEffect(() => {
    if (!defi?.groupId) return;
    const ref = doc(db, 'groups', String(defi.groupId));
    const un = onSnapshot(ref, (snap) => {
      setGroup(snap.exists() ? ({ id: snap.id, ...snap.data() }) : null);
    });
    return () => { try { un(); } catch {} };
  }, [defi?.groupId]);

  /* ----- Participations + names from ROOT participants/{uid} ----- */
  useEffect(() => {
    if (!defi?.id) return;

    // clear previous name listeners
    for (const [, unsub] of nameUnsubsRef.current) { try { unsub(); } catch {} }
    nameUnsubsRef.current.clear();
    prefetchedRef.current.clear();

    const qParts = query(collection(db, 'defis', String(defi.id), 'participations'));
    const un = onSnapshot(qParts, async (snap) => {
      const nextParts = [];
      const nextNames = {};

      // Collect UIDs we see in this snapshot
      const seenUids = new Set();

      snap.forEach((docSnap) => {
        const v = docSnap.data() || {};
        const uid = docSnap.id;
        seenUids.add(uid);

        nextParts.push({
          uid,
          livePoints: Number(v.livePoints || 0),
          picks: Array.isArray(v.picks) ? v.picks : [],
          updatedAt: v.liveUpdatedAt || v.updatedAt || null,
          _raw: v,
        });

        // 1) placeholder immédiat (jamais afficher l'UID)
       const localName = resolveDisplayNameFromParticipation(v);
        nextNames[uid] = localName || 'Chargement du nom…';

        // 2) Primary source: ROOT participants/{uid}.displayName + photoURL — live listener
        if (!nameUnsubsRef.current.has(uid)) {
          const uref = doc(db, 'participants', uid);
          const unsub = onSnapshot(
            uref,
            (uSnap) => {
              if (uSnap.exists()) {
                const u = uSnap.data() || {};
                const nm = pickFirstString(u.displayName, u.name, u.username, u.email) || '—';
                const photoURL = u.photoURL || u.avatarUrl || u.photo || null;
                setNamesMap(prev => (prev[uid] === nm ? prev : { ...prev, [uid]: nm }));
                setParticipantInfoMap(prev => {
                  const old = prev[uid] || {};
                  if (old.name === nm && old.photoURL === photoURL) return prev;
                  return { ...prev, [uid]: { name: nm, photoURL } };
                });
              } else {
                setNamesMap(prev => (prev[uid] === '—' ? prev : { ...prev, [uid]: '—' }));
                setParticipantInfoMap(prev => {
                  const old = prev[uid] || {};
                  if (old.name === '—' && !old.photoURL) return prev;
                  return { ...prev, [uid]: { name: '—', photoURL: null } };
                });
              }
            },
            () => { /* noop */ }
          );
          nameUnsubsRef.current.set(uid, unsub);
        }

        // 3) Prefetch immédiat (one-shot) — ajoute aussi photoURL
        if (!prefetchedRef.current.has(uid)) {
          prefetchedRef.current.add(uid);
          (async () => {
            try {
              const uref = doc(db, 'participants', uid);
              const s = await getDoc(uref);
              if (s.exists()) {
                const u = s.data() || {};
                const nm = pickFirstString(u.displayName, u.name, u.username, u.email) || '—';
                const photoURL = u.photoURL || u.avatarUrl || u.photo || null;
                setNamesMap(prev => (prev[uid] === nm ? prev : { ...prev, [uid]: nm }));
                setParticipantInfoMap(prev => {
                  const old = prev[uid] || {};
                  if (old.name === nm && old.photoURL === photoURL) return prev;
                  return { ...prev, [uid]: { name: nm, photoURL } };
                });
              } else {
                setNamesMap(prev => (prev[uid] === '—' ? prev : { ...prev, [uid]: '—' }));
                setParticipantInfoMap(prev => ({ ...prev, [uid]: { name: '—', photoURL: null } }));
              }
            } catch {
              setNamesMap(prev => (prev[uid] === '—' ? prev : { ...prev, [uid]: '—' }));
              setParticipantInfoMap(prev => ({ ...prev, [uid]: { name: '—', photoURL: null } }));
            }
          })();
        }
      });

      // Clean listeners for removed UIDs
      for (const [uid, unsub] of nameUnsubsRef.current) {
        if (!seenUids.has(uid)) {
          try { unsub(); } catch {}
          nameUnsubsRef.current.delete(uid);
          prefetchedRef.current.delete(uid);
        }
      }

      setParts(nextParts);
 setNamesMap(prev => {
   let changed = false;
   const merged = { ...prev };
   for (const [uid, nm] of Object.entries(nextNames)) {
     if (merged[uid] !== nm) {
       merged[uid] = nm;
       changed = true;
     }
   }
   return changed ? merged : prev;
 });
    });

    return () => {
      un();
      for (const [, unsub] of nameUnsubsRef.current) { try { unsub(); } catch {} }
      nameUnsubsRef.current.clear();
      prefetchedRef.current.clear();
    };
  }, [defi?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ----- Live stats (tallies) ----- */
  useEffect(() => {
    if (!defi?.id) return;
    const ref = doc(db, 'defis', String(defi.id), 'live', 'stats');
    const un = onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        const d = snap.data() || {};
        setLiveStats({
          playerGoals: d.playerGoals || {},
          playerA1: d.playerA1 || {},
          playerA2: d.playerA2 || {},
          playerAssists: d.playerAssists || d.assists || {},
          playerPoints: d.playerPoints || {},
          events: Array.isArray(d.events) ? d.events : [],
          updatedAt: d.updatedAt || null,
        });
      } else {
        setLiveStats({
          playerGoals: {}, playerA1: {}, playerA2: {}, playerAssists: {}, playerPoints: {},
          events: [], updatedAt: null
        });
      }
    });
    return () => un();
  }, [defi?.id]);

  /* ----- Resolve player meta (batched "in" queries) ----- */
  useEffect(() => {
    const fromTallies = Array.from(new Set([
      ...Object.keys(liveStats.playerGoals || {}),
      ...Object.keys(liveStats.playerA1 || {}),
      ...Object.keys(liveStats.playerA2 || {}),
      ...Object.keys(liveStats.playerAssists || {}),
      ...Object.keys(liveStats.playerPoints || {}),
    ]));
    const ids = fromTallies.filter(Boolean);
    const missing = ids.filter((id) => !playerMap[id]);
    if (missing.length === 0) return;

    (async () => {
      try {
        const updates = {};
        const CHUNK = 10;
        const chunks = [];
        for (let i = 0; i < missing.length; i += CHUNK) {
          chunks.push(missing.slice(i, i + CHUNK));
        }
        const queriesArr = chunks.map((idsChunk) => {
          const qPlayers = query(
            collection(db, 'nhl_players'),
            where(documentId(), 'in', idsChunk.map(String))
          );
          return getDocs(qPlayers);
        });

        const snaps = await Promise.all(queriesArr);
        for (const s of snaps) {
          s.forEach((docSnap) => {
            const pid = docSnap.id;
            const v = docSnap.data() || {};
            updates[pid] = {
              fullName: v.fullName || 'Chargement du joueur…',
              teamAbbr: v.teamAbbr || '',
            };
          });
        }
        for (const pid of missing) {
          if (!updates[pid]) {
            updates[pid] = { fullName: 'Chargement du joueur…', teamAbbr: '' };
          }
        }
        setPlayerMap((prev) => ({ ...prev, ...updates }));
      } catch {
        const fallback = {};
        for (const pid of missing) {
          fallback[pid] = { fullName: 'Chargement du joueur…', teamAbbr: '' };
        }
        setPlayerMap((prev) => ({ ...prev, ...fallback }));
      }
    })();
  }, [liveStats, playerMap]);

  /* ----- Leaderboard (memo) ----- */
  const leaderboardData = useMemo(() => {
    const rows = [...parts].sort((a,b) => b.livePoints - a.livePoints);
    if (!rows.length) return [];
    const top = rows[0].livePoints;
    return rows.map(r => ({ ...r, isTiedForFirst: r.livePoints === top }));
  }, [parts]);

  const me = user?.uid;
  const chipStyle = statusStyleWithOverride(defi);

  /* ----- Contributions from tallies ----- */
  function contributionItemsForParticipant(picks) {
    const norm = (v) => {
      if (v == null) return null;
      const s = String(v).trim();
      return /^\d+$/.test(s) ? String(Number(s)) : s;
    };
    const pickIds = new Set(
      (Array.isArray(picks) ? picks : [])
        .map(p => norm(p.playerId ?? p.id ?? p.nhlId ?? p.player?.id))
        .filter(Boolean)
    );
    if (pickIds.size === 0) return [];

    const rows = [];
    for (const pid of pickIds) {
      const g  = Number(liveStats.playerGoals?.[pid] || 0);
      const a1 = Number(liveStats.playerA1?.[pid]    || 0);
      const a2 = Number(liveStats.playerA2?.[pid]    || 0);
      const aC = Number(liveStats.playerAssists?.[pid] || 0);
      const pts = Number(liveStats.playerPoints?.[pid] || 0);

      const derived = Math.max(0, pts - g);
      const aTotal = Math.max(a1 + a2, aC, derived);

      const teamAbbr = playerMap[pid]?.teamAbbr || '';
      const playerName = playerMap[pid]?.fullName || 'Chargement du joueur…';

      if (g > 0) {
        rows.push({
          key: `G-${pid}`,
          playerId: pid,
          teamAbbr,
          playerName,
          role: 'G',
          isGoal: true,
          time: `x${g}`,
        });
      }
      if (aTotal > 0) {
        rows.push({
          key: `A-${pid}`,
          playerId: pid,
          teamAbbr,
          playerName,
          role: 'A',
          isGoal: false,
          time: `x${aTotal}`,
        });
      }
    }
    return rows.sort((a,b) => (a.isGoal === b.isGoal) ? 0 : (a.isGoal ? -1 : 1));
  }

  const ContributionRow = ({ item }) => {
    return (
      <View style={{
        flexDirection:'row', alignItems:'center', paddingVertical:6,
        borderBottomWidth:1, borderColor:'#f3f4f6'
      }}>
        <Image
          source={{ uri: headshotUrl(item.playerId) }}
          style={{ width:28, height:28, borderRadius:999, backgroundColor:'#eee', marginRight:10 }}
        />
        <View style={{ flex:1 }}>
          <Text numberOfLines={1}>
            {item.teamAbbr ? `${item.teamAbbr} — ` : ''}{item.playerName}
          </Text>
          <Text style={{ color:'#888', fontSize:12 }}>{item.time}</Text>
        </View>
        <View style={{
          minWidth:26, paddingHorizontal:8, paddingVertical:4,
          borderRadius:999, alignItems:'center', justifyContent:'center',
          backgroundColor: item.isGoal ? '#111' : '#2563EB'
        }}>
          <Text style={{ color:'#fff', fontWeight:'800', fontSize:12 }}>
            {item.role}
          </Text>
        </View>
      </View>
    );
  };

  /* ----- Toast: afficher les joueurs d’un participant ----- */
const showParticipantPlayers = (part) => {
  const baseName =
    namesMap[part.uid] ||
    resolveDisplayNameFromParticipation(part._raw) ||
    'Participant';

  const picks = Array.isArray(part.picks) ? part.picks : [];

  if (!picks.length) {
    Toast.show({
      type: 'playersTop',
      props: { title: baseName, items: [] },
      position: 'top',
      visibilityTime: 4000,
    });
    return;
  }

  const items = picks.map((pl) => ({
    name: pl.fullName ?? pl.name ?? 'Joueur',
    team: pl.teamAbbr ?? '??',
    playerId: pl.playerId ?? pl.id ?? pl.nhlId ?? pl.player?.id ?? null,
  }));

  Toast.show({
    type: 'playersTop',
    props: { title: baseName, items },
    position: 'top',
    visibilityTime: 7000,
  });
};

  /* ----- Header (groupe + infos défi) ----- */
  function HeaderCard({ group, defi }) {
  return (
    <View
      style={{
        padding: 12,
        borderWidth: 1,
        borderRadius: 12,
        backgroundColor: '#fff',
        elevation: 3,
        shadowColor: '#000',
        shadowOpacity: 0.08,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 3 },
        marginBottom: 8,
      }}
    >
      {/* Ligne 1 : Avatar + Nom + Nb participants */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 10,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
          <Image
            source={group?.avatarUrl ? { uri: group.avatarUrl } : GROUP_PLACEHOLDER}
            style={{
              width: 40, height: 40, borderRadius: 20, marginRight: 10,
              backgroundColor: '#f3f4f6', borderWidth: 1, borderColor: '#e5e7eb',
            }}
          />
          <View style={{ flex: 1 }}>
            <Text style={{ fontWeight: '800', fontSize: 16 }} numberOfLines={1}>
              {group?.name || group?.title || group?.id || 'Groupe'}
            </Text>
            {!!defi?.title && (
              <Text style={{ color: '#6b7280' }} numberOfLines={1}>
                {defi.title}
              </Text>
            )}
          </View>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 8 }}>
          <MaterialCommunityIcons name="account-group" size={20} color="#555" />
          <Text style={{ fontWeight: '700', marginLeft: 4 }}>
            {defi?.participantsCount ?? 0}
          </Text>
        </View>
      </View>

      {/* Ligne 2 : Cagnotte + Statut + Détails */}
      <View style={{ marginTop: 4 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
          <MaterialCommunityIcons name="treasure-chest" size={20} color="#111" />
          <Text style={{ fontSize: 16, fontWeight: '800', marginLeft: 6 }}>
            Cagnotte de {Number(defi?.pot ?? 0)} crédits
          </Text>
        </View>

        <Chip
          bg={chipStyle.bg}
          fg={chipStyle.fg}
          icon={chipStyle.icon}
          label={chipStyle.label}
        />

        <View style={{ marginTop: 8 }}>
          <Text style={{ color: '#555' }}>
            Débute à{' '}
            <Text style={{ fontWeight: '700' }}>
              {fmtTSLocalHM(defi?.firstGameUTC)}
            </Text>
          </Text>
          <Text style={{ color: '#555' }}>Barème : Buteur = +1 • Passe = +1</Text>
        </View>
      </View>
    </View>
  );
}

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
        <Toast position="top" config={toastConfig} />
      </>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: defi.title || (defi.type ? `Défi ${defi.type}x${defi.type}` : 'Résultats'),
          headerRight: () => (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="chatbubble-ellipses" size={18} color={colors.text} />
              <View style={{
                minWidth: 18, height: 18, marginLeft: 6,
                borderRadius: 9, backgroundColor: unread > 0 ? '#ef4444' : colors.border,
                alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4
              }}>
                <Text style={{ color: '#fff', fontSize: 11, fontWeight: '800' }}>
                  {unread > 99 ? '99+' : unread}
                </Text>
              </View>
            </View>
          ),
        }}
      />
        <FlatList
          data={leaderboardData}
          keyExtractor={(it) => it.uid}
          style={{ flex: 1 }}                  // 👈 occupe l’espace restant
          nestedScrollEnabled   
          keyboardShouldPersistTaps="handled"            // 👈 évite les blocages avec l'input
          ListHeaderComponent={() => <HeaderCard group={group} defi={defi} />}
          contentContainerStyle={{ padding:16, gap:16 }}
          
          renderItem={({ item, index }) => {
            const isMe = item.uid === (user?.uid || '');
            const baseName = namesMap[item.uid] || resolveDisplayNameFromParticipation(item._raw) || 'Chargement du nom…';
            const display = isMe ? 'Toi' : baseName;

            const info = participantInfoMap[item.uid] || {};
            const photo = info.photoURL;

            const contribs = contributionItemsForParticipant(item.picks);

            return (
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => showParticipantPlayers(item)}
                style={{
                  padding:12, borderWidth:1, borderRadius:12, backgroundColor:'#fff',
                  elevation:2, shadowColor:'#000', shadowOpacity:0.06, shadowRadius:4, shadowOffset:{width:0,height:2},
                  marginBottom:8
                }}
              >
                {/* Ligne du joueur */}
                <View style={{ flexDirection:'row', alignItems:'center', marginBottom:8 }}>
                  <Text style={{ width:28, textAlign:'right', marginRight:10, fontWeight:'700' }}>
                    {index + 1}
                  </Text>

                  {photo ? (
                    <Image
                      source={{ uri: photo }}
                      style={{
                        width: 28, height: 28, borderRadius: 14,
                        backgroundColor: '#e5e7eb', marginRight: 10
                      }}
                    />
                  ) : (
                    <View
                      style={{
                        width: 28, height: 28, borderRadius: 14, marginRight: 10,
                        alignItems: 'center', justifyContent: 'center',
                        backgroundColor: '#dbeafe', borderWidth: 1, borderColor: '#bfdbfe'
                      }}
                    >
                      <Text style={{ fontSize:10, fontWeight:'800', color:'#1d4ed8' }}>
                        {initialsFrom(display)}
                      </Text>
                    </View>
                  )}

                  <View style={{ flex:1 }}>
                    <Text numberOfLines={1} style={{ fontWeight:'700' }}>
                      {display} {item.isTiedForFirst ? '🥇' : ''}
                    </Text>
                    <Text style={{ color:'#888', fontSize:12 }}>
                      MAJ: {fmtTSLocalHM(item.updatedAt)}
                    </Text>
                  </View>

                  <View style={{ flexDirection:'row', alignItems:'center', gap:6 }}>
                    <MaterialCommunityIcons name="star-circle" size={18} color="#111" />
                    <Text style={{ fontSize:18, fontWeight:'800' }}>
                      {Number(item.livePoints || 0).toFixed(1)}
                    </Text>
                  </View>
                </View>

                {contribs.length === 0 ? (
                  <Text style={{ color:'#666' }}>
                    Défi non débuté ou pas de points pour l'instant.
                  </Text>
                ) : (
                  <View>
                    {contribs.map(row => (
                      <ContributionRow key={row.key} item={row} />
                    ))}
                  </View>
                )}
              </TouchableOpacity>
            );
        }}
        ListEmptyComponent={() => (
          <Text style={{ color:'#666', marginTop:24, textAlign:'center' }}>
            Aucune participation.
          </Text>
        )}
      />

     <InlineChat
      colors={colors}
      messages={messages}
      busy={busy}
      onSend={send}
      collapsed={chatCollapsed}
      onToggle={() => setChatCollapsed(v => !v)}
    />

      {/* Toast container avec config custom (TOP) */}
      <Toast position="top" config={toastConfig} />
    </>
  );
}


function InlineChat({ colors, messages, onSend, busy, collapsed = false, onToggle }) {
  const [text, setText] = React.useState('');
  const listRef = React.useRef(null);
  const [autoStick, setAutoStick] = React.useState(true);
  const INPUT_BAR_HEIGHT = 56;

  // ---- Animation (0=plié, 1=ouvert)
  const open = React.useRef(new Animated.Value(collapsed ? 0 : 1)).current;
  React.useEffect(() => {
    Animated.timing(open, {
      toValue: collapsed ? 0 : 1,
      duration: 180,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,        // on anime la hauteur => false
    }).start();
  }, [collapsed]);

  // hauteur cible quand ouvert (ajuste si besoin)
  const OPEN_HEIGHT = 360;
  const containerHeight = open.interpolate({ inputRange: [0,1], outputRange: [0, OPEN_HEIGHT] });
  const contentOpacity  = open.interpolate({ inputRange: [0,1], outputRange: [0, 1] });

  const data = React.useMemo(
    () => [...messages].sort((a,b) => (a.createdAt||0) - (b.createdAt||0)),
    [messages]
  );

  const scrollToEndIfNeeded = React.useCallback(() => {
    if (!autoStick) return;
    listRef.current?.scrollToEnd?.({ animated: false });
  }, [autoStick]);

  React.useEffect(() => {
    const id = setTimeout(scrollToEndIfNeeded, 0);
    return () => clearTimeout(id);
  }, [scrollToEndIfNeeded, data.length]);

  const last = data[data.length - 1];
  const preview = last?.text ? (last.text.length > 48 ? last.text.slice(0,48) + '…' : last.text) : 'Aucun message';

  return (
    <View style={{
      marginTop: 12, borderWidth: 1, borderColor: colors.border,
      borderRadius: 12, overflow: 'hidden', backgroundColor: colors.card
    }}>
      {/* Entête cliquable */}
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={onToggle}
        style={{
          paddingHorizontal: 12, paddingVertical: 10,
          borderBottomWidth: collapsed ? 0 : 1,
          borderBottomColor: colors.border,
          flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
          <Ionicons name="chatbubble-ellipses" size={16} color={colors.text} />
          <Text style={{ marginLeft: 8, fontWeight: '800', color: colors.text }}>
            Chat du défi
          </Text>
          <Text style={{ marginLeft: 8, color: colors.subtext, fontSize: 12 }}>
            {messages.length} messages
          </Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {collapsed ? (
            <Text style={{ color: colors.subtext, fontSize: 12, marginRight: 8 }} numberOfLines={1}>
              {preview}
            </Text>
          ) : null}
          <Ionicons name={collapsed ? "chevron-down" : "chevron-up"} size={18} color={colors.text} />
        </View>
      </TouchableOpacity>

      {/* Corps animé */}
      <Animated.View
        style={{
          height: containerHeight,
          opacity: contentOpacity,
          overflow: 'hidden',
        }}
        pointerEvents={collapsed ? 'none' : 'auto'}
      >
        {/* Liste */}
        <View style={{ flex: 1 }}>
          <FlatList
            ref={listRef}
            data={data}
            keyExtractor={(m) => m.id}
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: 12, paddingBottom: INPUT_BAR_HEIGHT + 12 }}
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled
            removeClippedSubviews={false}
            initialNumToRender={20}
            windowSize={10}
            onContentSizeChange={scrollToEndIfNeeded}
            onScroll={(e) => {
              const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
              const dist = contentSize.height - (contentOffset.y + layoutMeasurement.height);
              setAutoStick(dist < 80);
            }}
            scrollEventThrottle={16}
            renderItem={({ item }) => (
              <View style={{ marginBottom: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 2 }}>
                  <Image
                    source={item.photoURL ? { uri: item.photoURL } : require('@src/assets/avatar-placeholder.png')}
                    style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: colors.border, marginRight: 6 }}
                  />
                  <Text style={{ fontWeight: '700', color: colors.text }}>
                    {item.displayName || item.uid}
                  </Text>
                </View>
                <Text style={{ color: colors.text }}>{item.text}</Text>
              </View>
            )}
          />
        </View>

        {/* Input */}
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={{
            flexDirection: 'row', padding: 8, gap: 8,
            borderTopWidth: 1, borderTopColor: colors.border,
            height: INPUT_BAR_HEIGHT, backgroundColor: colors.card
          }}>
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder="Écrire un message…"
              placeholderTextColor={colors.subtext}
              style={{ flex: 1, padding: 12, backgroundColor: colors.card2, color: colors.text, borderRadius: 10 }}
              onFocus={() => requestAnimationFrame(scrollToEndIfNeeded)}
            />
            <TouchableOpacity
              onPress={() => {
                const t = text.trim();
                if (!t) return;
                setText('');
                onSend(t);
                requestAnimationFrame(scrollToEndIfNeeded);
              }}
              disabled={busy || !text.trim()}
              style={{
                paddingHorizontal: 14, justifyContent: 'center', borderRadius: 10,
                backgroundColor: busy || !text.trim() ? colors.border : colors.primary
              }}
            >
              <Text style={{ color: '#fff', fontWeight: '800' }}>Envoyer</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Animated.View>
    </View>
  );
}


/* ----------------------------- Toast config (custom type "playersTop") ----------------------------- */
const toastConfig = {
  playersTop: ({ props }) => {
    const items = Array.isArray(props?.items) ? props.items : [];
    const title = props?.title || 'Joueurs';
    return (
      <View
        style={{
          backgroundColor: '#111',
          padding: 12,
          borderRadius: 12,
          marginTop: 40,
          marginHorizontal: 8,
          maxWidth: '96%',
          maxHeight: 280,
        }}
      >
        <Text style={{ color: '#fff', fontWeight: '700', marginBottom: 8, fontSize: 16 }}>
          {title}
        </Text>
        {items.length === 0 ? (
          <Text style={{ color: '#fff', opacity: 0.85 }}>Aucun joueur enregistré.</Text>
        ) : (
          <ScrollView style={{ maxHeight: 240 }}>
            {items.map((it, i) => (
              <View key={`${it.playerId ?? it.name ?? i}-${i}`} style={{ flexDirection:'row', alignItems:'center', marginVertical: 4 }}>
                {it.playerId ? (
                  <Image
                    source={{ uri: `https://assets.nhle.com/mugs/nhl/latest/${encodeURIComponent(String(it.playerId))}.png` }}
                    style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: '#333', marginRight: 8 }}
                  />
                ) : (
                  <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: '#333', marginRight: 8 }} />
                )}
                <Text style={{ color:'#fff' }}>
                  {it.team ? `${it.team} - ` : ''}{it.name}
                </Text>
              </View>
            ))}
          </ScrollView>
        )}
      </View>
    );
  },
};