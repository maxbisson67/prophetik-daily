// app/(drawer)/groups/[groupId].js
import {
  View,
  Text,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  ScrollView,
  Modal,
} from 'react-native';
import { useEffect, useMemo, useState, useCallback } from 'react';
import { snapshotExists, snapshotData, snapshotId } from "@src/lib/safeSnapshot";
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

import { useAuth } from '@src/auth/SafeAuthProvider';
import { usePublicProfile } from '@src/profile/usePublicProfile';
import { getNameAvatarFrom as _getNameAvatarFrom } from '@src/profile/getNameAvatar';

import { useTheme } from '@src/theme/ThemeProvider';
import i18n from '@src/i18n/i18n';

import CreateDefiModal from '../../defis/CreateDefiModal';

import InviteQrCard from "@src/groups/InviteQrCard";
import GroupConfigSection from "@src/groups/components/GroupConfigSection";
import GroupAvatar from "@src/groups/components/GroupAvatar";
import {
  resolveParticipation,
  isParticipatingMember,
  PARTICIPATION,
} from "@src/groups/participationUtils";
import LeaderboardParticipantProfileModal from "@src/leaderboard/LeaderboardParticipantProfileModal";
import normalizeMemberRow from "@src/leaderboard/normalizeMemberRow";
import useLeaderboardGroupMembers from "@src/leaderboard/useLeaderboardGroupMembers";
import useLeaderboardProfiles, {
  resolveLeaderboardMember,
} from "@src/leaderboard/useLeaderboardProfiles";
import useActiveCompetition from "@src/hooks/useActiveCompetition";
import ParticipantAvatar from "@src/ui/ParticipantAvatar";

import {
  leaveGroupService,
  deleteGroupService,
  transferGroupOwnershipService,
} from '@src/groups/manageGroupService';
import { isGroupOwner } from '@src/groups/groupOwnership';

/* ----------------------------- Helpers ----------------------------- */
const RED = '#b91c1c';

function leftAccentCardStyle(colors) {
  return {
    backgroundColor: colors.card,
    borderRadius: 16,
    overflow: 'hidden',
    padding: 12,
    borderLeftWidth: 4,
    borderLeftColor: RED,
  };
}

function fmtDateYmd(ts) {
  try {
    const d =
      ts?.toDate?.() ??
      (typeof ts === 'number'
        ? new Date(ts)
        : ts instanceof Date
        ? ts
        : null);
    if (!d || Number.isNaN(d.getTime())) return null;
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  } catch {
    return null;
  }
}

function formatMemberSubtitle({ role, item, group }) {
  if (role === 'owner') {
    const date = fmtDateYmd(group?.createdAt);
    if (date) {
      return i18n.t('groups.detail.ownerCreatedOn', {
        date,
        defaultValue: `Owner, group created on ${date}`,
      });
    }
    return i18n.t('groups.detail.roleOwner', { defaultValue: 'Owner' });
  }

  const date = fmtDateYmd(item?.joinedAt ?? item?.createdAt);
  if (date) {
    return i18n.t('groups.detail.memberSince', {
      date,
      defaultValue: `Member since ${date}`,
    });
  }

  if (role === 'member') {
    return i18n.t('groups.detail.roleMember', { defaultValue: 'Member' });
  }

  return role ? String(role) : null;
}

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
    (m?.role === 'owner' ? group?.ownerId || group?.createdBy : null) ||
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

function participationStatusMeta(m) {
  const mode = resolveParticipation(m);
  if (mode === PARTICIPATION.ACTIVE) {
    return {
      mode,
      label: i18n.t("groups.detail.participationStatusActive", { defaultValue: "Actif" }),
      color: "#16a34a",
      bg: "#16a34a18",
    };
  }
  if (mode === PARTICIPATION.ADMIN_ONLY) {
    return {
      mode,
      label: i18n.t("groups.detail.participationStatusAdminOnly", {
        defaultValue: "Admin seulement",
      }),
      color: "#d97706",
      bg: "#d9770618",
    };
  }
  return {
    mode,
    label: i18n.t("groups.detail.participationStatusInactive", { defaultValue: "Inactif" }),
    color: "#64748b",
    bg: "#64748b18",
  };
}

