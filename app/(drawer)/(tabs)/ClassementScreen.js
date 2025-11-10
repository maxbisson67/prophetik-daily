// app/(tabs)/ClassementScreen.js
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  View, Text, ActivityIndicator, TouchableOpacity,
  FlatList, RefreshControl, Image
} from 'react-native';
import { Stack } from 'expo-router';
import { Ionicons, MaterialCommunityIcons, FontAwesome6 } from '@expo/vector-icons';

import { useAuth } from '@src/auth/SafeAuthProvider';
import { useGroups } from '@src/groups/useGroups';
import { useTheme } from '@src/theme/ThemeProvider';
import { db } from '@src/lib/firebase';
import { collection, onSnapshot, query, where, doc } from 'firebase/firestore';

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

/* ---------------- helpers cache-bust ---------------- */
function withCacheBust(url, tsMillis) {
  if (!url) return null;
  const v = Number.isFinite(tsMillis) ? tsMillis : Date.now();
  return url.includes('?') ? `${url}&_cb=${v}` : `${url}?_cb=${v}`;
}

/* ----------- profils publics (profiles_public) pour un set dynamique d'uids ----------- */
function usePublicProfilesFor(uids) {
  const [map, setMap] = useState({}); // uid -> { displayName, avatarUrl, updatedAt }

  useEffect(() => {
    const ids = Array.from(new Set((uids || []).filter(Boolean).map(String)));
    if (ids.length === 0) { setMap({}); return; }

    const unsubs = new Map();

    ids.forEach((uid) => {
      if (unsubs.has(uid)) return;
      const ref = doc(db, 'profiles_public', uid);
      const un = onSnapshot(
        ref,
        (snap) => {
          if (!snap.exists()) {
            setMap((prev) => {
              if (prev[uid]) {
                const next = { ...prev };
                delete next[uid];
                return next;
              }
              return prev;
            });
            return;
          }
          const d = snap.data() || {};
          setMap((prev) => ({
            ...prev,
            [uid]: {
              displayName: d.displayName || 'Invité',
              avatarUrl: d.avatarUrl || null,
              updatedAt: d.updatedAt || null,
            },
          }));
        },
        () => {
          // on laisse l’entrée telle quelle en cas d’erreur
        }
      );
      unsubs.set(uid, un);
    });

    return () => {
      for (const [, un] of unsubs) { try { un(); } catch {} }
    };
  }, [JSON.stringify(uids || [])]);

  return map;
}

// 🔧 util: dédupliquer par id
function dedupeById(arr) {
  const map = new Map();
  for (const g of (arr || [])) map.set(String(g.id), g);
  return Array.from(map.values());
}

/* 🔎 hook: tous les groupes dont je suis owner, peu importe le schéma
   - ownerId == uid
   - owner.uid == uid   (champ imbriqué)
   - createdBy == uid
   - owners array-contains uid
*/
function useOwnedGroups(uid) {
  const [owned, setOwned] = React.useState([]);
  const [loading, setLoading] = React.useState(!!uid);

  React.useEffect(() => {
    if (!uid) { setOwned([]); setLoading(false); return; }

    const results = {
      ownerId: [],
      createdBy: [],
    };

    const unsubs = [];

    function attach(qRef, key) {
      const un = onSnapshot(qRef, (snap) => {
        results[key] = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        const merged = dedupeById([
          ...results.ownerId,
          ...results.createdBy,
        ]);
        setOwned(merged);
        setLoading(false);

      }, (err) => {
        if (__DEV__) console.warn(`[useOwnedGroups] ${key} error:`, err?.message || err);
        setLoading(false);
      });
      unsubs.push(un);
    }

    try {
      // ownerId == uid
      attach(query(collection(db, 'groups'), where('ownerId', '==', String(uid))), 'ownerId');
    } catch (e) {
      if (__DEV__) console.warn('[useOwnedGroups] ownerId query failed:', e?.message || e);
    }

    try {
      // createdBy == uid
      attach(query(collection(db, 'groups'), where('createdBy', '==', String(uid))), 'createdBy');
    } catch (e) {
      if (__DEV__) console.warn('[useOwnedGroups] createdBy query failed:', e?.message || e);
    }


    return () => { unsubs.forEach(u => { try { u(); } catch {} }); };
  }, [uid]);

  return { owned, loading };
}

/* ---------------- Legend ---------------- */
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
      <Item left={<FontAwesome6 name="sack-dollar" size={14} color={colors.subtext} />} text="Gain" />
      <Item left={<MaterialCommunityIcons name="sack-percent" size={18} color={colors.subtext} />} text="Gain moyen par défi" />
    </View>
  );
}

