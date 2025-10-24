// app/(tabs)/AccueilScreen.js
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, ActivityIndicator, TouchableOpacity, ScrollView, Image, Modal, Pressable } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { collection, doc, onSnapshot, query, where, limit } from 'firebase/firestore';
import { db } from '@src/lib/firebase';
import { useAuth } from '@src/auth/AuthProvider';
import { MaterialCommunityIcons, Feather } from '@expo/vector-icons';

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

  // ---- UI: group picker modal ----
  const [showGroupPicker, setShowGroupPicker] = useState(false);
  const [groupsMeta, setGroupsMeta] = useState({}); // id -> {name}
  const groupMetaUnsubs = useRef(new Map()); // id -> unsub

  // listeners refs
  const subs = useRef({
    me: null,
    byUid: null,
    byPid: null,
    ownerCreated: null,
    ownerOwnerId: null,
  });
  const defisUnsubsRef = useRef(new Map()); // Map<groupId, unsub>

  // mémos clés
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
    setShowGroupPicker(false);

    const { me, ...rest } = subs.current;
    Object.values(rest).forEach(un => { try { un?.(); } catch {} });
    for (const [, un] of defisUnsubsRef.current) { try { un(); } catch {} }
    defisUnsubsRef.current.clear();
    try { me?.(); } catch {}
    subs.current = { me: null, byUid: null, byPid: null, ownerCreated: null, ownerOwnerId: null };

    // clear group meta listeners
    for (const [, un] of groupMetaUnsubs.current) { try { un(); } catch {} }
    groupMetaUnsubs.current.clear();
    setGroupsMeta({});
  }, [user?.uid]);

  /* ---------- 1) Participant (wallet, profil) ---------- */
  useEffect(() => {
    if (!user?.uid) { setLoadingMe(false); return; }
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
      try { subs.current.me?.(); } catch {}
      subs.current.me = null;
    };
  }, [user?.uid]);

  /* ---------- 2) Mes groupes : memberships + ownership ---------- */
  useEffect(() => {
    setError(null);
    setGroupIds([]);
    if (!user?.uid) { setLoadingGroups(false); return; }
    setLoadingGroups(true);

    const qByUid         = query(collection(db, 'group_memberships'), where('uid', '==', user.uid));
    const qByPid         = query(collection(db, 'group_memberships'), where('participantId', '==', user.uid));
    const qOwnerCreated  = query(collection(db, 'groups'), where('createdBy', '==', user.uid));
    const qOwnerOwnerId  = query(collection(db, 'groups'), where('ownerId', '==', user.uid));

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
    };

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
      const { me: keepMe2, ...rest2 } = subs.current;
      Object.values(rest2).forEach(un => { try { un?.(); } catch {} });
      subs.current = { me: keepMe2, byUid: null, byPid: null, ownerCreated: null, ownerOwnerId: null };
    };
  }, [user?.uid]);

  /* ---------- 2b) Charger les métadonnées des groupes pour le sélecteur ---------- */
  useEffect(() => {
    // Retire les listeners pour les groupes qui ne sont plus présents
    for (const [gid, un] of groupMetaUnsubs.current) {
      if (!groupIds.includes(gid)) { try { un(); } catch {}; groupMetaUnsubs.current.delete(gid); }
    }
    // Ajoute un listener par groupe pour récupérer le nom
    groupIds.forEach((gid) => {
      if (groupMetaUnsubs.current.has(gid)) return;
      const ref = doc(db, 'groups', gid);
      const un = onSnapshot(ref, (snap) => {
        setGroupsMeta(prev => ({ ...prev, [gid]: { name: snap.data()?.name || snap.data()?.title || gid } }));
      }, () => {});
      groupMetaUnsubs.current.set(gid, un);
    });
    return () => { /* cleaned elsewhere */ };
  }, [groupIds]);

  /* ---------- 3) Défis actifs/live par groupId (merge) ---------- */
  useEffect(() => {
    for (const [gid, un] of defisUnsubsRef.current) {
      if (!groupIds.includes(gid)) { try { un(); } catch {}; defisUnsubsRef.current.delete(gid); }
    }
    if (!groupIds.length) {
      setActiveDefis([]);
      setLoadingDefis(false);
      return;
    }

    groupIds.forEach((gid) => {
      if (defisUnsubsRef.current.has(gid)) return;

      const qActiveLive = query(
        collection(db, 'defis'),
        where('groupId', '==', gid),
        where('status', 'in', ['open', 'live']),
        limit(50)
      );

      const un = onSnapshot(
        qActiveLive,
        (snap) => {
          const rows = snap.docs.map(d => ({ id: d.id, ...d.data() }));
          setActiveDefis(prev => {
            const others = prev.filter(x => x.groupId !== gid);
            const merged = [...others, ...rows];
            merged.sort((a, b) => {
              const va = (a.signupDeadline?.toDate?.() ?? a.firstGameAtUTC?.toDate?.() ?? a.createdAt?.toDate?.() ?? 0).valueOf?.() || 0;
              const vb = (b.signupDeadline?.toDate?.() ?? b.firstGameAtUTC?.toDate?.() ?? b.createdAt?.toDate?.() ?? 0).valueOf?.() || 0;
              return va - vb;
            });
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
            return prev;
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

    return () => { /* nettoyé ailleurs */ };
  }, [groupIds]);

  /* ---------- Cleanup global ---------- */
  useEffect(() => {
    return () => {
      const { me, ...rest } = subs.current;
      Object.values(rest).forEach(un => { try { un(); } catch {} });
      for (const [, un] of defisUnsubsRef.current) { try { un(); } catch {} }
      defisUnsubsRef.current.clear();
      try { me?.(); } catch {}
      subs.current = { me: null, byUid: null, byPid: null, ownerCreated: null, ownerOwnerId: null };

      for (const [, un] of groupMetaUnsubs.current) { try { un(); } catch {} }
      groupMetaUnsubs.current.clear();
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
            onPress={() => router.push('/(auth)/auth-choice')}
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

  const st  = meDoc?.stats || {};
  const ach = meDoc?.achievements || {};
  const streak = Number(st.currentStreakDays ?? 0);
  const totalParticipations = Number(st.totalParticipations ?? 0);
  const doneFirstDefi   = !!ach.firstDefiCreated;
  const doneFirstGroup  = !!ach.firstGroupCreated;
  const doneFiveAny     = !!ach.fiveParticipationsAny;
  const doneStreak3     = !!ach.threeConsecutiveDays;
  const pct = (n, d) => Math.max(0, Math.min(100, Math.round((Number(n || 0) / Number(d || 1)) * 100)));
  const pctFive   = pct(totalParticipations, 5);
  const pctStreak = pct(streak, 3);

  const RED = '#ef4444';
  const RED_LIGHT = '#fecaca';
  const RED_DARK = '#b91c1c';

  const avatarUrl =
    meDoc?.photoURL ??
    meDoc?.photoUrl ??
    meDoc?.avatarUrl ??
    meDoc?.avatar?.url ??
    user?.photoURL ??
    null;

  // Action: créer un défi (avec logique de sélection)
  function onPressCreateDefi() {
    const fav = meDoc?.favoriteGroupId;
    if (fav) {
      router.push({ pathname: `/groups/${fav}`, params: { openCreate: '1' } });
      return;
    }
    if (groupIds.length === 1) {
      const gid = groupIds[0];
      router.push({ pathname: `/groups/${gid}`, params: { openCreate: '1' } });
      return;
    }
    setShowGroupPicker(true);
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Accueil' }} />
      <ScrollView contentContainerStyle={{ padding:16, gap:16 }}>
        {/* === Header profil (Avatar + nom + crédits + Créer un défi) === */}
        <View style={{
          padding:14,
          borderWidth:1,
          borderRadius:12,
          backgroundColor:'#fff',
          borderColor: RED_LIGHT,
          elevation:4,
          shadowColor: RED,
          shadowOpacity:0.18,
          shadowRadius:8,
          shadowOffset:{width:0,height:4}
        }}>
          {/* Avatar agrandi + edit */}
          <View style={{ alignItems:'center', marginBottom:12 }}>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Modifier l'avatar"
              onPress={() => router.push('/avatars/AvatarsScreen')}
              activeOpacity={0.8}
            >
              <Image
                source={avatarUrl ? { uri: avatarUrl } : require('@src/assets/avatar-placeholder.png')}
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
                  backgroundColor: '#fff',
                  borderRadius: 12,
                  padding: 4,
                  shadowColor: '#000',
                  shadowOpacity: 0.15,
                  shadowRadius: 3,
                  shadowOffset: { width: 0, height: 1 },
                  elevation: 3,
                }}
              >
                <Feather name="edit-2" size={14} color="#111" />
              </View>
            </TouchableOpacity>
            <Text style={{ fontWeight:'800', fontSize:16, marginTop:8 }}>
              Bonjour {meDoc?.displayName || meDoc?.name || '—'}
            </Text>
          </View>

          {/* Crédits */}
          <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'center' }}>
            <View />
            <View style={{ alignItems:'flex-end', paddingRight:6 }}>
              <Text style={{ fontSize:12, color:'#6b7280' }}>Crédits</Text>
              <Text style={{ fontWeight:'900', fontSize:20 }}>{credits}</Text>
            </View>
          </View>

          {/* Bouton "Créer un défi" */}
          <View style={{ marginTop:12 }}>
            <TouchableOpacity
              onPress={onPressCreateDefi}
              style={{
                backgroundColor: RED_DARK,
                paddingVertical: 12,
                borderRadius: 10,
                alignItems: 'center',
                elevation: 2
              }}
            >
              <Text style={{ color:'#fff', fontWeight:'800' }}>⚡ Créer un défi</Text>
            </TouchableOpacity>
          </View>
        </View>

           {/* === Stats rapides (après Mes défis) === */}
        <View style={{ padding:12, borderWidth:1, borderRadius:12, backgroundColor:'#fff',
          elevation:3, shadowColor:'#000', shadowOpacity:0.08, shadowRadius:6, shadowOffset:{width:0,height:3} }}>
          <View style={{ flexDirection:'row', gap:12 }}>
            <View style={{ flex:1, padding:10, borderRadius:10, backgroundColor:'#FEE2E2', borderWidth:1, borderColor:'#FECACA' }}>
              <Text style={{ fontSize:12, color:'#991B1B' }}>Défis actifs</Text>
              <Text style={{ fontWeight:'800', fontSize:18, color:'#7F1D1D' }}>
                {activeDefis.length}
              </Text>
            </View>
            <View style={{ flex:1, padding:10, borderRadius:10, backgroundColor:'#FFE4E6', borderWidth:1, borderColor:'#FECDD3' }}>
              <Text style={{ fontSize:12, color:'#9F1239' }}>Cagnotte totale</Text>
              <Text style={{ fontWeight:'800', fontSize:18, color:'#881337' }}>
                {activeDefis.reduce((sum, d) => sum + Number(d.pot || 0), 0)}
              </Text>
            </View>
          </View>
        </View>

        {/* === Mes défis du jour : actifs/live === */}
        <View style={{ padding:12, borderWidth:1, borderRadius:12, backgroundColor:'#fff',
          elevation:3, shadowColor:'#000', shadowOpacity:0.08, shadowRadius:6, shadowOffset:{width:0,height:3} }}>
          <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
            <Text style={{ fontWeight:'800', fontSize:16 }}>Mes défis du jour</Text>
            {(loadingGroups || loadingDefis) ? <ActivityIndicator /> : null}
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

     

        {/* === Gamification (à la fin) === */}
        <View style={{ padding:14, borderWidth:1, borderRadius:12, backgroundColor:'#fff',
          borderColor:'#eee', elevation:3, shadowColor:'#000', shadowOpacity:0.08, shadowRadius:6, shadowOffset:{width:0,height:3} }}>
          <Text style={{ fontWeight:'800', fontSize:16, marginBottom:8 }}>Crédits à gagner</Text>

          {/* 1 — Premier défi créé */}
          <View style={{ padding:10, borderRadius:10, borderWidth:1, borderColor: doneFirstDefi ? '#DCFCE7' : '#E5E7EB', backgroundColor: doneFirstDefi ? '#F0FDF4' : '#FFF', marginBottom:10 }}>
            <Text style={{ fontWeight:'700' }}>Premier défi créé {doneFirstDefi ? '✅' : '(+1 crédit)'}</Text>
            {!doneFirstDefi && (
              <View style={{ flexDirection:'row', justifyContent:'space-between', marginTop:6 }}>
                <Text style={{ color:'#6b7280', fontSize:12 }}>Crée ton premier défi</Text>
                <TouchableOpacity
                  onPress={onPressCreateDefi}
                  style={{ paddingHorizontal:10, paddingVertical:6, borderRadius:8, backgroundColor:RED_DARK }}
                >
                  <Text style={{ color:'#fff', fontWeight:'700' }}>Créer</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* 2 — Premier groupe créé */}
          <View style={{ padding:10, borderRadius:10, borderWidth:1, borderColor: doneFirstGroup ? '#DCFCE7' : '#E5E7EB', backgroundColor: doneFirstGroup ? '#F0FDF4' : '#FFF', marginBottom:10 }}>
            <Text style={{ fontWeight:'700' }}>Premier groupe créé {doneFirstGroup ? '✅' : '(+1 crédit)'}</Text>
            {!doneFirstGroup && (
              <View style={{ flexDirection:'row', justifyContent:'space-between', marginTop:6 }}>
                <Text style={{ color:'#6b7280', fontSize:12 }}>Crée ton premier groupe</Text>
                <TouchableOpacity
                  onPress={() => router.push('/(drawer)/(tabs)/GroupsScreen')}
                  style={{ paddingHorizontal:10, paddingVertical:6, borderRadius:8, backgroundColor:RED_DARK }}
                >
                  <Text style={{ color:'#fff', fontWeight:'700' }}>Créer</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* 3 — 5 participations */}
          <View style={{ padding:10, borderRadius:10, borderWidth:1, borderColor:'#E5E7EB', backgroundColor:'#FFF', marginBottom:10 }}>
            <Text style={{ fontWeight:'700' }}>
              Participer à 5 défis {doneFiveAny ? '✅' : '(+2 crédits)'}
            </Text>
            <Text style={{ color:'#6b7280', fontSize:12, marginTop:4 }}>
              Progression : {Math.min(totalParticipations,5)}/5
            </Text>
            <View style={{ height:8, borderRadius:99, backgroundColor:'#f3f4f6', marginTop:6 }}>
              <View style={{ width:`${pctFive}%`, height:8, borderRadius:99, backgroundColor:RED }} />
            </View>
          </View>

          {/* 4 — 3 jours consécutifs */}
          <View style={{ padding:10, borderRadius:10, borderWidth:1, borderColor:'#E5E7EB', backgroundColor:'#FFF' }}>
            <Text style={{ fontWeight:'700' }}>
              3 jours consécutifs {doneStreak3 ? '✅' : '(+2 crédits)'}
            </Text>
            <Text style={{ color:'#6b7280', fontSize:12, marginTop:4 }}>
              Série : {Math.min(streak,3)}/3
            </Text>
            <View style={{ height:8, borderRadius:99, backgroundColor:'#f3f4f6', marginTop:6 }}>
              <View style={{ width:`${pctStreak}%`, height:8, borderRadius:99, backgroundColor:RED }} />
            </View>
          </View>
        </View>

        {/* Modal sélection de groupe */}
        <Modal visible={showGroupPicker} transparent animationType="fade" onRequestClose={() => setShowGroupPicker(false)}>
          <View style={{ flex:1, backgroundColor:'rgba(0,0,0,0.4)', justifyContent:'center', padding:24 }}>
            <View style={{ backgroundColor:'#fff', borderRadius:12, padding:16 }}>
              <Text style={{ fontWeight:'800', fontSize:16, marginBottom:8 }}>Choisir un groupe</Text>
              {groupIds.length === 0 ? (
                <Text style={{ color:'#6b7280' }}>Aucun groupe disponible.</Text>
              ) : (
                groupIds.map((gid) => (
                  <Pressable
                    key={gid}
                    onPress={() => {
                      setShowGroupPicker(false);
                      router.push({ pathname: `/groups/${gid}`, params: { openCreate: '1' } });
                    }}
                    style={({ pressed }) => ({
                      paddingVertical:12,
                      borderBottomWidth:1,
                      borderColor:'#eee',
                      opacity: pressed ? 0.6 : 1
                    })}
                  >
                    <Text style={{ fontWeight:'600' }}>{groupsMeta[gid]?.name || gid}</Text>
                  </Pressable>
                ))
              )}
              <TouchableOpacity onPress={() => setShowGroupPicker(false)} style={{ marginTop:10, alignSelf:'flex-end' }}>
                <Text style={{ color:'#ef4444', fontWeight:'700' }}>Annuler</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </ScrollView>
    </>
  );
}