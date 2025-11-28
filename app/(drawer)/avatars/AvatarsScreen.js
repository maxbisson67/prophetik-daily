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
import functions from '@react-native-firebase/functions';
// Safe auth
import { useAuth } from '@src/auth/SafeAuthProvider';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '@src/theme/ThemeProvider';

const DEFAULT_PRICE = 5;

const FALLBACK_AVATARS = [
  {
    id: 'rough-01',
    name: 'Le Rought',
    url: 'https://picsum.photos/seed/rough/400',
    tags: ['hockey', 'barbu'],
    price: 5,
  },
  {
    id: 'clown-01',
    name: 'Le Clown',
    url: 'https://picsum.photos/seed/clown/400',
    tags: ['fun'],
    price: 5,
  },
  {
    id: 'espi-01',
    name: "L'Espiègle",
    url: 'https://picsum.photos/seed/espi/400',
    tags: ['malin'],
    price: 5,
  },
  {
    id: 'fresh-01',
    name: 'Le Fresh',
    url: 'https://picsum.photos/seed/fresh/400',
    tags: ['stylé'],
    price: 5,
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
        <MaterialCommunityIcons
          name={icon}
          size={14}
          color={defaultColor}
        />
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

/* -------- helpers prix/état -------- */
function readCredits(me) {
  if (typeof me?.credits === 'number') return me.credits;
  if (typeof me?.credits?.balance === 'number') return me.credits.balance;
  if (typeof me?.balance === 'number') return me.balance;
  return 0;
}
function hasBoughtAvatarBefore(me) {
  if (!me) return false;
  if (me.avatarId) return true;
  if (me.avatarPurchasedAt) return true;
  if (Array.isArray(me.avatarHistory) && me.avatarHistory.length > 0)
    return true;
  return false;
}
/** Prix:
 * - 5 crédits si premier achat
 * - 1 crédit pour (ré)activer n’importe quel avatar déjà ou actuellement utilisé (y compris le même)
 */
function getEffectivePrice({ me, selectedItem }) {
  const FIRST_PRICE = 5;
  const SWITCH_PRICE = 1;
  if (!selectedItem) return FIRST_PRICE;
  const already = hasBoughtAvatarBefore(me);
  return already ? SWITCH_PRICE : FIRST_PRICE;
}

export default function AvatarsScreen() {
  const r = useRouter();
  const { user } = useAuth();
  const { colors } = useTheme();
  const isDark = colors.background === '#111827';

  const [me, setMe] = useState(null);
  const [loadingMe, setLoadingMe] = useState(true);

  const [storeAvatars, setStoreAvatars] = useState(null);
  const [loadingAvatars, setLoadingAvatars] = useState(true);

  const [selectedId, setSelectedId] = useState(null);
  const selectedItem = useMemo(
    () => (storeAvatars || []).find((a) => a.id === selectedId) || null,
    [storeAvatars, selectedId]
  );

  // Participant (solde)
  useEffect(() => {
    if (!user?.uid) {
      setMe(null);
      setLoadingMe(false);
      return;
    }
    setLoadingMe(true);
    const ref = firestore().doc(`participants/${user.uid}`);
    const unsub = ref.onSnapshot(
      (snap) => {
        setMe(snap.exists ? { uid: snap.id, ...snap.data() } : null);
        setLoadingMe(false);
      },
      () => setLoadingMe(false)
    );
    return () => {
      try {
        unsub();
      } catch {}
    };
  }, [user?.uid]);

  // Avatars store
  useEffect(() => {
    setLoadingAvatars(true);
    const qRef = firestore()
      .collection('catalog_avatars')
      .orderBy('sort', 'asc');
    const unsub = qRef.onSnapshot(
      (snap) => {
        const rows =
          snap?.docs?.map((d) => ({ id: d.id, ...d.data() })) || [];
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

  const credits = useMemo(() => readCredits(me), [me]);
  const alreadyBought = useMemo(
    () => hasBoughtAvatarBefore(me),
    [me]
  );
  const effectivePrice = useMemo(
    () => getEffectivePrice({ me, selectedItem }),
    [me, selectedItem]
  );

  async function handleBuy() {
    if (!user?.uid)
      return Alert.alert(
        'Connexion requise',
        'Connecte-toi pour acheter un avatar.'
      );
    if (!selectedItem)
      return Alert.alert(
        'Choisis un avatar',
        'Sélectionne un avatar avant d’acheter.'
      );
    if (credits < effectivePrice) {
      return Alert.alert(
        'Crédits insuffisants',
        `Il te faut ${effectivePrice} crédit${
          effectivePrice > 1 ? 's' : ''
        } (solde: ${credits}).`
      );
    }

    try {
      // 1) Débit & droit d’activer via CF (serveur fait foi)
      const callPurchase =
        functions().httpsCallable('purchaseAvatar');
      const payload = {
        avatarId: selectedItem.id,
        price: effectivePrice,
        photoURL: selectedItem.url, // optionnel côté serveur
      };
      const res = await callPurchase(payload);
      if (!res?.data?.ok)
        throw new Error(res?.data?.error || 'Erreur inconnue');

      // 2) Option B: écrire uniquement avatarId (+ updatedAt) → CF onAvatarIdChange mettra avatarUrl
      await firestore()
        .doc(`profiles_public/${user.uid}`)
        .set(
          {
            avatarId: selectedItem.id,
            updatedAt: firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );

      const wasSwitch = effectivePrice === 1;
      Alert.alert(
        wasSwitch ? '✅ Avatar (ré)activé' : '🎉 Avatar acheté',
        'Ton profil sera mis à jour dans un instant.',
        [{ text: 'OK', onPress: () => r.back() }]
      );
    } catch (e) {
      Alert.alert('Achat impossible', String(e?.message || e));
    }
  }

  if (!user) {
    return (
      <>
        <Stack.Screen options={{ title: 'Avatars' }} />
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
            Connecte-toi pour accéder à la boutique d’avatars.
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
            <Text
              style={{
                color: '#fff',
                fontWeight: '700',
              }}
            >
              Se connecter
            </Text>
          </TouchableOpacity>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Mon avatar',
          headerLeft: () => (
            <TouchableOpacity
              onPress={() => r.replace('/(drawer)/boutique')}
              style={{ paddingHorizontal: 10 }}
            >
              <Ionicons
                name="arrow-back"
                size={24}
                color={colors.text}
              />
            </TouchableOpacity>
          ),
        }}
      />
      <FlatList
        data={storeAvatars || []}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={{ gap: 12 }}
        ItemSeparatorComponent={() => (
          <View style={{ height: 12 }} />
        )}
        contentContainerStyle={{
          padding: 16,
          gap: 12,
          backgroundColor: colors.background,
        }}
        ListHeaderComponent={
          <View style={{ gap: 12 }}>
            {/* Carte info / crédits */}
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
                Avatars exclusifs
              </Text>
              <Text style={{ color: colors.text }}>
                Personnalise ton profil avec un avatar unique. Chaque
                avatar coûte{' '}
                <Text style={{ fontWeight: '800' }}>
                  {DEFAULT_PRICE} crédits
                </Text>
                .
              </Text>

              <View
                style={{
                  marginTop: 10,
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
               <Chip
                icon="information"
                // ✅ Couleurs plus contrastées en mode sombre
                bg={isDark ? '#22c55e' : '#dcfce7'}
                color={isDark ? '#052e16' : '#166534'}
                label="Réactivation: 1 crédit"
              />
                <View style={{ alignItems: 'flex-end' }}>
                  <Text
                    style={{
                      fontSize: 12,
                      color: colors.subtext,
                    }}
                  >
                    Tes crédits
                  </Text>
                  {loadingMe ? (
                    <ActivityIndicator color={colors.primary} />
                  ) : (
                    <Text
                      style={{
                        fontWeight: '900',
                        fontSize: 20,
                        color: colors.text,
                      }}
                    >
                      {credits}
                    </Text>
                  )}
                </View>
              </View>
            </View>

            {/* Aperçu sélection + bouton Achat */}
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
                Aperçu
              </Text>
              <View
                style={{
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
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
                      Sélectionne un avatar
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

                {(() => {
                  const disabled =
                    !selectedItem || credits < effectivePrice;
                  return (
                    <>
                      <TouchableOpacity
                        onPress={handleBuy}
                        disabled={disabled}
                        style={{
                          backgroundColor: disabled
                            ? '#9ca3af'
                            : '#ef4444',
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
                        <Text
                          style={{
                            color: '#fff',
                            fontWeight: '900',
                          }}
                        >
                          {!selectedItem
                            ? 'Choisis un avatar'
                            : `Acheter (${effectivePrice} crédit${
                                effectivePrice > 1 ? 's' : ''
                              })`}
                        </Text>
                      </TouchableOpacity>

                      {alreadyBought &&
                        selectedItem &&
                        effectivePrice === 1 && (
                          <Text
                            style={{
                              color: colors.subtext,
                              fontSize: 12,
                              marginTop: 6,
                              textAlign: 'center',
                            }}
                          >
                            Toute (ré)activation d’avatar coûte 1
                            crédit.
                          </Text>
                        )}
                    </>
                  );
                })()}
              </View>
            </View>

            {/* Titre catalogue */}
            <Text
              style={{
                fontWeight: '700',
                color: colors.text,
              }}
            >
              Catalogue
            </Text>
            {loadingAvatars && (
              <View
                style={{
                  alignItems: 'center',
                  paddingVertical: 16,
                }}
              >
                <ActivityIndicator color={colors.primary} />
                <Text
                  style={{
                    marginTop: 8,
                    color: colors.subtext,
                  }}
                >
                  Chargement…
                </Text>
              </View>
            )}
          </View>
        }
        renderItem={({ item }) => {
          const active = selectedId === item.id;
          const price = Number.isFinite(item.price)
            ? item.price
            : DEFAULT_PRICE;

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
              <Text
                style={{
                  color: colors.subtext,
                  fontSize: 12,
                }}
              >
                {price} crédit{price > 1 ? 's' : ''}
              </Text>
            </TouchableOpacity>
          );
        }}
        ListFooterComponent={
          <View
            style={{
              gap: 8,
              marginTop: 12,
              marginBottom: 16,
            }}
          >
            <Text
              style={{
                color: colors.subtext,
                fontSize: 12,
                textAlign: 'center',
              }}
            >
              En achetant, tu acceptes un usage personnel dans l’app.
              Aucun remboursement.
            </Text>
          </View>
        }
      />
    </>
  );
}