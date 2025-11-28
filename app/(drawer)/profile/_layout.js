// app/profile/_layout.js
import React from 'react';
import { Stack } from 'expo-router';
import { DrawerToggleButton } from '@react-navigation/drawer';
import { useTheme } from '@src/theme/ThemeProvider';

export default function ProfilLayout() {
  const { colors } = useTheme();

  return (
    <Stack
      screenOptions={{
        headerLeft: (props) => <DrawerToggleButton {...props} />,
        title: 'Profil',
        headerStyle: {
          backgroundColor: colors.card,   // 👈 adapte l'entête au mode sombre
        },
        headerTitleStyle: {
          color: colors.text,              // 👈 texte lisible clair/sombre
        },
        headerTintColor: colors.text,      // 👈 couleur icône du drawer/back
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Profil' }} />
    </Stack>
  );
}