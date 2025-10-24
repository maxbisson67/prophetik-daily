// app/(drawer)/boutique/index.js
import React, { useMemo } from 'react';
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

import { useAuth } from '@src/auth/AuthProvider';
import { useGroups } from '@src/groups/useGroups';
import { useTheme } from '@src/theme/ThemeProvider';

const AVATAR_PLACEHOLDER = require('@src/assets/avatar-placeholder.png');
const GROUP_PLACEHOLDER  = require('@src/assets/group-placeholder.png');

export default function BoutiqueScreen() {
  const { colors, theme } = useTheme();
  const styles = makeStyles(colors);
  const router = useRouter();
  const { user, profile } = useAuth();

  // 🔁 Source unique des groupes
  const { groups, loading, error } = useGroups(user?.uid);

  // 🧩 Groupes dont je suis propriétaire
  const groupsOwned = useMemo(
    () => groups.filter(g => g.role === 'owner' || g.ownerId === user?.uid),
    [groups, user?.uid]
  );

  const profileAvatar = profile?.photoURL || null;

  if (!user) {
    return (
      <>
        <Stack.Screen options={{ title: 'Boutique',
          headerStyle: { backgroundColor: colors.card },
          headerTintColor: colors.text,
          headerTitleStyle: { color: colors.text },
        }} />
        <View style={[styles.screen, styles.center]}>
          <Text style={styles.text}>Connecte-toi pour accéder à la boutique.</Text>
        </View>
      </>
    );
  }

  if (loading) {
    return (
      <>
        <Stack.Screen options={{ title: 'Boutique',
          headerStyle: { backgroundColor: colors.card },
          headerTintColor: colors.text,
          headerTitleStyle: { color: colors.text },
        }} />
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
        <Stack.Screen options={{ title: 'Boutique',
          headerStyle: { backgroundColor: colors.card },
          headerTintColor: colors.text,
          headerTitleStyle: { color: colors.text },
        }} />
        <View style={[styles.screen, styles.center, { padding: 16 }]}>
          <Text style={styles.text}>Erreur: {String(error)}</Text>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Boutique',
        headerStyle: { backgroundColor: colors.card },
        headerTintColor: colors.text,
        headerTitleStyle: { color: colors.text },
      }} />

      <ScrollView contentContainerStyle={styles.container}>
        {/* 1️⃣ Carte : Avatar de profil */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Avatar de profil</Text>

          <View style={styles.rowCenter}>
            <Image
              source={profileAvatar ? { uri: profileAvatar } : AVATAR_PLACEHOLDER}
              style={[styles.avatarXL, { backgroundColor: colors.border }]}
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.textSubtle}>
                Personnalise ton identité dans l’app.
              </Text>

              <TouchableOpacity
                onPress={() => router.push('/avatars/AvatarsScreen')}
                style={[styles.btnPrimary, styles.btnWithIcon]}
              >
                <MaterialCommunityIcons name="palette" size={18} color="#fff" />
                <Text style={styles.btnPrimaryText}>Choisir un avatar</Text>
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

function makeStyles(colors) {
  return StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: colors.background,
    },
    container: {
      padding: 16,
      gap: 20,
      backgroundColor: colors.background,
    },

    // Cards
    card: {
      padding: 16,
      borderWidth: 1,
      borderRadius: 14,
      backgroundColor: colors.card,
      borderColor: colors.border,
      // soft shadow (iOS) + elevation (Android)
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

    // Text
    text: { color: colors.text },
    textBold: { color: colors.text, fontWeight: '700' },
    textSubtle: { color: colors.subtext },
    textMicro: { color: colors.subtext, marginTop: 2, fontSize: 12 },

    // Layout helpers
    rowCenter: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    center: { alignItems: 'center', justifyContent: 'center' },

    // Avatars
    avatarXL: { width: 64, height: 64, borderRadius: 32, marginRight: 12 },
    avatarLG: {
      width: 48,
      height: 48,
      borderRadius: 24,
      marginRight: 10,
      borderWidth: 1,
    },

    // Buttons
    btnWithIcon: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    btnPrimary: {
      marginTop: 10,
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
      backgroundColor: '#111827', // stays dark in both themes for contrast
    },
    btnDarkText: { color: '#fff', fontWeight: '800' },

    // Group rows inside the card
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

/** Slightly different list-row background per theme for depth */
function themeAwareListBG(colors) {
  // if background is very dark, use card tone; otherwise a subtle gray
  // (you can tweak this logic if you add more palette values)
  return colors.background === '#111827' ? '#1f2937' : '#fafafa';
}