// app/(auth)/auth-choice.js
import React from "react";
import { View, Text, TouchableOpacity, SafeAreaView } from "react-native";
import { Stack, useRouter } from "expo-router";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";

export default function AuthChoiceScreen() {
  const router = useRouter();

  const PrimaryBtn = ({ onPress, icon, label, testID }) => (
    <TouchableOpacity
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      testID={testID}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        backgroundColor: "#111827",
        padding: 14,
        borderRadius: 12,
      }}
    >
      {icon}
      <Text style={{ color: "#fff", fontWeight: "700", fontSize: 16 }}>{label}</Text>
    </TouchableOpacity>
  );

  const OutlineBtn = ({ onPress, icon, label, testID }) => (
    <TouchableOpacity
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      testID={testID}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        padding: 14,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: "#111827",
        backgroundColor: "#fff",
      }}
    >
      {icon}
      <Text style={{ fontWeight: "700", fontSize: 16, color: "#111827" }}>{label}</Text>
    </TouchableOpacity>
  );

  const Divider = ({ text = "ou" }) => (
    <View style={{ alignItems: "center", marginVertical: 6 }}>
      <Text style={{ color: "#9CA3AF", fontWeight: "600" }}>{text}</Text>
    </View>
  );

  return (
    <>
      <Stack.Screen options={{ title: "Bienvenue" }} />
      <SafeAreaView style={{ flex: 1 }}>
        <View style={{ flex: 1, padding: 16, gap: 16, justifyContent: "center" }}>
          {/* Carte d'accroche */}
          <View
            style={{
              padding: 16,
              backgroundColor: "#fff",
              borderRadius: 12,
              borderWidth: 1,
              borderColor: "#eee",
              elevation: 3,
              shadowColor: "#000",
              shadowOpacity: 0.08,
              shadowRadius: 6,
              shadowOffset: { width: 0, height: 3 },
            }}
          >
            <Text style={{ fontSize: 22, fontWeight: "800", marginBottom: 6 }}>
              Choisis ton mode d’inscription
            </Text>
            <Text style={{ color: "#6B7280" }}>
              Connecte-toi pour participer aux défis, consulter les résultats en direct
              et suivre ta progression.
            </Text>
          </View>

          {/* ——— Connexion ——— */}
          <PrimaryBtn
            onPress={() => router.push("/(auth)/phone-login")}
            label="Continuer avec SMS"
            testID="btn-continue-sms"
            icon={<Ionicons name="chatbox-ellipses-outline" size={20} color="#fff" />}
          />

          <OutlineBtn
            onPress={() => router.push("/(auth)/email-login")}
            label="Continuer avec Email"
            testID="btn-continue-email"
            icon={<Ionicons name="mail-outline" size={20} color="#111827" />}
          />

          <Divider text="ou" />

          {/* ——— Création de compte ——— */}
          <PrimaryBtn
            onPress={() => router.push("/(auth)/phone-signup")}
            label="Créer un compte SMS"
            testID="btn-signup-sms"
            icon={<Ionicons name="keypad-outline" size={20} color="#fff" />}
          />

          <OutlineBtn
            onPress={() => router.push("/(auth)/email-signup")}
            label="Créer un compte Email"
            testID="btn-signup-email"
            icon={<MaterialCommunityIcons name="account-plus-outline" size={20} color="#111827" />}
          />

          {/* Footer petit rappel */}
          <View style={{ alignItems: "center", marginTop: 8 }}>
            <Text style={{ color: "#6B7280", fontSize: 12, textAlign: "center" }}>
              En continuant, tu acceptes nos conditions d’utilisation.
            </Text>
          </View>
        </View>
      </SafeAreaView>
    </>
  );
}