// app/(auth)/sign-in.js
import React, { useState } from "react";
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
import { Stack } from "expo-router";
import { auth } from '@src/lib/firebase'; 
import { signInWithEmailAndPassword } from 'firebase/auth';

export default function SignInEmail() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const signIn = async () => {
    try {
      if (!email || !password) {
        Alert.alert("Champs manquants", "Entre un email et un mot de passe.");
        return;
      }
      setBusy(true);
      // ⚠️ Pas de navigation ici — on laisse _layout.js rediriger quand user devient vrai
     await signInWithEmailAndPassword(auth, email.trim(), password);
      Alert.alert("Connexion réussie");
    } catch (e) {
      if (e?.code === "auth/user-not-found") {
        try {

          await createUserWithEmailAndPassword(auth, email.trim(), password);
          Alert.alert("Compte créé", "Bienvenue !");
        } catch (e2) {
          Alert.alert("Impossible de créer le compte", String(e2?.message || e2));
        }
      } else {
        Alert.alert("Connexion impossible", String(e?.message || e));
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
            style={{ borderWidth: 1, borderColor: "#ddd", borderRadius: 10, padding: 12 }}
          />

          <Text style={{ fontWeight: "700", fontSize: 18, marginTop: 8 }}>Mot de passe</Text>
          <TextInput
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="••••••••"
            style={{ borderWidth: 1, borderColor: "#ddd", borderRadius: 10, padding: 12 }}
          />

          <TouchableOpacity
            disabled={busy}
            onPress={signIn}
            style={{
              backgroundColor: "#111",
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