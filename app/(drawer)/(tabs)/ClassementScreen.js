import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  View, Text, ActivityIndicator, TouchableOpacity,
  FlatList, RefreshControl, Image
} from 'react-native';
import { Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useAuth } from '@src/auth/AuthProvider';
import { useGroups } from '@src/groups/useGroups';
import { useTheme } from '@src/theme/ThemeProvider';
import { db } from '@src/lib/firebase';
import { collection, onSnapshot, doc, getDoc } from 'firebase/firestore';

const AVATAR_PLACEHOLDER = require('@src/assets/avatar-placeholder.png');
const GROUP_PLACEHOLDER  = require('@src/assets/group-placeholder.png');

/* ---------------- Leaderboards hook ---------------- */
function useLeaderboards(groupIds) {
  const [loading, setLoading] = useState(true);
  const [all, setAll] = useState({});

  useEffect(() => {
    if (!groupIds?.length) {
      setAll({});
      setLoading(false);
      return;
    }
    const unsubs = [];
    setLoading(true);
    groupIds.forEach((gid) => {
      const ref = collection(db, 'groups', gid, 'leaderboard');
      const unsub = onSnapshot(ref, (snap) => {
        const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setAll((prev) => ({ ...prev, [gid]: rows }));
      });
      unsubs.push(unsub);
    });
    setLoading(false);
    return () => unsubs.forEach((u) => u && u());
  }, [JSON.stringify(groupIds)]);

  return { loading, all };
}

/* ----------- charge (une fois) les profils manquants pour avatars ----------- */
function useParticipantsProfiles(userIds) {
  const [map, setMap] = useState({}); // { uid: { displayName, photoURL } }

  useEffect(() => {
    const ids = (userIds || []).filter(Boolean);
    if (!ids.length) return;

    let cancelled = false;
    (async () => {
      const promises = ids.map(async (uid) => {
        if (map[uid]) return null; // déjà en cache
        try {
          const snap = await getDoc(doc(db, 'participants', uid));
          if (snap.exists()) {
            const d = snap.data() || {};
            return [uid, { displayName: d.displayName || '', photoURL: d.photoURL || d.avatarUrl || null }];
          }
        } catch {}
        return [uid, { displayName: '', photoURL: null }];
      });

      const entries = (await Promise.all(promises)).filter(Boolean);
      if (!cancelled && entries.length) {
        setMap((prev) => {
          const next = { ...prev };
          for (const [uid, val] of entries) next[uid] = val;
          return next;
        });
      }
    })();

    return () => { cancelled = true; };
  }, [JSON.stringify(userIds)]); // eslint-disable-line react-hooks/exhaustive-deps

  return map;
}

/* ---------------- Head col (icône OU label texte) ---------------- */
function HeaderCol({
  icon,        // nom Ionicons (ex: "person" | "trophy"), ou null
  labelText,   // texte à afficher ("$" | "%") si icon est absent
  sortKey,
  currentSort,
  onSort,
  colors,
  flex = 1,
  center = false,
}) {
  const isActive = currentSort.key === sortKey;
  const dirIcon = currentSort.dir === 'asc' ? 'chevron-up' : 'chevron-down';
  return (
    <TouchableOpacity
      onPress={() => onSort(sortKey)}
      style={{
        flex,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: center ? 'center' : 'flex-start',
        gap: 6,
        paddingVertical: 2,
      }}
    >
      {icon ? (
        <Ionicons name={icon} size={16} color={isActive ? colors.primary : colors.subtext} />
      ) : (
        <Text style={{ fontWeight: '900', color: isActive ? colors.primary : colors.subtext }}>
          {labelText}
        </Text>
      )}
      {isActive ? <Ionicons name={dirIcon} size={14} color={colors.subtext} /> : null}
    </TouchableOpacity>
  );
}

