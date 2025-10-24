// app/(drawer)/_layout.js
import React, { useCallback } from 'react';
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
import { useAuth } from '@src/auth/AuthProvider';

// ---------- Header title follows the focused tab ----------
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
    case 'ClassementScreen':
      return 'Classement';
    default:
      return 'Prophetik';
  }
}

// ---------- Custom drawer content ----------
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

function DrawerHeader() {
  const { profile } = useAuth();
  return (
    <View
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
        source={
          profile?.photoURL
            ? { uri: profile.photoURL }
            : require('@src/assets/avatar-placeholder.png')
        }
        style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: '#e5e7eb' }}
      />
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 16, fontWeight: '800' }}>
          {profile?.displayName || 'Invité'}
        </Text>
        <Text style={{ color: '#6b7280', fontSize: 12 }}>
          {profile?.email || 'Connecté'}
        </Text>
      </View>
    </View>
  );
}

function CustomDrawerContent(props) {
  const router = useRouter();
  const { signOut } = useAuth();

  // Helper pour ouvrir un onglet du navigator "(tabs)" puis fermer le drawer
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

      <Separator />

      <SectionLabel>Espace perso</SectionLabel>
      <DrawerItem
        label="Boutique"
        onPress={() => goTab('boutique/index')}
        icon={({ color, size }) => (
          <MaterialCommunityIcons name="shopping" size={size} color={color} />
        )}
      />
      <DrawerItem
        label="Crédits"
        onPress={() => goTab('credits/index')}
        icon={({ color, size }) => <Ionicons name="card" size={size} color={color} />}
      />
      <DrawerItem
        label="Profil"
        onPress={() => {
          props.navigation.dispatch(DrawerActions.closeDrawer());
          requestAnimationFrame(() => {
            router.push('/profile');
          });
        }}
        icon={({ color, size }) => (
          <Ionicons name="person-circle" size={size} color={color} />
        )}
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
        headerShown: true,
        drawerType: 'slide',
        drawerHideStatusBarOnOpen: true,
        headerLeft: (props) => <DrawerToggleButton {...props} />,
        headerStyle: { backgroundColor: '#fff' },
        drawerActiveTintColor: '#ef4444',
        drawerInactiveTintColor: '#6b7280',
        drawerLabelStyle: { fontWeight: '700' },
      }}
    >
      {/* L’écran principal reste le tabs; le header reprend le titre de l’onglet actif */}
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