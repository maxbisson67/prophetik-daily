// app/setting/_layout.js
import React from 'react';
import { Stack } from 'expo-router';
import { DrawerToggleButton } from '@react-navigation/drawer';
import { useTheme } from '@src/theme/ThemeProvider';

export default function SettingLayout() {
  const { colors } = useTheme();

  return (
    <Stack
      screenOptions={{
        headerLeft: (props) => <DrawerToggleButton {...props} />,
        title: 'Setting',
        headerStyle: {
          backgroundColor: colors.card,   // 👈 header suit le thème
        },
        headerTitleStyle: {
          color: colors.text,             // 👈 texte du titre
        },
        headerTintColor: colors.text,     // 👈 icône du drawer / back
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Setting' }} />
    </Stack>
  );
}