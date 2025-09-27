// app/(auth)/_layout.js
import { Stack } from 'expo-router';

export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: true }}>
      <Stack.Screen name="sign-in" options={{ title: 'Se connecter' }} />
      <Stack.Screen name="sign-up" options={{ title: 'Créer un compte' }} />
    </Stack>
  );
}