// app/(auth)/phone-login.js
import React, { useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  SafeAreaView,
  ScrollView
} from "react-native";
import { Stack, useRouter, useLocalSearchParams } from "expo-router";
import auth from "@react-native-firebase/auth";
import firestore from "@react-native-firebase/firestore";
import i18n from "@src/i18n/i18n";

import ProphetikIcons from "@src/ui/ProphetikIcons";
import { useTheme } from "@src/theme/ThemeProvider";

// --- Helpers E.164 ---
const DEFAULT_COUNTRY = "+1";
const E164 = /^\+\d{8,15}$/;

function normalizePhone(input) {
  if (!input) return "";
  const raw = String(input).trim();

  if (raw.startsWith("+")) {
    const digits = raw.replace(/[^\d+]/g, "");
    return digits.replace(/\+(?=\+)/g, "");
  }

  const digitsOnly = raw.replace(/\D+/g, "");
  if (digitsOnly.length === 10) return `${DEFAULT_COUNTRY}${digitsOnly}`;
  if (digitsOnly.length > 0) return `+${digitsOnly}`;
  return "";
}

function sanitizeDisplayName(s) {
  return String(s || "")
    .replace(/\s+/g, " ")
    .replace(/[<>]/g, "")
    .trim()
    .slice(0, 48);
}

function stripUndefined(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj || {})) if (v !== undefined) out[k] = v;
  return out;
}

async function ensureParticipantDoc({ displayName }) {
  const user = auth().currentUser;
  if (!user) throw new Error("Not authenticated");

  const now = firestore.FieldValue.serverTimestamp();

  const payload = stripUndefined({
    displayName: displayName || user.displayName || null,
    phoneNumber: user.phoneNumber ?? null,
    email: user.email ?? null,
    photoURL: user.photoURL ?? null,
    updatedAt: now,
  });

  const ref = firestore().collection("participants").doc(user.uid);
  const snap = await ref.get();

  if (!snap.exists) {
    await ref.set(
      {
        ...payload,
        createdAt: now,
        "onboarding.welcomeSeen": false,
      },
      { merge: true }
    );
    return { isNew: true, shouldShowWelcome: true };
  }

  const data = snap.data() || {};
  const welcomeSeen = data?.onboarding?.welcomeSeen === true;

  await ref.set(payload, { merge: true });

  // si onboarding.welcomeSeen n’existe pas, on le force à false (optionnel mais “safe”)
  if (data?.onboarding?.welcomeSeen === undefined) {
    await ref.set({ "onboarding.welcomeSeen": false }, { merge: true });
  }

  return { isNew: false, shouldShowWelcome: !welcomeSeen };
}

async function ensurePublicProfile({ displayName }) {
  const user = auth().currentUser;
  if (!user) return;

  const now = firestore.FieldValue.serverTimestamp();

  // IMPORTANT: ne jamais mettre undefined
  const payload = stripUndefined({
    displayName: displayName || user.displayName || null,
    avatarUrl: user.photoURL ?? null,
    updatedAt: now,
    visibility: "public", // optionnel mais aide à stabiliser
  });

  const ref = firestore().collection("profiles_public").doc(user.uid);
  const snap = await ref.get();

  if (!snap.exists) {
    // CREATE clean, sans merge
    await ref.set(payload);
    return { created: true };
  }

  // UPDATE: merge ok
  await ref.set(payload, { merge: true });
  return { created: false };
}

