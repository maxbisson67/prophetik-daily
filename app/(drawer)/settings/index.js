import { View, Text, TouchableOpacity } from 'react-native';
import { Stack } from 'expo-router';
import { useTheme } from '@src/theme/ThemeProvider';
import { useLanguage } from '@src/i18n/LanguageProvider';
import i18n from '@src/i18n/i18n';

export default function SettingsScreen() {
  const { mode, setMode, colors } = useTheme();
  const { lang, setLang } = useLanguage();

  const setSafeTheme = (m) => {
    if (typeof setMode === 'function') setMode(m);
  };

  const Item = ({ label, value, selected, onPress }) => (
    <TouchableOpacity
      onPress={onPress}
      style={{
        padding: 14,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.card,
        marginBottom: 10,
      }}
    >
      <Text
        style={{
          color: colors.text,
          fontWeight: selected ? '800' : '600',
        }}
      >
        {label} {selected ? '✓' : ''}
      </Text>
    </TouchableOpacity>
  );

  return (
    <>
      <Stack.Screen options={{ title: i18n.t('settings.title') }} />

      <View style={{ flex: 1, padding: 16, backgroundColor: colors.background }}>

        {/* --- Apparence --- */}
        <Text
          style={{
            color: colors.text,
            fontSize: 18,
            fontWeight: '800',
            marginBottom: 12,
          }}
        >
          {i18n.t('settings.appearance')}
        </Text>

        <Item
          label={i18n.t('settings.theme.system')}
          value="system"
          selected={mode === 'system'}
          onPress={() => setSafeTheme('system')}
        />
        <Item
          label={i18n.t('settings.theme.light')}
          value="light"
          selected={mode === 'light'}
          onPress={() => setSafeTheme('light')}
        />
        <Item
          label={i18n.t('settings.theme.dark')}
          value="dark"
          selected={mode === 'dark'}
          onPress={() => setSafeTheme('dark')}
        />

        {/* --- Langue --- */}
        <Text
          style={{
            color: colors.text,
            fontSize: 18,
            fontWeight: '800',
            marginVertical: 16,
          }}
        >
          {i18n.t('settings.language')}
        </Text>

        <Item
          label="Français"
          value="fr"
          selected={lang === 'fr'}
          onPress={() => setLang('fr')}
        />

        <Item
          label="English"
          value="en"
          selected={lang === 'en'}
          onPress={() => setLang('en')}
        />

      </View>
    </>
  );
}