function StatusChip({ label, color, bg, colors }) {
  return (
    <View
      style={{
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 999,
        backgroundColor: bg || colors.card2,
        borderWidth: 1,
        borderColor: color || colors.border,
      }}
    >
      <Text style={{ color: color || colors.subtext, fontSize: 10, fontWeight: "800" }}>
        {label}
      </Text>
    </View>
  );
}

function MemberRow({
  uid,
  role,
  item,
  group,
  profiles,
  isAiMember = false,
  isOwnerRow = false,
  isMe = false,
  onPress,
}) {
  const { colors } = useTheme();
  const pubRaw = usePublicProfile(uid);
  const profile = unwrapProfileShape(pubRaw);

  let utilName = null,
    utilAvatar = null;
  try {
    if (typeof _getNameAvatarFrom === "function") {
      const extracted = _getNameAvatarFrom(profile) || {};
      utilName = extracted.displayName || null;
      utilAvatar = extracted.avatarUrl || null;
    }
  } catch {}

  const fallback = chooseNameAvatar(profile, item);
  const lbIdentity = resolveLeaderboardMember({ uid, id: uid }, profiles || {});
  const displayName =
    utilName || lbIdentity.displayName || fallback.displayName || "Invité";
  const participationMeta = participationStatusMeta(item);
  const subtitle = isAiMember
    ? i18n.t("groups.detail.novaAiParticipant", {
        defaultValue: "Participant IA · assiste aux défis du groupe",
      })
    : formatMemberSubtitle({ role, item, group });
  const version = lbIdentity.updatedAt?.toMillis?.() ? lbIdentity.updatedAt.toMillis() : 0;

  const accentColor = isOwnerRow
    ? "#FACC15"
    : isAiMember
    ? "#8b5cf6"
    : isParticipatingMember(item)
    ? "#16a34a"
    : colors.subtext;

  return (
    <TouchableOpacity
      activeOpacity={0.82}
      onPress={onPress}
      disabled={!onPress}
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 10,
        paddingHorizontal: 10,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: isMe ? colors.primary : colors.border,
        borderLeftWidth: 4,
        borderLeftColor: accentColor,
        marginBottom: 8,
        backgroundColor: isMe ? colors.rowAlt || colors.card2 : colors.card,
        shadowColor: "#000",
        shadowOpacity: 0.08,
        shadowOffset: { width: 0, height: 2 },
        shadowRadius: 5,
        elevation: 2,
      }}
    >
      <View style={{ marginRight: 10, flexShrink: 0 }}>
        <ParticipantAvatar
          photoURL={lbIdentity.avatarUrl || utilAvatar || fallback.avatarUrl}
          avatarUrl={lbIdentity.avatarUrl || utilAvatar || fallback.avatarUrl}
          jerseyFrontUrl={lbIdentity.jerseyFrontUrl}
          jerseyBackUrl={lbIdentity.jerseyBackUrl}
          avatarKind={lbIdentity.avatarKind}
          name={displayName}
          size={40}
          colors={colors}
          version={version}
        />
      </View>

      <View style={{ flex: 1, minWidth: 0, paddingRight: 6 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <Text style={{ fontWeight: "800", color: colors.text, fontSize: 15 }} numberOfLines={1}>
            {displayName}
          </Text>
          {isOwnerRow ? (
            <Ionicons name="star" size={14} color="#FACC15" />
          ) : null}
          {isAiMember ? (
            <StatusChip
              label={i18n.t("groups.detail.novaAiBadge", { defaultValue: "IA" })}
              color="#8b5cf6"
              bg="#8b5cf618"
              colors={colors}
            />
          ) : null}
        </View>

        {!!subtitle && (
          <Text style={{ color: colors.subtext, fontSize: 12, marginTop: 2 }} numberOfLines={2}>
            {subtitle}
          </Text>
        )}

        {!isAiMember ? (
          <View style={{ marginTop: 6, alignSelf: "flex-start" }}>
            <StatusChip
              label={participationMeta.label}
              color={participationMeta.color}
              bg={participationMeta.bg}
              colors={colors}
            />
          </View>
        ) : null}
      </View>

      {onPress ? (
        <Ionicons name="chevron-forward" size={18} color={colors.subtext} style={{ flexShrink: 0 }} />
      ) : null}
    </TouchableOpacity>
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

  // Transfer ownership modal
  const [transferOpen, setTransferOpen] = useState(false);
  const [profileRow, setProfileRow] = useState(null);
  const [transferring, setTransferring] = useState(false);
  const [draftFavoriteTeam, setDraftFavoriteTeam] = useState(null);

  useFocusEffect(
    useCallback(() => {
      setDraftFavoriteTeam(null);

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
        setGroup(snapshotExists(snap) ? { id: snapshotId(snap), ...snapshotData(snap) } : null);
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
      const rows = (snap?.docs ?? []).map((d) => ({ id: d.id, ...d.data() }));
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

  const isAi = useCallback((m) => {
    const uidX = String(m?.uidNorm || m?.uid || "");
    const typeX = String(m?.type || "").toLowerCase();
    return uidX === "ai" || typeX === "ai";
  }, []);

  const memberList = useMemo(
    () =>
      normalizedMemberships.filter((m) =>
        ['member', 'owner'].includes(m.role)
      ),
    [normalizedMemberships]
  );

  const sortedMemberList = useMemo(() => {
    const list = [...memberList];
    list.sort((a, b) => {
      const tier = (m) => {
        if (String(m.role || "").toLowerCase() === "owner") return 0;
        if (isAi(m)) return 2;
        return 1;
      };
      const tierDiff = tier(a) - tier(b);
      if (tierDiff !== 0) return tierDiff;

      const activeDiff =
        Number(isParticipatingMember(b)) - Number(isParticipatingMember(a));
      if (activeDiff !== 0) return activeDiff;

      const nameA = String(a.displayName || a.uidNorm || "");
      const nameB = String(b.displayName || b.uidNorm || "");
      return nameA.localeCompare(nameB, "fr");
    });
    return list;
  }, [memberList, isAi]);

  const memberUids = useMemo(
    () => sortedMemberList.map((m) => String(m.uidNorm)).filter(Boolean),
    [sortedMemberList]
  );
  const memberProfiles = useLeaderboardProfiles(memberUids);

  const groupSport = String(group?.sport || group?.league || "NHL").toUpperCase();
  const { competitionKey: activeCompetitionKey } = useActiveCompetition({
    sport: groupSport,
    enabled: !!group?.id,
  });
  const { rows: rawLeaderboardRows } = useLeaderboardGroupMembers({
    groupId: id,
    competitionKey: activeCompetitionKey,
    sport: groupSport,
    enabled: !!id && !!activeCompetitionKey,
  });
  const leaderboardRows = useMemo(
    () => (rawLeaderboardRows || []).map(normalizeMemberRow),
    [rawLeaderboardRows]
  );

  const openMemberProfile = useCallback(
    (uid) => {
      const uidStr = String(uid || "").trim();
      if (!uidStr) return;
      const lbRow = leaderboardRows.find((r) => String(r.id || r.uid) === uidStr);
      setProfileRow(
        lbRow || {
          id: uidStr,
          uid: uidStr,
          pointsTotal: 0,
          fgcPoints: 0,
          tpPoints: 0,
          tsPoints: 0,
          wins: 0,
          participations: 0,
        }
      );
    },
    [leaderboardRows]
  );

  const humanMembers = memberList.filter(
    (m) => m.uidNorm !== 'ai'
  );

  const codeInvitation = group?.codeInvitation;

  const effectivePrice = getGroupEffectivePrice(group);

  const isOwner = isGroupOwner(group, user?.uid);

  const activeMembers = useMemo(() => {
    return normalizedMemberships.filter((m) => {
      const st = String(m?.status || 'active').toLowerCase();
      const active = m?.active === true || m?.active === undefined;
      return st === 'active' && active;
    });
  }, [normalizedMemberships]);

  const otherHumanMembers = useMemo(() => {
    if (!user?.uid) return [];

    return activeMembers
      .filter((m) => String(m.role || 'member').toLowerCase() === 'member') // ✅ members seulement
      .filter((m) => !isAi(m))                                              // ✅ exclut Nova
      .filter((m) => String(m.uidNorm) !== String(user.uid));               // ✅ exclut moi-même
  }, [activeMembers, isAi, user?.uid]);

  const hasOtherHuman = otherHumanMembers.length > 0;

  const handleLeaveGroup = async () => {
    if (!group?.id) return;

    // Owner: si d’autres humains, transfert requis
    if (isOwner && hasOtherHuman) {
      Alert.alert(
        i18n.t('groups.detail.transferRequiredTitle') || 'Transfert requis',
        i18n.t('groups.detail.transferRequiredMessage') ||
          "Il reste d'autres membres. Tu dois transférer la propriété avant de quitter.",
        [
          { text: i18n.t('common.cancel') || 'Annuler', style: 'cancel' },
          {
            text: i18n.t('groups.detail.actionTransferOwnership') || 'Transférer la propriété',
            onPress: () => setTransferOpen(true),
          },
        ]
      );
      return;
    }

    const title = isOwner
      ? (i18n.t('groups.detail.leaveOwnerConfirmTitle') || 'Quitter le groupe ?')
      : (i18n.t('groups.detail.leaveConfirmTitle') || 'Quitter le groupe ?');

    const msg = isOwner
      ? (i18n.t('groups.detail.leaveOwnerConfirmMessage') ||
          "Comme tu es le propriétaire et qu'il ne reste que toi et Nova, le groupe sera archivé.")
      : (i18n.t('groups.detail.leaveConfirmMessage') || "Tu vas quitter ce groupe.");

    Alert.alert(title, msg, [
      { text: i18n.t('common.cancel') || 'Annuler', style: 'cancel' },
      {
        text: i18n.t('common.confirm') || 'Confirmer',
        style: 'destructive',
        onPress: async () => {
          try {
            await leaveGroupService({ groupId: group.id });
            Alert.alert(
              i18n.t('groups.detail.leaveConfirmTitle') || 'OK'
                (isOwner ? 'Groupe archivé.' : 'Tu as quitté le groupe.')
            );
            r.replace('/(drawer)/(tabs)/GroupsScreen');
          } catch (e) {
            console.log('leaveGroup error', e);
            Alert.alert(
              i18n.t('groups.detail.leaveErrorTitle') || 'Erreur',
              String(e?.message || e)
            );
          }
        },
      },
    ]);
  };

  async function handleDeleteGroup() {
    if (!group?.id) return;

    if (hasOtherHuman) {
      Alert.alert(
        i18n.t('groups.detail.deleteBlockedTitle') || 'Suppression impossible',
        i18n.t('groups.detail.deleteBlockedOtherMembers') ||
          "Il reste d'autres membres. Transfère la propriété ou fais-les quitter avant de supprimer."
      );
      return;
    }

    if (hasActiveDefis) {
      Alert.alert(
        i18n.t('groups.detail.deleteBlockedTitle'),
        i18n.t('groups.detail.deleteBlockedMessage')
      );
      return;
    }

    Alert.alert(
      i18n.t('groups.detail.deleteConfirmTitle'),
      i18n.t('groups.detail.deleteConfirmMessage'),
      [
        { text: i18n.t('groups.detail.deleteConfirmCancel'), style: 'cancel' },
        {
          text: i18n.t('groups.detail.deleteConfirmOk'),
          style: 'destructive',
          onPress: async () => {
            try {
              setDeleting(true);
              await deleteGroupService({ groupId: group.id });
              Alert.alert(
                i18n.t('groups.detail.deleteDoneTitle'),
                i18n.t('groups.detail.deleteDoneMessage')
              );
              r.replace('/(drawer)/(tabs)/GroupsScreen');
            } catch (e) {
              console.log('deleteGroup error', e);
              Alert.alert(
                i18n.t('groups.detail.deleteErrorTitle'),
                String(e?.message || e)
              );
            } finally {
              setDeleting(false);
            }
          },
        },
      ]
    );
  }

  async function handleTransferOwnership(newOwnerUid) {
    if (!group?.id || !newOwnerUid) return;

    try {
      setTransferring(true);
      await transferGroupOwnershipService({ groupId: group.id, newOwnerUid });

      setTransferOpen(false);

      Alert.alert(
        i18n.t('groups.detail.transferDoneTitle') || 'OK',
        i18n.t('groups.detail.transferDoneMessage') || 'Propriété transférée.'
      );
    } catch (e) {
      console.log('transfer ownership error', e);
      Alert.alert(
        i18n.t('groups.detail.transferErrorTitle') || 'Erreur',
        String(e?.message || e)
      );
    } finally {
      setTransferring(false);
    }
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
              autopilotEnabled: group.autopilotEnabled !== false,
            },
          ]
        : [],
    [group, id]
  );

  // Options d’entête centralisées
  const headerOptions = {
    title: group?.name || i18n.t('groups.detail.headerFallback'),
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
            {i18n.t('groups.detail.loading')}
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
            {i18n.t('groups.detail.errorPrefix')}{' '}
            {String(error?.message || error)}
          </Text>
          <Text style={{ marginTop: 6, color: colors.subtext }}>
            {i18n.t('groups.detail.idLabel', { id })}
          </Text>
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
            {i18n.t('groups.detail.notFound', { id })}
          </Text>
        </View>
      </>
    );
  }

  const displayFavoriteTeam = isOwner
    ? draftFavoriteTeam ?? group?.favoriteTeam ?? null
    : group?.favoriteTeam ?? null;

  return (
    <>
      <Stack.Screen options={headerOptions} />

      {/* Modal: Transfer ownership */}
      <Modal
        visible={transferOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setTransferOpen(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.35)',
            padding: 16,
            justifyContent: 'center',
          }}
        >
          <View
            style={{
              backgroundColor: colors.card,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: colors.border,
              padding: 14,
            }}
          >
            <Text style={{ fontWeight: '900', fontSize: 18, color: colors.text }}>
              {i18n.t('groups.detail.transferOwnershipTitle') || 'Transférer la propriété'}
            </Text>
            <Text style={{ marginTop: 6, color: colors.subtext }}>
              {i18n.t('groups.detail.transferOwnershipSubtitle') ||
                "Choisis un membre (autre que Nova) pour devenir propriétaire."}
            </Text>

            <View style={{ marginTop: 12 }}>
              {otherHumanMembers.length === 0 ? (
                <Text style={{ color: colors.subtext }}>
                  {i18n.t('groups.detail.transferNoCandidates') || "Aucun membre éligible."}
                </Text>
              ) : (
                otherHumanMembers.map((m) => (
                  <TouchableOpacity
                    key={m.id || m.uidNorm}
                    disabled={transferring}
                    onPress={() => handleTransferOwnership(m.uidNorm)}
                    style={{
                      padding: 12,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: colors.border,
                      backgroundColor: colors.card2,
                      marginBottom: 10,
                      opacity: transferring ? 0.6 : 1,
                    }}
                  >
                    <MemberRow uid={m.uidNorm} role={m.role} item={m} />
                  </TouchableOpacity>
                ))
              )}
            </View>

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 6 }}>
              <TouchableOpacity
                onPress={() => setTransferOpen(false)}
                disabled={transferring}
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: colors.border,
                  alignItems: 'center',
                  backgroundColor: colors.card2,
                  opacity: transferring ? 0.6 : 1,
                }}
              >
                <Text style={{ fontWeight: '800', color: colors.text }}>
                  {i18n.t('common.cancel') || 'Annuler'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <LeaderboardParticipantProfileModal
        visible={!!profileRow}
        row={profileRow}
        peerRows={leaderboardRows}
        profiles={memberProfiles}
        sport={groupSport}
        colors={colors}
        onClose={() => setProfileRow(null)}
      />

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
          <View style={leftAccentCardStyle(colors)}>
            <View style={{ alignItems: 'center' }}>
              <GroupAvatar
                group={{ ...group, favoriteTeam: displayFavoriteTeam }}
                size={120}
                colors={colors}
                style={{
                  backgroundColor: colors.card2,
                  borderWidth: 2,
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
                {group?.name ||
                  group?.title ||
                  i18n.t('groups.detail.headerFallback')}
              </Text>
            </View>
          </View>

          <GroupConfigSection
            group={group}
            isOwner={isOwner}
            colors={colors}
            onFavoriteTeamDraftChange={isOwner ? setDraftFavoriteTeam : undefined}
          />

          {/* Membres */}
          <View style={leftAccentCardStyle(colors)}>
            <View style={{ padding: 4 }}>
              <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text }}>
                {i18n.t('groups.detail.membersSection')}
              </Text>
            </View>

            {sortedMemberList.length === 0 ? (
              <Text style={{ paddingHorizontal: 4, color: colors.subtext }}>
                {i18n.t('groups.detail.noMembers')}
              </Text>
            ) : (
              sortedMemberList.map((m) => (
                <MemberRow
                  key={m.id || m.uidNorm}
                  uid={m.uidNorm}
                  role={m.role}
                  item={m}
                  group={group}
                  profiles={memberProfiles}
                  isAiMember={isAi(m)}
                  isOwnerRow={String(m.role || "").toLowerCase() === "owner"}
                  isMe={!!user?.uid && String(m.uidNorm) === String(user.uid)}
                  onPress={() => openMemberProfile(m.uidNorm)}
                />
              ))
            )}
          </View>

        {(!!codeInvitation || !!group?.signupDeadline) && (
        <View style={leftAccentCardStyle(colors)}>
          {!!codeInvitation && (
            <InviteQrCard
              code={codeInvitation}
              groupName={group?.name || group?.title || "Prophetik"}
              colors={colors}
            />
          )}

          {!!group?.signupDeadline && (
            <DetailRow colors={colors} label={i18n.t("groups.detail.signupUntil")}>
              {fmtDate(group.signupDeadline)}
            </DetailRow>
          )}
        </View>
        )}

          {/* Options de partage */}
          <View style={[leftAccentCardStyle(colors), { gap: 8 }]}>
            <View style={{ padding: 4 }}>
              <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text }}>
                {i18n.t('groups.detail.actionsSection')}
              </Text>
            </View>

        
            {/* Quitter (member) / Quitter (owner -> archive) */}
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
                {isOwner
                  ? (i18n.t('groups.detail.actionLeaveOwner') || 'Quitter (archiver le groupe)')
                  : i18n.t('groups.detail.actionLeaveGroup')}
              </Text>
            </TouchableOpacity>

            {/* Bouton transfert explicite */}
            {isOwner && hasOtherHuman && (
              <TouchableOpacity
                onPress={() => setTransferOpen(true)}
                style={{
                  backgroundColor: colors.primary,
                  padding: 14,
                  borderRadius: 10,
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: '#fff', fontWeight: '800' }}>
                  {i18n.t('groups.detail.actionTransferOwnership') || 'Transférer la propriété'}
                </Text>
              </TouchableOpacity>
            )}

            {/* Suppression uniquement si owner + aucun autre humain */}
            {isOwner && !hasOtherHuman && (
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
                    {deleting
                      ? (i18n.t('groups.detail.deleting') || 'Suppression…')
                      : i18n.t('groups.detail.deleteConfirmTitle')}
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
                    {i18n.t('groups.detail.checkingDefis')}
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
                    {i18n.t('groups.detail.cannotDeleteWhileDefis')}
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