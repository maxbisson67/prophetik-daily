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

// ✅ expo-image pour contrôler le cache
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
  return (
    <Text
      style={{
        marginTop: 18,
        marginBottom: 6,
        marginHorizontal: 16,
        color: '#6b7280',
        fontWeight: '700',
      }}
    >
      {children}
    </Text>
  );
}
function Separator() {
  return (
    <View
      style={{
        height: 1,
        backgroundColor: '#e5e7eb',
        marginVertical: 8,
        marginHorizontal: 12,
      }}
    />
  );
}

function tsToMillis(ts) {
  if (!ts) return 0;
  if (typeof ts.toMillis === 'function') return ts.toMillis();
  // Firestore Timestamp-like object
  if (typeof ts.seconds === 'number') return ts.seconds * 1000 + (ts.nanoseconds ? Math.floor(ts.nanoseconds / 1e6) : 0);
  if (typeof ts === 'number') return ts;
  return 0;
}

function withCacheBust(url, updatedAt) {
  if (!url) return null;
  const v = tsToMillis(updatedAt) || Date.now(); // ⚠️ si updatedAt absent → nonce
  return url.includes('?') ? `${url}&_cb=${v}` : `${url}?_cb=${v}`;
}

/* ------------------------------------------------------------------ */
/* DrawerHeader: lit profiles_public/{uid} pour afficher nom + avatar  */
/* ------------------------------------------------------------------ */
function DrawerHeader() {
  const { user } = useAuth();
  const { profile: pub, loading: loadingPub } = usePublicProfile(user?.uid);

  const displayName =
    pub?.displayName ||
    user?.displayName ||
    (user?.email ? user.email.split('@')[0] : 'Invité');

  const email = user?.email || '';

  //  A) Avatar: UNIQUEMENT profiles_public.avatarUrl (fallback auth.photoURL)
  const rawAvatar = pub?.avatarUrl || user?.photoURL || null;

  //  B) Version basée sur updatedAt (ou nonce si absent)
  const avatarUri = useMemo(
    () => withCacheBust(rawAvatar, pub?.updatedAt),
    [rawAvatar, pub?.updatedAt]
  );

  //  C) Remount forcé quand l'URL change — et “bump” si on détecte un onError (cache récalcitrant)
  const [bump, setBump] = React.useState(0);
  const [lastKey, setLastKey] = React.useState('');
  const imageKey = `${avatarUri || 'placeholder'}#${bump}`;

  // si l’URL change, on remonte le composant pour éviter toute mémoisation interne
  React.useEffect(() => {
    if (imageKey !== lastKey) setLastKey(imageKey);
  }, [imageKey, lastKey]);

  return (
    <View
      key={lastKey} // ← remount du header quand l'URL (avec _cb) change
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
        key={imageKey} // ← remount de l'image elle-même
        source={
          avatarUri
            ? { uri: avatarUri }
            : require('@src/assets/avatar-placeholder.png')
        }
        onError={() => {
          if (__DEV__) console.warn('[DrawerHeader] avatar load error:', avatarUri);
          // Dernier recours: on force un nouveau key avec un nonce
          setBump((n) => n + 1);
        }}
        onLoadEnd={() => {
          
        }}
        style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: '#e5e7eb' }}
      />
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 16, fontWeight: '800' }}>
          {loadingPub ? 'Chargement…' : displayName}
        </Text>
        <Text style={{ color: '#6b7280', fontSize: 12 }}>
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
  const router = useRouter();
  const { signOut } = useAuth();

  const goTab = useCallback(
    (screenName) => {
      props.navigation.navigate('(tabs)', { screen: screenName });
      props.navigation.dispatch(DrawerActions.closeDrawer());
    },
    [props.navigation]
  );

  return (
    <DrawerContentScrollView {...props} contentContainerStyle={{ paddingTop: 0 }}>
      <DrawerHeader />
      <Separator />

      <SectionLabel>Navigation</SectionLabel>
      <DrawerItem
        label="Accueil"
        onPress={() => goTab('AccueilScreen')}
        icon={({ color, size }) => <Ionicons name="home" size={size} color={color} />}
      />
      <DrawerItem
        label="Groupes"
        onPress={() => goTab('GroupsScreen')}
        icon={({ color, size }) => <Ionicons name="people" size={size} color={color} />}
      />
      <DrawerItem
        label="Défis"
        onPress={() => goTab('ChallengesScreen')}
        icon={({ color, size }) => <Ionicons name="trophy" size={size} color={color} />}
      />
         <DrawerItem
        label="Classement"
        onPress={() => goTab('ClassementScreen')}
        icon={({ color, size }) => <Ionicons name="podium" size={size} color={color} />}
      />
      <Separator />

      <SectionLabel>Espace perso</SectionLabel>
       <DrawerItem
        label="Boutique"
        onPress={() => {
          props.navigation.dispatch(DrawerActions.closeDrawer());
          requestAnimationFrame(() => {
            router.push('/(drawer)/boutique');
          });
        }}
       icon={({ color, size }) => (
          <MaterialCommunityIcons name="shopping" size={size} color={color} />
        )}
      />
       <DrawerItem
        label="Crédits"
        onPress={() => {
          props.navigation.dispatch(DrawerActions.closeDrawer());
          requestAnimationFrame(() => {
            router.push('/(drawer)/credits');
          });
        }}
        icon={({ color, size }) => <Ionicons name="card" size={size} color={color} />}
      />
     
       <DrawerItem
        label="Profil"
        onPress={() => {
          props.navigation.dispatch(DrawerActions.closeDrawer());
          requestAnimationFrame(() => {
            router.push('/(drawer)/profile');
          });
        }}
        icon={({ color, size }) => <Ionicons name="person-circle" size={size} color={color} />}
      />
     
      <DrawerItem
        label="Réglages"
        onPress={() => {
          props.navigation.dispatch(DrawerActions.closeDrawer());
          requestAnimationFrame(() => {
            router.push('/(drawer)/settings');
          });
        }}
        icon={({ color, size }) => <Ionicons name="settings" size={size} color={color} />}
      />

      <Separator />

      <DrawerItem
        label="Se déconnecter"
        onPress={async () => {
          await signOut().catch(() => {});
          router.replace('/(auth)/auth-choice');
        }}
        icon={({ color, size }) => <Ionicons name="log-out" size={size} color={color} />}
      />
    </DrawerContentScrollView>
  );
}

export default function DrawerLayout() {
  return (
    <Drawer
      id="rootDrawer"
      drawerContent={(props) => <CustomDrawerContent {...props} />}
      screenOptions={{
        headerShown: false,
        drawerType: 'slide',
        drawerHideStatusBarOnOpen: true,
        headerLeft: (props) => <DrawerToggleButton {...props} />,
        headerStyle: { backgroundColor: '#fff' },
        drawerActiveTintColor: '#ef4444',
        drawerInactiveTintColor: '#6b7280',
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