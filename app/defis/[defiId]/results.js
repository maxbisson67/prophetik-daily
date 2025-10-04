// app/defis/[defiId]/results.js
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, ActivityIndicator, FlatList, Image } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { collection, doc, getDoc, onSnapshot, query } from 'firebase/firestore';
import { db } from '@src/lib/firebase';
import { useAuth } from '@src/auth/AuthProvider';
import { MaterialCommunityIcons } from '@expo/vector-icons';

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
function resolveDisplayNameFromParticipation(partData) {
  if (!partData) return null;
  const direct = pickFirstString(
    // weak fallbacks (primary source is root participants/{uid})
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

  const [defi, setDefi] = useState(null);
  const [loadingDefi, setLoadingDefi] = useState(true);

  const [parts, setParts] = useState([]);           // [{uid, livePoints, picks, updatedAt, _raw}]
  const [namesMap, setNamesMap] = useState({});     // uid -> displayName/email/uid

  // Live name listeners for root participants/{uid}
  const nameUnsubsRef = useRef(new Map());          // Map<uid, unsub>
  const fetchedOnceRef = useRef(new Set());         // avoid duplicate getDoc calls (backup path)

  const [liveStats, setLiveStats] = useState({
    playerGoals: {}, playerA1: {}, playerA2: {}, playerAssists: {}, playerPoints: {}, events: [], updatedAt: null
  });
  const [playerMap, setPlayerMap] = useState({});   // { playerId: { fullName, teamAbbr } }

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

  /* ----- Participations + names from ROOT participants/{uid} ----- */
  useEffect(() => {
    if (!defi?.id) return;

    // clear previous name listeners
    for (const [, unsub] of nameUnsubsRef.current) { try { unsub(); } catch {} }
    nameUnsubsRef.current.clear();

    const qParts = query(collection(db, 'defis', String(defi.id), 'participations'));
    const un = onSnapshot(qParts, async (snap) => {
      const nextParts = [];
      const nextNames = { ...namesMap }; // keep already-resolved names

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

        // If we already have a name (from previous render), keep it
        if (nextNames[uid]) return;

        // Weak local fallback from participation
        const localName = resolveDisplayNameFromParticipation(v);
        if (localName) {
          nextNames[uid] = localName;
          return;
        }

        // Primary source: ROOT participants/{uid}.displayName — live listener
        if (!nameUnsubsRef.current.has(uid)) {
          const uref = doc(db, 'participants', uid);
          const unsub = onSnapshot(uref, (uSnap) => {
            if (uSnap.exists()) {
              const u = uSnap.data() || {};
              const nm = pickFirstString(u.displayName, u.name, u.username, u.email, uid) || uid;
              setNamesMap(prev => (prev[uid] === nm ? prev : { ...prev, [uid]: nm }));
            } else {
              setNamesMap(prev => (prev[uid] === uid ? prev : { ...prev, [uid]: uid }));
            }
          }, async () => {
            // fallback one-shot if snapshot fails
            if (!fetchedOnceRef.current.has(uid)) {
              fetchedOnceRef.current.add(uid);
              try {
                const s = await getDoc(uref);
                if (s.exists()) {
                  const u = s.data() || {};
                  const nm = pickFirstString(u.displayName, u.name, u.username, u.email, uid) || uid;
                  setNamesMap(prev => (prev[uid] === nm ? prev : { ...prev, [uid]: nm }));
                } else {
                  setNamesMap(prev => (prev[uid] === uid ? prev : { ...prev, [uid]: uid }));
                }
              } catch {
                setNamesMap(prev => (prev[uid] === uid ? prev : { ...prev, [uid]: uid }));
              }
            }
          });
          nameUnsubsRef.current.set(uid, unsub);
        }
      });

      // Clean up listeners for UIDs no longer present
      for (const [uid, unsub] of nameUnsubsRef.current) {
        if (!seenUids.has(uid)) {
          try { unsub(); } catch {}
          nameUnsubsRef.current.delete(uid);
        }
      }

      setParts(nextParts);
      setNamesMap(prev => ({ ...nextNames, ...prev }));
    });

    return () => {
      un();
      for (const [, unsub] of nameUnsubsRef.current) { try { unsub(); } catch {} }
      nameUnsubsRef.current.clear();
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
          // tolérance: si ta pipeline écrit un total d'aides
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

  /* ----- Resolve player meta (for contribution rows) ----- */
  useEffect(() => {
    const fromTallies = Array.from(new Set([
      ...Object.keys(liveStats.playerGoals || {}),
      ...Object.keys(liveStats.playerA1 || {}),
      ...Object.keys(liveStats.playerA2 || {}),
      ...Object.keys(liveStats.playerAssists || {}),
      ...Object.keys(liveStats.playerPoints || {}),
    ]));
    const ids = fromTallies.filter(Boolean);
    const missing = ids.filter(id => !playerMap[id]);
    if (!missing.length) return;

    (async () => {
      const updates = {};
      for (const pid of missing) {
        try {
          const ref = doc(db, 'nhl_players', String(pid));
          const snap = await getDoc(ref);
          if (snap.exists()) {
            const v = snap.data() || {};
            updates[pid] = {
              fullName: v.fullName || `#${pid}`,
              teamAbbr: v.teamAbbr || '',
            };
          } else {
            updates[pid] = { fullName: `#${pid}`, teamAbbr: '' };
          }
        } catch {
          updates[pid] = { fullName: `#${pid}`, teamAbbr: '' };
        }
      }
      setPlayerMap(prev => ({ ...prev, ...updates }));
    })();
  }, [liveStats, playerMap]);

  /* ----- Leaderboard ----- */
  const leaderboard = useMemo(() => {
    const rows = [...parts].sort((a,b) => b.livePoints - a.livePoints);
    if (!rows.length) return [];
    const top = rows[0].livePoints;
    return rows.map(r => ({ ...r, isTiedForFirst: r.livePoints === top }));
  }, [parts]);

  const me = user?.uid;
  const st = statusStyleWithOverride(defi);

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
      const aC = Number(liveStats.playerAssists?.[pid] || 0); // total assists if provided
      const pts = Number(liveStats.playerPoints?.[pid] || 0);

      // calcule le nombre d'assists le plus plausible
      const derived = Math.max(0, pts - g); // si points = buts+passes
      const aTotal = Math.max(a1 + a2, aC, derived);

      const teamAbbr = playerMap[pid]?.teamAbbr || '';
      const playerName = playerMap[pid]?.fullName || `#${pid}`;

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
    // Buts d'abord, puis assists
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

  const header = (
    <View style={{ padding:16, gap:16 }}>
      <View style={{
        padding:12, borderWidth:1, borderRadius:12, backgroundColor:'#fff',
        elevation:3, shadowColor:'#000', shadowOpacity:0.08, shadowRadius:6, shadowOffset:{width:0,height:3}
      }}>
        <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
          <Chip bg={st.bg} fg={st.fg} icon={st.icon} label={st.label} />
          <View style={{ flexDirection:'row', alignItems:'center', gap:8 }}>
            <MaterialCommunityIcons name="account-group" size={18} color="#555" />
            <Text style={{ fontWeight:'600' }}>{defi.participantsCount || 0}</Text>
          </View>
        </View>

        <View style={{ flexDirection:'row', alignItems:'center', gap:8 }}>
          <MaterialCommunityIcons name="treasure-chest" size={22} color="#111" />
          <Text style={{ fontSize:18, fontWeight:'800' }}>
            Cagnotte de {Number(defi.pot || 0)} crédits
          </Text>
        </View>

        <View style={{ marginTop:6 }}>
          <Text style={{ color:'#555' }}>
            Débute à <Text style={{ fontWeight:'700' }}>{fmtTSLocalHM(defi.firstGameUTC)}</Text> 
          </Text>
          <Text style={{ color:'#555' }}>Barème : Buteur = +1 • Passe = +1</Text>
        </View>
      </View>
    </View>
  );

  return (
    <>
      <Stack.Screen options={{ title: defi.title || (defi.type ? `Défi ${defi.type}x${defi.type}` : 'Résultats') }} />
      <FlatList
        data={leaderboard}
        keyExtractor={(it) => it.uid}
        ListHeaderComponent={header}
        contentContainerStyle={{ padding:16, gap:16 }}
        renderItem={({ item, index }) => {
          const isMe = item.uid === (me || '');
          // Name: ROOT participants/{uid} -> local participation -> uid
          const baseName = namesMap[item.uid] || resolveDisplayNameFromParticipation(item._raw) || item.uid;
          const display = isMe ? 'Toi' : baseName;

          const contribs = contributionItemsForParticipant(item.picks);
          return (
            <View style={{
              padding:12, borderWidth:1, borderRadius:12, backgroundColor:'#fff',
              elevation:2, shadowColor:'#000', shadowOpacity:0.06, shadowRadius:4, shadowOffset:{width:0,height:2},
              marginBottom:8
            }}>
              <View style={{ flexDirection:'row', alignItems:'center', marginBottom:8 }}>
                <Text style={{ width:28, textAlign:'right', marginRight:10, fontWeight:'700' }}>
                  {index + 1}
                </Text>
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
                <Text style={{ color:'#666' }}>Défi non débuté ou pas de points pour l'instant.</Text>
              ) : (
                <View>
                  {contribs.map(row => (
                    <ContributionRow key={row.key} item={row} />
                  ))}
                </View>
              )}
            </View>
          );
        }}
        ListEmptyComponent={() => (
          <Text style={{ color:'#666', marginTop:24, textAlign:'center' }}>
            Aucune participation.
          </Text>
        )}
      />
    </>
  );
}