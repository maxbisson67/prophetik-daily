// app/(drawer)/groups/_layout.js
import React from 'react';
import { Stack } from 'expo-router';
import { Text } from 'react-native';
import { DrawerToggleButton } from '@react-navigation/drawer';

export default function GroupsStackLayout() {
  return (
    <Stack screenOptions={{ headerShown: true, headerStyle: { backgroundColor: '#fff' } }}>
      {/* Tu n’as PAS de "index" dans ce dossier. On ne le déclare donc pas. */}
      {/* Si tu rajoutes un app/(drawer)/groups/index.js plus tard, tu pourras ajouter cet écran. */}

     <Stack.Screen
      name="[groupId]/index"
      options={({ route }) => ({
        title: `Groupe ${route.params?.groupId ?? ''}`,
        headerBackTitleVisible: false,
        headerLeft: undefined,
        headerRight: () => null,
      })}
    />

      <Stack.Screen
        name="[groupId]/members"
        options={{
          title: 'Membres du groupe',
          headerBackTitleVisible: false,
          headerLeft: undefined,
          headerRight: () => null,
        }}
      />

      <Stack.Screen
        name="create"
        options={{
          title: 'Créer un groupe',
          headerLeft: undefined,
          headerRight: () => null,
        }}
      />

      <Stack.Screen
        name="join"
        options={{
          title: 'Joindre un groupe',
          headerLeft: undefined,
          headerRight: () => null,
        }}
      />

      <Stack.Screen
        name="useFavoriteGroup"
        options={{
          title: 'Groupe favori',
          headerLeft: undefined,
          headerRight: () => null,
        }}
      />
    </Stack>
  );
}