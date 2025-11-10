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

// Firebase
import { storage, db } from '@src/lib/firebase';
import { getDownloadURL, ref as storageRef } from 'firebase/storage';
import { doc, onSnapshot } from 'firebase/firestore';

// Hooks & thèmes
import { useAuth } from '@src/auth/SafeAuthProvider';
import { useGroups } from '@src/groups/useGroups';
import { useTheme } from '@src/theme/ThemeProvider';

const AVATAR_PLACEHOLDER = require('@src/assets/avatar-placeholder.png');
const GROUP_PLACEHOLDER  = require('@src/assets/group-placeholder.png');

/* =========================================================
   Helpers
========================================================= */

async function resolveStorageUrlMaybe(raw) {
  try {
    if (!raw || typeof raw !== 'string') return null;
    if (/^https?:\/\//i.test(raw)) return raw;
    if (raw.startsWith('gs://')) {
      const ref = storageRef(storage, raw);
      return await getDownloadURL(ref);
    }
    if (!raw.includes('://') && !raw.startsWith('data:')) {
      const ref = storageRef(storage, raw);
      return await getDownloadURL(ref);
    }
    if (raw.startsWith('data:')) return raw;
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
    if (!uid) { setParticipant(null); return; }
    const ref = doc(db, 'participants', String(uid));
    const unsub = onSnapshot(ref, (snap) => {
      if (!snap.exists()) {
        setParticipant({ displayName: '', photoURL: null, updatedAt: null, avatarPurchasedAt: null });
        return;
      }
      const d = snap.data() || {};
      setParticipant({
        displayName: d.displayName || '',
        photoURL: d.photoURL || d.avatarUrl || d.photoUrl || d.avatar || null,
        updatedAt: d.updatedAt || null,
        avatarPurchasedAt: d.avatarPurchasedAt || null,
      });
    }, (e) => {
      console.log('[Boutique] useParticipantAvatarLive error:', e?.message || e);
      setParticipant({ displayName: '', photoURL: null, updatedAt: null, avatarPurchasedAt: null });
    });
    return () => { try { unsub(); } catch {} };
  }, [uid]);

  return participant;
}

