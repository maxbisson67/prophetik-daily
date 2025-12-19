// app/(drawer)/_layout.js
import React, { useCallback, useMemo } from 'react';
import { View, Text, Image } from 'react-native';
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
import { usePublicProfile } from '@src/profile/usePublicProfile';

// ✅ i18n (uniforme partout)
import i18n from '@src/i18n/i18n';

/* =========================================================
   Helpers
========================================================= */

function getHeaderTitle(route) {
  const focused = getFocusedRouteNameFromRoute(route) ?? 'AccueilScreen';

  switch (focused) {
    case 'AccueilScreen':
    case 'index':
      return i18n.t('home.title', { defaultValue: 'Home' });

    case 'GroupsScreen':
      return i18n.t('drawer.groups', { defaultValue: 'Groups' });

    case 'ChallengesScreen':
      return i18n.t('drawer.challenges', { defaultValue: 'Challenges' });

    case 'credits/index':
      return i18n.t('drawer.credits', { defaultValue: 'Credits' });

    case 'boutique/index':
      return i18n.t('drawer.shop', { defaultValue: 'Shop' });

    case 'profile/index':
      return i18n.t('drawer.profile', { defaultValue: 'Profile' });

    case 'settings/index':
      return i18n.t('drawer.settings', { defaultValue: 'Settings' });

    case 'ClassementScreen':
      return i18n.t('drawer.leaderboard', { defaultValue: 'Leaderboard' });

    case 'MatchLiveScreen':
      return i18n.t('drawer.matchLive', { defaultValue: 'Live game' });

    default:
      return i18n.t('app.name', { defaultValue: 'Prophetik' });
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
    return (
      ts.seconds * 1000 +
      (ts.nanoseconds ? Math.floor(ts.nanoseconds / 1e6) : 0)
    );
  }
  if (typeof ts === 'number') return ts;
  return 0;
}

function withCacheBust(url, updatedAt) {
  if (!url) return null;
  const v = tsToMillis(updatedAt) || Date.now();
  return url.includes('?') ? `${url}&_cb=${v}` : `${url}?_cb=${v}`;
}

/* =========================================================
   DrawerHeader: profiles_public/{uid}
========================================================= */
function DrawerHeader() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const { profile: pub, loading: loadingPub } = usePublicProfile(user?.uid);

  const guestLabel = i18n.t('drawer.guest', { defaultValue: 'Guest' });
  const onlineLabel = i18n.t('drawer.online', { defaultValue: 'Signed in' });
  const offlineLabel = i18n.t('drawer.offline', { defaultValue: 'Offline' });
  const loadingLabel = i18n.t('common.loading', { defaultValue: 'Loading…' });

  const displayName =
    pub?.displayName ||
    user?.displayName ||
    (user?.email ? user.email.split('@')[0] : guestLabel);

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
          {loadingPub ? loadingLabel : displayName}
        </Text>
        <Text style={{ color: colors.subtext, fontSize: 12 }}>
          {email || (user ? onlineLabel : offlineLabel)}
        </Text>
      </View>
    </View>
  );
}

/* =========================================================
   Drawer Content
========================================================= */
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
    style: { marginHorizontal: 4, borderRadius: 10 },
    labelStyle: { color: colors.text, fontWeight: '600' },
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

      <SectionLabel>
        {i18n.t('drawer.section.navigation', { defaultValue: 'Navigation' })}
      </SectionLabel>

      <DrawerItem
        {...itemCommonProps}
        label={i18n.t('drawer.home', { defaultValue: 'Home' })}
        onPress={() => goTab('AccueilScreen')}
        icon={({ size }) => (
          <Ionicons name="home" size={size} color={colors.text} />
        )}
      />

      <Separator />
      <SectionLabel>
        {i18n.t('drawer.section.personal', { defaultValue: 'Personal' })}
      </SectionLabel>


      <DrawerItem
          {...itemCommonProps}
          label={i18n.t('drawer.howItWorks', { defaultValue: 'Comment ça marche' })}
          onPress={() => {
            props.navigation.dispatch(DrawerActions.closeDrawer());
            requestAnimationFrame(() => router.push('/(drawer)/howitworks'));
          }}
          icon={({ size }) => (
            <Ionicons name="help-circle-outline" size={size} color={colors.text} />
          )}
      />

      <DrawerItem
        {...itemCommonProps}
        label={i18n.t('drawer.subscriptions', { defaultValue: 'Subscriptions' })}
        onPress={() => {
          props.navigation.dispatch(DrawerActions.closeDrawer());
          requestAnimationFrame(() => router.push('/(drawer)/subscriptions'));
        }}
        icon={({ size }) => (
          <Ionicons name="diamond-outline" size={size} color={colors.text} />
        )}
      />

        <DrawerItem
        {...itemCommonProps}
        label={i18n.t('drawer.credits', { defaultValue: 'Credits' })}
        onPress={() => {
          props.navigation.dispatch(DrawerActions.closeDrawer());
          requestAnimationFrame(() => router.push('/(drawer)/credits'));
        }}
        icon={({ size }) => (
          <Ionicons name="card" size={size} color={colors.text} />
        )}
      />


      <DrawerItem
        {...itemCommonProps}
        label={i18n.t('drawer.shop', { defaultValue: 'Shop' })}
        onPress={() => {
          props.navigation.dispatch(DrawerActions.closeDrawer());
          requestAnimationFrame(() => router.push('/(drawer)/boutique'));
        }}
        icon={({ size }) => (
          <MaterialCommunityIcons name="shopping" size={size} color={colors.text} />
        )}
      />

    
      <DrawerItem
        {...itemCommonProps}
        label={i18n.t('drawer.profile', { defaultValue: 'Profile' })}
        onPress={() => {
          props.navigation.dispatch(DrawerActions.closeDrawer());
          requestAnimationFrame(() => router.push('/(drawer)/profile'));
        }}
        icon={({ size }) => (
          <Ionicons name="person-circle" size={size} color={colors.text} />
        )}
      />

      <DrawerItem
        {...itemCommonProps}
        label={i18n.t('drawer.settings', { defaultValue: 'Settings' })}
        onPress={() => {
          props.navigation.dispatch(DrawerActions.closeDrawer());
          requestAnimationFrame(() => router.push('/(drawer)/settings'));
        }}
        icon={({ size }) => (
          <Ionicons name="settings" size={size} color={colors.text} />
        )}
      />


      <Separator />

      <DrawerItem
        {...itemCommonProps}
        label={i18n.t('drawer.signOut', { defaultValue: 'Sign out' })}
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

/* =========================================================
   Drawer Layout
========================================================= */
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
        drawerStyle: { backgroundColor: colors.background },
        drawerActiveTintColor: colors.primary,
        drawerInactiveTintColor: colors.subtext,
        drawerLabelStyle: { fontWeight: '700' },
      }}
    >
      <Drawer.Screen
        name="(tabs)"
        options={({ route }) => ({
          drawerLabel: i18n.t('drawer.home', { defaultValue: 'Home' }),
          headerTitle: getHeaderTitle(route),
        })}
      />
    </Drawer>
  );
}