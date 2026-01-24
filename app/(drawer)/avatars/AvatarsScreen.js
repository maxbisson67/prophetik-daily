// app/(drawer)/AvatarsScreen.js
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
import { Stack, useRouter } from 'expo-router';
import firestore from '@react-native-firebase/firestore';

// i18n
import i18n from '@src/i18n/i18n';

// Safe auth
import { useAuth } from '@src/auth/SafeAuthProvider';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '@src/theme/ThemeProvider';

// ⚠️ Fallback dev
const FALLBACK_AVATARS = [
  {
    id: 'rough-01',
    name: 'Le Rought',
    url: 'https://picsum.photos/seed/rough/400',
    tags: ['hockey', 'barbu'],
  },
  {
    id: 'clown-01',
    name: 'Le Clown',
    url: 'https://picsum.photos/seed/clown/400',
    tags: ['fun'],
  },
  {
    id: 'espi-01',
    name: "L'Espiègle",
    url: 'https://picsum.photos/seed/espi/400',
    tags: ['malin'],
  },
  {
    id: 'fresh-01',
    name: 'Le Fresh',
    url: 'https://picsum.photos/seed/fresh/400',
    tags: ['stylé'],
  },
];

function Chip({ icon, color, bg, label }) {
  const { colors } = useTheme();
  const isDark = colors.background === '#111827';

  const defaultBg = bg || (isDark ? '#111827' : '#F3F4F6');
  const defaultColor = color || colors.text;

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        paddingVertical: 4,
        paddingHorizontal: 8,
        borderRadius: 999,
        backgroundColor: defaultBg,
      }}
    >
      {!!icon && (
        <MaterialCommunityIcons name={icon} size={14} color={defaultColor} />
      )}
      <Text
        style={{
          color: defaultColor,
          marginLeft: icon ? 6 : 0,
          fontWeight: '700',
        }}
      >
        {label}
      </Text>
    </View>
  );
}

