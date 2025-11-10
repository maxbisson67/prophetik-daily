import React from 'react';
import { Stack } from 'expo-router';
import { DrawerToggleButton } from '@react-navigation/drawer';

export default function AvatarsStackLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerLeft: (props) => <DrawerToggleButton {...props} />,
      }}
    >
      {/* page d’entrée (facultatif) */}
      <Stack.Screen name="index" options={{ title: 'Avatars' }} />
      <Stack.Screen name="AvatarScreen" options={{ title: 'Boutique d’avatars' }} />
      <Stack.Screen name="GroupAvatarScreen" options={{ title: 'Avatars du groupe' }} />
    </Stack>
  );
}