/* =========================================================
   Écran principal
========================================================= */
export default function BoutiqueScreen() {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const router = useRouter();
  const { user, profile } = useAuth();
  const { groups, loading, error } = useGroups(user?.uid);

  // 🔁 Groupes dont je suis propriétaire
  const groupsOwned = useMemo(
    () => groups.filter(g => g.role === 'owner' || g.ownerId === user?.uid),
    [groups, user?.uid]
  );

  // 👂 Participant live (réagit aux changements d’avatar)
  const participantDoc = useParticipantAvatarLive(user?.uid);

  // Clé de version (sert de cache-buster)
  const versionKey = useMemo(() => {
    // on prend d’abord la date la plus pertinente du participant
    const pUpd = participantDoc?.updatedAt?.seconds || participantDoc?.updatedAt || '';
    const pBuy = participantDoc?.avatarPurchasedAt?.seconds || participantDoc?.avatarPurchasedAt || '';
    // on ajoute un peu de profil s’il expose une date
    const profUpd = profile?.updatedAt?.seconds || profile?.updatedAt || '';
    return [pUpd, pBuy, profUpd].filter(Boolean).join('|') || (user?.uid ?? 'v1');
  }, [participantDoc?.updatedAt, participantDoc?.avatarPurchasedAt, profile?.updatedAt, user?.uid]);

  // Candidats d’avatar (ordre de préférence)
  const avatarCandidates = useMemo(() => {
    const c = [
      participantDoc?.photoURL, // 👈 prioritaire: ce que la CF vient d’écrire
      profile?.photoURL,
      profile?.avatarUrl,
      profile?.photoUrl,
      user?.photoURL,
      user?.photoUrl,
    ].filter(Boolean);
    // console.log('[Boutique] avatar candidates:', c);
    return c;
  }, [participantDoc?.photoURL, profile?.photoURL, profile?.avatarUrl, profile?.photoUrl, user?.photoURL, user?.photoUrl]);

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
    return () => { cancelled = true; };
  }, [avatarCandidates, versionKey]);

  // Re-resout quand l’écran reprend le focus (utile au retour de AvatarsScreen)
  useFocusEffect(
    React.useCallback(() => {
      // force un petit refresh en réinitialisant d’abord l’URI
      setAvatarUri((prev) => (prev ? withCacheKey(prev.split('?')[0], versionKey) : prev));
    }, [versionKey])
  );

  /* =========================================================
     États de chargement / erreurs
  ========================================================= */
  if (!user) {
    return (
      <>
        <Stack.Screen options={{ title: 'Boutique' }} />
        <View style={[styles.screen, styles.center]}>
          <Text style={styles.text}>Connecte-toi pour accéder à la boutique.</Text>
        </View>
      </>
    );
  }

  if (loading) {
    return (
      <>
        <Stack.Screen options={{ title: 'Boutique' }} />
        <View style={[styles.screen, styles.center]}>
          <ActivityIndicator color={colors.primary} />
          <Text style={[styles.textSubtle, { marginTop: 8 }]}>Chargement…</Text>
        </View>
      </>
    );
  }

  if (error) {
    return (
      <>
        <Stack.Screen options={{ title: 'Boutique' }} />
        <View style={[styles.screen, styles.center, { padding: 16 }]}>
          <Text style={styles.text}>Erreur: {String(error)}</Text>
        </View>
      </>
    );
  }

  /* =========================================================
     Affichage principal
  ========================================================= */
  return (
    <>
      <Stack.Screen options={{ title: 'Boutique' }} />
      <ScrollView contentContainerStyle={styles.container}>
        {/* 1️⃣ Carte : Avatar de profil */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Avatar de profil</Text>

          <View style={styles.rowCenter}>
           <Image
            key={avatarUri || 'placeholder'}           // 👈 force remount when URL changes
            source={avatarUri ? { uri: avatarUri, cache: 'reload' } : AVATAR_PLACEHOLDER} // 👈 try to reload
            onError={() => setAvatarUri(null)}
            style={[styles.avatarXL, { backgroundColor: colors.border }]}
          />
            <View style={{ flex: 1 }}>
              <Text style={styles.textSubtle}>
                Personnalise ton identité dans l’app.
              </Text>

              <TouchableOpacity
                onPress={() => router.push('/avatars/AvatarsScreen')}
                style={[styles.btnPrimary, styles.btnWithIcon, { marginTop: 10 }]}
              >
                <MaterialCommunityIcons name="account-edit" size={18} color="#fff" />
                <Text style={styles.btnPrimaryText}>Changer d’avatar (1 crédit)</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => router.push({ pathname: '/avatars/AvatarsScreen', params: { mode: 'shop' } })}
                style={[styles.btnDark, styles.btnWithIcon, { marginTop: 8 }]}
              >
                <Ionicons name="cart" size={16} color="#fff" />
                <Text style={styles.btnDarkText}>Acheter de nouveaux avatars (5 crédits)</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* 2️⃣ Carte : Avatars de groupes */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Avatars de groupes</Text>

          {groupsOwned.length === 0 ? (
            <Text style={styles.textSubtle}>
              Tu n’es propriétaire d’aucun groupe. Crée-en un dans l’onglet Groupes.
            </Text>
          ) : (
            <>
              <Text style={[styles.textSubtle, { marginBottom: 10 }]}>
                Change l’avatar des groupes que tu gères :
              </Text>

              {groupsOwned.map((item) => (
                <View key={item.id} style={styles.groupRow}>
                  <View style={[styles.rowCenter, { flex: 1 }]}>
                    <Image
                      source={item.avatarUrl ? { uri: item.avatarUrl } : GROUP_PLACEHOLDER}
                      style={[
                        styles.avatarLG,
                        { backgroundColor: colors.background, borderColor: colors.border },
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
                      router.push({ pathname: `/groups/${item.id}`, params: { focus: 'avatar' } })
                    }
                    style={[styles.btnDark, styles.btnWithIcon]}
                  >
                    <Ionicons name="create" size={16} color="#fff" />
                    <Text style={styles.btnDarkText}>Modifier</Text>
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
    cardTitle: { fontSize: 18, fontWeight: '800', marginBottom: 10, color: colors.text },
    text: { color: colors.text },
    textBold: { color: colors.text, fontWeight: '700' },
    textSubtle: { color: colors.subtext },
    textMicro: { color: colors.subtext, marginTop: 2, fontSize: 12 },
    rowCenter: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    center: { alignItems: 'center', justifyContent: 'center' },
    avatarXL: { width: 64, height: 64, borderRadius: 32, marginRight: 12 },
    avatarLG: { width: 48, height: 48, borderRadius: 24, marginRight: 10, borderWidth: 1 },
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

function themeAwareListBG(colors) {
  return colors.background === '#111827' ? '#1f2937' : '#fafafa';
}