/* ---------------- Legend (rendue UNE SEULE FOIS en haut de l’écran) ---------------- */
function Legend({ colors }) {
  const Item = ({ left, text }) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginRight: 16, marginBottom: 6 }}>
      {left}
      <Text style={{ color: colors.subtext, fontSize: 12 }}>{text}</Text>
    </View>
  );
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 10 }}>
      <Item left={<Ionicons name="person" size={14} color={colors.subtext} />} text="Nom" />
      <Item left={<Ionicons name="trophy" size={14} color={colors.subtext} />} text="Défis gagnés" />
      <Item left={<Text style={{ fontWeight: '900', color: colors.subtext }}>$</Text>} text="Gain" />
      <Item left={<Text style={{ fontWeight: '900', color: colors.subtext }}>%</Text>} text="Gain (%)" />
    </View>
  );
}

/* ---------------- Leaderboard table ---------------- */
function LeaderboardTable({ rows, colors }) {
  const [sort, setSort] = useState({ key: 'wins', dir: 'desc' });

  // profils pour avatars
  const userIds = useMemo(() => rows.map(r => r.id), [rows]);
  const profiles = useParticipantsProfiles(userIds);

  const sorted = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => {
      const av = a?.[sort.key] ?? 0;
      const bv = b?.[sort.key] ?? 0;
      if (av === bv) return 0;
      return sort.dir === 'asc' ? (av < bv ? -1 : 1) : (av > bv ? -1 : 1);
    });
    return copy;
  }, [rows, sort]);

  const toggleSort = useCallback(
    (key) => {
      setSort((s) =>
        s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'desc' }
      );
    },
    []
  );

  return (
    <View
      style={{
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 12,
        overflow: 'hidden',
        backgroundColor: colors.card,
      }}
    >
      {/* header (icônes/labels) */}
      <View
        style={{
          flexDirection: 'row',
          paddingVertical: 10,
          paddingHorizontal: 12,
          backgroundColor: colors.card2,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        <View style={{ width: 40 }} />
        <HeaderCol icon="person"   sortKey="displayName" currentSort={sort} onSort={toggleSort} colors={colors} flex={1.5} />
        <HeaderCol icon="trophy"   sortKey="wins"        currentSort={sort} onSort={toggleSort} colors={colors} center />
        <HeaderCol labelText="$"   sortKey="potTotal"    currentSort={sort} onSort={toggleSort} colors={colors} center />
        <HeaderCol labelText="%"   sortKey="potAvg"      currentSort={sort} onSort={toggleSort} colors={colors} center />
      </View>

      {/* rows */}
      {sorted.map((r, idx) => {
        const prof = profiles[r.id] || {};
        const display = r.displayName || prof.displayName || r.id;
        const shortName = display.length > 10 ? display.slice(0, 10) + '…' : display;

        // potAvg = déjà une valeur “%” (on n’applique pas ×100)
        const gainPct = Number.isFinite(r.potAvg) ? r.potAvg : 0;

        return (
          <View
            key={r.id}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingVertical: 10,
              paddingHorizontal: 12,
              borderBottomWidth: idx === sorted.length - 1 ? 0 : 1,
              borderBottomColor: colors.border,
              backgroundColor: idx % 2 ? colors.rowAlt : colors.card,
            }}
          >
            <Image
              source={prof.photoURL ? { uri: prof.photoURL } : AVATAR_PLACEHOLDER}
              style={{
                width: 32,
                height: 32,
                borderRadius: 16,
                marginRight: 8,
                backgroundColor: colors.border,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            />
            <View style={{ flex: 1.5 }}>
              <Text style={{ color: colors.text, fontWeight: '700' }} numberOfLines={1}>
                {shortName}
              </Text>
            </View>
            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text style={{ color: colors.text, textAlign: 'center' }}>{r.wins ?? 0}</Text>
            </View>
            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text style={{ color: colors.text, textAlign: 'center' }}>
                {(r.potTotal ?? 0).toLocaleString('fr-CA', {
                  style: 'currency',
                  currency: 'CAD',
                  maximumFractionDigits: 0,
                })}
              </Text>
            </View>
            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text style={{ color: colors.text, textAlign: 'center' }}>{Number(gainPct).toFixed(2)}%</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

/* ---------------- Screen ---------------- */
export default function ClassementScreen() {
  const { user } = useAuth();
  const { colors } = useTheme();
  const { groups, loading: loadingGroups, error } = useGroups(user?.uid);
  const groupIds = useMemo(() => groups.map((g) => String(g.id)), [groups]);
  const { loading: loadingBoards, all } = useLeaderboards(groupIds);

  const [refreshing, setRefreshing] = useState(false);
  const [rebuilding, setRebuilding] = useState({});

  const baseUrl = `https://us-central1-capitaine.cloudfunctions.net/rebuildLeaderboardForGroup`;

  const handleRebuild = useCallback(async (gid) => {
    try {
      setRebuilding((s) => ({ ...s, [gid]: true }));
      const res = await fetch(`${baseUrl}?groupId=${encodeURIComponent(gid)}`);
      if (!res.ok) throw new Error(await res.text());
    } catch (e) {
      console.log('rebuild leaderboard error:', e?.message || e);
    } finally {
      setRebuilding((s) => ({ ...s, [gid]: false }));
    }
  }, []);

  const onRefresh = useCallback(async () => {
    if (!groupIds.length) return;
    try {
      setRefreshing(true);
      await Promise.all(groupIds.map((gid) => fetch(`${baseUrl}?groupId=${encodeURIComponent(gid)}`)));
    } catch (e) {
      console.log('refresh leaderboard error:', e?.message || e);
    } finally {
      setRefreshing(false);
    }
  }, [groupIds]);

  if (!user) {
    return (
      <>
        <Stack.Screen options={{ title: 'Classement' }} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <Text style={{ color: colors.text }}>Connecte-toi pour voir les classements.</Text>
        </View>
      </>
    );
  }

  if (loadingGroups || loadingBoards) {
    return (
      <>
        <Stack.Screen options={{ title: 'Classement' }} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator />
          <Text style={{ marginTop: 8, color: colors.subtext }}>Chargement…</Text>
        </View>
      </>
    );
  }

  if (error) {
    return (
      <>
        <Stack.Screen options={{ title: 'Classement' }} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <Text style={{ color: colors.text }}>Erreur: {String(error)}</Text>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Classement' }} />
      <FlatList
        contentContainerStyle={{ padding: 16, gap: 16 }}
        data={groups}
        keyExtractor={(g) => String(g.id)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        ListHeaderComponent={
          // ✅ Légende rendue une fois ici
          <Legend colors={colors} />
        }
        renderItem={({ item }) => {
          const rows = all?.[item.id] || [];
          return (
            <View
              style={{
                padding: 14,
                borderRadius: 12,
                backgroundColor: colors.card,
                borderWidth: 1,
                borderColor: colors.border,
                shadowColor: '#000',
                shadowOpacity: 0.05,
                shadowRadius: 6,
                shadowOffset: { width: 0, height: 3 },
                elevation: 2,
              }}
            >
              {/* --- Header de la carte --- */}
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 8,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Image
                    source={item.avatarUrl ? { uri: item.avatarUrl } : GROUP_PLACEHOLDER}
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 16,
                      marginRight: 8,
                      backgroundColor: colors.border,
                    }}
                  />
                  <Text style={{ fontWeight: '900', color: colors.text }}>
                    {item.name || item.id}
                  </Text>
                </View>

                <TouchableOpacity
                  onPress={() => handleRebuild(item.id)}
                  disabled={!!rebuilding[item.id]}
                  style={{
                    paddingVertical: 6,
                    paddingHorizontal: 10,
                    borderRadius: 10,
                    backgroundColor: rebuilding[item.id] ? colors.border : colors.primary,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  {rebuilding[item.id] ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Ionicons name="refresh" size={14} color="#fff" />
                  )}
                  <Text style={{ color: '#fff', fontWeight: '800', fontSize: 12 }}>
                    {rebuilding[item.id] ? 'Recalcul…' : 'Recalculer'}
                  </Text>
                </TouchableOpacity>
              </View>

              {rows.length === 0 ? (
                <Text style={{ color: colors.subtext }}>Pas encore de stats pour ce groupe.</Text>
              ) : (
                <LeaderboardTable rows={rows} colors={colors} />
              )}
            </View>
          );
        }}
        ListEmptyComponent={() => (
          <View style={{ alignItems: 'center', marginTop: 40 }}>
            <Text style={{ color: colors.subtext }}>Tu n’as pas encore de groupes.</Text>
          </View>
        )}
      />
    </>
  );
}