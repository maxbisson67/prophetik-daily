// app/avatars/GroupAvatarsScreen.js
import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  FlatList,
  TouchableOpacity,
  Image,
  Alert,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import firestore from '@react-native-firebase/firestore';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

// i18n
import i18n from '@src/i18n/i18n';

// Safe auth
import { useAuth } from '@src/auth/SafeAuthProvider';
import { useTheme } from '@src/theme/ThemeProvider';

// ⚠️ Fallback (dev only) – noms non traduits ici
const FALLBACK = [
  { id: 'wolves', name: 'Les Loups', url: 'https://picsum.photos/seed/wolves/400', sort: 10 },
  { id: 'titans', name: 'Les Titans', url: 'https://picsum.photos/seed/titans/400', sort: 20 },
  { id: 'visions', name: 'Les Visionnaires', url: 'https://picsum.photos/seed/visions/400', sort: 30 },
  { id: 'dragons', name: 'Les Dragons', url: 'https://picsum.photos/seed/dragons/400', sort: 40 },
  { id: 'skaters', name: 'Les Patineurs Fous', url: 'https://picsum.photos/seed/skaters/400', sort: 50 },
  { id: 'blizzard', name: 'Le Blizzard', url: 'https://picsum.photos/seed/blizzard/400', sort: 60 },
];

function Chip({ icon, color, bg, label }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        paddingVertical: 4,
        paddingHorizontal: 8,
        borderRadius: 999,
        backgroundColor: bg || '#F3F4F6',
      }}
    >
      {!!icon && (
        <MaterialCommunityIcons name={icon} size={14} color={color || '#111'} />
      )}
      <Text
        style={{
          color: color || '#111',
          marginLeft: icon ? 6 : 0,
          fontWeight: '700',
        }}
      >
        {label}
      </Text>
    </View>
  );
}

// ✅ Détecte si un groupe est archivé selon plusieurs schémas possibles
function isGroupArchived(g) {
  if (!g) return false;

  if (g.archived === true) return true;
  if (g.isArchived === true) return true;

  const status = String(g.status || '').toLowerCase();
  if (status === 'archived') return true;

  if (g.archivedAt) return true;
  if (g.archivedOn) return true;

  if (g.disabled === true) return true;

  return false;
}

