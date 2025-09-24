// app/_layout.js
import React from 'react';
import { Stack } from 'expo-router';

// ⚠️ Ce layout est le layout racine.
// Il ne contient PAS tes Tabs (ils sont dans app/(tabs)/_layout.js).
// Ici, tu peux aussi ajouter un provider global si nécessaire.

export default function RootLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }} />
  );
}