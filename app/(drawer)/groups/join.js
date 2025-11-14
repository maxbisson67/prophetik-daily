// app/groups/join.js
import React, { useMemo, useState, useCallback } from "react";
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Alert, BackHandler } from "react-native";
import { Stack, useRouter, useLocalSearchParams, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import firestore from "@react-native-firebase/firestore";
import functions from "@react-native-firebase/functions";

// Safe auth
import { useAuth } from "@src/auth/SafeAuthProvider";

const CODE_LEN = 8;
const ALPHABET = "ABCDEFGHIJKLMNPQRSTUVWXYZ123456789"; // sans O ni 0

// Utilitaires identité locale à partir du profil/participant
function pickDisplayName(profile, user) {
  const p = profile || {};
  return (
    p.displayName ||
    p.name ||
    (p.email ? String(p.email).split("@")[0] : "") ||
    user?.displayName ||
    "Invité"
  );
}
function pickAvatarUrl(profile, user) {
  const p = profile || {};
  return p.photoURL || p.avatarUrl || p.photoUrl || p.avatar || user?.photoURL || user?.photoUrl || null;
}

export default function JoinGroupScreen() {
  const router = useRouter();
  const { user, profile } = useAuth(); // on lit le profil pour displayName/avatarUrl
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

  // 🔙 Retour sûr (onboarding vs normal)
  const safeBack = useCallback(async () => {
    try {
      if (fromOnboarding && user?.uid) {
        await firestore()
          .doc(`participants/${user.uid}`)
          .set({ onboarding: { welcomeSeen: false } }, { merge: true });
        router.replace("/onboarding/welcome");
        return true;
      }

      if (router.canGoBack?.()) {
        router.back();
        return true;
      }

      // Retour par défaut vers l’onglet Accueil
      router.replace("/(drawer)/(tabs)/AccueilScreen");
      return true;
    } catch (e) {
      console.log("Erreur reset onboarding:", e?.message || e);
      return true;
    }
  }, [fromOnboarding, router, user?.uid]);

  // 🔙 Support bouton physique Android
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

      // Prépare l'identité à envoyer à la CF (écrit côté serveur via Admin SDK)
      const identity = {
        displayName: pickDisplayName(profile, user),
        avatarUrl: pickAvatarUrl(profile, user),
      };

      // RNFirebase Functions (par défaut region = us-central1 comme ta CF)
      const joinGroupByCode = functions().httpsCallable("joinGroupByCode");
      const res = await joinGroupByCode({ code: cleanedCode, identity });

      const groupId = res?.data?.groupId || res?.data?.id;
      if (!groupId) throw new Error("Réponse inattendue du serveur.");

      // Navigation → détail du groupe dans le Drawer
      router.replace({
        pathname: "/(drawer)/groups/[groupId]",
        params: { groupId, initial: JSON.stringify({ id: groupId }) },
      });
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