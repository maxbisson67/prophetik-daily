// app/groups/join.js
import React, { useMemo, useState, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  BackHandler,
} from "react-native";
import {
  Stack,
  useRouter,
  useLocalSearchParams,
  useFocusEffect,
} from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import firestore from "@react-native-firebase/firestore";
import functions from "@react-native-firebase/functions";

// Safe auth + thème
import { useAuth } from "@src/auth/SafeAuthProvider";
import { useTheme } from "@src/theme/ThemeProvider";

const CODE_LEN = 8;
const ALPHABET = "ABCDEFGHIJKLMNPQRSTUVWXYZ123456789";

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
  return (
    p.photoURL ||
    p.avatarUrl ||
    p.photoUrl ||
    p.avatar ||
    user?.photoURL ||
    user?.photoUrl ||
    null
  );
}

export default function JoinGroupScreen() {
  const router = useRouter();
  const { user, profile } = useAuth();
  const { colors } = useTheme();
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

  const validateCode = (c) =>
    c.length === CODE_LEN && [...c].every((ch) => ALPHABET.includes(ch));

  const cleanedCode = sanitize(code);
  const canJoin = useMemo(() => validateCode(cleanedCode) && !busy, [
    cleanedCode,
    busy,
  ]);

  // 🔙 Retour logique
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

      router.replace("/(drawer)/(tabs)/AccueilScreen");
      return true;
    } catch {
      return true;
    }
  }, [fromOnboarding, router, user?.uid]);

  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener(
        "hardwareBackPress",
        safeBack
      );
      return () => sub.remove();
    }, [safeBack])
  );

  async function onJoin() {
    if (!user?.uid)
      return Alert.alert("Connexion requise", "Connecte-toi pour rejoindre un groupe.");

    if (!validateCode(cleanedCode))
      return Alert.alert(
        "Code invalide",
        `Le code doit contenir ${CODE_LEN} caractères (A–Z, sans O et 0).`
      );

    try {
      setBusy(true);

      const identity = {
        displayName: pickDisplayName(profile, user),
        avatarUrl: pickAvatarUrl(profile, user),
      };

      const joinGroupByCode = functions().httpsCallable("joinGroupByCode");
      const res = await joinGroupByCode({ code: cleanedCode, identity });

      const groupId = res?.data?.groupId;
      if (!groupId) throw new Error("Réponse inattendue du serveur.");

      router.replace({
        pathname: "/(drawer)/groups/[groupId]",
        params: { groupId },
      });
    } catch (e) {
      const msg = String(e?.message || e);

      if (msg.includes("not-found"))
        Alert.alert("Code introuvable", "Vérifie le code et réessaie.");
      else if (msg.includes("unauthenticated"))
        Alert.alert("Connexion requise", "Connecte-toi pour rejoindre un groupe.");
      else if (msg.includes("permission-denied"))
        Alert.alert("Accès refusé", "Tu n’es pas autorisé à rejoindre ce groupe.");
      else Alert.alert("Erreur", msg);
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
              <Ionicons name="arrow-back" size={24} color={colors.text} />
            </TouchableOpacity>
          ),
          headerStyle: { backgroundColor: colors.card },
          headerTitleStyle: { color: colors.text },
          headerTintColor: colors.text,
        }}
      />

      <View
        style={{
          flex: 1,
          padding: 20,
          backgroundColor: colors.background,
        }}
      >
        <View
          style={{
            backgroundColor: colors.card,
            borderRadius: 14,
            padding: 18,
            marginBottom: 16,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <Text
            style={{
              fontSize: 22,
              fontWeight: "900",
              textAlign: "center",
              color: colors.text,
            }}
          >
            🔑 Entrez votre code d’invitation
          </Text>
          <Text
            style={{
              marginTop: 8,
              textAlign: "center",
              color: colors.subtext,
              fontSize: 15,
              lineHeight: 22,
            }}
          >
            Rejoignez immédiatement un groupe existant et commencez à prédire.
          </Text>
        </View>

        <TextInput
          value={code}
          onChangeText={(t) => setCode(sanitize(t))}
          autoCapitalize="characters"
          placeholder="XXXXXXXX"
          placeholderTextColor={colors.subtext}
          maxLength={CODE_LEN + 2}
          style={{
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 12,
            padding: 14,
            fontSize: 20,
            letterSpacing: 2,
            backgroundColor: colors.card,
            color: colors.text,
            textAlign: "center",
          }}
        />

        <TouchableOpacity
          onPress={onJoin}
          disabled={!canJoin}
          style={{
            marginTop: 20,
            backgroundColor: canJoin ? "#ef4444" : colors.subtext,
            padding: 14,
            borderRadius: 12,
            alignItems: "center",
          }}
        >
          {busy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={{ color: "#fff", fontWeight: "800" }}>
              Rejoindre le groupe
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={safeBack}
          style={{
            marginTop: 20,
            paddingVertical: 10,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.card,
            alignItems: "center",
          }}
        >
          <Text style={{ fontWeight: "600", color: colors.text }}>
            Annuler
          </Text>
        </TouchableOpacity>
      </View>
    </>
  );
}