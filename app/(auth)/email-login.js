// app/(auth)/sign-in.js
import React, { useEffect, useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, ActivityIndicator,
  Alert, KeyboardAvoidingView, Platform
} from "react-native";
import { Stack, useRouter } from "expo-router";

// Our “bridge” auth (firebase/auth) lives here
import { webAuth } from "@src/lib/firebase";

// Firebase Web Auth helpers (used on web AND to sign the bridge on native)
import {
  signInWithEmailAndPassword as webSignInWithEmailAndPassword,
  createUserWithEmailAndPassword as webCreateUserWithEmailAndPassword,
  onAuthStateChanged as onWebAuthStateChanged,
} from "firebase/auth";

// RNFirebase Auth (primary auth on native)
import rnfbAuth from "@react-native-firebase/auth";

export default function SignInEmail() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  // Navigate home
  const goHome = () => router.replace("/(drawer)/(tabs)/AccueilScreen");

  // On native, watch RNFB auth; on web, watch webAuth
  useEffect(() => {
    let unsub;
    if (Platform.OS === "web") {
      unsub = onWebAuthStateChanged(webAuth, (u) => {
        if (u) goHome();
      });
    } else {
      unsub = rnfbAuth().onAuthStateChanged((u) => {
        if (u) goHome();
      });
    }
    return () => { try { unsub && unsub(); } catch {} };
  }, [router]);

  const signIn = async () => {
    const em = String(email || "").trim().toLowerCase();
    const pw = String(password || "").trim();

    if (!em || !pw) {
      Alert.alert("Champs manquants", "Entre un email et un mot de passe.");
      return;
    }

    try {
      setBusy(true);

      if (Platform.OS === "web") {
        // WEB: one sign-in is enough
        await webSignInWithEmailAndPassword(webAuth, em, pw);
        Alert.alert("✅ Connexion réussie", "Bienvenue dans Prophetik!", [
          { text: "OK", onPress: goHome },
        ]);
        return;
      }

      // NATIVE: sign in RNFB Auth (primary)
      await rnfbAuth().signInWithEmailAndPassword(em, pw);

      // Also sign in the Web SDK “bridge” so Firestore gets a token immediately
      try {
        await webSignInWithEmailAndPassword(webAuth, em, pw);
      } catch (e) {
        // If the bridge is already signed in or races, we ignore
        console.log("[Bridge webAuth] sign-in skipped/failed:", e?.code || e);
      }

      Alert.alert("✅ Connexion réussie", "Bienvenue dans Prophetik!", [
        { text: "Allons-y !", onPress: goHome },
      ]);
    } catch (e) {
      if (e?.code === "auth/user-not-found") {
        // Create account flow
        try {
          if (Platform.OS === "web") {
            await webCreateUserWithEmailAndPassword(webAuth, em, pw);
          } else {
            // Create on RNFB first (primary)
            await rnfbAuth().createUserWithEmailAndPassword(em, pw);
            // Sign in bridge
            try {
              await webSignInWithEmailAndPassword(webAuth, em, pw);
            } catch {}
          }
          Alert.alert("🎉 Compte créé", "Bienvenue! Tu peux maintenant profiter de Prophetik.", [
            { text: "Découvrir", onPress: goHome },
          ]);
        } catch (e2) {
          Alert.alert("Impossible de créer le compte", String(e2?.message || e2));
        }
      } else {
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
              borderWidth: 1, borderColor: "#ddd", borderRadius: 10, padding: 12,
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
              borderWidth: 1, borderColor: "#ddd", borderRadius: 10, padding: 12,
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