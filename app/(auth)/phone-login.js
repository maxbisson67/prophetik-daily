// app/(auth)/phone-login.js
import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Stack, useRouter } from "expo-router";

export default function PhoneLoginDisabled() {
  const r = useRouter();

  return (
    <>
      <Stack.Screen options={{ title: "Connexion par téléphone" }} />
      <View style={{ flex: 1, padding: 16, justifyContent: "center", gap: 12 }}>
        <Text style={{ fontSize: 18, fontWeight: "700" }}>
          Connexion par téléphone non disponible
        </Text>
        <Text>
          Pour le moment, utilise la connexion par courriel ou par mot de passe.
        </Text>

        <TouchableOpacity
          onPress={() => r.push("/(auth)/sign-in")}
          style={{
            backgroundColor: "#111",
            padding: 14,
            borderRadius: 10,
            alignItems: "center",
            marginTop: 16,
          }}
        >
          <Text style={{ color: "#fff", fontWeight: "700" }}>
            Aller à la connexion courriel
          </Text>
        </TouchableOpacity>
      </View>
    </>
  );
}