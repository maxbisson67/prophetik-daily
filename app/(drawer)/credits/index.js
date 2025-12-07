// app/(drawer)/credits/index.js
import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, ActivityIndicator, FlatList } from 'react-native';
import { Stack } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import firestore from '@react-native-firebase/firestore'; // ✅ RNFirebase
// Safe auth
import { useAuth } from '@src/auth/SafeAuthProvider';

import CreditsWallet from '@src/credits/CreditsWallet';
import { useTheme } from '@src/theme/ThemeProvider';

/* ---------- Helpers ---------- */

function fmtDateTime(ts) {
  try {
    const d =
      ts?.toDate?.() ??
      (ts instanceof Date ? ts : ts ? new Date(ts) : null);
    if (!d) return '';
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(
      d.getDate()
    )} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch {
    return '';
  }
}

const TYPE_META = {
  defi_entry: {
    label: 'Inscription à un défi',
    icon: 'ticket-confirmation-outline',
    tint: 'out',
  },
  defi_payout: {
    label: 'Gain de défi',
    icon: 'trophy-outline',
    tint: 'in',
  },
  // ✅ Nouveau : remboursement d’un défi annulé (ex: cancelled_ghost)
  defi_refund: {
    label: 'Remboursement : défi annulé',
    icon: 'backup-restore',
    tint: 'in',
  },
  topup_free: {
    label: 'Bonus gratuit',
    icon: 'gift-outline',
    tint: 'in',
  },
  topup_purchase: {
    label: 'Achat de crédits',
    icon: 'credit-card-outline',
    tint: 'in',
  },
  adjustment: {
    label: 'Ajustement',
    icon: 'tune',
    tint: 'neutral',
  },
  purchase_avatar: {
    label: 'Achat d’un avatar',
    icon: 'credit-card-outline',
    tint: 'out',
  },
  first_defi: {
    label: 'Récompense : 1er défi créé',
    icon: 'fire',
    tint: 'in',
  },
  first_group: {
    label: 'Récompense : 1er groupe créé',
    icon: 'fire',
    tint: 'in',
  },
  three_consecutive_days: {
    label: 'Récompense : 3 jours d’affilée',
    icon: 'fire',
    tint: 'in',
  },
  five_participations_any: {
    label: 'Récompense : 5 participations',
    icon: 'counter',
    tint: 'in',
  },
};

function typeMeta(type, amount) {
  const meta = {
    ...(TYPE_META[type] || {
      label: type || 'Mouvement',
      icon: 'dots-horizontal',
      tint: 'neutral',
    }),
  };
  if (meta.tint === 'neutral') {
    if (Number(amount) > 0) meta.tint = 'in';
    else if (Number(amount) < 0) meta.tint = 'out';
  }
  return meta;
}

function AmountPill({ amount }) {
  const n = Number(amount) || 0;
  const isPlus = n > 0;
  const isMinus = n < 0;
  const bg = isPlus ? '#ECFDF5' : isMinus ? '#FEF2F2' : '#F3F4F6';
  const fg = isPlus ? '#065F46' : isMinus ? '#991B1B' : '#374151';
  return (
    <View
      style={{
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 999,
        backgroundColor: bg,
      }}
    >
      <Text style={{ color: fg, fontWeight: '800' }}>
        {n > 0 ? `+${n}` : n}
      </Text>
    </View>
  );
}

function GoalStatusIcon({ done }) {
  return (
    <MaterialCommunityIcons
      name={done ? 'check-circle' : 'progress-clock'}
      size={20}
      color={done ? '#059669' : '#6B7280'} // Vert vs Gris neutre
      style={{ marginRight: 6 }}
    />
  );
}

function RowIcon({ name, tint }) {
  const color =
    tint === 'in'
      ? '#047857'
      : tint === 'out'
      ? '#B91C1C'
      : '#6B7280';
  return <MaterialCommunityIcons name={name} size={20} color={color} />;
}

