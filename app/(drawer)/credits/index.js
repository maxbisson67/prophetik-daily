// app/(drawer)/credits/index.js
import { Redirect } from 'expo-router';
export default function CreditsRedirect() {
  return <Redirect href="/(drawer)/(tabs)/credits" />;
}