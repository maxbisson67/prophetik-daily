import React from 'react';
import { Stack } from 'expo-router';
import { DrawerToggleButton } from '@react-navigation/drawer';
import { useTheme } from '@src/theme/ThemeProvider';

export default function AvatarsStackLayout() {
  const { colors } = useTheme();
  const isDark = colors.background === '#111827';

  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerLeft: (props) => <DrawerToggleButton {...props} />,
        headerStyle: {
          backgroundColor: colors.card,   // header adapté au thème
        },
        headerTitleStyle: {
          color: colors.text,             // texte lisible en dark mode
        },
        headerTintColor: colors.text,     // icône du Drawer adaptée
        contentStyle: {
          backgroundColor: colors.background, // fond uniforme clair/sombre
        },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Avatars' }} />
      <Stack.Screen name="AvatarScreen" options={{ title: 'Boutique d’avatars' }} />
      <Stack.Screen name="GroupAvatarScreen" options={{ title: 'Avatars du groupe' }} />
    </Stack>
  );
}