/* ---------- Screen ---------- */

export default function CreditsScreen() {
  const { user } = useAuth();
  const { colors } = useTheme();

  const [me, setMe] = useState(null);
  const [logs, setLogs] = useState([]);
  const [groupsLB, setGroupsLB] = useState([]);
  const [loading, setLoading] = useState(true);

  // Profil + logs + groups où je suis membre/owner (pour classements simples)
  useEffect(() => {
    if (!user?.uid) return;

    // participant
    const unsub1 = firestore()
      .doc(`participants/${user.uid}`)
      .onSnapshot((snap) => {
        setMe(snap.exists ? { id: snap.id, ...snap.data() } : null);
      });

    // credit logs
    const unsub2 = firestore()
      .collection(`participants/${user.uid}/credit_logs`)
      .orderBy('createdAt', 'desc')
      .limit(50)
      .onSnapshot((snap) => {
        setLogs(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      });

    // group memberships (2 variantes de clé)
    const q1 = firestore()
      .collection('group_memberships')
      .where('uid', '==', user.uid);
    const q2 = firestore()
      .collection('group_memberships')
      .where('userId', '==', user.uid);
    const found = new Set();

    const handle = async (snap) => {
      snap.docs.forEach((d) => {
        const gid = d.data()?.groupId;
        if (gid) found.add(gid);
      });

      const arr = await Promise.all(
        Array.from(found).map(async (gid) => {
          // nom de groupe
          let name = gid;
          try {
            const g = await firestore().doc(`groups/${gid}`).get();
            if (g.exists) name = g.data()?.name || gid;
          } catch {}

          // leaderboard top 10
          let entries = [];
          try {
            const lbSnap = await firestore()
              .collection(`groups/${gid}/leaderboard`)
              .orderBy('balance', 'desc')
              .limit(10)
              .get();
            entries = lbSnap.docs.map((x) => ({
              id: x.id,
              ...x.data(),
            }));
          } catch {
            const lbSnap = await firestore()
              .collection(`groups/${gid}/leaderboard`)
              .get();
            entries = lbSnap.docs.map((x) => ({
              id: x.id,
              ...x.data(),
            }));
            entries.sort(
              (a, b) => (b.balance || 0) - (a.balance || 0)
            );
            entries = entries.slice(0, 10);
          }

          return { groupId: gid, name, entries };
        })
      );
      setGroupsLB(arr);
    };

    const unsub3 = q1.onSnapshot(handle);
    const unsub4 = q2.onSnapshot(handle);

    setLoading(false);
    return () => {
      unsub1?.();
      unsub2?.();
      unsub3?.();
      unsub4?.();
    };
  }, [user?.uid]);

  if (!user) {
    return (
      <>
        <Stack.Screen options={{ title: 'Crédits' }} />
        <View
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
            backgroundColor: colors.background,
          }}
        >
          <Text style={{ color: colors.text }}>
            Connecte-toi…
          </Text>
        </View>
      </>
    );
  }

  if (loading || !me) {
    return (
      <>
        <Stack.Screen options={{ title: 'Crédits' }} />
        <View
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.background,
          }}
        >
          <ActivityIndicator color={colors.primary} />
        </View>
      </>
    );
  }

  const balance = me?.credits?.balance ?? 0;
  const st = me?.stats || {};
  const ach = me?.achievements || {};

  // 🔁 Progression cyclique sur 5 participations (5 → reste affiché 5, puis repart à 1)
  const totalPart = Number(st.totalParticipations || 0);
  const cycle5 = totalPart % 5;
  const displayCount5 =
    totalPart === 0 ? 0 : cycle5 === 0 ? 5 : cycle5;

  // 🔁 Progression cyclique sur 3 jours consécutifs (3 → reste 3, puis repart à 1)
  const rawStreak = Number(st.currentStreakDays || 0);
  const cycle3 = rawStreak % 3;
  const displayStreak3 =
    rawStreak === 0 ? 0 : cycle3 === 0 ? 3 : cycle3;

  const nextGoals = [
    {
      key: 'first_defi',
      label: 'Premier défi créé',
      done: !!ach.firstDefiCreated,
      reward: '+1',
    },
    {
      key: 'first_group',
      label: 'Premier groupe créé',
      done: !!ach.firstGroupCreated,
      reward: '+1',
    },
    {
      key: '5_participations',
      label: 'Participer à 5 défis',
      done: !!ach.fiveParticipationsAny,
      reward: '+1',
      // ✅ Utilise la version cyclique, comme sur l’Accueil
      progress: `${displayCount5}/5`,
    },
    {
      key: '3_consecutive_days',
      label: '3 jours consécutifs',
      done: !!ach.threeConsecutiveDays,
      reward: '+1',
      // ✅ Utilise la version cyclique (1,2,3 → puis repart)
      progress: `${displayStreak3}/3`,
    },
  ];

  function ActivitiesCard({ logs }) {
    return (
      <View
        style={{
          padding: 14,
          borderWidth: 1,
          borderRadius: 12,
          backgroundColor: colors.card,
          borderColor: colors.border,
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
          Activités
        </Text>

        {logs.length === 0 ? (
          <Text style={{ color: colors.subtext }}>
            Aucun mouvement de crédits pour l’instant.
          </Text>
        ) : (
          <View
            style={{
              borderTopWidth: 1,
              borderColor: colors.border,
            }}
          >
            {logs.map((item) => {
              const meta = typeMeta(item.type, item.amount);
              const when = fmtDateTime(item.createdAt);
              const subtitleParts = [];
              if (when) subtitleParts.push(when);
              if (
                typeof item.fromBalance === 'number' &&
                typeof item.toBalance === 'number'
              ) {
                subtitleParts.push(
                  `${item.fromBalance} → ${item.toBalance}`
                );
              }
              return (
                <View
                  key={item.id}
                  style={{
                    paddingVertical: 10,
                    borderBottomWidth: 1,
                    borderColor: colors.border,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                  }}
                >
                  <RowIcon
                    name={meta.icon}
                    tint={meta.tint}
                  />
                  <View style={{ flex: 1 }}>
                    <View
                      style={{
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <Text
                        style={{
                          fontWeight: '700',
                          color: colors.text,
                        }}
                      >
                        {meta.label}
                      </Text>
                      <AmountPill amount={item.amount} />
                    </View>
                    {!!subtitleParts.length && (
                      <Text
                        style={{
                          color: colors.subtext,
                          fontSize: 12,
                          marginTop: 2,
                        }}
                      >
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

  return (
    <>
      <Stack.Screen options={{ title: 'Crédits' }} />
      <FlatList
        style={{ flex: 1, backgroundColor: colors.background }}
        data={[]}
        keyExtractor={() => 'noop'}
        contentContainerStyle={{
          padding: 16,
          gap: 16,
          backgroundColor: colors.background,
        }}
        ListHeaderComponent={
          <View style={{ gap: 16 }}>
            {/* Solde */}
            <CreditsWallet credits={balance} />

            {/* Objectifs */}
            <View
              style={{
                padding: 14,
                borderWidth: 1,
                borderRadius: 12,
                backgroundColor: colors.card,
                borderColor: colors.border,
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
                Objectifs
              </Text>
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
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <GoalStatusIcon done={g.done} />
                    <Text style={{ color: colors.text }}>
                      {g.label}
                      {g.progress ? `  (${g.progress})` : ''}
                    </Text>
                  </View>
                  <Text
                    style={{
                      fontWeight: '800',
                      color: g.done ? '#059669' : colors.text,
                    }}
                  >
                    {g.reward}
                  </Text>
                </View>
              ))}
            </View>

            {/* Activités (logs) */}
            <ActivitiesCard logs={logs} />
          </View>
        }
      />
    </>
  );
}