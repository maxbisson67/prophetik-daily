// app/(tabs)/AccueilScreen.js (index.js)
import React, { useEffect,  useRef, useState } from 'react';
import { View, Text, ActivityIndicator, FlatList, TouchableOpacity, Alert, ScrollView } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { collection, doc, onSnapshot, query, where, orderBy, limit } from 'firebase/firestore';
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
function statusStyle(s) {
  const k = String(s || '').toLowerCase();
  if (k === 'open') return { bg: '#ECFDF5', fg: '#065F46', icon: 'clock-outline', label: 'Ouvert' };
  if (k === 'live') return { bg: '#EFF6FF', fg: '#1D4ED8', icon: 'broadcast', label: 'En cours' };
  if (k === 'awaiting_result') return { bg: '#FFF7ED', fg: '#9A3412', icon: 'timer-sand', label: 'Calcul' };
  if (k === 'completed') return { bg: '#F3F4F6', fg: '#111827', icon: 'check-decagram', label: 'Terminé' };
  return { bg: '#F3F4F6', fg: '#374151', icon: 'help-circle-outline', label: s || '—' };
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

/* ----------------------------- Screen ----------------------------- */
export default function AccueilScreen() {
  const { user } = useAuth();
  const router = useRouter();

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

  // listeners refs
  const subs = useRef({
    me: null,
    byUid: null,
    byPid: null,
    ownerCreated: null,
    ownerOwnerId: null,
  });
  const defisUnsubsRef = useRef(new Map()); // Map<groupId, unsub>

  // mémos clés pour éviter setState inutiles
  const lastGroupIdsKeyRef = useRef('');
  const lastActiveKeyRef = useRef('');

  // Reset states quand user change
useEffect(() => {
  setMeDoc(null);
  setGroupIds([]);
  setActiveDefis([]);
  setError(null);
  setLoadingMe(!!user?.uid);
  setLoadingGroups(!!user?.uid);
  setLoadingDefis(!!user?.uid);

  // clean tous les anciens listeners
  const { me, ...rest } = subs.current;
  Object.values(rest).forEach(un => { try { un?.(); } catch {} });
  for (const [, un] of defisUnsubsRef.current) { try { un(); } catch {} }
  defisUnsubsRef.current.clear();
  try { me?.(); } catch {}
  subs.current = { me: null, byUid: null, byPid: null, ownerCreated: null, ownerOwnerId: null };
}, [user?.uid]);
  /* ---------- 1) Participant (wallet, profil) : listener unique et stable ---------- */
  useEffect(() => {
    if (!user?.uid) { setLoadingMe(false); return; }

    // si déjà abonné, ne rien faire
    if (subs.current.me) { setLoadingMe(false); return; }

    const ref = doc(db, 'participants', user.uid);
    const un = onSnapshot(ref, (snap) => {
      setMeDoc(snap.exists() ? ({ uid: snap.id, ...snap.data() }) : null);
      setLoadingMe(false);
    }, (e) => {
      setError(e);
      setLoadingMe(false);
    });

    subs.current.me = un;

    return () => {
      // on dégagera aussi 'me' au démontage global
      try { subs.current.me?.(); } catch {}
      subs.current.me = null;
    };
  }, [user?.uid]);

  /* ---------- 2) Mes groupes : memberships + ownership (sans toucher 'me') ---------- */
  useEffect(() => {
    setError(null);
    setGroupIds([]);
    if (!user?.uid) { setLoadingGroups(false); return; }
    setLoadingGroups(true);

    // Queries
    const qByUid         = query(collection(db, 'group_memberships'), where('uid', '==', user.uid));
    const qByPid         = query(collection(db, 'group_memberships'), where('participantId', '==', user.uid));
    const qOwnerCreated  = query(collection(db, 'groups'), where('createdBy', '==', user.uid));
    const qOwnerOwnerId  = query(collection(db, 'groups'), where('ownerId', '==', user.uid));

    // state local dans l'effet
    let rowsByUid = [];
    let rowsByPid = [];
    let rowsOwnerCreated = [];
    let rowsOwnerOwnerId = [];

    const recompute = () => {
      const memberships = [...rowsByUid, ...rowsByPid].filter(m =>
        (m?.status ? String(m.status).toLowerCase() === 'open' : (m?.active === true || m?.active === undefined))
      );
      const gidsFromMemberships = memberships.map(m => m.groupId).filter(Boolean);

      const gidsFromOwner = [...rowsOwnerCreated, ...rowsOwnerOwnerId].map(g => g.id).filter(Boolean);

      const union = Array.from(new Set([...gidsFromMemberships, ...gidsFromOwner]));
      const unionSorted = union.sort();
      const key = JSON.stringify(unionSorted);

      if (key !== lastGroupIdsKeyRef.current) {
        lastGroupIdsKeyRef.current = key;
        setGroupIds(unionSorted);
        setLoadingGroups(false);
      }
      // sinon, aucun setState → pas de boucle
    };

    // ❌ ne pas toucher 'me' ici
    const { me: keepMe, ...rest } = subs.current;
    Object.values(rest).forEach(un => { try { un?.(); } catch {} });
    subs.current = { me: keepMe, byUid: null, byPid: null, ownerCreated: null, ownerOwnerId: null };

    subs.current.byUid = onSnapshot(
      qByUid,
      (snap) => { rowsByUid = snap.docs.map(d => ({ id: d.id, ...d.data() })); recompute(); },
      (e) => { setError(e); setLoadingGroups(false); }
    );
    subs.current.byPid = onSnapshot(
      qByPid,
      (snap) => { rowsByPid = snap.docs.map(d => ({ id: d.id, ...d.data() })); recompute(); },
      (e) => { setError(e); setLoadingGroups(false); }
    );
    subs.current.ownerCreated = onSnapshot(
      qOwnerCreated,
      (snap) => { rowsOwnerCreated = snap.docs.map(d => ({ id: d.id, ...d.data() })); recompute(); },
      (e) => { setError(e); setLoadingGroups(false); }
    );
    subs.current.ownerOwnerId = onSnapshot(
      qOwnerOwnerId,
      (snap) => { rowsOwnerOwnerId = snap.docs.map(d => ({ id: d.id, ...d.data() })); recompute(); },
      (e) => { setError(e); setLoadingGroups(false); }
    );

    return () => {
      // cleanup de CET effet, on préserve 'me'
      const { me: keepMe2, ...rest2 } = subs.current;
      Object.values(rest2).forEach(un => { try { un?.(); } catch {} });
      subs.current = { me: keepMe2, byUid: null, byPid: null, ownerCreated: null, ownerOwnerId: null };
    };
  }, [user?.uid]);

  /* ---------- 3) Défis actifs/live par groupId (merge) ---------- */
  useEffect(() => {
    // retire les listeners obsolètes
    for (const [gid, un] of defisUnsubsRef.current) {
      if (!groupIds.includes(gid)) { try { un(); } catch {}; defisUnsubsRef.current.delete(gid); }
    }
    if (!groupIds.length) {
      setActiveDefis([]);
      setLoadingDefis(false);
      return;
    }

    // écoute par groupe
    groupIds.forEach((gid) => {
      if (defisUnsubsRef.current.has(gid)) return;

      // Firestore supporte where('status','in', ['active','live'])
      const qActiveLive = query(
        collection(db, 'defis'),
        where('groupId', '==', gid),
        where('status', 'in', ['open', 'live']),
        // orderBy sur Firestore requiert un index si combiné, on garde un tri côté client
        limit(50)
      );

      const un = onSnapshot(
        qActiveLive,
        (snap) => {
          const rows = snap.docs.map(d => ({ id: d.id, ...d.data() }));

          // merge par groupId puis flatten + tri stable (deadline puis firstGameAtUTC)
          setActiveDefis(prev => {
            const others = prev.filter(x => x.groupId !== gid);
            const merged = [...others, ...rows];
            merged.sort((a, b) => {
              const va = (a.signupDeadline?.toDate?.() ?? a.firstGameAtUTC?.toDate?.() ?? a.createdAt?.toDate?.() ?? 0).valueOf?.() || 0;
              const vb = (b.signupDeadline?.toDate?.() ?? b.firstGameAtUTC?.toDate?.() ?? b.createdAt?.toDate?.() ?? 0).valueOf?.() || 0;
              return va - vb;
            });

            // anti-micro “shuffle”
            const k = JSON.stringify(
              merged.map(d => ({
                id: d.id,
                status: d.status,
                pot: Number(d.pot || 0),
                sd: d.signupDeadline?.seconds,
                fg: d.firstGameAtUTC?.seconds
              }))
            );
            if (k !== lastActiveKeyRef.current) {
              lastActiveKeyRef.current = k;
              return merged;
            }
            return prev; // pas de changement matériel
          });

          setLoadingDefis(false);
        },
        (e) => {
          setError(e);
          setLoadingDefis(false);
        }
      );

      defisUnsubsRef.current.set(gid, un);
    });

    return () => { /* nettoyé ailleurs au démontage global */ };
  }, [groupIds]);

  /* ---------- Cleanup global au démontage écran ---------- */
  useEffect(() => {
    return () => {
      // tous les listeners groupes/defis
      const { me, ...rest } = subs.current;
      Object.values(rest).forEach(un => { try { un?.(); } catch {} });
      for (const [, un] of defisUnsubsRef.current) { try { un(); } catch {} }
      defisUnsubsRef.current.clear();

      // et on retire aussi 'me' en quittant l’écran
      try { me?.(); } catch {}
      subs.current = { me: null, byUid: null, byPid: null, ownerCreated: null, ownerOwnerId: null };
    };
  }, []);

  /* ----------------------------- UI ----------------------------- */
  if (!user) {
    return (
      <>
        <Stack.Screen options={{ title: 'Accueil' }} />
        <View style={{ flex:1, alignItems:'center', justifyContent:'center', padding:24 }}>
          <Text>Connecte-toi pour accéder à l’accueil.</Text>
          <TouchableOpacity
            onPress={() => router.push('/(auth)/sign-in')}
            style={{ marginTop:12, backgroundColor:'#111', paddingHorizontal:16, paddingVertical:10, borderRadius:10 }}
          >
            <Text style={{ color:'#fff', fontWeight:'700' }}>Se connecter</Text>
          </TouchableOpacity>
        </View>
      </>
    );
  }

  if (error) {
    return (
      <>
        <Stack.Screen options={{ title: 'Accueil' }} />
        <View style={{ flex:1, alignItems:'center', justifyContent:'center', padding:16 }}>
          <Text>Erreur : {String(error?.message || error)}</Text>
        </View>
      </>
    );
  }

  const credits =
    typeof meDoc?.credits === 'number'
      ? meDoc.credits
      : typeof meDoc?.credits?.balance === 'number'
      ? meDoc.credits.balance
      : typeof meDoc?.balance === 'number'
      ? meDoc.balance
      : 0;

  return (
    <>
      <Stack.Screen options={{ title: 'Accueil' }} />
      <ScrollView contentContainerStyle={{ padding:16, gap:16 }}>
        {/* Carte profil / crédits */}
        {/* Carte engagement */}
<View style={{
  padding:14, borderWidth:1, borderRadius:12, backgroundColor:'#fff',
  elevation:3, shadowColor:'#000', shadowOpacity:0.08, shadowRadius:6, shadowOffset:{width:0,height:3}
}}>
          {/* Ligne 1 : Avatar + nom + crédits */}
          <View style={{ flexDirection:'row', alignItems:'center', justifyContent:'space-between' }}>
            <View style={{ flexDirection:'row', alignItems:'center', gap:12 }}>
              {/* Avatar (placeholder si pas d’URL) */}
              <View style={{ width:44, height:44, borderRadius:22, backgroundColor:'#f3f4f6', alignItems:'center', justifyContent:'center' }}>
                <Text style={{ fontWeight:'800' }}>
                  {(meDoc?.displayName?.[0] || meDoc?.name?.[0] || '🙂').toUpperCase()}
                </Text>
              </View>
              <View>
                <Text style={{ fontWeight:'800', fontSize:16 }}>
                  Bonjour {meDoc?.displayName || meDoc?.name || '—'}
                </Text>
                <Text style={{ color:'#6b7280' }}>Prêt à prédire juste ?</Text>
              </View>
            </View>

            <View style={{ alignItems:'flex-end' }}>
              <Text style={{ fontSize:12, color:'#6b7280' }}>Crédits</Text>
              <Text style={{ fontWeight:'900', fontSize:20 }}>{credits}</Text>
            </View>
          </View>

          {/* Ligne 2 : Streak + Prochain badge */}
          <View style={{ marginTop:12, gap:8 }}>
            {/* Streak (TODO: remplace 3 par ta valeur & 7 par l’objectif hebdo) */}
            <View>
              <Text style={{ fontWeight:'700' }}>Série en cours · 3 jours</Text>
              <View style={{ height:8, borderRadius:99, backgroundColor:'#f3f4f6', marginTop:6 }}>
                <View style={{ width:`${(3/7)*100}%`, height:8, borderRadius:99, backgroundColor:'#111' }} />
              </View>
              <Text style={{ color:'#6b7280', fontSize:12, marginTop:4 }}>Objectif : 7 jours d’affilée</Text>
            </View>

            {/* Prochain badge (TODO: remplace 7/10 par ton calcul réel) */}
            <View>
              <Text style={{ fontWeight:'700' }}>Badge à venir · Junior</Text>
              <View style={{ height:8, borderRadius:99, backgroundColor:'#f3f4f6', marginTop:6 }}>
                <View style={{ width:`${(7/10)*100}%`, height:8, borderRadius:99, backgroundColor:'#111' }} />
              </View>
              <Text style={{ color:'#6b7280', fontSize:12, marginTop:4 }}>7/10 participations</Text>
            </View>
          </View>

          {/* Ligne 3 : Infos du jour */}
          <View style={{ marginTop:12, flexDirection:'row', gap:12 }}>
            <View style={{ flex:1, padding:10, borderRadius:10, backgroundColor:'#F5F3FF', borderWidth:1, borderColor:'#EDE9FE' }}>
              <Text style={{ fontSize:12, color:'#6b7280' }}>Défis actifs</Text>
              <Text style={{ fontWeight:'800', fontSize:18 }}>
                {activeDefis.length}
              </Text>
            </View>
            <View style={{ flex:1, padding:10, borderRadius:10, backgroundColor:'#ECFEFF', borderWidth:1, borderColor:'#CFFAFE' }}>
              <Text style={{ fontSize:12, color:'#6b7280' }}>Cagnotte totale</Text>
              <Text style={{ fontWeight:'800', fontSize:18 }}>
                {activeDefis.reduce((sum, d) => sum + Number(d.pot || 0), 0)}
              </Text>
            </View>
          </View>

          {/* Ligne 4 : Rappel deadline (si présent) */}
          {(() => {
            // TODO: calcule la plus proche deadline des défis actifs
            const next = [...activeDefis]
              .map(d => d.signupDeadline?.toDate?.() || null)
              .filter(Boolean)
              .sort((a,b) => a - b)[0];
            if (!next) return null;
            const hh = String(next.getHours()).padStart(2,'0');
            const mm = String(next.getMinutes()).padStart(2,'0');
            return (
              <View style={{ marginTop:12, padding:10, borderRadius:10, backgroundColor:'#FFFBEB', borderWidth:1, borderColor:'#FEF3C7' }}>
                <Text style={{ fontWeight:'700' }}>Inscriptions : {hh}:{mm}</Text>
                <Text style={{ color:'#92400E', marginTop:2, fontSize:12 }}>
                  Pense à valider tes choix avant la fermeture.
                </Text>
              </View>
            );
          })()}

          {/* Ligne 5 : Actions rapides */}
          <View style={{ marginTop:12, flexDirection:'row', gap:10 }}>
            <TouchableOpacity
              onPress={() => {/* ex: daily bonus */}}
              style={{ flex:1, backgroundColor:'#111', padding:12, borderRadius:10, alignItems:'center' }}
            >
              <Text style={{ color:'#fff', fontWeight:'800' }}>Bonus quotidien</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {/* boutique skins/avatars */}}
              style={{ flex:1, borderWidth:1, borderColor:'#111', padding:12, borderRadius:10, alignItems:'center' }}
            >
              <Text style={{ fontWeight:'800' }}>Boutique</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Mes défis du jour : actifs/live */}
        <View style={{ padding:12, borderWidth:1, borderRadius:12, backgroundColor:'#fff',
          elevation:3, shadowColor:'#000', shadowOpacity:0.08, shadowRadius:6, shadowOffset:{width:0,height:3} }}>
          <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
            <Text style={{ fontWeight:'800', fontSize:16 }}>Mes défis du jour</Text>
            {loadingGroups || loadingDefis ? <ActivityIndicator /> : null}
          </View>

          {(!groupIds.length && !loadingGroups) ? (
            <Text style={{ color:'#666' }}>Tu n’as pas encore de groupes.</Text>
          ) : (activeDefis.length === 0 && !loadingDefis) ? (
            <Text style={{ color:'#666' }}>Aucun défi actif pour le moment.</Text>
          ) : (
            <View>
              {activeDefis.map((item) => {
                const st = statusStyle(item.status);
                return (
                  <TouchableOpacity
                    key={item.id}
                    onPress={() => router.push(`/defis/${item.id}`)}
                    style={{ paddingVertical:10, borderBottomWidth:1, borderColor:'#f0f0f0' }}
                  >
                    <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'center' }}>
                      <Text style={{ fontWeight:'700' }}>
                        {item.title || (item.type ? `Défi ${item.type}x${item.type}` : 'Défi')}
                      </Text>
                      <Chip bg={st.bg} fg={st.fg} icon={st.icon} label={st.label} />
                    </View>
                    <View style={{ marginTop:4, flexDirection:'row', alignItems:'center', gap:12 }}>
                      <View style={{ flexDirection:'row', alignItems:'center', gap:6 }}>
                        <MaterialCommunityIcons name="clock-outline" size={16} color="#555" />
                        <Text style={{ color:'#555' }}>
                          {item.signupDeadline ? `Limite ${fmtTSLocalHM(item.signupDeadline)}` :
                          item.firstGameAtUTC ? `Débute ${fmtTSLocalHM(item.firstGameAtUTC)}` : '—'}
                        </Text>
                      </View>
                      <View style={{ flexDirection:'row', alignItems:'center', gap:6 }}>
                        <MaterialCommunityIcons name="treasure-chest" size={16} color="#111" />
                        <Text style={{ fontWeight:'700' }}>{Number(item.pot || 0)}</Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>

        {/* CTA rapide */}
        <View style={{ flexDirection:'row', gap:10 }}>
          <TouchableOpacity
            onPress={() => router.push('/(tabs)/ChallengesScreen')}
            style={{ flex:1, backgroundColor:'#111', padding:14, borderRadius:12, alignItems:'center' }}
          >
            <Text style={{ color:'#fff', fontWeight:'800' }}>Voir tous les défis</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => router.push('/(tabs)/GroupsScreen')}
            style={{ flex:1, borderWidth:1, borderColor:'#111', padding:14, borderRadius:12, alignItems:'center' }}
          >
            <Text style={{ fontWeight:'800' }}>Mes groupes</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </>
  );
}