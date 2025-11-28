// app/(drawer)/defis/_layout.js
import React from 'react';
import { Stack } from 'expo-router';
import { DrawerToggleButton } from '@react-navigation/drawer';
import { useTheme } from '@src/theme/ThemeProvider';

export default function DefisStackLayout() {
  const { colors } = useTheme();

  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: colors.card },
        headerTitleStyle: { color: colors.text },
        headerTintColor: colors.text,
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          title: 'Défis',
          headerLeft: (props) => (
            <DrawerToggleButton
              {...props}
              tintColor={colors.text}
            />
          ),
        }}
      />

      <Stack.Screen
        name="[defiId]/index"
        options={{
          headerBackTitleVisible: false,
          // Pas de title ici, laissé à l'écran lui-même
        }}
      />

      <Stack.Screen
        name="[defiId]/participate"
        options={{
          headerBackTitleVisible: false,
        }}
      />

      <Stack.Screen
        name="[defiId]/results"
        options={{
          headerBackTitleVisible: false,
        }}
      />
    </Stack>
  );
}