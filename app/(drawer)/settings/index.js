import React from 'react';
import { View, Text, TouchableOpacity, Platform } from 'react-native';
import { Stack } from 'expo-router';
import { useTheme } from '@src/theme/ThemeProvider';
import { useLanguage } from '@src/i18n/LanguageProvider';
import i18n from '@src/i18n/i18n';
import crashlytics from '@react-native-firebase/crashlytics';
import * as Application from 'expo-application';

export default function SettingsScreen() {
  const { mode, setMode, colors } = useTheme();
  const { lang, setLang } = useLanguage();

  const visibleVersion = Application.nativeApplicationVersion ?? '—';
  const buildVersion = Application.nativeBuildVersion ?? '—';

  const setSafeTheme = (m) => {
    if (typeof setMode === 'function') setMode(m);
  };

  const Item = ({ label, selected, onPress, danger = false }) => (
    <TouchableOpacity
      onPress={onPress}
      style={{
        padding: 14,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: danger ? '#dc2626' : colors.border,
        backgroundColor: colors.card,
        marginBottom: 10,
      }}
    >
      <Text
        style={{
          color: danger ? '#dc2626' : colors.text,
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
        <Text style={{ color: colors.text, fontSize: 18, fontWeight: '800', marginBottom: 12 }}>
          {i18n.t('settings.appearance')}
        </Text>

        <Item
          label={i18n.t('settings.theme.system')}
          selected={mode === 'system'}
          onPress={() => setSafeTheme('system')}
        />
        <Item
          label={i18n.t('settings.theme.light')}
          selected={mode === 'light'}
          onPress={() => setSafeTheme('light')}
        />
        <Item
          label={i18n.t('settings.theme.dark')}
          selected={mode === 'dark'}
          onPress={() => setSafeTheme('dark')}
        />

        <Text style={{ color: colors.text, fontSize: 18, fontWeight: '800', marginVertical: 16 }}>
          {i18n.t('settings.language')}
        </Text>

        <Item label="Français" selected={lang === 'fr'} onPress={() => setLang('fr')} />
        <Item label="English" selected={lang === 'en'} onPress={() => setLang('en')} />

        <Text style={{ color: colors.text, fontSize: 18, fontWeight: '800', marginTop: 24, marginBottom: 12 }}>
          Version
        </Text>

        <View
          style={{
            padding: 14,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.card,
          }}
        >
          <Text style={{ color: colors.text, fontWeight: '600', marginBottom: 6 }}>
            App: {visibleVersion}
          </Text>
          <Text style={{ color: colors.text, opacity: 0.8 }}>
            {Platform.OS === 'android' ? 'Version code' : 'Build number'}: {buildVersion}
          </Text>
        </View>
      </View>
    </>
  );
}