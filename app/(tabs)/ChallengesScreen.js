// app/(tabs)/ChallengesScreen.js
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, ActivityIndicator, FlatList, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { collection, onSnapshot, query, where, doc } from 'firebase/firestore';
import { db } from '@src/lib/firebase';
import { useAuth } from '@src/auth/AuthProvider';

function fmtTSLocalHM(v) {
  try {
    const d = v?.toDate?.() ? v.toDate() : (v instanceof Date ? v : v ? new Date(v) : null);
    if (!d) return '—';
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
  } catch { return '—'; }
}

function tsToMillis(v) {
  const d = v?.toDate?.() ? v.toDate() : (v instanceof Date ? v : v ? new Date(v) : null);
  return d ? d.getTime() : 0;
}

export default function ChallengesScreen() {
  const { user } = useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [groupIds, setGroupIds] = useState([]);   // union memberships + ownership
  const [defis, setDefis] = useState([]);         // défis actifs
  const [error, setError] = useState(null);
  const [groupsMap, setGroupsMap] = useState({}); // { [groupId]: {id, name, ...} }

  // refs unsub
  const subs = useRef({
    byUid: null,
    byPid: null,
    byOwnerCreated: null,
    byOwnerOwnerId: null,
  });
  const defisUnsubsRef = useRef(new Map());   // Map<groupId, unsub>
  const groupsUnsubsRef = useRef(new Map());  // Map<groupId, unsub>

  // 1) Récupère mes groupes : memberships (uid|participantId) + ownership (createdBy|ownerId)
  useEffect(() => {
    setError(null);
    setDefis([]);
    setGroupIds([]);
    if (!user?.uid) { setLoading(false); return; }
    setLoading(true);

    // clean previous
    Object.values(subs.current).forEach(un => { try { un?.(); } catch {} });
    subs.current = { byUid: null, byPid: null, byOwnerCreated: null, byOwnerOwnerId: null };

    const qByUid = query(collection(db, 'group_memberships'), where('uid', '==', user.uid));
    const qByPid = query(collection(db, 'group_memberships'), where('participantId', '==', user.uid));

    const qOwnerCreated = query(collection(db, 'groups'), where('createdBy', '==', user.uid));
    const qOwnerOwnerId = query(collection(db, 'groups'), where('ownerId', '==', user.uid));

    let rowsByUid = [];
    let rowsByPid = [];
    let rowsOwnerCreated = [];
    let rowsOwnerOwnerId = [];

    const recompute = () => {
      const memberships = [...rowsByUid, ...rowsByPid].filter(m =>
        (m?.status ? String(m.status).toLowerCase() === 'active' : (m?.active === true || m?.active === undefined))
      );
      const gidsFromMemberships = memberships.map(m => m.groupId).filter(Boolean);

      const gidsFromOwner = [...rowsOwnerCreated, ...rowsOwnerOwnerId].map(g => g.id).filter(Boolean);

      const union = Array.from(new Set([...gidsFromMemberships, ...gidsFromOwner]));
      setGroupIds(union);
      setLoading(false);
    };

    subs.current.byUid = onSnapshot(
      qByUid,
      (snap) => { rowsByUid = snap.docs.map(d => ({ id: d.id, ...d.data() })); recompute(); },
      (e) => { setError(e); setLoading(false); }
    );

    subs.current.byPid = onSnapshot(
      qByPid,
      (snap) => { rowsByPid = snap.docs.map(d => ({ id: d.id, ...d.data() })); recompute(); },
      (e) => { setError(e); setLoading(false); }
    );

    subs.current.byOwnerCreated = onSnapshot(
      qOwnerCreated,
      (snap) => { rowsOwnerCreated = snap.docs.map(d => ({ id: d.id, ...d.data() })); recompute(); },
      (e) => { setError(e); setLoading(false); }
    );

    subs.current.byOwnerOwnerId = onSnapshot(
      qOwnerOwnerId,
      (snap) => { rowsOwnerOwnerId = snap.docs.map(d => ({ id: d.id, ...d.data() })); recompute(); },
      (e) => { setError(e); setLoading(false); }
    );

    return () => {
      Object.values(subs.current).forEach(un => { try { un?.(); } catch {} });
      subs.current = { byUid: null, byPid: null, byOwnerCreated: null, byOwnerOwnerId: null };
    };
  }, [user?.uid]);

  // 2) Pour chaque groupId => écouter ses défis actifs
  useEffect(() => {
    // retire obsolètes
    for (const [gid, un] of defisUnsubsRef.current) {
      if (!groupIds.includes(gid)) { try { un(); } catch {}; defisUnsubsRef.current.delete(gid); }
    }

    for (const gid of groupIds) {
      if (defisUnsubsRef.current.has(gid)) continue;

      const qActive = query(
        collection(db, 'defis'),
        where('groupId', '==', gid),
        where('status', '==', 'active')
      );

      const un = onSnapshot(
        qActive,
        (snap) => {
          const rows = snap.docs.map(d => ({ id: d.id, ...d.data() }));
          setDefis(prev => {
            // remplace les défis pour ce groupe
            const others = prev.filter(x => x.groupId !== gid);
            const merged = [...others, ...rows].sort((a, b) => {
              // tri par deadline, puis 1er match, puis création
              const va = tsToMillis(a.signupDeadline) || tsToMillis(a.firstGameUTC) || tsToMillis(a.createdAt);
              const vb = tsToMillis(b.signupDeadline) || tsToMillis(b.firstGameUTC) || tsToMillis(b.createdAt);
              return va - vb;
            });
            return merged;
          });
        },
        (e) => setError(e)
      );

      defisUnsubsRef.current.set(gid, un);
    }

    return () => { /* cleanup handled on unmount */ };
  }, [groupIds]);

  // 3) Charger les noms des groupes pour les défis affichés
  useEffect(() => {
    const neededIds = Array.from(new Set(defis.map(d => d.groupId).filter(Boolean)));

    // unsubscribe ceux qui ne sont plus nécessaires
    for (const [gid, un] of groupsUnsubsRef.current) {
      if (!neededIds.includes(gid)) { try { un(); } catch {}; groupsUnsubsRef.current.delete(gid); }
    }

    // subscribe aux nouveaux
    for (const gid of neededIds) {
      if (groupsUnsubsRef.current.has(gid)) continue;
      const ref = doc(db, 'groups', gid);
      const un = onSnapshot(ref, snap => {
        if (snap.exists()) {
          setGroupsMap(prev => ({ ...prev, [gid]: { id: gid, ...snap.data() } }));
        }
      });
      groupsUnsubsRef.current.set(gid, un);
    }

    return () => { /* cleanup on unmount below */ };
  }, [defis]);

  // 4) cleanup global
  useEffect(() => {
    return () => {
      Object.values(subs.current).forEach(un => { try { un?.(); } catch {} });
      for (const [, un] of defisUnsubsRef.current) { try { un(); } catch {} }
      defisUnsubsRef.current.clear();
      for (const [, un] of groupsUnsubsRef.current) { try { un(); } catch {} }
      groupsUnsubsRef.current.clear();
    };
  }, []);

  // UI
  if (!user) {
    return (
      <View style={{ flex:1, alignItems:'center', justifyContent:'center', padding:24 }}>
        <Text>Connecte-toi pour voir tes défis.</Text>
        <TouchableOpacity
          onPress={() => router.push('/(auth)/sign-in')}
          style={{ marginTop:12, backgroundColor:'#111', paddingHorizontal:16, paddingVertical:10, borderRadius:10 }}
        >
          <Text style={{ color:'#fff', fontWeight:'700' }}>Se connecter</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={{ flex:1, alignItems:'center', justifyContent:'center' }}>
        <ActivityIndicator />
        <Text style={{ marginTop:8 }}>Chargement des défis…</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={{ flex:1, alignItems:'center', justifyContent:'center', padding:16 }}>
        <Text>Erreur : {String(error?.message || error)}</Text>
      </View>
    );
  }

  return (
    <FlatList
      contentContainerStyle={{ padding:16 }}
      data={defis}
      keyExtractor={(item) => item.id}
      ListHeaderComponent={() => (
        <Text style={{ fontSize:22, fontWeight:'700', marginBottom:8 }}>Défis actifs</Text>
      )}
      renderItem={({ item }) => {
        const groupName = groupsMap[item.groupId]?.name || item.groupId;
        const title = item.title || (item.type ? `Défi ${item.type}x${item.type}` : 'Défi');
        return (
          <TouchableOpacity
            onPress={() => router.push(`/defis/${item.id}`)}
            style={{ marginBottom:12, padding:12, borderWidth:1, borderRadius:12, backgroundColor:'#fff',elevation: 3, }}
          >
            <Text style={{ fontWeight:'700', fontSize:16 }}>
              {groupName} – {title}
            </Text>

            <View style={{ marginTop:6 }}>
              <Text>Date NHL: {item.gameDate || '—'}</Text>
              <Text>Limite inscription (local): {fmtTSLocalHM(item.signupDeadline)}</Text>
              <Text>Premier match (local): {fmtTSLocalHM(item.firstGameUTC)}</Text>
              <Text>Coût participation: {item.participationCost ?? item.type} crédit(s)</Text>
            </View>
          </TouchableOpacity>
        );
      }}
      ListEmptyComponent={() => (
        <Text style={{ color:'#666', marginTop:24, textAlign:'center' }}>
          Aucun défi actif pour tes groupes.
        </Text>
      )}
    />
  );
}