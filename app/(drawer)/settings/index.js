// app/(drawer)/credits/index.js
import { Redirect } from 'expo-router';
export default function SettingsRedirect() {
  return <Redirect href="/(drawer)/(tabs)/settings" />;
}