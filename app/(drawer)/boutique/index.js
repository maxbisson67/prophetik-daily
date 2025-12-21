// app/(drawer)/boutique/index.js
import React, { useMemo, useState, useEffect } from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  TouchableOpacity,
  Image,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';

// RNFirebase
import firestore from '@react-native-firebase/firestore';
import storage from '@react-native-firebase/storage';

// i18n
import i18n from '@src/i18n/i18n';

// Hooks & thèmes
import { useAuth } from '@src/auth/SafeAuthProvider';
import { useGroups } from '@src/groups/useGroups';
import { useTheme } from '@src/theme/ThemeProvider';

const AVATAR_PLACEHOLDER = require('@src/assets/avatar-placeholder.png');
const GROUP_PLACEHOLDER = require('@src/assets/group-placeholder.png');

/* =========================================================
   Helpers
========================================================= */

// util dédup
function dedupeById(arr) {
  const m = new Map();
  for (const g of arr || []) m.set(String(g.id), g);
  return Array.from(m.values());
}

// ✅ Archivé? (même logique que CF)
function isArchivedGroup(g) {
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

// hook: groupes dont je suis owner (couvre plusieurs schémas)
function useOwnedGroups(uid) {
  const [owned, setOwned] = React.useState([]);
  const [loading, setLoading] = React.useState(!!uid);

  React.useEffect(() => {
    if (!uid) {
      setOwned([]);
      setLoading(false);
      return;
    }

    const results = { ownerId: [], createdBy: [], ownersArr: [] };
    const unsubs = [];

    const attach = (q, key) => {
      const un = q.onSnapshot(
        (snap) => {
          results[key] = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
          setOwned(
            dedupeById([
              ...results.ownerId,
              ...results.createdBy,
              ...results.ownersArr,
            ])
          );
          setLoading(false);
        },
        () => setLoading(false)
      );
      unsubs.push(un);
    };

    try {
      attach(
        firestore().collection('groups').where('ownerId', '==', String(uid)),
        'ownerId'
      );
    } catch {}

    try {
      attach(
        firestore().collection('groups').where('createdBy', '==', String(uid)),
        'createdBy'
      );
    } catch {}

    // owners: array-contains uid
    try {
      attach(
        firestore()
          .collection('groups')
          .where('owners', 'array-contains', String(uid)),
        'ownersArr'
      );
    } catch {}

    return () => {
      unsubs.forEach((u) => {
        try {
          u();
        } catch {}
      });
    };
  }, [uid]);

  return { owned, loading };
}

// Résout une URL potentielle provenant de Storage (gs://, chemin brut) ou retourne l’URL http(s) telle quelle.
async function resolveStorageUrlMaybe(raw) {
  try {
    if (!raw || typeof raw !== 'string') return null;

    // URL http(s) → telle quelle
    if (/^https?:\/\//i.test(raw)) return raw;

    // Data URI
    if (raw.startsWith('data:')) return raw;

    // gs://bucket/path → via refFromURL
    if (raw.startsWith('gs://')) {
      const ref = storage().refFromURL(raw);
      return await ref.getDownloadURL();
    }

    // Chemin relatif dans Storage (ex: "avatars/user123.png")
    if (!raw.includes('://')) {
      const ref = storage().ref(raw);
      return await ref.getDownloadURL();
    }

    return null;
  } catch (e) {
    console.log('[Boutique] resolveStorageUrlMaybe error:', e?.message || e);
    return null;
  }
}

// Ajoute un cache-buster stable (selon updatedAt/achat) pour forcer le rafraîchissement de l’image
function withCacheKey(url, key) {
  if (!url) return url;
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}v=${encodeURIComponent(String(key || 'v1'))}`;
}

/** Ecoute en temps réel participants/{uid} pour récupérer la photo du profil */
function useParticipantAvatarLive(uid) {
  const [participant, setParticipant] = useState(null);

  useEffect(() => {
    if (!uid) {
      setParticipant(null);
      return;
    }

    const unsub = firestore()
      .doc(`participants/${String(uid)}`)
      .onSnapshot(
        (snap) => {
          if (!snap.exists) {
            setParticipant({
              displayName: '',
              photoURL: null,
              updatedAt: null,
              avatarPurchasedAt: null,
            });
            return;
          }
          const d = snap.data() || {};
          setParticipant({
            displayName: d.displayName || '',
            photoURL: d.photoURL || d.avatarUrl || d.photoUrl || d.avatar || null,
            updatedAt: d.updatedAt || null,
            avatarPurchasedAt: d.avatarPurchasedAt || null,
          });
        },
        (e) => {
          console.log('[Boutique] useParticipantAvatarLive error:', e?.message || e);
          setParticipant({
            displayName: '',
            photoURL: null,
            updatedAt: null,
            avatarPurchasedAt: null,
          });
        }
      );

    return () => {
      try {
        unsub();
      } catch {}
    };
  }, [uid]);

  return participant;
}

// 🎨 Version theme-aware : utilise les surfaces du thème plutôt que des hex statiques
function themeAwareListBG(colors) {
  if (colors.card2) return colors.card2;
  if (colors.card) return colors.card;
  return colors.background;
}

/* =========================================================
   Écran principal
========================================================= */
export default function BoutiqueScreen() {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const router = useRouter();
  const { user, profile } = useAuth();
  const { owned: ownedGroups } = useOwnedGroups(user?.uid);
  const { groups, loading, error } = useGroups(user?.uid);

  const headerTitle = i18n.t('boutique.title', 'Boutique');

  // Fusion: tout groupe dont je suis owner, qu'il vienne de useGroups ou du hook owned
  // ✅ + filtre des groupes archivés
  const groupsOwned = React.useMemo(() => {
    const ownedFromMembership = (groups || []).filter((g) => {
      const role = String(g.role || '').toLowerCase();
      return (
        role === 'owner' ||
        g.ownerId === user?.uid ||
        g.createdBy === user?.uid ||
        (Array.isArray(g.owners) && g.owners.includes(user?.uid))
      );
    });

    const merged = dedupeById([...(ownedGroups || []), ...ownedFromMembership]);

    // ✅ Exclure archivés
    return merged.filter((g) => !isArchivedGroup(g));
  }, [groups, ownedGroups, user?.uid]);

  // 👂 Participant live (réagit aux changements d’avatar)
  const participantDoc = useParticipantAvatarLive(user?.uid);

  // Clé de version (sert de cache-buster)
  const versionKey = useMemo(() => {
    const pUpd = participantDoc?.updatedAt?.seconds || participantDoc?.updatedAt || '';
    const pBuy =
      participantDoc?.avatarPurchasedAt?.seconds ||
      participantDoc?.avatarPurchasedAt ||
      '';
    const profUpd = profile?.updatedAt?.seconds || profile?.updatedAt || '';
    return [pUpd, pBuy, profUpd].filter(Boolean).join('|') || (user?.uid ?? 'v1');
  }, [participantDoc?.updatedAt, participantDoc?.avatarPurchasedAt, profile?.updatedAt, user?.uid]);

  // Candidats d’avatar (ordre de préférence)
  const avatarCandidates = useMemo(() => {
    return [
      participantDoc?.photoURL, // 👈 prioritaire: ce que la CF vient d’écrire
      profile?.photoURL,
      profile?.avatarUrl,
      profile?.photoUrl,
      user?.photoURL,
      user?.photoUrl,
    ].filter(Boolean);
  }, [
    participantDoc?.photoURL,
    profile?.photoURL,
    profile?.avatarUrl,
    profile?.photoUrl,
    user?.photoURL,
    user?.photoUrl,
  ]);

  const [avatarUri, setAvatarUri] = useState(null);

  // Résolution de l’URL (avec cache-buster) + re-run à chaque changement de clé
  useEffect(() => {
    let cancelled = false;

    (async () => {
      for (const raw of avatarCandidates) {
        const url = await resolveStorageUrlMaybe(raw);
        if (url) {
          if (!cancelled) setAvatarUri(withCacheKey(url, versionKey));
          return;
        }
      }
      if (!cancelled) setAvatarUri(null);
    })();

    return () => {
      cancelled = true;
    };
  }, [avatarCandidates, versionKey]);

  // Re-resout quand l’écran reprend le focus (utile au retour de AvatarsScreen)
  useFocusEffect(
    React.useCallback(() => {
      setAvatarUri((prev) =>
        prev ? withCacheKey(prev.split('?')[0], versionKey) : prev
      );
    }, [versionKey])
  );

  /* =========================================================
     États de chargement / erreurs
  ========================================================= */
  if (!user) {
    return (
      <>
        <Stack.Screen options={{ title: headerTitle }} />
        <View style={[styles.screen, styles.center]}>
          <Text style={styles.text}>
            {i18n.t('boutique.loginRequired', 'Connecte-toi pour accéder à la boutique.')}
          </Text>
        </View>
      </>
    );
  }

  if (loading) {
    return (
      <>
        <Stack.Screen options={{ title: headerTitle }} />
        <View style={[styles.screen, styles.center]}>
          <ActivityIndicator color={colors.primary} />
          <Text style={[styles.textSubtle, { marginTop: 8 }]}>
            {i18n.t('boutique.loading', 'Chargement…')}
          </Text>
        </View>
      </>
    );
  }

  if (error) {
    return (
      <>
        <Stack.Screen options={{ title: headerTitle }} />
        <View style={[styles.screen, styles.center, { padding: 16 }]}>
          <Text style={styles.text}>
            {i18n.t('boutique.errorPrefix', {
              defaultValue: 'Erreur : {{message}}',
              message: String(error),
            })}
          </Text>
        </View>
      </>
    );
  }

  /* =========================================================
     Affichage principal
  ========================================================= */
  return (
    <>
      <Stack.Screen options={{ title: headerTitle }} />
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.container}
      >
        {/* 1️⃣ Carte : Avatar de profil */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            {i18n.t('boutique.profileCard.title', 'Avatar de profil')}
          </Text>

          <View style={styles.rowCenter}>
            <Image
              key={avatarUri || 'placeholder'}
              source={
                avatarUri
                  ? { uri: avatarUri, cache: 'reload' }
                  : AVATAR_PLACEHOLDER
              }
              onError={() => setAvatarUri(null)}
              style={[styles.avatarXL, { backgroundColor: colors.border }]}
            />

            <View style={{ flex: 1 }}>
              <Text style={styles.textSubtle}>
                {i18n.t(
                  'boutique.profileCard.hint',
                  'Personnalise ton identité dans l’app.'
                )}
              </Text>

              <TouchableOpacity
                onPress={() => router.push('/avatars/AvatarsScreen')}
                style={[styles.btnPrimary, styles.btnWithIcon, { marginTop: 10 }]}
              >
                <MaterialCommunityIcons
                  name="account-edit"
                  size={18}
                  color="#fff"
                />
                <Text style={styles.btnPrimaryText}>
                  {i18n.t('boutique.profileCard.changeAvatar', {
                    defaultValue: "Changer d’avatar ({{price}} crédit)",
                    price: 1,
                  })}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* 2️⃣ Carte : Avatars de groupes */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            {i18n.t('boutique.groupsCard.title', 'Avatars de groupes')}
          </Text>

          {groupsOwned.length === 0 ? (
            <Text style={styles.textSubtle}>
              {i18n.t(
                'boutique.groupsCard.emptyOwner',
                'Tu n’es propriétaire d’aucun groupe actif. Crée-en un dans l’onglet Groupes.'
              )}
            </Text>
          ) : (
            <>
              <Text style={[styles.textSubtle, { marginBottom: 10 }]}>
                {i18n.t(
                  'boutique.groupsCard.hint',
                  'Change l’avatar des groupes que tu gères :'
                )}
              </Text>

              {groupsOwned.map((item) => (
                <View key={item.id} style={styles.groupRow}>
                  <View style={[styles.rowCenter, { flex: 1 }]}>
                    <Image
                      source={
                        item.avatarUrl
                          ? { uri: item.avatarUrl }
                          : GROUP_PLACEHOLDER
                      }
                      style={[
                        styles.avatarLG,
                        {
                          backgroundColor: colors.background,
                          borderColor: colors.border,
                        },
                      ]}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.textBold}>{item.name || item.id}</Text>
                      {!!item.description && (
                        <Text numberOfLines={1} style={styles.textMicro}>
                          {item.description}
                        </Text>
                      )}
                    </View>
                  </View>

                  <TouchableOpacity
                    onPress={() =>
                      router.push({
                        pathname: '/avatars/GroupAvatarsScreen',
                        params: { groupId: item.id },
                      })
                    }
                    style={[styles.btnDark, styles.btnWithIcon]}
                  >
                    <Ionicons name="create" size={16} color="#fff" />
                    <Text style={styles.btnDarkText}>
                      {i18n.t('boutique.groupsCard.edit', 'Modifier')}
                    </Text>
                  </TouchableOpacity>
                </View>
              ))}
            </>
          )}
        </View>
      </ScrollView>
    </>
  );
}

/* =========================================================
   Styles
========================================================= */
function makeStyles(colors) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    container: { padding: 16, gap: 20, backgroundColor: colors.background },
    card: {
      padding: 16,
      borderWidth: 1,
      borderRadius: 14,
      backgroundColor: colors.card,
      borderColor: colors.border,
      shadowColor: '#000',
      shadowOpacity: 0.06,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 3 },
      elevation: 3,
    },
    cardTitle: {
      fontSize: 18,
      fontWeight: '800',
      marginBottom: 10,
      color: colors.text,
    },
    text: { color: colors.text },
    textBold: { color: colors.text, fontWeight: '700' },
    textSubtle: { color: colors.subtext },
    textMicro: { color: colors.subtext, marginTop: 2, fontSize: 12 },
    rowCenter: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    center: { alignItems: 'center', justifyContent: 'center' },
    avatarXL: { width: 64, height: 64, borderRadius: 32, marginRight: 12 },
    avatarLG: {
      width: 48,
      height: 48,
      borderRadius: 24,
      marginRight: 10,
      borderWidth: 1,
    },
    btnWithIcon: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    btnPrimary: {
      alignSelf: 'flex-start',
      backgroundColor: colors.primary,
      paddingVertical: 10,
      paddingHorizontal: 14,
      borderRadius: 10,
    },
    btnPrimaryText: { color: '#fff', fontWeight: '800' },
    btnDark: {
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 10,
      backgroundColor: '#111827',
      alignSelf: 'flex-start',
    },
    btnDarkText: { color: '#fff', fontWeight: '800' },
    groupRow: {
      marginBottom: 12,
      padding: 12,
      borderWidth: 1,
      borderRadius: 12,
      borderColor: colors.border,
      backgroundColor: themeAwareListBG(colors),
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
  });
}