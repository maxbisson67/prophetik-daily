import { Tabs, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { HeaderProfileButton } from "@src/profile/HeaderProfileButton";

export default function TabLayout() {
  const r = useRouter();
  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        headerRight: () => (
          <HeaderProfileButton onPress={() => r.push("/profile")} />
        ),
        sceneStyle: { backgroundColor: 'transparent' },
        contentStyle: { backgroundColor: 'transparent' }, // selon version
        tabBarStyle: { backgroundColor: 'rgba(255,255,255,0.92)' },
        headerStyle: { backgroundColor: '#fff' },

      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: "Accueil", tabBarIcon: ({ color, size }) => <Ionicons name="home" color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="GroupsScreen"
        options={{ title: "Groupes", tabBarIcon: ({ color, size }) => <Ionicons name="people" color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="ChallengesScreen"
        options={{ title: "Défis", tabBarIcon: ({ color, size }) => <Ionicons name="trophy" color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="ResultatsScreen"
        options={{ title: "Résultats", tabBarIcon: ({ color, size }) => <Ionicons name="stats-chart" color={color} size={size} /> }}
      />
    </Tabs>
  );
}