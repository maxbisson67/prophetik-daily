import React from 'react';
import { Stack } from 'expo-router';
import { DrawerToggleButton } from '@react-navigation/drawer';
import { useTheme } from '@src/theme/ThemeProvider';

export default function BoutiqueLayout() {
  const { colors } = useTheme();

  return (
    <Stack
      screenOptions={{
        headerLeft: (props) => <DrawerToggleButton {...props} />,
        title: 'Boutique',
        headerStyle: {
          backgroundColor: colors.card,     // 👈 couleur dynamique du header
        },
        headerTitleStyle: {
          color: colors.text,              // 👈 texte en accord avec ton thème
        },
        headerTintColor: colors.text,       // 👈 couleur de la flèche du Drawer
        headerShadowVisible: false,         // 👌 plus beau en mode sombre
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Boutique' }} />
    </Stack>
  );
}