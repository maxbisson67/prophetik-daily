import { Stack } from 'expo-router';
import { DrawerToggleButton } from '@react-navigation/drawer';

export default function SettingLayout() {
  return (
    <Stack
      screenOptions={{
        headerLeft: (props) => <DrawerToggleButton {...props} />,
        title: 'Setting',
      }}
    >
      {/* ton écran principal */}
      <Stack.Screen name="index" options={{ title: 'Setting' }} />
    </Stack>
  );
}