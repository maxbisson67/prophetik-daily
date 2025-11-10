// app/(drawer)/(tabs)/settings/index.js
import { View, Text, TouchableOpacity } from 'react-native';
import { Stack } from 'expo-router';
import { useTheme } from '@src/theme/ThemeProvider';

export default function SettingsScreen() {
  const { mode, setMode, colors } = useTheme();

  const setSafe = (m) => {
    if (typeof setMode === 'function') setMode(m);
  };

  const Item = ({ label, value }) => (
    <TouchableOpacity
      onPress={() => setSafe(value)}
      style={{
        padding: 14,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.card,
        marginBottom: 10,
      }}
    >
      <Text style={{ color: colors.text, fontWeight: mode === value ? '800' : '600' }}>
        {label} {mode === value ? '✓' : ''}
      </Text>
    </TouchableOpacity>
  );

  return (
    <>
      <Stack.Screen options={{ title: 'Réglages' }} />
      <View style={{ flex: 1, padding: 16, backgroundColor: colors.background }}>
        <Text style={{ color: colors.text, fontSize: 18, fontWeight: '800', marginBottom: 12 }}>
          Apparence
        </Text>

        <Item label="Automatique (suivre l’appareil)" value="system" />
        <Item label="Clair" value="light" />
        <Item label="Sombre" value="dark" />

        <Text style={{ color: colors.subtext, marginTop: 16 }}>
          Mode actuel : {mode}
        </Text>
      </View>
    </>
  );
}