// app/(auth)/sign-in.js
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Stack, useRouter } from "expo-router";
import { auth } from "@src/lib/firebase";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
} from "firebase/auth";

export default function SignInEmail() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  // Si déjà connecté, redirige automatiquement
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (u) {
        // on remplace l'écran courant pour éviter le retour sur la page de connexion
        router.replace("/(drawer)/(tabs)/AccueilScreen");
      }
    });
    return () => unsub();
  }, [router]);

  const goHome = () => router.replace("/(drawer)/(tabs)/AccueilScreen");

  const signIn = async () => {
    try {
      const em = String(email || "").trim().toLowerCase();
      const pw = String(password || "").trim();

      if (!em || !pw) {
        Alert.alert("Champs manquants", "Entre un email et un mot de passe.");
        return;
      }

      setBusy(true);

      await signInWithEmailAndPassword(auth, em, pw);

      // Alert plus engageante, et navigation sur action
      Alert.alert(
        "✅ Connexion réussie",
        "Bienvenue dans Prophetik! Prêt à lancer un défi ou rejoindre tes groupes?",
        [
          { text: "Plus tard", style: "cancel" },
          { text: "Allons-y !", style: "default", onPress: goHome },
        ]
      );
    } catch (e) {
      // Si l'utilisateur n'existe pas, on propose de le créer
      if (e?.code === "auth/user-not-found") {
        try {
          const em = String(email || "").trim().toLowerCase();
          const pw = String(password || "").trim();

          await createUserWithEmailAndPassword(auth, em, pw);

          Alert.alert(
            "🎉 Compte créé",
            "Bienvenue! Tu peux maintenant profiter de Prophetik.",
            [{ text: "Découvrir", onPress: goHome }]
          );
        } catch (e2) {
          Alert.alert("Impossible de créer le compte", String(e2?.message || e2));
        }
      } else {
        // Mapping d’erreurs un peu plus humain
        let msg = String(e?.message || e);
        if (e?.code === "auth/invalid-email") msg = "Adresse email invalide.";
        if (e?.code === "auth/invalid-credential" || e?.code === "auth/wrong-password")
          msg = "Email ou mot de passe incorrect.";
        if (e?.code === "auth/too-many-requests")
          msg = "Trop de tentatives. Réessaie plus tard.";

        Alert.alert("Connexion impossible", msg);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: "Connexion email", headerShown: true }} />
      <KeyboardAvoidingView
        behavior={Platform.select({ ios: "padding", android: undefined })}
        style={{ flex: 1 }}
      >
        <View style={{ flex: 1, padding: 16, gap: 12, justifyContent: "center" }}>
          <Text style={{ fontWeight: "700", fontSize: 18 }}>Email</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            placeholder="ton@email.com"
            editable={!busy}
            style={{
              borderWidth: 1,
              borderColor: "#ddd",
              borderRadius: 10,
              padding: 12,
              opacity: busy ? 0.7 : 1,
            }}
          />

          <Text style={{ fontWeight: "700", fontSize: 18, marginTop: 8 }}>
            Mot de passe
          </Text>
          <TextInput
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="••••••••"
            editable={!busy}
            style={{
              borderWidth: 1,
              borderColor: "#ddd",
              borderRadius: 10,
              padding: 12,
              opacity: busy ? 0.7 : 1,
            }}
          />

          <TouchableOpacity
            disabled={busy}
            onPress={signIn}
            style={{
              backgroundColor: busy ? "#9ca3af" : "#111",
              padding: 14,
              borderRadius: 10,
              alignItems: "center",
              marginTop: 12,
            }}
          >
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={{ color: "#fff", fontWeight: "700" }}>Continuer</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </>
  );
}