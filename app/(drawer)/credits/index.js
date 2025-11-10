// app/(drawer)/credits/index.js
import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, ActivityIndicator, FlatList } from 'react-native';
import { Stack } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
// Safe auth
import { useAuth } from '@src/auth/SafeAuthProvider';

import { db } from '@src/lib/firebase';
import {
  doc, onSnapshot, collection, query, where, orderBy, limit,
  getDoc, getDocs
} from 'firebase/firestore';

/* ---------- Helpers ---------- */

function fmtDateTime(ts) {
  try {
    const d =
      ts?.toDate?.() ??
      (ts instanceof Date ? ts : ts ? new Date(ts) : null);
    if (!d) return '';
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch {
    return '';
  }
}

const TYPE_META = {
  defi_entry:       { label: 'Inscription à un défi', icon: 'ticket-confirmation-outline', tint: 'out' },
  defi_payout:      { label: 'Gain de défi',           icon: 'trophy-outline',               tint: 'in'  },
  topup_free:       { label: 'Bonus gratuit',          icon: 'gift-outline',                 tint: 'in'  },
  topup_purchase:   { label: 'Achat de crédits',       icon: 'credit-card-outline',          tint: 'in'  },
  adjustment:       { label: 'Ajustement',             icon: 'tune',                         tint: 'neutral' },
  first_defi_reward:   { label: 'Récompense : 1er défi',          icon: 'star-circle-outline',   tint: 'in' },
  first_group_reward:  { label: 'Récompense : 1er groupe',        icon: 'account-group-outline', tint: 'in' },
  streak3_reward:      { label: 'Récompense : 3 jours d’affilée', icon: 'fire',                  tint: 'in' },
  five_particip_reward: { label: 'Récompense : 5 participations', icon: 'counter',               tint: 'in' },
};

function typeMeta(type, amount) {
  const meta = { ...(TYPE_META[type] || { label: type || 'Mouvement', icon: 'dots-horizontal', tint: 'neutral' }) };
  if (meta.tint === 'neutral') {
    if (Number(amount) > 0) meta.tint = 'in';
    else if (Number(amount) < 0) meta.tint = 'out';
  }
  return meta;
}

function AmountPill({ amount }) {
  const n = Number(amount) || 0;
  const isPlus  = n > 0;
  const isMinus = n < 0;
  const bg = isPlus ? '#ECFDF5' : isMinus ? '#FEF2F2' : '#F3F4F6';
  const fg = isPlus ? '#065F46' : isMinus ? '#991B1B' : '#374151';
  return (
    <View style={{ paddingHorizontal:8, paddingVertical:4, borderRadius:999, backgroundColor:bg }}>
      <Text style={{ color: fg, fontWeight:'800' }}>{n > 0 ? `+${n}` : n}</Text>
    </View>
  );
}

function RowIcon({ name, tint }) {
  const color = tint === 'in' ? '#047857' : tint === 'out' ? '#B91C1C' : '#6B7280';
  return <MaterialCommunityIcons name={name} size={20} color={color} />;
}

/* ---------- Screen ---------- */

export default function CreditsScreen() {
  const { user } = useAuth();
  const [me, setMe] = useState(null);
  const [logs, setLogs] = useState([]);
  const [groupsLB, setGroupsLB] = useState([]);
  const [loading, setLoading] = useState(true);

  // Profil + logs + groups où je suis membre/owner (pour classements simples)
  useEffect(() => {
    if (!user) return;

    const unsub1 = onSnapshot(doc(db, 'participants', user.uid), (snap) => {
      setMe(snap.exists() ? ({ id: snap.id, ...snap.data() }) : null);
    });

    const unsub2 = onSnapshot(
      query(collection(db, 'participants', user.uid, 'credit_logs'), orderBy('createdAt', 'desc'), limit(50)),
      (snap) => setLogs(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    );

    const q1 = query(collection(db, 'group_memberships'), where('uid', '==', user.uid));
    const q2 = query(collection(db, 'group_memberships'), where('userId', '==', user.uid));
    const found = new Set();

    const handle = async (snap) => {
      snap.docs.forEach(d => {
        const gid = d.data()?.groupId;
        if (gid) found.add(gid);
      });

      const arr = await Promise.all(
        Array.from(found).map(async (gid) => {
          let name = gid;
          try {
            const g = await getDoc(doc(db, 'groups', gid));
            if (g.exists()) name = g.data()?.name || gid;
          } catch {}

          let entries = [];
          try {
            const lbSnap = await getDocs(query(collection(db, 'groups', gid, 'leaderboard'), orderBy('balance', 'desc'), limit(10)));
            entries = lbSnap.docs.map(x => ({ id: x.id, ...x.data() }));
          } catch {
            const lbSnap = await getDocs(collection(db, 'groups', gid, 'leaderboard'));
            entries = lbSnap.docs.map(x => ({ id: x.id, ...x.data() }));
            entries.sort((a,b) => (b.balance||0)-(a.balance||0));
            entries = entries.slice(0,10);
          }

          return { groupId: gid, name, entries };
        })
      );
      setGroupsLB(arr);
    };

    const unsub3 = onSnapshot(q1, handle);
    const unsub4 = onSnapshot(q2, handle);

    setLoading(false);
    return () => { unsub1?.(); unsub2?.(); unsub3?.(); unsub4?.(); };
  }, [user?.uid]);

  if (!user) {
    return (
      <>
        <Stack.Screen options={{ title: 'Crédits' }} />
        <View style={{ flex:1, alignItems:'center', justifyContent:'center', padding:16 }}>
          <Text>Connecte-toi…</Text>
        </View>
      </>
    );
  }
  if (loading || !me) {
    return (
      <>
        <Stack.Screen options={{ title: 'Crédits' }} />
        <View style={{ flex:1, alignItems:'center', justifyContent:'center' }}>
          <ActivityIndicator />
        </View>
      </>
    );
  }

  const balance = me?.credits?.balance ?? 0;
  const st  = me?.stats || {};
  const ach = me?.achievements || {};

  const nextGoals = [
    { key: 'first_defi', label: 'Premier défi créé', done: !!ach.firstDefiCreated, reward: '+1' },
    { key: 'first_group', label: 'Premier groupe créé', done: !!ach.firstGroupCreated, reward: '+1' },
    { key: '5_participations', label: 'Participer à 5 défis', done: !!ach.fiveParticipationsAny, reward: '+2', progress: `${st.totalParticipations||0}/5` },
    { key: '3_consecutive_days', label: '3 jours consécutifs', done: !!ach.threeConsecutiveDays, reward: '+2', progress: `${st.currentStreakDays||0}/3` },
  ];

  function ActivitiesCard({ logs }) {
  return (
    <View style={{ padding: 14, borderWidth: 1, borderRadius: 12, backgroundColor: '#fff' }}>
      <Text style={{ fontWeight: '800', fontSize: 16, marginBottom: 8 }}>Activités</Text>

      {logs.length === 0 ? (
        <Text style={{ color: '#6B7280' }}>Aucun mouvement de crédits pour l’instant.</Text>
      ) : (
        <View style={{ borderTopWidth: 1, borderColor: '#F3F4F6' }}>
          {logs.map((item) => {
            const meta = typeMeta(item.type, item.amount);
            const when = fmtDateTime(item.createdAt);
            const subtitleParts = [];
            if (when) subtitleParts.push(when);
            if (typeof item.fromBalance === 'number' && typeof item.toBalance === 'number') {
              subtitleParts.push(`${item.fromBalance} → ${item.toBalance}`);
            }
           

            return (
              <View
                key={item.id}
                style={{
                  paddingVertical: 10,
                  borderBottomWidth: 1,
                  borderColor: '#F3F4F6',
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                }}
              >
                <RowIcon name={meta.icon} tint={meta.tint} />
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ fontWeight: '700' }}>{meta.label}</Text>
                    <AmountPill amount={item.amount} />
                  </View>
                  {!!subtitleParts.length && (
                    <Text style={{ color: '#6B7280', fontSize: 12, marginTop: 2 }}>
                      {subtitleParts.join(' · ')}
                    </Text>
                  )}
                </View>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

  const renderLogItem = ({ item }) => {
    const meta = typeMeta(item.type, item.amount);
    const title = meta.label;
    const subtitleParts = [];
    const when = fmtDateTime(item.createdAt);
    if (when) subtitleParts.push(when);
    if (typeof item.fromBalance === 'number' && typeof item.toBalance === 'number') {
      subtitleParts.push(`${item.fromBalance} → ${item.toBalance}`);
    }
    if (item.defiId) subtitleParts.push(`défi: ${item.defiId}`);

    return (
      <View style={{ paddingHorizontal:16, paddingVertical:10, borderBottomWidth:1, borderColor:'#f0f0f0', flexDirection:'row', alignItems:'center', gap:12 }}>
        <RowIcon name={meta.icon} tint={meta.tint} />
        <View style={{ flex:1 }}>
          <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'center' }}>
            <Text style={{ fontWeight:'700' }}>{title}</Text>
            <AmountPill amount={item.amount} />
          </View>
          {!!subtitleParts.length && (
            <Text style={{ color:'#6B7280', fontSize:12, marginTop:2 }}>
              {subtitleParts.join(' · ')}
            </Text>
          )}
        </View>
      </View>
    );
  };

  return (
  <>
    <Stack.Screen options={{ title: 'Crédits' }} />
    <FlatList
      // On n’utilise plus FlatList pour lister les logs ligne par ligne,
      // on rend tout dans l’en-tête sous forme de 3 cartes.
      data={[]}
      keyExtractor={() => 'noop'}
      ListHeaderComponent={
        <View style={{ padding: 16, gap: 16 }}>
          {/* Solde */}
          <View style={{ padding: 14, borderWidth: 1, borderRadius: 12, backgroundColor: '#fff' }}>
            <Text style={{ fontWeight: '800', fontSize: 18 }}>Mon solde</Text>
            <Text style={{ fontSize: 34, fontWeight: '900', marginTop: 4 }}>
              {me?.credits?.balance ?? 0}
            </Text>
          </View>

          {/* Objectifs */}
          <View style={{ padding: 14, borderWidth: 1, borderRadius: 12, backgroundColor: '#fff' }}>
            <Text style={{ fontWeight: '800', fontSize: 16, marginBottom: 8 }}>Objectifs</Text>
            {nextGoals.map((g) => (
              <View
                key={g.key}
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 6,
                }}
              >
                <Text>
                  {g.done ? '✅ ' : ''}
                  {g.label}
                  {g.progress ? `  (${g.progress})` : ''}
                </Text>
                <Text style={{ fontWeight: '800', color: g.done ? '#059669' : '#111827' }}>
                  {g.reward}
                </Text>
              </View>
            ))}
          </View>

          {/* Activités (logs) */}
          <ActivitiesCard logs={logs} />
        </View>
      }
      // plus de renderItem / ListEmptyComponent ici
    />
  </>
);
}