// app/(drawer)/groups/[groupId].js
import {
  View,
  Text,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  Share,
  ScrollView,
  Image,
} from 'react-native';
import {
  useEffect,
  useMemo,
  useState,
  useRef,
  useCallback,
} from 'react';
import { DrawerToggleButton } from '@react-navigation/drawer';
import {
  useLocalSearchParams,
  Stack,
  useRouter,
  useNavigation,
} from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';

import firestore from '@react-native-firebase/firestore';
import functions from '@react-native-firebase/functions';

import { useAuth } from '@src/auth/SafeAuthProvider';
import { usePublicProfile } from '@src/profile/usePublicProfile';
import { getNameAvatarFrom as _getNameAvatarFrom } from '@src/profile/getNameAvatar';

import { useTheme } from '@src/theme/ThemeProvider';

import CreateDefiModal from '../../defis/CreateDefiModal';

/* ----------------------------- Helpers ----------------------------- */
function fmtDate(ts) {
  try {
    const d =
      ts?.toDate?.() ??
      (typeof ts === 'number'
        ? new Date(ts)
        : ts instanceof Date
        ? ts
        : null);
    if (!d) return '—';
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(
      d.getDate()
    )} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch {
    return '—';
  }
}
function resolveUid(m, group) {
  return (
    m?.uid ||
    m?.userId ||
    m?.participantId ||
    m?.memberId ||
    m?.ownerId ||
    (m?.role === 'owner'
      ? group?.ownerId || group?.createdBy
      : null) ||
    group?.createdBy ||
    null
  );
}

const ROW_HEIGHT = 28;
function DetailRow({ label, children, colors }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        minHeight: ROW_HEIGHT,
        marginBottom: 6,
      }}
    >
      <Text
        style={{
          width: 130,
          fontWeight: '600',
          includeFontPadding: false,
          lineHeight: 18,
          color: colors.text,
        }}
      >
        {label}
      </Text>
      <View style={{ flex: 1, justifyContent: 'center' }}>
        {typeof children === 'string' ? (
          <Text
            style={{
              includeFontPadding: false,
              lineHeight: 18,
              color: colors.text,
            }}
          >
            {children}
          </Text>
        ) : (
          children
        )}
      </View>
    </View>
  );
}
function DetailRowWithAction({ label, value, onPress, colors }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        minHeight: ROW_HEIGHT,
        marginBottom: 6,
      }}
    >
      <Text
        style={{
          width: 130,
          fontWeight: '600',
          includeFontPadding: false,
          lineHeight: 18,
          color: colors.text,
        }}
      >
        {label}
      </Text>
      <Text
        style={{ flex: 1, marginRight: 8, color: colors.text }}
        numberOfLines={1}
        ellipsizeMode="middle"
      >
        {value}
      </Text>
      <TouchableOpacity
        onPress={onPress}
        style={{
          width: 26,
          height: 26,
          borderRadius: 6,
          borderWidth: 1,
          borderColor: colors.border,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.card2,
        }}
        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
      >
        <MaterialCommunityIcons
          name="share-variant"
          size={16}
          color={colors.text}
        />
      </TouchableOpacity>
    </View>
  );
}
function getGroupEffectivePrice(group) {
  if (!group) return 5;
  return group.avatarId ? 1 : 5;
}

/* ---------- Normalisation de la forme renvoyée par usePublicProfile --------- */
function unwrapProfileShape(raw) {
  if (!raw) return null;
  let p = raw.profile ?? raw;
  if (p && typeof p.data === 'function') {
    const d = p.data();
    if (d && typeof d === 'object') p = d;
  }
  if (p && p.data && typeof p.data === 'object' && !Array.isArray(p.data)) {
    p = p.data;
  }
  if (p && p.doc && typeof p.doc === 'object') {
    const d = p.doc.data?.() ?? p.doc.data ?? p.doc;
    if (d && typeof d === 'object') p = d;
  }
  return p && typeof p === 'object' ? p : null;
}

