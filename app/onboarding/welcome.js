// app/onboarding/welcome.js
import React, { useState } from "react";
import { View, Text, TouchableOpacity, Image, ActivityIndicator, Alert, SafeAreaView } from "react-native";
import { Stack, useRouter } from "expo-router";
import firestore from "@react-native-firebase/firestore";
import { useAuth } from "@src/auth/SafeAuthProvider";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTheme } from "@src/theme/ThemeProvider";
import i18n from "@src/i18n/i18n";
const PROPHETIK_LOGO = require("../../assets/prophetik_icon_512.png");

const RED = "#b91c1c";
const BLACK = "#111827";

export default function WelcomeOnboarding() {
  const router = useRouter();
  const { user } = useAuth();
  const { colors } = useTheme();
  const [saving, setSaving] = useState(false);

async function markSeenAndGo(nextPath) {
  if (!user?.uid) {
    router.replace("/");
    return;
  }

  try {
    setSaving(true);

    await firestore()
      .doc(`participants/${user.uid}`)
      .update({
        "onboarding.welcomeSeen": true,
        updatedAt: firestore.FieldValue.serverTimestamp(),
      });

  } catch (e) {
    Alert.alert("Oups", String(e?.message || e));
  } finally {
    setSaving(false);
    router.replace(nextPath || "/(drawer)/(tabs)/AccueilScreen");
  }
}

  return (
    <>
      <Stack.Screen
        options={{
          title: i18n.t("onboarding.welcome.title", { defaultValue: "Welcome" }),
        }}
      />

      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={{ flex: 1, padding: 16, justifyContent: "center" }}>
          <View
            style={{
              padding: 16,
              borderWidth: 1,
              borderRadius: 16,
              backgroundColor: colors.card,
              borderColor: colors.border,
            }}
          >
            <View style={{ alignItems: "center" }}>
              <Image
                source={PROPHETIK_LOGO}
                style={{
                  width: 120,
                  height: 120,
                  borderRadius: 60,
                  backgroundColor: colors.card2,
                  marginBottom: 12,
                }}
                resizeMode="contain"
              />

            <Text style={{ fontSize: 22, fontWeight: "900", textAlign: "center", color: colors.text }}>
              {i18n.t("onboarding.welcome.h1", { defaultValue: "Welcome to Prophetik 🎉" })}
            </Text>

            <Text style={{ marginTop: 8, color: colors.subtext, textAlign: "center" }}>
              {i18n.t("onboarding.welcome.subtitle", {
                defaultValue: "Create your first group or join your friends to play.",
              })}
            </Text>
            </View>

            <View style={{ marginTop: 16, gap: 10 }}>
              {/* CTA Rejoindre (rouge) */}
              <TouchableOpacity
                disabled={saving}
                onPress={() => markSeenAndGo("/groups/join?from=onboarding")}
                activeOpacity={0.9}
                style={{
                  backgroundColor: RED,
                  paddingVertical: 14,
                  borderRadius: 12,
                  alignItems: "center",
                  opacity: saving ? 0.7 : 1,
                }}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={{ color: "#fff", fontWeight: "900" }}>
                    {i18n.t("onboarding.welcome.joinCta", { defaultValue: "Join a group" })}
                  </Text>
                )}
              </TouchableOpacity>

              {/* CTA Créer (noir) */}
              <TouchableOpacity
                disabled={saving}
                onPress={() => markSeenAndGo("/groups/create?from=onboarding")}
                activeOpacity={0.9}
                style={{
                  backgroundColor: BLACK,
                  paddingVertical: 14,
                  borderRadius: 12,
                  alignItems: "center",
                  opacity: saving ? 0.7 : 1,
                }}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                <Text style={{ color: "#fff", fontWeight: "900" }}>
                  {i18n.t("onboarding.welcome.createCta", { defaultValue: "Create a group" })}
                </Text>
                )}
              </TouchableOpacity>

              {/* CTA Plus tard (fine bordure) */}
              <TouchableOpacity
                disabled={saving}
                onPress={() => markSeenAndGo(null)}
                activeOpacity={0.9}
                style={{
                  borderWidth: 1,
                  borderColor: colors.border,
                  paddingVertical: 12,
                  borderRadius: 12,
                  alignItems: "center",
                  backgroundColor: "transparent",
                  opacity: saving ? 0.7 : 1,
                }}
              >
                <Text style={{ color: colors.subtext, fontWeight: "800" }}>
                  {i18n.t("common.later", { defaultValue: "Later" })}
                </Text>
              </TouchableOpacity>
            </View>

            {/* ✅ Enlever la ligne "Cumule des crédits..." */}
            <View style={{ marginTop: 16, gap: 8 }}>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <MaterialCommunityIcons name="account-group" size={18} color={RED} />
                <Text style={{ marginLeft: 8, color: colors.text }}>
                  {i18n.t("onboarding.welcome.privateGroups", {
                    defaultValue: "Play with your friends in private groups",
                  })}
                </Text>
              </View>
            </View>
          </View>
        </View>
      </SafeAreaView>
    </>
  );
}