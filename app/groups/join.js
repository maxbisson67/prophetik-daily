// app/groups/join.js
import React, { useMemo, useState, useCallback } from "react";
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Alert, BackHandler } from "react-native";
import { Stack, useRouter, useLocalSearchParams, useFocusEffect } from "expo-router";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { getFunctions, httpsCallable } from "firebase/functions";
import { doc, updateDoc } from "firebase/firestore";

import { app, db } from "@src/lib/firebase";
import { useAuth } from "@src/auth/AuthProvider";

const CODE_LEN = 8;
const ALPHABET = "ABCDEFGHIJKLMNPQRSTUVWXYZ123456789"; // sans O ni 0

export default function JoinGroupScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { from } = useLocalSearchParams();
  const fromOnboarding = String(from || "") === "onboarding";

  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  const sanitize = (s) =>
    String(s || "")
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .replace(/O/g, "")
      .replace(/0/g, "");

  const validateCode = (c) => c.length === CODE_LEN && [...c].every((ch) => ALPHABET.includes(ch));
  const cleanedCode = sanitize(code);
  const canJoin = useMemo(() => validateCode(cleanedCode) && !busy, [cleanedCode, busy]);

  // 🔙 Fonction retour : si fromOnboarding, on réinitialise welcomeSeen et revient à l'onboarding
  const safeBack = useCallback(async () => {
    if (fromOnboarding) {
      try {
        if (user?.uid) {
          const ref = doc(db, "participants", user.uid);
          await updateDoc(ref, { "onboarding.welcomeSeen": false });
        }
      } catch (e) {
        console.log("Erreur reset onboarding:", e);
      }
      router.replace("/onboarding/welcome");
      return true;
    }
    if (router.canGoBack?.()) {
      router.back();
      return true;
    }
    router.replace("/(drawer)/(tabs)/AccueilScreen");
    return true;
  }, [fromOnboarding, router, user?.uid]);

  // 🔙 Support du bouton physique Android
  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener("hardwareBackPress", safeBack);
      return () => sub.remove();
    }, [safeBack])
  );

  async function onJoin() {
    if (!user?.uid) {
      Alert.alert("Connexion requise", "Connecte-toi pour rejoindre un groupe.");
      return;
    }
    if (!validateCode(cleanedCode)) {
      Alert.alert(
        "Code invalide",
        `Le code doit contenir ${CODE_LEN} caractères (A–Z sans O, 1–9 sans 0).`
      );
      return;
    }

    try {
      setBusy(true);
      const functions = getFunctions(app, "us-central1");
      const joinGroupByCode = httpsCallable(functions, "joinGroupByCode");
      const res = await joinGroupByCode({ code: cleanedCode });
      const groupId = res?.data?.groupId || res?.data?.id;
      if (!groupId) throw new Error("Réponse inattendue du serveur.");
      router.replace({ pathname: `/groups/${groupId}`, params: { initial: JSON.stringify({ id: groupId }) } });
    } catch (e) {
      const msg = String(e?.message || e);
      if (msg.includes("not-found")) Alert.alert("Code introuvable", "Vérifie le code et réessaie.");
      else if (msg.includes("unauthenticated")) Alert.alert("Connexion requise", "Connecte-toi pour rejoindre un groupe.");
      else if (msg.includes("permission-denied")) Alert.alert("Accès refusé", "Tu n’es pas autorisé à rejoindre ce groupe.");
      else Alert.alert("Impossible de rejoindre", msg);
      console.log("joinGroupByCode error:", e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: "Rejoindre un groupe",
          headerLeft: () => (
            <TouchableOpacity onPress={safeBack} style={{ paddingHorizontal: 10 }}>
              <Ionicons name="arrow-back" size={24} color="#111827" />
            </TouchableOpacity>
          ),
        }}
      />

      <View style={{ flex: 1, padding: 20, backgroundColor: "#f9fafb" }}>
        <View
          style={{
            backgroundColor: "#fff",
            borderRadius: 14,
            padding: 18,
            marginBottom: 16,
            shadowColor: "#000",
            shadowOpacity: 0.1,
            shadowRadius: 8,
            shadowOffset: { width: 0, height: 3 },
            elevation: 3,
          }}
        >
          <Text style={{ fontSize: 22, fontWeight: "900", textAlign: "center", color: "#111827" }}>
            🔑 Entrez votre code d’invitation
          </Text>
          <Text style={{ marginTop: 8, textAlign: "center", color: "#374151", fontSize: 15, lineHeight: 22 }}>
            Rejoignez instantanément un groupe existant et commencez à prédire avec vos amis.
          </Text>
        </View>

        <TextInput
          value={code}
          onChangeText={(t) => setCode(sanitize(t))}
          autoCapitalize="characters"
          autoCorrect={false}
          placeholder="XXXXXXXX"
          maxLength={CODE_LEN + 2}
          style={{
            borderWidth: 1,
            borderColor: "#e5e7eb",
            borderRadius: 12,
            padding: 14,
            fontSize: 20,
            letterSpacing: 2,
            backgroundColor: "#fff",
            textAlign: "center",
          }}
        />

        <TouchableOpacity
          onPress={onJoin}
          disabled={!canJoin}
          style={{
            marginTop: 20,
            backgroundColor: canJoin ? "#ef4444" : "#9ca3af",
            padding: 14,
            borderRadius: 12,
            alignItems: "center",
          }}
        >
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={{ color: "#fff", fontWeight: "800" }}>Rejoindre le groupe</Text>}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={safeBack}
          style={{
            marginTop: 20,
            paddingVertical: 10,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: "#ddd",
            backgroundColor: "#fff",
            alignItems: "center",
          }}
        >
          <Text style={{ fontWeight: "600", color: "#111827" }}>Annuler</Text>
        </TouchableOpacity>
      </View>
    </>
  );
}