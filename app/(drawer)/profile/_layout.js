import { Stack } from 'expo-router';
import { DrawerToggleButton } from '@react-navigation/drawer';

export default function ProfilLayout() {
  return (
    <Stack
      screenOptions={{
        headerLeft: (props) => <DrawerToggleButton {...props} />,
        title: 'Profil',
      }}
    >
      {/* ton écran principal */}
      <Stack.Screen name="index" options={{ title: 'Profil' }} />
    </Stack>
  );
}