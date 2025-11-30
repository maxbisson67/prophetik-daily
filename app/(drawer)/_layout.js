// app/(drawer)/_layout.js
import React, { useCallback, useMemo } from 'react';
import { View, Text } from 'react-native';
import { Drawer } from 'expo-router/drawer';
import {
  DrawerToggleButton,
  DrawerContentScrollView,
  DrawerItem,
} from '@react-navigation/drawer';
import {
  getFocusedRouteNameFromRoute,
  DrawerActions,
} from '@react-navigation/native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '@src/auth/SafeAuthProvider';
import { useTheme } from '@src/theme/ThemeProvider';

// ✅ expo-image pour contrôler le cache (ici: Image RN standard)
import { Image } from 'react-native';

// 🔽 profil public (displayName, avatarUrl, updatedAt)
import { usePublicProfile } from '@src/profile/usePublicProfile';

function getHeaderTitle(route) {
  const focused = getFocusedRouteNameFromRoute(route) ?? 'AccueilScreen';
  switch (focused) {
    case 'AccueilScreen':
    case 'index':
      return 'Accueil';
    case 'GroupsScreen':
      return 'Groupes';
    case 'ChallengesScreen':
      return 'Défis';
    case 'credits/index':
      return 'Crédits';
    case 'boutique/index':
      return 'Boutique';
    case 'profile/index':
      return 'Profile';
    case 'settings/index':
      return 'Réglages';
    case 'ClassementScreen':
      return 'Classement';
    default:
      return 'Prophetik';
  }
}

function SectionLabel({ children }) {
  const { colors } = useTheme();
  return (
    <Text
      style={{
        marginTop: 18,
        marginBottom: 6,
        marginHorizontal: 16,
        color: colors.subtext,
        fontWeight: '700',
      }}
    >
      {children}
    </Text>
  );
}
function Separator() {
  const { colors } = useTheme();
  return (
    <View
      style={{
        height: 1,
        backgroundColor: colors.border,
        marginVertical: 8,
        marginHorizontal: 12,
      }}
    />
  );
}

function tsToMillis(ts) {
  if (!ts) return 0;
  if (typeof ts.toMillis === 'function') return ts.toMillis();
  if (typeof ts.seconds === 'number') {
    return ts.seconds * 1000 + (ts.nanoseconds ? Math.floor(ts.nanoseconds / 1e6) : 0);
  }
  if (typeof ts === 'number') return ts;
  return 0;
}

function withCacheBust(url, updatedAt) {
  if (!url) return null;
  const v = tsToMillis(updatedAt) || Date.now();
  return url.includes('?') ? `${url}&_cb=${v}` : `${url}?_cb=${v}`;
}

/* ------------------------------------------------------------------ */
/* DrawerHeader: lit profiles_public/{uid} pour afficher nom + avatar  */
/* ------------------------------------------------------------------ */
function DrawerHeader() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const { profile: pub, loading: loadingPub } = usePublicProfile(user?.uid);

  const displayName =
    pub?.displayName ||
    user?.displayName ||
    (user?.email ? user.email.split('@')[0] : 'Invité');

  const email = user?.email || '';

  const rawAvatar = pub?.avatarUrl || user?.photoURL || null;
  const avatarUri = useMemo(
    () => withCacheBust(rawAvatar, pub?.updatedAt),
    [rawAvatar, pub?.updatedAt]
  );

  const [bump, setBump] = React.useState(0);
  const [lastKey, setLastKey] = React.useState('');
  const imageKey = `${avatarUri || 'placeholder'}#${bump}`;

  React.useEffect(() => {
    if (imageKey !== lastKey) setLastKey(imageKey);
  }, [imageKey, lastKey]);

  return (
    <View
      key={lastKey}
      style={{
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: 10,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
      }}
    >
      <Image
        key={imageKey}
        source={
          avatarUri
            ? { uri: avatarUri }
            : require('@src/assets/avatar-placeholder.png')
        }
        onError={() => {
          if (__DEV__) console.warn('[DrawerHeader] avatar load error:', avatarUri);
          setBump((n) => n + 1);
        }}
        style={{
          width: 48,
          height: 48,
          borderRadius: 24,
          backgroundColor: colors.card,
        }}
      />
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 16, fontWeight: '800', color: colors.text }}>
          {loadingPub ? 'Chargement…' : displayName}
        </Text>
        <Text style={{ color: colors.subtext, fontSize: 12 }}>
          {email || (user ? 'Connecté' : 'Hors ligne')}
        </Text>
      </View>
    </View>
  );
}

