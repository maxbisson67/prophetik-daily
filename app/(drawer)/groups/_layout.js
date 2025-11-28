// app/(drawer)/groups/_layout.js
import React from 'react';
import { Stack } from 'expo-router';
import { DrawerToggleButton } from '@react-navigation/drawer';
import { useTheme } from '@src/theme/ThemeProvider';

export default function GroupsLayout() {
  const { colors, isDark } = useTheme();

  return (
    <Stack
      screenOptions={{
        headerLeft: (props) => <DrawerToggleButton {...props} />,
        // 👉 applique le thème
        headerStyle: { backgroundColor: colors.header },
        headerTintColor: colors.headerTint,
        headerTitleStyle: { color: colors.headerTint },
        contentStyle: { backgroundColor: colors.background },
        headerShadowVisible: !isDark,
      }}
    >
      <Stack.Screen
        name="index"
        options={{ title: 'Groupes' }}
      />
      <Stack.Screen
        name="[groupId]"
        options={{ title: 'Détail du groupe' }}
      />
    </Stack>
  );
}