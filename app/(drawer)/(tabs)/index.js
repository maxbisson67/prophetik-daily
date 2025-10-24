// app/(drawer)/(tabs)/index.js
import { Redirect } from 'expo-router';

export default function TabsIndex() {
  // ✅ On force l’index des Tabs à pointer sur un vrai écran,
  // sinon le Drawer titre le chemin "(drawer)/(tabs)".
  return <Redirect href="/(drawer)/(tabs)/AccueilScreen" />;
}