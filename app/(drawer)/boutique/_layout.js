// app/(drawer)/boutique/_layout.js
import React from 'react';
import { Stack } from 'expo-router';
import { DrawerToggleButton } from '@react-navigation/drawer';
import { useTheme } from '@src/theme/ThemeProvider';
import i18n from '@src/i18n/i18n';

export default function BoutiqueLayout() {
  const { colors } = useTheme();

  const title = i18n.t('boutique.title', 'Boutique');

  return (
    <Stack
      screenOptions={{
        headerLeft: (props) => <DrawerToggleButton {...props} />,
        title,
        headerStyle: {
          backgroundColor: colors.card,     // couleur dynamique du header
        },
        headerTitleStyle: {
          color: colors.text,               // texte adapté au thème
        },
        headerTintColor: colors.text,       // icônes (drawer / back)
        headerShadowVisible: false,         // plus clean en dark mode
      }}
    >
      <Stack.Screen
        name="index"
        options={{ title }}
      />
    </Stack>
  );
}