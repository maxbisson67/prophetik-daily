// app/(drawer)/defis/_layout.js
import React from 'react';
import { Stack } from 'expo-router';
import { DrawerToggleButton } from '@react-navigation/drawer';

export default function DefisStackLayout() {
  return (
    <Stack screenOptions={{ headerShown: true, headerStyle: { backgroundColor: '#fff' } }}>
      <Stack.Screen
        name="index"
        options={{
          title: 'Défis',
          headerLeft: (props) => <DrawerToggleButton {...props} />,
        }}
      />
      <Stack.Screen
        name="[defiId]/index"
        options={{
          headerBackTitleVisible: false,
          // important: NO headerTitle here; let the screen set it
        }}
      />
      <Stack.Screen
        name="[defiId]/participate"
        options={{
          headerBackTitleVisible: false,
          // important: NO headerTitle here; let the screen set it
        }}
      />
      <Stack.Screen
        name="[defiId]/results"
        options={{
          headerBackTitleVisible: false,
          // important: NO headerTitle here; let the screen set it
        }}
      />
    </Stack>
  );
}