function HeaderCol({
  icon,
  iconSet = 'mci',
  labelText,
  sortKey,
  currentSort,
  onSort,
  colors,
  flex,
  center,
}) {
  const isActive = currentSort?.key === sortKey;
  const direction = isActive ? currentSort?.dir : null;
  const IconSet = iconSet === 'fa6' ? FontAwesome6 : MaterialCommunityIcons;
  const iconSize = iconSet === 'mci' && icon === 'sack-percent' ? 20 : 18;

  return (
    <TouchableOpacity
      onPress={() => onSort(sortKey)}
      style={{
        flex: flex || (center ? 1 : undefined),
        alignItems: center ? 'center' : 'flex-start',
        flexDirection: 'row',
        justifyContent: center ? 'center' : 'flex-start',
        gap: 6,
      }}
    >
      {icon && (
        <IconSet
          name={icon}
          size={iconSize}
          color={isActive ? colors.primary : colors.text}
        />
      )}
      {labelText && (
        <Text
          style={{
            color: isActive ? colors.primary : colors.text,
            fontWeight: isActive ? '700' : '500',
          }}
        >
          {labelText}
        </Text>
      )}
      {isActive && (
        <MaterialCommunityIcons
          name={direction === 'asc' ? 'chevron-up' : 'chevron-down'}
          size={24}
          color={colors.primary}
          style={{ marginLeft: 2 }}
        />
      )}
    </TouchableOpacity>
  );
}

/* ---------------- Leaderboard table ---------------- */
function LeaderboardTable({ rows, colors, groupId }) {
  const [sort, setSort] = useState({ key: 'wins', dir: 'desc' });

  // 🔁 Liste des uids visibles dans la table (ids des entries = uid des participants)
  const uids = useMemo(() => rows.map((r) => String(r.id)), [rows]);

  // 🔵 Profils publics en temps réel pour ces uids
  const publicProfiles = usePublicProfilesFor(uids);

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
      {/* header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          paddingVertical: 10,
          paddingHorizontal: 12,
          backgroundColor: colors.card2,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        <View style={{ width: 40 }} />
        <HeaderCol
          icon="account"
          sortKey="displayName"
          currentSort={sort}
          onSort={toggleSort}
          colors={colors}
          flex={1.5}
        />
        <HeaderCol
          icon="trophy"
          sortKey="wins"
          currentSort={sort}
          onSort={toggleSort}
          colors={colors}
          center
        />
        <HeaderCol
          iconSet="fa6"
          icon="sack-dollar"
          sortKey="potTotal"
          currentSort={sort}
          onSort={toggleSort}
          colors={colors}
          center
        />
        <HeaderCol
          icon="sack-percent"
          sortKey="potAvg"
          currentSort={sort}
          onSort={toggleSort}
          colors={colors}
          center
        />
      </View>

      {/* rows */}
      {sorted.map((r, idx) => {
        const prof = publicProfiles[r.id] || {};
        const version = prof.updatedAt?.toMillis?.() ? prof.updatedAt.toMillis() : 0;

        const display =
          prof.displayName ||
          r.displayName ||
          r.id;

        const shortName = display.length > 10 ? display.slice(0, 10) + '…' : display;
        const uri = prof.avatarUrl ? withCacheBust(prof.avatarUrl, version) : null;

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
              key={`${version}:${uri || 'placeholder'}`}
              source={uri ? { uri } : AVATAR_PLACEHOLDER}
              style={{
                width: 32,
                height: 32,
                borderRadius: 16,
                marginRight: 8,
                backgroundColor: colors.border,
                borderWidth: 1,
                borderColor: colors.border,
              }}
              onError={() => {
                if (__DEV__) console.warn('[Classement] avatar load error:', uri);
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
              <Text style={{ color: colors.text, textAlign: 'center' }}>
                {(r.potAvg ?? 0).toLocaleString('fr-CA', {
                  style: 'currency',
                  currency: 'CAD',
                  maximumFractionDigits: 2,
                })}
              </Text>
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

  // 1) Groupes où je suis MEMBRE
  const {
    groups: memberGroups,
    loading: loadingMemberGroups,
    error
  } = useGroups(user?.uid);

  // 2) Groupes dont je suis OWNER (tous schémas couverts)
  const { owned: ownedGroups, loading: loadingOwned } = useOwnedGroups(user?.uid);

  // 3) Fusion dédupliquée
  const groups = useMemo(
    () => dedupeById([...(memberGroups || []), ...(ownedGroups || [])]),
    [memberGroups, ownedGroups]
  );

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

  if (loadingMemberGroups || loadingOwned || loadingBoards) {
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
        ListHeaderComponent={<Legend colors={colors} />}
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
              </View>

              {rows.length === 0 ? (
                <Text style={{ color: colors.subtext }}>Pas encore de stats pour ce groupe.</Text>
              ) : (
                <LeaderboardTable rows={rows} colors={colors} groupId={item.id} />
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