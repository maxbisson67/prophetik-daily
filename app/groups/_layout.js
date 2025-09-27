// app/groups/_layout.js
import { Stack } from 'expo-router';

export default function GroupsLayout() {
  return (
    <Stack screenOptions={{ headerShown: true, title: 'Groupe' }} />
  );
}