/* ------------------------------------ */
/* Drawer content                       */
/* ------------------------------------ */
function CustomDrawerContent(props) {
  const { colors } = useTheme();
  const router = useRouter();
  const { signOut } = useAuth();

  const goTab = useCallback(
    (screenName) => {
      props.navigation.navigate('(tabs)', { screen: screenName });
      props.navigation.dispatch(DrawerActions.closeDrawer());
    },
    [props.navigation]
  );

  const itemCommonProps = {
    // ✅ style du conteneur
    style: { marginHorizontal: 4, borderRadius: 10 },
    // ✅ style du label (texte)
    labelStyle: {
      color: colors.text,
      fontWeight: '600',
    },
    // ✅ couleur de l’icône (on ignore le "color" automatique)
    activeTintColor: colors.primary,
    inactiveTintColor: colors.subtext,
  };

  return (
    <DrawerContentScrollView
      {...props}
      contentContainerStyle={{ paddingTop: 0 }}
      style={{ backgroundColor: colors.background }}
    >
      <DrawerHeader />
      <Separator />

      <SectionLabel>Navigation</SectionLabel>

      <DrawerItem
        {...itemCommonProps}
        label="Accueil"
        onPress={() => goTab('AccueilScreen')}
        icon={({ size }) => (
          <Ionicons name="home" size={size} color={colors.text} />
        )}
      />

      <DrawerItem
        {...itemCommonProps}
        label="Groupes"
        onPress={() => goTab('GroupsScreen')}
        icon={({ size }) => (
          <Ionicons name="people" size={size} color={colors.text} />
        )}
      />

      <DrawerItem
        {...itemCommonProps}
        label="Défis"
        onPress={() => goTab('ChallengesScreen')}
        icon={({ size }) => (
          <Ionicons name="trophy" size={size} color={colors.text} />
        )}
      />

      <DrawerItem
        {...itemCommonProps}
        label="Classement"
        onPress={() => goTab('ClassementScreen')}
        icon={({ size }) => (
          <Ionicons name="podium" size={size} color={colors.text} />
        )}
      />

       <DrawerItem
        {...itemCommonProps}
        label="Match Live"
        onPress={() => goTab('MatchLiveScreen')}
        icon={({ size }) => (
          <Ionicons name="pulse-outline" size={size} color={colors.text} />
        )}
      />


 


      <Separator />
      <SectionLabel>Espace perso</SectionLabel>

      <DrawerItem
        {...itemCommonProps}
        label="Boutique"
        onPress={() => {
          props.navigation.dispatch(DrawerActions.closeDrawer());
          requestAnimationFrame(() => {
            router.push('/(drawer)/boutique');
          });
        }}
        icon={({ size }) => (
          <MaterialCommunityIcons
            name="shopping"
            size={size}
            color={colors.text}
          />
        )}
      />

        
      <DrawerItem
        {...itemCommonProps}
        label="Crédits"
        onPress={() => {
          props.navigation.dispatch(DrawerActions.closeDrawer());
          requestAnimationFrame(() => {
            router.push('/(drawer)/credits');
          });
        }}
        icon={({ size }) => (
          <Ionicons name="card" size={size} color={colors.text} />
        )}
      />

      <DrawerItem
        {...itemCommonProps}
        label="Profil"
        onPress={() => {
          props.navigation.dispatch(DrawerActions.closeDrawer());
          requestAnimationFrame(() => {
            router.push('/(drawer)/profile');
          });
        }}
        icon={({ size }) => (
          <Ionicons name="person-circle" size={size} color={colors.text} />
        )}
      />

      <DrawerItem
        {...itemCommonProps}
        label="Réglages"
        onPress={() => {
          props.navigation.dispatch(DrawerActions.closeDrawer());
          requestAnimationFrame(() => {
            router.push('/(drawer)/settings');
          });
        }}
        icon={({ size }) => (
          <Ionicons name="settings" size={size} color={colors.text} />
        )}
      />

      <Separator />

      <DrawerItem
        {...itemCommonProps}
        label="Se déconnecter"
        onPress={async () => {
          await signOut().catch(() => {});
          router.replace('/(auth)/auth-choice');
        }}
        icon={({ size }) => (
          <Ionicons name="log-out" size={size} color={colors.text} />
        )}
      />
    </DrawerContentScrollView>
  );
}

export default function DrawerLayout() {
  const { colors } = useTheme();

  return (
    <Drawer
      id="rootDrawer"
      drawerContent={(props) => <CustomDrawerContent {...props} />}
      screenOptions={{
        headerShown: false,
        drawerType: 'slide',
        drawerHideStatusBarOnOpen: true,
        headerLeft: (props) => <DrawerToggleButton {...props} />,
        headerStyle: { backgroundColor: colors.card },
        headerTintColor: colors.text,
        drawerStyle: {
          backgroundColor: colors.background,
        },
        drawerActiveTintColor: colors.primary,
        drawerInactiveTintColor: colors.subtext,
        drawerLabelStyle: { fontWeight: '700' },
      }}
    >
      <Drawer.Screen
        name="(tabs)"
        options={({ route }) => ({
          drawerLabel: 'Accueil',
          headerTitle: getHeaderTitle(route),
        })}
      />
    </Drawer>
  );
}