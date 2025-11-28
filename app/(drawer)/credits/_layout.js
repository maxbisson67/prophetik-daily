// app/(drawer)/credits/_layout.js
import { Stack } from 'expo-router';
import { DrawerToggleButton } from '@react-navigation/drawer';
import { useTheme } from '@src/theme/ThemeProvider';

export default function CreditLayout() {
  const { colors } = useTheme();

  return (
    <Stack
      screenOptions={{
        headerLeft: (props) => <DrawerToggleButton {...props} />,
        title: 'Crédits',
        headerStyle: {
          backgroundColor: colors.card,   // 👈 s'adapte sombre/clair
        },
        headerTintColor: colors.text,     // texte et icônes adaptés
        headerTitleStyle: {
          color: colors.text,
          fontWeight: '700',
        },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Crédits' }} />
    </Stack>
  );
}