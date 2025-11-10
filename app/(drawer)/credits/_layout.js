import { Stack } from 'expo-router';
import { DrawerToggleButton } from '@react-navigation/drawer';

export default function CreditLayout() {
  return (
    <Stack
      screenOptions={{
        headerLeft: (props) => <DrawerToggleButton {...props} />,
        title: 'Crédits',
      }}
    >
      {/* ton écran principal */}
      <Stack.Screen name="index" options={{ title: 'Crédits' }} />
    </Stack>
  );
}