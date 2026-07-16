import React, { useCallback } from "react";
import { View, Text, TouchableOpacity, Platform, ScrollView, Linking, Alert } from "react-native";
import { Stack } from "expo-router";
import { useTheme } from "@src/theme/ThemeProvider";
import { useLanguage } from "@src/i18n/LanguageProvider";
import { useAuth } from "@src/auth/SafeAuthProvider";
import i18n from "@src/i18n/i18n";
import * as Application from "expo-application";
import NotificationPrefsSection from "@src/notifications/NotificationPrefsSection";
import useDeleteAccount from "@src/account/useDeleteAccount";
import DeleteAccountButton from "@src/account/DeleteAccountButton";
import { privacyUrlForLang, termsUrlForLang, supportUrlForLang } from "@src/constants/legalUrls";

export default function SettingsScreen() {
  const { mode, setMode, colors } = useTheme();
  const { lang, setLang } = useLanguage();
  const { user } = useAuth();
  const { deleting, confirmDeleteAccount } = useDeleteAccount();
  const privacyUrl = privacyUrlForLang(lang);
  const termsUrl = termsUrlForLang(lang);
  const supportUrl = supportUrlForLang(lang);

  const visibleVersion = Application.nativeApplicationVersion ?? "—";
  const buildVersion = Application.nativeBuildVersion ?? "—";

  const setSafeTheme = (m) => {
    if (typeof setMode === "function") setMode(m);
  };

  const openUrl = useCallback(async (url) => {
    try {
      await Linking.openURL(url);
    } catch (e) {
      Alert.alert(i18n.t("common.unknownError", { defaultValue: "Erreur" }), String(e?.message || e));
    }
  }, []);

  const Item = ({ label, selected, onPress, danger = false }) => (
    <TouchableOpacity
      onPress={onPress}
      disabled={deleting}
      style={{
        padding: 14,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: danger ? "#dc2626" : colors.border,
        backgroundColor: colors.card,
        marginBottom: 10,
        opacity: deleting ? 0.6 : 1,
      }}
    >
      <Text
        style={{
          color: danger ? "#dc2626" : colors.text,
          fontWeight: selected ? "800" : "600",
        }}
      >
        {label} {selected ? "✓" : ""}
      </Text>
    </TouchableOpacity>
  );

  return (
    <>
      <Stack.Screen options={{ title: i18n.t("settings.title") }} />

      <ScrollView
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
      >
        <Text style={{ color: colors.text, fontSize: 18, fontWeight: "800", marginBottom: 12 }}>
          {i18n.t("settings.appearance")}
        </Text>

        <Item
          label={i18n.t("settings.theme.system")}
          selected={mode === "system"}
          onPress={() => setSafeTheme("system")}
        />
        <Item
          label={i18n.t("settings.theme.light")}
          selected={mode === "light"}
          onPress={() => setSafeTheme("light")}
        />
        <Item
          label={i18n.t("settings.theme.dark")}
          selected={mode === "dark"}
          onPress={() => setSafeTheme("dark")}
        />

        <Text style={{ color: colors.text, fontSize: 18, fontWeight: "800", marginVertical: 16 }}>
          {i18n.t("settings.language")}
        </Text>

        <Item label="Français" selected={lang === "fr"} onPress={() => setLang("fr")} />
        <Item label="English" selected={lang === "en"} onPress={() => setLang("en")} />

        <Text style={{ color: colors.text, fontSize: 18, fontWeight: "800", marginVertical: 16 }}>
          {i18n.t("settings.notifications.title", { defaultValue: "Notifications" })}
        </Text>

        <NotificationPrefsSection colors={colors} />

        <Text style={{ color: colors.text, fontSize: 18, fontWeight: "800", marginTop: 24, marginBottom: 12 }}>
          {i18n.t("settings.legal.title", { defaultValue: "Mentions légales" })}
        </Text>

        <Item
          label={i18n.t("settings.legal.privacy", { defaultValue: "Politique de confidentialité" })}
          onPress={() => openUrl(privacyUrl)}
        />
        <Item
          label={i18n.t("settings.legal.terms", { defaultValue: "Conditions d'utilisation" })}
          onPress={() => openUrl(termsUrl)}
        />
        <Item
          label={i18n.t("settings.legal.support", { defaultValue: "Support" })}
          onPress={() => openUrl(supportUrl)}
        />

        {user?.uid ? (
          <>
            <Text style={{ color: colors.text, fontSize: 18, fontWeight: "800", marginTop: 24, marginBottom: 12 }}>
              {i18n.t("settings.account.title", { defaultValue: "Compte" })}
            </Text>

            <DeleteAccountButton
              colors={colors}
              deleting={deleting}
              onPress={confirmDeleteAccount}
            />
          </>
        ) : null}

        <Text style={{ color: colors.text, fontSize: 18, fontWeight: "800", marginTop: 24, marginBottom: 12 }}>
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
          <Text style={{ color: colors.text, fontWeight: "600", marginBottom: 6 }}>
            App: {visibleVersion}
          </Text>
          <Text style={{ color: colors.text, opacity: 0.8 }}>
            {Platform.OS === "android" ? "Version code" : "Build number"}: {buildVersion}
          </Text>
        </View>
      </ScrollView>
    </>
  );
}