function chooseNameAvatar(profile, membershipItem) {
  const name =
    profile?.displayName?.trim?.() ||
    profile?.name?.trim?.() ||
    membershipItem?.displayName?.trim?.() ||
    membershipItem?.name?.trim?.() ||
    null;

  const avatar =
    profile?.avatarUrl ||
    profile?.photoURL ||
    membershipItem?.avatarUrl ||
    membershipItem?.photoURL ||
    null;

  return { displayName: name, avatarUrl: avatar };
}

function MemberRow({ uid, role, item }) {
  const { colors } = useTheme();
  const pubRaw = usePublicProfile(uid);
  const profile = unwrapProfileShape(pubRaw);

  let utilName = null,
    utilAvatar = null;
  try {
    if (typeof _getNameAvatarFrom === 'function') {
      const extracted = _getNameAvatarFrom(profile) || {};
      utilName = extracted.displayName || null;
      utilAvatar = extracted.avatarUrl || null;
    }
  } catch {}

  const fallback = chooseNameAvatar(profile, item);
  const displayName = utilName || fallback.displayName || 'Invité';
  const avatarUrl = utilAvatar || fallback.avatarUrl || null;

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
        paddingHorizontal: 10,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: colors.border,
        marginBottom: 8,
        backgroundColor: colors.card,
      }}
    >
      <Image
        source={
          avatarUrl
            ? { uri: avatarUrl }
            : require('@src/assets/avatar-placeholder.png')
        }
        style={{
          width: 36,
          height: 36,
          borderRadius: 18,
          backgroundColor: colors.card2,
          marginRight: 10,
        }}
      />
      <View style={{ flex: 1 }}>
        <Text style={{ fontWeight: '700', color: colors.text }}>
          {displayName || 'Invité'}
        </Text>
        {!!role && (
          <Text style={{ color: colors.subtext, fontSize: 12 }}>
            {String(role)}
          </Text>
        )}
      </View>
    </View>
  );
}

