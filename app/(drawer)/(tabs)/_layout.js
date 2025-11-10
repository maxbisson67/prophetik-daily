import React from 'react';
import { Tabs } from 'expo-router';
import { DrawerToggleButton } from '@react-navigation/drawer';
import { Ionicons } from '@expo/vector-icons';

export default function TabsLayout() {
  return (
    <Tabs
      initialRouteName="AccueilScreen"
      screenOptions={{
        headerShown: true,
        lazy: true,
        headerStyle: { backgroundColor: '#fff' },
        tabBarActiveTintColor: '#ef4444',
        tabBarInactiveTintColor: '#6b7280',
      }}
    >
      <Tabs.Screen
        name="AccueilScreen"
        options={{
          title: 'Accueil',
          headerLeft: (props) => <DrawerToggleButton {...props} />,
          tabBarIcon: ({ color, size }) => <Ionicons name="home" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="GroupsScreen"
        options={{
          title: 'Groupes',
          headerLeft: (props) => <DrawerToggleButton {...props} />,
          tabBarIcon: ({ color, size }) => <Ionicons name="people" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="ChallengesScreen"
        options={{
          title: 'Défis',
          headerLeft: (props) => <DrawerToggleButton {...props} />,
          tabBarIcon: ({ color, size }) => <Ionicons name="trophy" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="ClassementScreen"
        options={{
          title: 'Classement',
          headerLeft: (props) => <DrawerToggleButton {...props} />,
          tabBarIcon: ({ color, size }) => <Ionicons name="podium" color={color} size={size} />,
        }}
      />

      {/* Hide the file-based route (tabs index) */}
      <Tabs.Screen
        name="index"
        options={{
          href: null,          // ✅ enough to hide it
          headerShown: false,  // optional
        }}
      />
    </Tabs>
  );
}