export default function PhoneLoginScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { colors } = useTheme();

  const initialPhone = typeof params?.phone === "string" ? params.phone : "";

  const [step, setStep] = useState(1); // 1=enter, 2=code
  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState(initialPhone);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  const confirmationRef = useRef(null);

  const normalized = useMemo(() => normalizePhone(phone), [phone]);
  const canSend = useMemo(() => E164.test(normalized), [normalized]);

  const goHome = () => router.replace("/(drawer)/(tabs)/AccueilScreen");

  const sendCode = async () => {
    try {
      if (!canSend) {
        Alert.alert(
          i18n.t("auth.phoneLogin.invalidPhoneTitle", { defaultValue: "Invalid phone number" }),
          i18n.t("auth.phoneLogin.invalidPhoneBody", {
            defaultValue: "Enter a valid number (e.g., 5145551234).",
          })
        );
        return;
      }

      setBusy(true);

      // ✅ Pas de precheck / pas de blocage: on envoie le SMS direct
      const confirmation = await auth().signInWithPhoneNumber(normalized, true);
      confirmationRef.current = confirmation;

      setPhone(normalized);
      setStep(2);

      Alert.alert(
        i18n.t("auth.phoneLogin.codeSentTitle", { defaultValue: "Code sent" }),
        i18n.t("auth.phoneLogin.codeSentBody", { defaultValue: "Check your SMS." })
      );
    } catch (e) {
      console.log("SMS send error:", e?.code, e?.message);
        const code = e?.code || "";

        if (code === "auth/invalid-phone-number") {
          Alert.alert(
            i18n.t("auth.phoneLogin.invalidPhoneTitle", { defaultValue: "Numéro invalide" }),
            i18n.t("auth.phoneLogin.invalidPhoneBody", {
              defaultValue: "Le format du numéro est invalide. Exemple : 5145551234.",
            })
          );
        } else {
          Alert.alert(
            i18n.t("auth.phoneLogin.smsErrorTitle", { defaultValue: "Erreur SMS" }),
            i18n.t("auth.phoneLogin.smsErrorBody", {
              defaultValue: "Impossible d’envoyer le code.",
            })
          );
        }
    } finally {
      setBusy(false);
    }
  };

  const confirmCode = async () => {
    try {
      if (!code.trim() || code.trim().length < 4) {
        Alert.alert(
          i18n.t("auth.phoneLogin.codeRequiredTitle", { defaultValue: "Code required" }),
          i18n.t("auth.phoneLogin.codeRequiredBody", { defaultValue: "Enter the code you received by SMS." })
        );
        return;
      }

      const confirmation = confirmationRef.current;
      if (!confirmation) {
        Alert.alert(
          i18n.t("auth.phoneLogin.sessionExpiredTitle", { defaultValue: "Session expired" }),
          i18n.t("auth.phoneLogin.sessionExpiredBody", { defaultValue: "Try sending the code again." })
        );
        setStep(1);
        setCode("");
        return;
      }

      setBusy(true);

      await confirmation.confirm(code.trim());

      // ✅ prénom optionnel (n’écrase pas un displayName existant)
      const cleanName = sanitizeDisplayName(displayName);
      const user = auth().currentUser;

      if (user && cleanName && !user.displayName) {
        try {
          await user.updateProfile({ displayName: cleanName });
          await user.reload().catch(() => {});
        } catch {}
      }


     let shouldShowWelcome = false;

      try {
        const res = await ensureParticipantDoc({ displayName: cleanName || null });
        shouldShowWelcome = !!res?.shouldShowWelcome;
        console.log("participants OK", { shouldShowWelcome });
      } catch (e) {
        console.log("participants FAIL", e?.code, e?.message);
        throw e;
      }

      try {
        await ensurePublicProfile({ displayName: cleanName || null });
        console.log("profiles_public OK");
      } catch (e) {
        console.log("profiles_public FAIL", e?.code, e?.message);
        throw e;
      }

      
      if (shouldShowWelcome) {
        router.replace("/onboarding/welcome");
      } else {
        goHome();
      }

    } catch (e) {
      const msg = String(e?.message || e);

      if (msg.includes("invalid-verification-code")) {
        Alert.alert(
          i18n.t("auth.phoneLogin.invalidCodeTitle", { defaultValue: "Invalid code" }),
          i18n.t("auth.phoneLogin.invalidCodeBody", { defaultValue: "Double-check the code." })
        );
      } else if (msg.includes("session-expired")) {
        Alert.alert(
          i18n.t("auth.phoneLogin.sessionExpiredTitle", { defaultValue: "Session expired" }),
          i18n.t("auth.phoneLogin.sessionExpiredBody", { defaultValue: "Try sending the code again." })
        );
        setStep(1);
        confirmationRef.current = null;
      } else {
        Alert.alert(
          i18n.t("auth.phoneLogin.signInFailedTitle", { defaultValue: "Sign-in failed" }),
          msg
        );
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: i18n.t("auth.phoneLogin.title", { defaultValue: "Continue with SMS" }),
          headerShown: true,
        }}
      />

    <SafeAreaView style={{ flex: 1 }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingTop: 32, gap: 12 }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ alignItems: "center", marginBottom: 8 }}>
          <ProphetikIcons size="xxl" iconPosition="after" />
        </View>

        <Text style={{ fontSize: 22, fontWeight: "800", color: colors.text }}>
          {i18n.t("auth.phoneLogin.h1", { defaultValue: "Continue with SMS" })}
        </Text>

        {step === 1 ? (
          <>
            <Text style={{ color: "#6B7280" }}>
              {i18n.t("auth.phoneLogin.subtitle", {
                defaultValue: "We’ll text you a one-time code.",
              })}
            </Text>

            <Text>
              {i18n.t("auth.phoneLogin.displayNameLabel", { defaultValue: "First name (optional)" })}
            </Text>
            <TextInput
              value={displayName}
              onChangeText={setDisplayName}
              placeholder={i18n.t("auth.phoneLogin.displayNamePlaceholder", { defaultValue: "e.g., Marcel" })}
              autoCapitalize="words"
              style={{ borderWidth: 1, borderRadius: 10, padding: 12 }}
            />

            <Text>
              {i18n.t("auth.phoneLogin.phoneLabel", { defaultValue: "Phone (you can type 5145551234)" })}
            </Text>
            <TextInput
              placeholder={i18n.t("auth.phoneLogin.phonePlaceholder", { defaultValue: "5145551234" })}
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              autoComplete="tel"
              style={{ borderWidth: 1, borderRadius: 10, padding: 12 }}
            />

            {!!normalized && (
              <Text style={{ color: "#6B7280" }}>
                {i18n.t("auth.phoneLogin.sendingAs", {
                  defaultValue: "Sending as: {{phone}}",
                  phone: normalized,
                })}
              </Text>
            )}

            <TouchableOpacity
              onPress={sendCode}
              disabled={busy || !canSend}
              style={{
                backgroundColor: "#111827",
                padding: 14,
                borderRadius: 10,
                alignItems: "center",
                opacity: busy || !canSend ? 0.6 : 1,
              }}
            >
              {busy ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={{ color: "#fff", fontWeight: "800" }}>
                  {i18n.t("auth.phoneLogin.receiveCodeCta", { defaultValue: "Get code" })}
                </Text>
              )}
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text>{i18n.t("auth.phoneLogin.codeLabel", { defaultValue: "Code received by SMS" })}</Text>

            <TextInput
              placeholder={i18n.t("auth.phoneLogin.codePlaceholder", { defaultValue: "123456" })}
              value={code}
              onChangeText={setCode}
              keyboardType="number-pad"
              maxLength={6}
              style={{ borderWidth: 1, borderRadius: 10, padding: 12, letterSpacing: 4 }}
            />

            <TouchableOpacity
              onPress={confirmCode}
              disabled={busy || code.trim().length < 4}
              style={{
                backgroundColor: "#b91c1c",
                padding: 14,
                borderRadius: 10,
                alignItems: "center",
                opacity: busy || code.trim().length < 4 ? 0.6 : 1,
              }}
            >
              {busy ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={{ color: "#fff", fontWeight: "800" }}>
                  {i18n.t("auth.phoneLogin.confirmCta", { defaultValue: "Confirm" })}
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                setStep(1);
                setCode("");
                confirmationRef.current = null;
              }}
              disabled={busy}
              style={{ padding: 10, alignItems: "center" }}
            >
              <Text style={{ color: "#6B7280" }}>
                {i18n.t("auth.phoneLogin.resendLink", { defaultValue: "Use a different number / resend" })}
              </Text>
            </TouchableOpacity>
          </>
        )}

       </ScrollView>
       </SafeAreaView>
    </>
  );
}