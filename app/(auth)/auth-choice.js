// app/(auth)/auth-choice.js
import React from "react";
import { View, Text, TouchableOpacity, Alert, SafeAreaView } from "react-native";
import { Stack, useRouter } from "expo-router";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";

export default function AuthChoiceScreen() {
  const router = useRouter();

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

          {/* Bouton: SMS (OTP) */}
          <TouchableOpacity
            onPress={() => router.push("/(auth)/phone-login")}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              backgroundColor: "#111827",
              padding: 14,
              borderRadius: 12,
            }}
          >
            <Ionicons name="chatbox-ellipses-outline" size={20} color="#fff" />
            <Text style={{ color: "#fff", fontWeight: "700", fontSize: 16 }}>
              Continuer avec SMS
            </Text>
          </TouchableOpacity>

          {/* Bouton: Email (écran existant) */}
          <TouchableOpacity
            onPress={() => router.push("/(auth)/sign-in")}
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
            <Ionicons name="mail-outline" size={20} color="#111827" />
            <Text style={{ fontWeight: "700", fontSize: 16, color: "#111827" }}>
              Continuer avec Email
            </Text>
          </TouchableOpacity>

           {/* Bouton: Créer un compte */}
         <TouchableOpacity
           onPress={() => router.push("/(auth)/sign-up")}
           style={{
             flexDirection: "row",
             alignItems: "center",
             gap: 12,
             padding: 14,
             borderRadius: 12,
             backgroundColor: "#111827",
           }}
         >
           <MaterialCommunityIcons name="account-plus-outline" size={20} color="#fff" />
           <Text style={{ color: "#fff", fontWeight: "700", fontSize: 16 }}>
             Créer un compte
           </Text>
         </TouchableOpacity>

          {/* Lignes de séparation */}
          <View style={{ alignItems: "center", marginVertical: 6 }}>
            <Text style={{ color: "#9CA3AF", fontWeight: "600" }}>ou</Text>
          </View>

          {/* Bouton: Apple (placeholder) */}
          <TouchableOpacity
            onPress={() => Alert.alert("Bientôt disponible", "Connexion Apple à venir.")}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              padding: 14,
              borderRadius: 12,
              backgroundColor: "#000",
            }}
          >
            <Ionicons name="logo-apple" size={22} color="#fff" />
            <Text style={{ color: "#fff", fontWeight: "700", fontSize: 16 }}>
              Continuer avec Apple
            </Text>
          </TouchableOpacity>

          {/* Bouton: Google (placeholder) */}
          <TouchableOpacity
            onPress={() => Alert.alert("Bientôt disponible", "Connexion Google à venir.")}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              padding: 14,
              borderRadius: 12,
              backgroundColor: "#fff",
              borderWidth: 1,
              borderColor: "#e5e7eb",
            }}
          >
            <MaterialCommunityIcons name="google" size={20} color="#EA4335" />
            <Text style={{ fontWeight: "700", fontSize: 16, color: "#111827" }}>
              Continuer avec Google
            </Text>
          </TouchableOpacity>

          {/* Footer petit rappel */}
          <View style={{ alignItems: "center", marginTop: 8 }}>
            <Text style={{ color: "#6B7280", fontSize: 12 }}>
              En continuant, tu acceptes nos conditions d’utilisation.
            </Text>
          </View>
        </View>
      </SafeAreaView>
    </>
  );
}