// app/(drawer)/(tabs)/_layout.js
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@src/theme/ThemeProvider';

const RED = '#ef4444';
const GRAY = '#9ca3af';


export default function TabLayout() {
  const { colors } = useTheme();
  return (
    <Tabs
      initialRouteName="AccueilScreen"
      screenOptions={{
        headerShown: false, // le header des tabs peut servir (ou laisse true si tu veux le hamburger ici)
        headerStyle: { backgroundColor: colors.card },
        headerTintColor: colors.text,
        headerTitleStyle: { color: colors.text },
        tabBarStyle: {
          backgroundColor: colors.tabbar,
          borderTopColor: colors.border,
          borderTopWidth: 1,
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.subtext,
        tabBarLabelStyle: { fontWeight: '600' },
      }}
    >
      <Tabs.Screen name="index" options={{ href: null }} />
      <Tabs.Screen name="credits/index" options={{ href: null, title: 'Crédits' }} />
      <Tabs.Screen name="boutique/index" options={{ href: null, title: 'Crédits' }} />
      <Tabs.Screen name="settings/index" options={{ href: null, title: 'Crédits' }} />
      {/* Ne cache plus 'index' ici (voir fichier 3 pour la redirection) */}
      <Tabs.Screen
        name="AccueilScreen"
        options={{
          title: 'Accueil',
          tabBarIcon: ({ color, size }) => <Ionicons name="home" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="GroupsScreen"
        options={{
          title: 'Groupes',
          tabBarIcon: ({ color, size }) => <Ionicons name="people" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="ChallengesScreen"
        options={{
          title: 'Défis',
          tabBarIcon: ({ color, size }) => <Ionicons name="trophy" color={color} size={size} />,
        }}
      />
       <Tabs.Screen
        name="ClassementScreen"
        options={{
          title: 'Classement',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="podium" color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}