export default function GroupAvatarsScreen() {
  const params = useLocalSearchParams();
  const groupId = useMemo(
    () => (Array.isArray(params.groupId) ? params.groupId[0] : params.groupId) || '',
    [params.groupId]
  );

  const router = useRouter();
  const { user } = useAuth();
  const { colors } = useTheme();
  const isDark = colors.background === '#111827';

  const [group, setGroup] = useState(null);
  const [loadingGroup, setLoadingGroup] = useState(true);

  const [items, setItems] = useState(null);
  const [loadingItems, setLoadingItems] = useState(true);

  const [busy, setBusy] = useState(false);

  const [selectedId, setSelectedId] = useState(null);
  const selectedItem = useMemo(
    () => (items || []).find((a) => a.id === selectedId) || null,
    [items, selectedId]
  );

  // Group meta
  useEffect(() => {
    if (!groupId) {
      setGroup(null);
      setLoadingGroup(false);
      return;
    }
    setLoadingGroup(true);
    const ref = firestore().doc(`groups/${String(groupId)}`);
    const unsub = ref.onSnapshot(
      (snap) => {
        setGroup(snap.exists ? { id: snap.id, ...snap.data() } : null);
        setLoadingGroup(false);
      },
      () => setLoadingGroup(false)
    );
    return () => {
      try { unsub(); } catch {}
    };
  }, [groupId]);

  const groupArchived = useMemo(() => isGroupArchived(group), [group]);

  // Catalog (group avatars)
  useEffect(() => {
    setLoadingItems(true);
    const qRef = firestore()
      .collection('catalog_group_avatars')
      .orderBy('sort', 'asc');

    const unsub = qRef.onSnapshot(
      (snap) => {
        const rows = snap?.docs?.map((d) => ({ id: d.id, ...d.data() })) || [];
        setItems(rows.length ? rows : FALLBACK);
        setLoadingItems(false);
      },
      () => {
        setItems(FALLBACK);
        setLoadingItems(false);
      }
    );

    return () => {
      try { unsub(); } catch {}
    };
  }, []);

  const canManage =
    !!user?.uid &&
    !!group &&
    (group.ownerId === user.uid ||
      group.createdBy === user.uid ||
      String(group.ownerUid || '').toLowerCase() === String(user.uid).toLowerCase() ||
      (Array.isArray(group.admins) && group.admins.includes(user.uid)));

  async function handleApply() {
    // Blocage si groupe archivé
    if (groupArchived) {
      return Alert.alert(
        i18n.t('groupAvatars.alerts.archivedTitle', 'Groupe archivé'),
        i18n.t(
          'groupAvatars.alerts.archivedBody',
          'Ce groupe est archivé. Tu ne peux pas changer l’avatar.'
        )
      );
    }

    if (!user?.uid) {
      return Alert.alert(
        i18n.t('groupAvatars.alerts.loginRequiredTitle', 'Connexion requise'),
        i18n.t('groupAvatars.alerts.loginRequiredBody', 'Connecte-toi pour modifier un avatar.')
      );
    }

    if (!group?.id) {
      return Alert.alert(
        i18n.t('groupAvatars.alerts.groupRequiredTitle', 'Groupe requis'),
        i18n.t('groupAvatars.alerts.groupRequiredBody', 'Aucun groupe n’a été fourni.')
      );
    }

    if (!selectedItem) {
      return Alert.alert(
        i18n.t('groupAvatars.alerts.selectRequiredTitle', 'Choisis un avatar'),
        i18n.t('groupAvatars.alerts.selectRequiredBody', 'Sélectionne un avatar avant d’appliquer.')
      );
    }

    if (!canManage) {
      return Alert.alert(
        i18n.t('groupAvatars.alerts.accessDeniedTitle', 'Accès refusé'),
        i18n.t('groupAvatars.alerts.accessDeniedBody', 'Seul le propriétaire du groupe peut changer son avatar.')
      );
    }

    try {
      setBusy(true);

      // ✅ Simple "apply" côté client : on met avatarId + avatarUrl sur groups/{groupId}
      await firestore()
        .doc(`groups/${group.id}`)
        .set(
          {
            avatarId: selectedItem.id,
            avatarUrl: selectedItem.url,
            updatedAt: firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );

      const groupName = group?.name || group?.title || group?.id || '—';

      Alert.alert(
        i18n.t('groupAvatars.alerts.appliedTitle', '✅ Avatar appliqué'),
        i18n.t('groupAvatars.alerts.appliedBody', {
          defaultValue: 'Le groupe “{{name}}” a un nouvel avatar.',
          name: groupName,
        }),
        [{ text: i18n.t('common.ok', 'OK'), onPress: () => router.back() }]
      );
    } catch (e) {
      Alert.alert(
        i18n.t('groupAvatars.alerts.applyFailedTitle', 'Impossible de modifier'),
        String(e?.message || e)
      );
    } finally {
      setBusy(false);
    }
  }

  const headerTitle = i18n.t('groupAvatars.title', 'Avatars de groupe');

  return (
    <>
      <Stack.Screen
        options={{
          title: headerTitle,
          headerLeft: () => (
            <TouchableOpacity
              onPress={() => router.back()}
              style={{ paddingHorizontal: 10 }}
            >
              <Ionicons name="arrow-back" size={24} color={colors.text} />
            </TouchableOpacity>
          ),
          headerStyle: { backgroundColor: colors.card },
          headerTitleStyle: { color: colors.text },
          headerTintColor: colors.text,
        }}
      />

      <FlatList
        data={items || []}
        keyExtractor={(it) => it.id}
        numColumns={2}
        columnWrapperStyle={{ gap: 12 }}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={{
          padding: 16,
          gap: 12,
          backgroundColor: colors.background,
        }}
        ListHeaderComponent={
          <View style={{ gap: 12 }}>
            {/* Bandeau groupe (sans crédits) */}
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
              <Text style={{ fontWeight: '800', fontSize: 16, marginBottom: 6, color: colors.text }}>
                {i18n.t('groupAvatars.group.title', 'Groupe')}
              </Text>

              <Text style={{ fontWeight: '700', color: colors.text }}>
                {loadingGroup
                  ? i18n.t('common.initializing', 'Chargement…')
                  : group?.name || group?.title || group?.id || '—'}
              </Text>

              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  marginTop: 8,
                  gap: 10,
                }}
              >
                <View style={{ gap: 6 }}>
                  <Chip
                    icon={canManage ? 'shield-check' : 'lock'}
                    color={canManage ? '#065F46' : '#991B1B'}
                    bg={canManage ? '#ECFDF5' : '#FEE2E2'}
                    label={
                      canManage
                        ? i18n.t('groupAvatars.access.owner', 'Tu es propriétaire')
                        : i18n.t('groupAvatars.access.readOnly', 'Lecture seule')
                    }
                  />
                  {groupArchived && (
                    <Chip
                      icon="archive"
                      color="#92400E"
                      bg="#FEF3C7"
                      label={i18n.t('groupAvatars.access.archived', 'Groupe archivé')}
                    />
                  )}
                </View>
              </View>
            </View>

            {/* Aperçu sélection + bouton appliquer */}
            <View
              style={{
                padding: 12,
                borderWidth: 1,
                borderRadius: 12,
                backgroundColor: colors.card,
                borderColor: colors.border,
              }}
            >
              <Text style={{ fontWeight: '700', marginBottom: 8, color: colors.text }}>
                {i18n.t('groupAvatars.preview.title', 'Aperçu')}
              </Text>

              <View style={{ alignItems: 'center', justifyContent: 'center' }}>
                {selectedItem?.url ? (
                  <Image
                    source={{ uri: selectedItem.url }}
                    style={{
                      width: 180,
                      height: 180,
                      borderRadius: 90,
                      backgroundColor: colors.card2 || '#1f2937',
                    }}
                  />
                ) : (
                  <View
                    style={{
                      width: 180,
                      height: 180,
                      borderRadius: 90,
                      backgroundColor: colors.card2 || '#1f2937',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text style={{ color: colors.subtext }}>
                      {i18n.t('groupAvatars.preview.noneSelected', 'Sélectionne un avatar')}
                    </Text>
                  </View>
                )}

                {!!selectedItem && (
                  <Text style={{ marginTop: 8, fontWeight: '700', color: colors.text }}>
                    {selectedItem.name || selectedItem.id}
                  </Text>
                )}

                {(() => {
                  const disabled = busy || !selectedItem || !canManage || groupArchived;

                  const btnLabel = busy
                    ? i18n.t('groupAvatars.actions.processing', 'Traitement…')
                    : groupArchived
                    ? i18n.t('groupAvatars.actions.archivedDisabled', 'Groupe archivé')
                    : selectedItem
                    ? i18n.t('groupAvatars.actions.applyButton', 'Appliquer')
                    : i18n.t('groupAvatars.actions.chooseFirst', 'Choisis un avatar');

                  return (
                    <TouchableOpacity
                      onPress={handleApply}
                      disabled={disabled}
                      style={{
                        marginTop: 12,
                        backgroundColor: disabled ? '#9ca3af' : colors.primary,
                        paddingVertical: 14,
                        paddingHorizontal: 16,
                        borderRadius: 12,
                        alignItems: 'center',
                        elevation: 2,
                        shadowColor: '#000',
                        shadowOpacity: 0.1,
                        shadowRadius: 4,
                        shadowOffset: { width: 0, height: 2 },
                      }}
                    >
                      <Text style={{ color: '#fff', fontWeight: '900' }}>
                        {btnLabel}
                      </Text>
                    </TouchableOpacity>
                  );
                })()}

                {groupArchived && (
                  <Text style={{ marginTop: 10, color: colors.subtext, fontSize: 12, textAlign: 'center' }}>
                    {i18n.t(
                      'groupAvatars.hints.archivedExplain',
                      'Ce groupe est archivé : les modifications sont désactivées.'
                    )}
                  </Text>
                )}
              </View>
            </View>

            {/* Titre catalogue */}
            <Text style={{ fontWeight: '700', color: colors.text }}>
              {i18n.t('groupAvatars.catalog.title', 'Catalogue')}
            </Text>

            {loadingItems && (
              <View style={{ alignItems: 'center', paddingVertical: 16 }}>
                <ActivityIndicator color={colors.primary} />
                <Text style={{ marginTop: 8, color: colors.subtext }}>
                  {i18n.t('common.initializing', 'Chargement…')}
                </Text>
              </View>
            )}
          </View>
        }
        renderItem={({ item }) => {
          const active = selectedId === item.id;

          return (
            <TouchableOpacity
              onPress={() => setSelectedId(item.id)}
              style={{
                flex: 1,
                padding: 10,
                borderRadius: 12,
                borderWidth: 2,
                borderColor: active ? '#ef4444' : colors.border,
                backgroundColor: active
                  ? isDark
                    ? '#450a0a'
                    : '#fff1f2'
                  : colors.card,
              }}
            >
              <Image
                source={{ uri: item.url }}
                style={{
                  width: '100%',
                  aspectRatio: 1,
                  borderRadius: 10,
                  backgroundColor: colors.card2 || '#1f2937',
                }}
              />
              <Text
                style={{ marginTop: 8, fontWeight: '700', color: colors.text }}
                numberOfLines={1}
              >
                {item.name || item.id}
              </Text>
              <Text style={{ color: colors.subtext, fontSize: 12 }}>
                {i18n.t('groupAvatars.catalog.freeLine', 'Gratuit')}
              </Text>
            </TouchableOpacity>
          );
        }}
        ListFooterComponent={
          <View style={{ gap: 8, marginTop: 12, marginBottom: 16 }}>
            <Text style={{ color: colors.subtext, fontSize: 12, textAlign: 'center' }}>
              {i18n.t(
                'groupAvatars.footer.note',
                'Les avatars de groupe sont gratuits.'
              )}
            </Text>
          </View>
        }
      />
    </>
  );
}