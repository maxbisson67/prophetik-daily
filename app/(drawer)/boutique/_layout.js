import { Stack } from 'expo-router';
import { DrawerToggleButton } from '@react-navigation/drawer';

export default function BoutiqueLayout() {
  return (
    <Stack
      screenOptions={{
        headerLeft: (props) => <DrawerToggleButton {...props} />,
        title: 'Boutique',
      }}
    >
      {/* ton écran principal */}
      <Stack.Screen name="index" options={{ title: 'Boutique' }} />
    </Stack>
  );
}