// app/(tabs)/ChallengesScreen.js
import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  SectionList,
  TouchableOpacity,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';

// ✅ i18n
import i18n from '@src/i18n/i18n';

// ✅ Safe auth
import { useAuth } from '@src/auth/SafeAuthProvider';

// ✅ RNFirebase Firestore
import firestore from '@react-native-firebase/firestore';

import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '@src/theme/ThemeProvider';

// ✅ Modal de création de défi
import CreateDefiModal from '../defis/CreateDefiModal';

const GROUP_PLACEHOLDER = require('@src/assets/group-placeholder.png');

function fmtTSLocalHM(v) {
  try {
    const d = v?.toDate?.()
      ? v.toDate()
      : v instanceof Date
      ? v
      : v
      ? new Date(v)
      : null;
    if (!d) return '—';
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
  } catch {
    return '—';
  }
}
function tsToMillis(v) {
  const d = v?.toDate?.()
    ? v.toDate()
    : v instanceof Date
    ? v
    : v
    ? new Date(v)
    : null;
  return d ? d.getTime() : 0;
}
function initialsFrom(nameOrEmail = '') {
  const s = String(nameOrEmail).trim();
  if (!s) return '?';
  const parts = s.replace(/\s+/g, ' ').split(' ');
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function ChallengesScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const { colors } = useTheme();

  const [loading, setLoading] = useState(true);
  const [groupIds, setGroupIds] = useState([]);
  const [activeDefis, setActiveDefis] = useState([]);
  const [pastDefis, setPastDefis] = useState([]);
  const [error, setError] = useState(null);
  const [groupsMap, setGroupsMap] = useState({});

  // WINNERS: uid -> { name, photoURL }
  const [winnerInfoMap, setWinnerInfoMap] = useState({});
  const winnerUnsubsRef = useRef(new Map()); // Map<uid, unsub>

  // refs unsub pour les groupes / memberships
  const subs = useRef({
    byUid: null,
    byPid: null,
    byOwnerCreated: null,
    byOwnerOwnerId: null,
  });
  const defisUnsubsRef = useRef(new Map()); // Map<gid, unsub>
  const groupsUnsubsRef = useRef(new Map()); // Map<gid, unsub>

  // 👉 State pour la modal de création de défi
  const [showCreateModal, setShowCreateModal] = useState(false);

  // 1) Mes groupes (membre + owner)
  useEffect(() => {
    setError(null);
    setActiveDefis([]);
    setPastDefis([]);
    setGroupIds([]);
    if (!user?.uid) {
      setLoading(false);
      return;
    }
    setLoading(true);

    // clear old subs
    Object.values(subs.current).forEach((un) => {
      try {
        un?.();
      } catch {}
    });
    subs.current = {
      byUid: null,
      byPid: null,
      byOwnerCreated: null,
      byOwnerOwnerId: null,
    };

    const qByUid = firestore()
      .collection('group_memberships')
      .where('uid', '==', user.uid);
    const qByPid = firestore()
      .collection('group_memberships')
      .where('participantId', '==', user.uid);
    const qOwnerCreated = firestore()
      .collection('groups')
      .where('createdBy', '==', user.uid);
    const qOwnerOwnerId = firestore()
      .collection('groups')
      .where('ownerId', '==', user.uid);

    let rowsByUid = [];
    let rowsByPid = [];
    let rowsOwnerCreated = [];
    let rowsOwnerOwnerId = [];

    const recompute = () => {
      // memberships actifs (tolérant)
      const memberships = [...rowsByUid, ...rowsByPid].filter((m) => {
        const st = String(m?.status || '').toLowerCase();
        if (st) return ['open', 'active', 'approved'].includes(st);
        return m?.active !== false;
      });
      const gidsFromMemberships = memberships
        .map((m) => m.groupId)
        .filter(Boolean);
      const gidsFromOwner = [...rowsOwnerCreated, ...rowsOwnerOwnerId]
        .map((g) => g.id)
        .filter(Boolean);
      const union = Array.from(
        new Set([...gidsFromMemberships, ...gidsFromOwner])
      );
      setGroupIds(union);
      setLoading(false);

      // On profite aussi pour alimenter groupsMap à partir de rowsOwner*
      setGroupsMap((prev) => {
        const next = { ...prev };
        for (const g of [...rowsOwnerCreated, ...rowsOwnerOwnerId]) {
          if (!g?.id) continue;
          next[g.id] = {
            ...(next[g.id] || {}),
            ...g,
          };
        }
        return next;
      });
    };

    subs.current.byUid = qByUid.onSnapshot(
      (snap) => {
        rowsByUid = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        recompute();
      },
      (e) => {
        setError(e);
        setLoading(false);
      }
    );
    subs.current.byPid = qByPid.onSnapshot(
      (snap) => {
        rowsByPid = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        recompute();
      },
      (e) => {
        setError(e);
        setLoading(false);
      }
    );
    subs.current.byOwnerCreated = qOwnerCreated.onSnapshot(
      (snap) => {
        rowsOwnerCreated = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        recompute();
      },
      (e) => {
        setError(e);
        setLoading(false);
      }
    );
    subs.current.byOwnerOwnerId = qOwnerOwnerId.onSnapshot(
      (snap) => {
        rowsOwnerOwnerId = snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));
        recompute();
      },
      (e) => {
        setError(e);
        setLoading(false);
      }
    );

    return () => {
      Object.values(subs.current).forEach((un) => {
        try {
          un?.();
        } catch {}
      });
      subs.current = {
        byUid: null,
        byPid: null,
        byOwnerCreated: null,
        byOwnerOwnerId: null,
      };
    };
  }, [user?.uid]);

  // 2) Un seul listener / groupe → partition côté client
  useEffect(() => {
    // nettoyer obsolètes
    for (const [gid, un] of defisUnsubsRef.current) {
      if (!groupIds.includes(gid)) {
        try {
          un();
        } catch {}
        defisUnsubsRef.current.delete(gid);
      }
    }

    for (const gid of groupIds) {
      if (defisUnsubsRef.current.has(gid)) continue;

      const qAll = firestore()
        .collection('defis')
        .where('groupId', '==', gid);
      const un = qAll.onSnapshot(
        (snap) => {
          const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
          // partition
          const actives = [];
          const past = [];
          for (const r of rows) {
            const k = String(r.status || '').toLowerCase();
            if (k === 'open' || k === 'live') actives.push(r);
            else past.push(r);
          }

          // merge par groupe
          setActiveDefis((prev) => {
            const withoutGroup = prev.filter((x) => x.groupId !== gid);
            const merged = [...withoutGroup, ...actives].sort((a, b) => {
              const va =
                tsToMillis(a.signupDeadline) ||
                tsToMillis(a.firstGameUTC) ||
                tsToMillis(a.createdAt);
              const vb =
                tsToMillis(b.signupDeadline) ||
                tsToMillis(b.firstGameUTC) ||
                tsToMillis(b.createdAt);
              return va - vb;
            });
            return merged;
          });
          setPastDefis((prev) => {
            const withoutGroup = prev.filter((x) => x.groupId !== gid);
            const merged = [...withoutGroup, ...past].sort((a, b) => {
              const va =
                tsToMillis(a.firstGameUTC) ||
                tsToMillis(a.signupDeadline) ||
                tsToMillis(a.createdAt);
              const vb =
                tsToMillis(b.firstGameUTC) ||
                tsToMillis(b.signupDeadline) ||
                tsToMillis(b.createdAt);
              return vb - va; // décroissant
            });
            return merged;
          });
        },
        (e) => setError(e)
      );

      defisUnsubsRef.current.set(gid, un);
    }

    return () => {
      // cleanup au démontage global (géré plus bas)
    };
  }, [groupIds]);

  // 3) Charger noms des groupes (pour toutes les cartes de défis)
  useEffect(() => {
    const neededIds = Array.from(
      new Set(
        [...activeDefis, ...pastDefis]
          .map((d) => d.groupId)
          .filter(Boolean)
      )
    );

    for (const [gid, un] of groupsUnsubsRef.current) {
      if (!neededIds.includes(gid) && !groupIds.includes(gid)) {
        try {
          un();
        } catch {}
        groupsUnsubsRef.current.delete(gid);
      }
    }

    const allNeeded = Array.from(new Set([...neededIds, ...groupIds]));

    for (const gid of allNeeded) {
      if (groupsUnsubsRef.current.has(gid)) continue;
      const ref = firestore().collection('groups').doc(gid);
      const un = ref.onSnapshot((snap) => {
        if (snap.exists) {
          setGroupsMap((prev) => ({
            ...prev,
            [gid]: { id: gid, ...snap.data() },
          }));
        }
      });
      groupsUnsubsRef.current.set(gid, un);
    }
  }, [activeDefis, pastDefis, groupIds]);

  // 3b) Charger les infos gagnants (nom + avatar) depuis profiles_public/{uid}
  useEffect(() => {
    const allDefis = [...activeDefis, ...pastDefis];
    const neededUids = Array.from(
      new Set(
        allDefis
          .flatMap((d) =>
            Array.isArray(d.winners) ? d.winners : []
          )
          .filter(Boolean)
      )
    );

    // retire les listeners obsolètes
    for (const [uid, un] of winnerUnsubsRef.current) {
      if (!neededUids.includes(uid)) {
        try {
          un();
        } catch {}
        winnerUnsubsRef.current.delete(uid);
      }
    }

    // ajoute les nouveaux listeners
    for (const uid of neededUids) {
      if (winnerUnsubsRef.current.has(uid)) continue;
      const ref = firestore().collection('profiles_public').doc(uid);
      const un = ref.onSnapshot(
        (snap) => {
          if (snap.exists) {
            const v = snap.data() || {};
            const name = v.displayName || v.name || uid;
            const photoURL = v.avatarUrl || v.photoURL || null;
            setWinnerInfoMap((prev) => {
              const old = prev[uid] || {};
              if (
                old.name === name &&
                old.photoURL === photoURL
              )
                return prev;
              return { ...prev, [uid]: { name, photoURL } };
            });
          } else {
            setWinnerInfoMap((prev) => ({
              ...prev,
              [uid]: { name: uid, photoURL: null },
            }));
          }
        },
        () => {
          setWinnerInfoMap((prev) => ({
            ...prev,
            [uid]: { name: uid, photoURL: null },
          }));
        }
      );
      winnerUnsubsRef.current.set(uid, un);
    }
  }, [activeDefis, pastDefis]);

  // 4) cleanup global
  useEffect(() => {
    return () => {
      Object.values(subs.current).forEach((un) => {
        try {
          un?.();
        } catch {}
      });
      for (const [, un] of defisUnsubsRef.current) {
        try {
          un();
        } catch {}
      }
      defisUnsubsRef.current.clear();
      for (const [, un] of groupsUnsubsRef.current) {
        try {
          un();
        } catch {}
      }
      groupsUnsubsRef.current.clear();
      for (const [, un] of winnerUnsubsRef.current) {
        try {
          un();
        } catch {}
      }
      winnerUnsubsRef.current.clear();
    };
  }, []);

  // Limiter passés à 20
  const pastLimited = useMemo(
    () => pastDefis.slice(0, 20),
    [pastDefis]
  );

  // 👉 Construire la liste des groupes pour la modal
  const userGroups = useMemo(
    () =>
      groupIds.map((id) => {
        const g = groupsMap[id] || {};
        return {
          id,
          name: g.name || id,
          status: g.status || null,
          avatarUrl: g.avatarUrl || null,
          isFavorite: !!g.isFavorite,
        };
      }),
    [groupIds, groupsMap]
  );

  const favoriteGroup = useMemo(
    () => userGroups.find((g) => g.isFavorite) || null,
    [userGroups]
  );

  // Sections pour la liste
  const sections = useMemo(() => {
    const s = [];
    if (activeDefis.length > 0)
      s.push({
        title: i18n.t('challenges.activeTitle'),
        key: 'open',
        data: activeDefis,
      });
    if (pastLimited.length > 0)
      s.push({
        title: i18n.t('challenges.pastTitle'),
        key: 'past',
        data: pastLimited,
      });
    return s;
  }, [activeDefis, pastLimited]);

  const WinnerRow = ({ uid, share }) => {
    const info = winnerInfoMap[uid] || {
      name: uid,
      photoURL: null,
    };
    const name = info.name || uid;
    const photo = info.photoURL;
    return (
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          marginBottom: 6,
        }}
      >
        {photo ? (
          <Image
            source={{ uri: photo }}
            style={{
              width: 22,
              height: 22,
              borderRadius: 11,
              backgroundColor: '#e5e7eb',
              marginRight: 8,
            }}
          />
        ) : (
          <View
            style={{
              width: 22,
              height: 22,
              borderRadius: 11,
              marginRight: 8,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: '#d1fae5',
              borderWidth: 1,
              borderColor: '#a7f3d0',
            }}
          >
            <Text
              style={{
                fontSize: 10,
                fontWeight: '800',
                color: colors.text,
              }}
            >
              {initialsFrom(name)}
            </Text>
          </View>
        )}
        <Text style={{ color: colors.text }}>
          {name}
          {share > 0 ? ` (+${share})` : ''}
        </Text>
      </View>
    );
  };

  // Rendu d'une carte de défi
  const renderCard = (item, isActive) => {
    const groupName =
      groupsMap[item.groupId]?.name || item.groupId;
    const title =
      item.title ||
      (item.type
        ? i18n.t('home.challenge') + ` ${item.type}x${item.type}`
        : i18n.t('home.challenge'));
    const pot = Number.isFinite(item.pot) ? item.pot : 0;

    const statusKey = String(item.status || '').toLowerCase();
    const winners = Array.isArray(item.winners)
      ? item.winners
      : [];
    const winnerShares = item.winnerShares || {};

    const isGhostCancelled = statusKey === 'cancelled_ghost';

    let statusLabel = '';
    let statusColor = '#6b7280';
    let statusIcon = 'checkmark-circle';

    if (statusKey === 'open' || statusKey === 'live') {
      statusLabel = i18n.t('challenges.status.active');
      statusColor = '#16a34a';
      statusIcon = 'flame';
    } else if (statusKey === 'awaiting_result') {
      statusLabel = i18n.t('challenges.status.awaiting');
      statusColor = '#ea580c';
      statusIcon = 'timer-outline';
    } else if (isGhostCancelled) {
      statusLabel = i18n.t('challenges.status.cancelledGhost');
      statusColor = '#9ca3af';
      statusIcon = 'alert-circle-outline';
    } else {
      statusLabel = i18n.t('challenges.status.completed');
      statusColor = '#6b7280';
      statusIcon = 'checkmark-circle';
    }

    const potLabel = i18n.t('challenges.potLabel', { count: pot });
    const entryCost = item.participationCost ?? item.type;

    const winnersTitle =
      winners.length > 1
        ? i18n.t('challenges.winnersTitlePlural')
        : i18n.t('challenges.winnersTitleSingular');

    return (
      <View
        style={{
          marginBottom: 12,
          padding: 12,
          borderWidth: 1,
          borderRadius: 12,
          backgroundColor: colors.card,
          elevation: 3,
          borderColor: colors.border,
        }}
      >
        {/* En-tête avec avatar groupe */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              flex: 1,
              minWidth: 0,
            }}
          >
            <Image
              source={
                groupsMap[item.groupId]?.avatarUrl
                  ? { uri: groupsMap[item.groupId].avatarUrl }
                  : GROUP_PLACEHOLDER
              }
              style={{
                width: 28,
                height: 28,
                borderRadius: 14,
                backgroundColor: colors.card2,
                borderWidth: 1,
                borderColor: colors.border,
                marginRight: 8,
              }}
            />
            <Text
              style={{
                fontWeight: '700',
                fontSize: 16,
                flexShrink: 1,
                color: colors.text,
              }}
              numberOfLines={1}
            >
              {groupName} – {title}
            </Text>
          </View>

          {/* Badge de statut */}
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons name={statusIcon} size={18} color={statusColor} />
            <Text
              style={{
                marginLeft: 6,
                color: statusColor,
                fontWeight: '700',
              }}
            >
              {statusLabel}
            </Text>
          </View>
        </View>

        {/* Infos */}
        <View style={{ marginTop: 6, gap: 2 }}>
          <Text style={{ color: colors.text }}>
            {i18n.t('challenges.gameDateLabel')}: {item.gameDate || '—'}
          </Text>

          {/* 🔹 Ces infos seulement pour les défis actifs */}
          {isActive && !isGhostCancelled && (
            <>
              <Text style={{ color: colors.text }}>
                {i18n.t('challenges.signupDeadlineLabel')}{' '}
                {fmtTSLocalHM(item.signupDeadline)}
              </Text>
              <Text style={{ color: colors.text }}>
                {i18n.t('challenges.firstGameLabel')}{' '}
                {fmtTSLocalHM(item.firstGameUTC)}
              </Text>
            </>
          )}

          {/* Cagnotte */}
          <View
            style={{
              marginTop: 6,
              alignSelf: 'stretch',
              flexDirection: 'row',
              alignItems: 'center',
              paddingVertical: 8,
              paddingHorizontal: 10,
              borderRadius: 10,
              backgroundColor: colors.card2,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <MaterialCommunityIcons
              name="cash-multiple"
              size={16}
              color="#b91c1c"
            />
            <Text
              style={{
                marginLeft: 6,
                color: colors.text,
                fontWeight: '800',
              }}
            >
              {potLabel}
            </Text>
          </View>

          {/* Coût participation – seulement pour les actifs */}
          {isActive && !isGhostCancelled && (
            <Text
              style={{ marginTop: 4, color: colors.subtext }}
            >
              {i18n.t('challenges.entryCostLabel', {
                count: entryCost,
              })}
            </Text>
          )}

          {/* Info remboursement si ghost */}
          {isGhostCancelled && (
            <Text
              style={{
                marginTop: 4,
                color: colors.subtext,
                fontSize: 12,
              }}
            >
              {i18n.t('challenges.ghostRefundHint')}
            </Text>
          )}

          {/* Gagnant(s) */}
          {statusKey === 'completed' &&
            winners.length > 0 && (
              <View
                style={{
                  marginTop: 8,
                  paddingVertical: 8,
                  paddingHorizontal: 10,
                  borderRadius: 10,
                  backgroundColor: colors.card2,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    marginBottom: 6,
                  }}
                >
                  <MaterialCommunityIcons
                    name="trophy"
                    size={16}
                    color="#16a34a"
                  />
                  <Text
                    style={{
                      marginLeft: 6,
                      color: colors.text,
                      fontWeight: '800',
                    }}
                  >
                    {winnersTitle} :
                  </Text>
                </View>

                <View>
                  {winners.map((uid) => (
                    <WinnerRow
                      key={uid}
                      uid={uid}
                      share={Number(
                        winnerShares?.[uid] ?? 0
                      )}
                    />
                  ))}
                </View>
              </View>
            )}
        </View>

        {/* Boutons */}
        <View
          style={{
            flexDirection: 'row',
            gap: 8,
            marginTop: 10,
          }}
        >
          <TouchableOpacity
            onPress={() =>
              router.push(
                `/(drawer)/defis/${item.id}/results`
              )
            }
            style={{
              flex: 1,
              paddingVertical: 10,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: colors.border,
              alignItems: 'center',
              backgroundColor: colors.card2,
            }}
          >
            <Text
              style={{
                fontWeight: '700',
                color: colors.text,
              }}
            >
              {i18n.t('challenges.seeResults')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() =>
              statusKey === 'open' || statusKey === 'live'
                ? router.push(
                    `/(drawer)/defis/${item.id}`
                  )
                : null
            }
            disabled={
              !(
                statusKey === 'open' ||
                statusKey === 'live'
              )
            }
            style={{
              flex: 1,
              paddingVertical: 10,
              borderRadius: 10,
              alignItems: 'center',
              backgroundColor:
                statusKey === 'open' ||
                statusKey === 'live'
                  ? '#b91c1c'
                  : '#9ca3af',
            }}
          >
            <Text
              style={{
                color: '#fff',
                fontWeight: '700',
              }}
            >
              {i18n.t('challenges.participate')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // UI : pas connecté
  if (!user) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
          backgroundColor: colors.background,
        }}
      >
        <Text style={{ color: colors.text }}>
          {i18n.t('challenges.loginToSee')}
        </Text>
        <TouchableOpacity
          onPress={() => router.push('/(auth)/sign-in')}
          style={{
            marginTop: 12,
            backgroundColor: '#b91c1c',
            paddingHorizontal: 16,
            paddingVertical: 10,
            borderRadius: 10,
          }}
        >
          <Text
            style={{
              color: '#fff',
              fontWeight: '700',
            }}
          >
            {i18n.t('auth.login')}
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.background,
        }}
      >
        <ActivityIndicator color={colors.primary} />
        <Text
          style={{
            marginTop: 8,
            color: colors.subtext,
          }}
        >
          {i18n.t('challenges.loadingChallenges')}
        </Text>
      </View>
    );
  }

  if (error) {
    return (
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
          {i18n.t('common.errorLabel')}{' '}
          {String(error?.message || error)}
        </Text>
      </View>
    );
  }

  return (
    <>
      {/* Modal de création de défi */}
      <CreateDefiModal
        visible={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        groups={userGroups}
        initialGroupId={favoriteGroup?.id ?? null}
        onCreated={({ groupId }) => {
          setShowCreateModal(false);
        }}
      />

      <View
        style={{
          flex: 1,
          backgroundColor: colors.background,
        }}
      >
        {/* 👉 CTA rouge en haut de la page */}
        <View
          style={{
            paddingHorizontal: 16,
            paddingTop: 16,
            paddingBottom: 8,
          }}
        >
          <TouchableOpacity
            onPress={() => setShowCreateModal(true)}
            style={{
              borderRadius: 10,
              paddingVertical: 12,
              alignItems: 'center',
              backgroundColor: '#b91c1c',
            }}
          >
            <Text
              style={{
                color: '#fff',
                fontWeight: '700',
              }}
            >
              {i18n.t('challenges.createNhlChallenge')}
            </Text>
          </TouchableOpacity>
        </View>

        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingBottom: 24,
          }}
          stickySectionHeadersEnabled={false}
          renderSectionHeader={({ section }) => (
            <Text
              style={{
                fontSize: 22,
                fontWeight: '700',
                marginBottom: 8,
                marginTop: section.key === 'past' ? 10 : 0,
                color: colors.text,
              }}
            >
              {section.title}
            </Text>
          )}
          renderItem={({ item, section }) =>
            renderCard(item, section.key === 'open')
          }
          ListEmptyComponent={() => (
            <Text
              style={{
                color: colors.subtext,
                marginTop: 24,
                textAlign: 'center',
              }}
            >
              {i18n.t('challenges.noChallenges')}
            </Text>
          )}
        />
      </View>
    </>
  );
}