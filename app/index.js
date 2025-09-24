// app/index.js
import { Redirect } from 'expo-router';

export default function Index() {
  // Quand l'app démarre, on redirige vers les tabs
  return <Redirect href="/(tabs)" />;
}