/* ----------------------------- Écran ----------------------------- */
export default function GroupDetailScreen() {
  const { user } = useAuth();
  const { colors } = useTheme();
  const r = useRouter();
  const params = useLocalSearchParams();
  const navigation = useNavigation();

  const id = useMemo(() => {
    const raw = params.groupId;
    return Array.isArray(raw) ? String(raw[0]) : String(raw || '');
  }, [params.groupId]);

  const initial = useMemo(() => {
    try {
      return params.initial ? JSON.parse(params.initial) : null;
    } catch {
      return null;
    }
  }, [params.initial]);

  const [group, setGroup] = useState(initial);
  const [loading, setLoading] = useState(!initial);
  const [error, setError] = useState(null);
  const [memberships, setMemberships] = useState([]);

  const [hasActiveDefis, setHasActiveDefis] = useState(false);
  const [checkingDefis, setCheckingDefis] = useState(true);
  const [deleting, setDeleting] = useState(false);

  const [openCreate, setOpenCreate] = useState(params?.openCreate === '1');

  useFocusEffect(
    useCallback(() => {
      const onBeforeRemove = (e) => {
        e.preventDefault();
        r.replace('/(drawer)/(tabs)/GroupsScreen');
      };
      const sub = navigation.addListener('beforeRemove', onBeforeRemove);
      return sub;
    }, [navigation, r])
  );

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError(null);
    const ref = firestore().collection('groups').doc(id);
    const unsub = ref.onSnapshot(
      (snap) => {
        setGroup(snap.exists ? { id: snap.id, ...snap.data() } : null);
        setLoading(false);
      },
      (e) => {
        setError(e);
        setLoading(false);
      }
    );
    return () => {
      try {
        unsub();
      } catch {}
    };
  }, [id]);

  useEffect(() => {
    if (!id) return;
    const qM = firestore()
      .collection('group_memberships')
      .where('groupId', '==', id);
    const unsub = qM.onSnapshot((snap) => {
      const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const activeRows = rows.filter((m) =>
        m.status
          ? m.status === 'active'
          : m.active === true || m.active === undefined
      );
      const norm = activeRows.map((m) => ({
        ...m,
        role: String(m.role || 'member').toLowerCase(),
      }));
      setMemberships(norm);
    });
    return () => {
      try {
        unsub();
      } catch {}
    };
  }, [id]);

  useEffect(() => {
    if (!id) return;

    setCheckingDefis(true);
    const q = firestore()
      .collection('defis')
      .where('groupId', '==', id)
      .where('status', 'in', ['open', 'live', 'awaiting_result']);

    const unsub = q.onSnapshot(
      (snap) => {
        setHasActiveDefis(!snap.empty);
        setCheckingDefis(false);
      },
      (e) => {
        console.log('defis active/listen error', e);
        setHasActiveDefis(false);
        setCheckingDefis(false);
      }
    );

    return () => {
      try {
        unsub();
      } catch {}
    };
  }, [id]);

  const normalizedMemberships = useMemo(
    () =>
      memberships
        .map((m) => ({ ...m, uidNorm: resolveUid(m, group) }))
        .filter((m) => !!m.uidNorm),
    [memberships, group]
  );

  const memberList = useMemo(
    () =>
      normalizedMemberships.filter((m) =>
        ['member', 'owner'].includes(m.role)
      ),
    [normalizedMemberships]
  );

  const name = group?.name;
  const codeInvitation = group?.codeInvitation;

  const inviteMessage = `Rejoins mon groupe "${name || id}" dans Prophetik-daily.\nCode: ${
    codeInvitation ?? '—'
  }\nID: ${group?.id || id}`;
  const onShareInvite = async () => {
    try {
      await Share.share({ message: inviteMessage });
    } catch (e) {
      Alert.alert('Partage impossible', String(e?.message ?? e));
    }
  };

  const effectivePrice = getGroupEffectivePrice(group);
  const isOwner =
    !!user?.uid &&
    (group?.ownerId === user.uid ||
      group?.createdBy === user.uid ||
      (memberships || []).some((m) => {
        const uidNorm = m?.uidNorm || m?.uid || m?.participantId;
        return (
          uidNorm === user.uid &&
          String(m?.role || '').toLowerCase() === 'owner'
        );
      }));

  const handleLeaveGroup = async () => {
    try {
      const leave = functions().httpsCallable('leaveGroup');
      await leave({ groupId: group.id });
      Alert.alert('Groupe quitté', 'Tu as quitté ce groupe.');
      r.replace('/(drawer)/(tabs)/GroupsScreen');
    } catch (e) {
      console.log('leaveGroup error', e);
      Alert.alert(
        'Impossible de quitter',
        e?.message || 'Une erreur est survenue.'
      );
    }
  };

  async function handleDeleteGroup() {
    if (!group?.id) return;

    if (hasActiveDefis) {
      Alert.alert(
        'Impossible de supprimer',
        'Il reste des défis actifs ou en cours de calcul dans ce groupe.'
      );
      return;
    }

    Alert.alert(
      'Supprimer ce groupe ?',
      'Cette action est définitive. Les membres ne verront plus ce groupe.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              setDeleting(true);
              const fn = functions().httpsCallable('deleteGroup');
              await fn({ groupId: group.id });
              Alert.alert(
                'Groupe supprimé',
                'Le groupe a été supprimé avec succès.'
              );
              r.replace('/(drawer)/(tabs)/GroupsScreen');
            } catch (e) {
              console.log('deleteGroup error', e);
              Alert.alert(
                'Suppression impossible',
                e?.message ||
                  'Une erreur est survenue lors de la suppression du groupe.'
              );
            } finally {
              setDeleting(false);
            }
          },
        },
      ]
    );
  }

  const userGroups = useMemo(
    () =>
      group
        ? [
            {
              id: group.id,
              name: group.name || group.title || `ID: ${group.id || id}`,
              avatarUrl: group.avatarUrl || null,
              status: group.status || null,
            },
          ]
        : [],
    [group, id]
  );

  // 🎯 Options d’entête centralisées (utilisées dans tous les états)
  const headerOptions = {
    title: group?.name || 'Groupe',
    headerStyle: { backgroundColor: colors.header },
    headerTintColor: colors.headerTint,
    headerTitleStyle: { color: colors.headerTint },
    headerLeft: () => (
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <TouchableOpacity
          onPress={() => r.replace('/(drawer)/(tabs)/GroupsScreen')}
          style={{ paddingHorizontal: 8 }}
        >
          <Ionicons name="arrow-back" size={24} color={colors.headerTint} />
        </TouchableOpacity>
        <DrawerToggleButton tintColor={colors.headerTint} />
      </View>
    ),
  };

  /* ---------------------- États de chargement / erreur ---------------------- */
  if (loading) {
    return (
      <>
        <Stack.Screen options={headerOptions} />
        <View
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.background,
          }}
        >
          <ActivityIndicator color={colors.primary} />
          <Text style={{ color: colors.subtext, marginTop: 8 }}>
            Chargement du groupe…
          </Text>
        </View>
      </>
    );
  }

  if (error) {
    return (
      <>
        <Stack.Screen options={headerOptions} />
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
            Erreur : {String(error?.message || error)}
          </Text>
          <Text style={{ marginTop: 6, color: colors.subtext }}>ID: {id}</Text>
        </View>
      </>
    );
  }

  if (!group) {
    return (
      <>
        <Stack.Screen options={headerOptions} />
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
            Aucun groupe trouvé (ID: {id})
          </Text>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={headerOptions} />

      <CreateDefiModal
        visible={openCreate}
        onClose={() => setOpenCreate(false)}
        groups={userGroups}
        initialGroupId={group.id}
        onCreated={({ groupId }) => {
          setOpenCreate(false);
          if (groupId) {
            r.replace({
              pathname: '/(drawer)/(tabs)/ChallengesScreen',
              params: { groupId },
            });
          }
        }}
      />

      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <ScrollView
          contentContainerStyle={{ padding: 16, gap: 16 }}
          style={{ flex: 1 }}
        >
          {/* Carte Avatar de groupe */}
          <View
            style={{
              padding: 14,
              borderWidth: 1,
              borderRadius: 12,
              backgroundColor: colors.card,
              borderColor: colors.border,
              elevation: 3,
              shadowColor: '#000',
              shadowOpacity: 0.08,
              shadowRadius: 6,
              shadowOffset: { width: 0, height: 3 },
            }}
          >
            <View style={{ alignItems: 'center' }}>
              <Image
                source={
                  group?.avatarUrl
                    ? { uri: group.avatarUrl }
                    : require('@src/assets/group-placeholder.png')
                }
                style={{
                  width: 120,
                  height: 120,
                  borderRadius: 60,
                  backgroundColor: colors.card2,
                  borderWidth: 2,
                  borderColor: colors.border,
                }}
              />
              <Text
                style={{
                  fontWeight: '800',
                  fontSize: 18,
                  marginTop: 10,
                  color: colors.text,
                }}
              >
                {group?.name || group?.title || 'Groupe'}
              </Text>
            </View>

            <View style={{ marginTop: 12 }}>
              {isOwner ? (
                <TouchableOpacity
                  onPress={() =>
                    r.push({
                      pathname: '/avatars/GroupAvatarsScreen',
                      params: { groupId: group.id },
                    })
                  }
                  style={{
                    backgroundColor: colors.primary,
                    paddingVertical: 12,
                    paddingHorizontal: 20,
                    borderRadius: 10,
                    alignItems: 'center',
                    justifyContent: 'center',
                    elevation: 2,
                  }}
                >
                  <Text style={{ color: '#fff', fontWeight: '900' }}>
                    {effectivePrice === 1
                      ? 'Modifier l’avatar du groupe (1 crédit)'
                      : 'Acheter un avatar de groupe (5 crédits)'}
                  </Text>
                </TouchableOpacity>
              ) : (
                <View
                  style={{
                    backgroundColor: colors.card2,
                    paddingVertical: 12,
                    borderRadius: 10,
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ color: colors.subtext, fontWeight: '700' }}>
                    Seul le propriétaire peut changer l’avatar
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* Détails */}
          <View
            style={{
              padding: 12,
              borderWidth: 1,
              borderRadius: 12,
              backgroundColor: colors.card,
              borderColor: colors.border,
            }}
          >
            <Text
              style={{
                fontWeight: '800',
                marginBottom: 4,
                textAlign: 'center',
                color: colors.text,
              }}
            >
              Détails
            </Text>
            <DetailRow colors={colors} label="Type de groupe">
              {group?.isPrivate ? 'Privé' : 'Public'}
            </DetailRow>
            {!!codeInvitation && (
              <DetailRowWithAction
                colors={colors}
                label="Code d’invitation"
                value={codeInvitation}
                onPress={onShareInvite}
              />
            )}
            <DetailRow colors={colors} label="Créé le">
              {fmtDate(group?.createdAt)}
            </DetailRow>
            {!!group?.signupDeadline && (
              <DetailRow colors={colors} label="Inscription jusqu’à">
                {fmtDate(group.signupDeadline)}
              </DetailRow>
            )}
          </View>

          {/* Membres */}
          <View
            style={{
              padding: 12,
              borderWidth: 1,
              borderRadius: 12,
              backgroundColor: colors.card,
              borderColor: colors.border,
            }}
          >
            <View style={{ padding: 4 }}>
              <Text
                style={{
                  fontSize: 18,
                  fontWeight: '700',
                  color: colors.text,
                }}
              >
                Membres du groupe
              </Text>
            </View>
            {memberList.length === 0 ? (
              <Text
                style={{ paddingHorizontal: 4, color: colors.subtext }}
              >
                Aucun membre.
              </Text>
            ) : (
              memberList.map((m) => (
                <MemberRow
                  key={m.id || m.uidNorm}
                  uid={m.uidNorm}
                  role={m.role}
                  item={m}
                />
              ))
            )}
          </View>

          {/* Actions */}
          <View
            style={{
              padding: 12,
              borderWidth: 1,
              borderRadius: 12,
              gap: 8,
              backgroundColor: colors.card,
              borderColor: colors.border,
            }}
          >
            <Text
              style={{
                fontWeight: '700',
                textAlign: 'center',
                color: colors.text,
              }}
            >
              Actions
            </Text>
            <TouchableOpacity
              onPress={() => setOpenCreate(true)}
              style={{
                backgroundColor: colors.primary,
                padding: 14,
                borderRadius: 10,
                alignItems: 'center',
              }}
            >
              <Text style={{ color: '#fff', fontWeight: '700' }}>
                Créer un défi
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={onShareInvite}
              style={{
                backgroundColor: colors.card2,
                padding: 14,
                borderRadius: 10,
                alignItems: 'center',
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <Text style={{ fontWeight: '600', color: colors.text }}>
                Partager le code d’invitation
                {codeInvitation ? ` (${codeInvitation})` : ''}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleLeaveGroup}
              style={{
                backgroundColor: colors.card2,
                padding: 14,
                borderRadius: 10,
                alignItems: 'center',
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <Text style={{ fontWeight: '600', color: '#b00020' }}>
                Quitter ce groupe
              </Text>
            </TouchableOpacity>

            {isOwner && (
              <View style={{ marginTop: 8 }}>
                <TouchableOpacity
                  onPress={handleDeleteGroup}
                  disabled={hasActiveDefis || deleting}
                  style={{
                    backgroundColor:
                      hasActiveDefis || deleting ? colors.card2 : '#fef2f2',
                    padding: 14,
                    borderRadius: 10,
                    alignItems: 'center',
                    borderWidth: 1,
                    borderColor: colors.border,
                    opacity: hasActiveDefis || deleting ? 0.7 : 1,
                  }}
                >
                  <Text style={{ fontWeight: '700', color: '#b91c1c' }}>
                    {deleting ? 'Suppression…' : 'Supprimer ce groupe'}
                  </Text>
                </TouchableOpacity>

                {checkingDefis && (
                  <Text
                    style={{
                      marginTop: 4,
                      fontSize: 12,
                      color: colors.subtext,
                    }}
                  >
                    Vérification des défis actifs…
                  </Text>
                )}

                {hasActiveDefis && !checkingDefis && (
                  <Text
                    style={{
                      marginTop: 4,
                      fontSize: 12,
                      color: '#b91c1c',
                    }}
                  >
                    Tu ne peux pas supprimer ce groupe tant que des défis sont
                    ouverts / en cours.
                  </Text>
                )}
              </View>
            )}
          </View>
        </ScrollView>
      </View>
    </>
  );
}