export default function AvatarsScreen() {
  const r = useRouter();
  const { user } = useAuth();
  const { colors } = useTheme();
  const isDark = colors.background === '#111827';

  const [storeAvatars, setStoreAvatars] = useState(null);
  const [loadingAvatars, setLoadingAvatars] = useState(true);

  const [selectedId, setSelectedId] = useState(null);

  const selectedItem = useMemo(
    () => (storeAvatars || []).find((a) => a.id === selectedId) || null,
    [storeAvatars, selectedId]
  );

  // Avatars store
  useEffect(() => {
    setLoadingAvatars(true);
    const qRef = firestore().collection('catalog_avatars').orderBy('sort', 'asc');
    const unsub = qRef.onSnapshot(
      (snap) => {
        const rows = snap?.docs?.map((d) => ({ ...d.data(), id: d.id })) || [];
        setStoreAvatars(rows.length ? rows : FALLBACK_AVATARS);
        setLoadingAvatars(false);
      },
      () => {
        setStoreAvatars(FALLBACK_AVATARS);
        setLoadingAvatars(false);
      }
    );
    return () => {
      try {
        unsub();
      } catch {}
    };
  }, []);

  async function handleApply() {
    if (!user?.uid) {
      return Alert.alert(
        i18n.t('avatars.alerts.loginRequiredTitle', 'Connexion requise'),
        i18n.t(
          'avatars.alerts.loginRequiredBody',
          'Connecte-toi pour modifier ton avatar.'
        )
      );
    }
    if (!selectedItem) {
      return Alert.alert(
        i18n.t('avatars.alerts.selectRequiredTitle', 'Choisis un avatar'),
        i18n.t(
          'avatars.alerts.selectRequiredBody',
          'Sélectionne un avatar avant de continuer.'
        )
      );
    }

    try {
      // Écrit avatarId (+ updatedAt). Ton CF onAvatarIdChange / listener mettra avatarUrl si tu l’as.
      await firestore()
        .doc(`profiles_public/${user.uid}`)
        .set(
          {
            avatarId: selectedItem.id,
            updatedAt: firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );

      Alert.alert(
        i18n.t('avatars.alerts.appliedTitle', '✅ Avatar appliqué'),
        i18n.t(
          'avatars.alerts.appliedBody',
          'Ton profil sera mis à jour dans un instant.'
        ),
        [{ text: i18n.t('common.ok', 'OK'), onPress: () => r.back() }]
      );
    } catch (e) {
      Alert.alert(
        i18n.t('avatars.alerts.applyFailedTitle', 'Impossible de modifier'),
        String(e?.message || e)
      );
    }
  }

  // ---- non connecté ----
  if (!user) {
    return (
      <>
        <Stack.Screen options={{ title: i18n.t('avatars.title', 'Avatars') }} />
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
            {i18n.t(
              'avatars.loginGate.body',
              'Connecte-toi pour choisir ton avatar.'
            )}
          </Text>
          <TouchableOpacity
            onPress={() => r.push('/(auth)/auth-choice')}
            style={{
              marginTop: 12,
              backgroundColor: '#b91c1c',
              paddingHorizontal: 16,
              paddingVertical: 10,
              borderRadius: 10,
            }}
          >
            <Text style={{ color: '#fff', fontWeight: '700' }}>
              {i18n.t('auth.login', 'Se connecter')}
            </Text>
          </TouchableOpacity>
        </View>
      </>
    );
  }

  const headerTitle = i18n.t('avatars.headerTitle', 'Mon avatar');

  return (
    <>
      <Stack.Screen
        options={{
          title: headerTitle,
          headerLeft: () => (
            <TouchableOpacity
              onPress={() => r.back()}
              style={{ paddingHorizontal: 10 }}
            >
              <Ionicons name="arrow-back" size={24} color={colors.text} />
            </TouchableOpacity>
          ),
        }}
      />

      <FlatList
        data={storeAvatars || []}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={{ gap: 12 }}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        contentContainerStyle={{
          padding: 16,
          gap: 12,
          backgroundColor: colors.background,
        }}
        ListHeaderComponent={
          <View style={{ gap: 12 }}>
            {/* Carte info */}
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
              <Text
                style={{
                  fontWeight: '800',
                  fontSize: 16,
                  marginBottom: 6,
                  color: colors.text,
                }}
              >
                {i18n.t('avatars.info.title', 'Choisis ton avatar')}
              </Text>

              <Text style={{ color: colors.text }}>
                {i18n.t(
                  'avatars.info.body',
                  'Sélectionne un avatar et applique-le à ton profil.'
                )}
              </Text>

              <View style={{ marginTop: 10 }}>
                <Chip
                  icon="gift"
                  bg={isDark ? '#22c55e' : '#dcfce7'}
                  color={isDark ? '#052e16' : '#166534'}
                  label={i18n.t('avatars.info.freeChip', 'Gratuit')}
                />
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
              <Text
                style={{
                  fontWeight: '700',
                  marginBottom: 8,
                  color: colors.text,
                }}
              >
                {i18n.t('avatars.preview.title', 'Aperçu')}
              </Text>

              <View style={{ alignItems: 'center', justifyContent: 'center' }}>
                {selectedItem?.url ? (
                  <Image
                    source={{ uri: selectedItem.url }}
                    style={{
                      width: 180,
                      height: 180,
                      borderRadius: 90,
                      backgroundColor: colors.card2,
                    }}
                  />
                ) : (
                  <View
                    style={{
                      width: 180,
                      height: 180,
                      borderRadius: 90,
                      backgroundColor: colors.card2,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text style={{ color: colors.subtext }}>
                      {i18n.t(
                        'avatars.preview.noneSelected',
                        'Sélectionne un avatar'
                      )}
                    </Text>
                  </View>
                )}

                {!!selectedItem && (
                  <Text
                    style={{
                      marginTop: 8,
                      fontWeight: '700',
                      color: colors.text,
                    }}
                  >
                    {selectedItem.name || selectedItem.id}
                  </Text>
                )}

                <TouchableOpacity
                  onPress={handleApply}
                  disabled={!selectedItem}
                  style={{
                    backgroundColor: !selectedItem ? '#9ca3af' : '#ef4444',
                    paddingVertical: 14,
                    paddingHorizontal: 20,
                    borderRadius: 12,
                    alignItems: 'center',
                    justifyContent: 'center',
                    elevation: 3,
                    shadowColor: '#000',
                    shadowOpacity: 0.15,
                    shadowRadius: 4,
                    shadowOffset: { width: 0, height: 2 },
                    marginTop: 10,
                  }}
                >
                  <Text style={{ color: '#fff', fontWeight: '900' }}>
                    {!selectedItem
                      ? i18n.t('avatars.actions.chooseFirst', 'Choisis un avatar')
                      : i18n.t('avatars.actions.applyButton', 'Appliquer')}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Titre catalogue */}
            <Text style={{ fontWeight: '700', color: colors.text }}>
              {i18n.t('avatars.catalog.title', 'Catalogue')}
            </Text>

            {loadingAvatars && (
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

          const cardBg = active
            ? isDark
              ? '#450a0a'
              : '#fff1f2'
            : colors.card;

          return (
            <TouchableOpacity
              onPress={() => setSelectedId(item.id)}
              style={{
                flex: 1,
                padding: 10,
                borderRadius: 12,
                borderWidth: 2,
                borderColor: active ? '#ef4444' : colors.border,
                backgroundColor: cardBg,
              }}
            >
              <Image
                source={{ uri: item.url }}
                style={{
                  width: '100%',
                  aspectRatio: 1,
                  borderRadius: 10,
                  backgroundColor: colors.card2,
                }}
              />
              <Text
                style={{
                  marginTop: 8,
                  fontWeight: '700',
                  color: colors.text,
                }}
                numberOfLines={1}
              >
                {item.name || item.id}
              </Text>

              {!!item.tags?.length && (
                <Text style={{ color: colors.subtext, fontSize: 12 }} numberOfLines={1}>
                  {item.tags.join(' • ')}
                </Text>
              )}
            </TouchableOpacity>
          );
        }}
      />
    </>
  );
}