import React, { useMemo, useRef, useState, useEffect, useCallback } from "react";
import { snapshotExists, snapshotData, snapshotId } from "@src/lib/safeSnapshot";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  SafeAreaView,
  ScrollView,
  AppState,
} from "react-native";
import { Stack, useRouter, useLocalSearchParams, useFocusEffect } from "expo-router";
import auth from "@react-native-firebase/auth";
import firestore from "@react-native-firebase/firestore";
import i18n from "@src/i18n/i18n";

import ProphetikIcons from "@src/ui/ProphetikIcons";
import { useTheme } from "@src/theme/ThemeProvider";
import Analytics from "@src/services/analytics";
import {
  E164,
  normalizePhone,
  isSignedInForPhone,
  isSessionExpiredError,
  prepareForPhoneVerification,
  sendPhoneVerification,
  alertForPhoneSendError,
  waitForSignedInPhone,
  peekPendingPhoneVerification,
  stashPendingPhoneVerification,
  clearPendingPhoneVerification,
} from "@src/auth/phoneAuthHelpers";

function sanitizeDisplayName(s) {
  return String(s || "")
    .replace(/\s+/g, " ")
    .replace(/[<>]/g, "")
    .trim()
    .slice(0, 48);
}

function stripUndefined(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj || {})) {
    if (v !== undefined) out[k] = v;
  }
  return out;
}

async function ensureParticipantDoc({ displayName }) {
  const user = auth().currentUser;
  if (!user) throw new Error("Not authenticated");

  const now = firestore.FieldValue.serverTimestamp();

  const ref = firestore().collection("participants").doc(user.uid);
  const snap = await ref.get();
  const resolvedName =
    sanitizeDisplayName(displayName) ||
    sanitizeDisplayName(snapshotExists(snap) ? snapshotData(snap)?.displayName : "") ||
    sanitizeDisplayName(user.displayName) ||
    null;

  const payload = stripUndefined({
    displayName: resolvedName,
    phoneNumber: user.phoneNumber ?? null,
    email: user.email ?? null,
    photoURL: user.photoURL ?? null,
    updatedAt: now,
  });

  if (!snapshotExists(snap)) {
    await ref.set(
      {
        ...payload,
        createdAt: now,
        onboarding: {
          welcomeSeen: false,
        },
      },
      { merge: true }
    );
    return { isNew: true, shouldShowWelcome: true };
  }

  const data = snapshotData(snap) || {};
  const welcomeSeen = data?.onboarding?.welcomeSeen === true;

  await ref.set(payload, { merge: true });

  if (data?.onboarding?.welcomeSeen === undefined) {
    await ref.set(
      {
        onboarding: {
          welcomeSeen: false,
        },
      },
      { merge: true }
    );
  }

  return { isNew: false, shouldShowWelcome: !welcomeSeen };
}

async function ensurePublicProfile({ displayName }) {
  const user = auth().currentUser;
  if (!user) return;

  const now = firestore.FieldValue.serverTimestamp();

  const payload = stripUndefined({
    displayName: displayName || user.displayName || null,
    avatarUrl: user.photoURL ?? null,
    updatedAt: now,
    visibility: "public",
  });

  const ref = firestore().collection("profiles_public").doc(user.uid);
  const snap = await ref.get();

  if (!snapshotExists(snap)) {
    await ref.set(payload);
    return { created: true };
  }

  await ref.set(payload, { merge: true });
  return { created: false };
}

async function completePhoneLoginFlow({ displayName, router }) {
  const pending = peekPendingPhoneVerification();
  const cleanName = sanitizeDisplayName(
    displayName || pending?.displayName || auth().currentUser?.displayName || ""
  );

  clearPendingPhoneVerification();
  await Analytics.authSuccess("sms_login");

  const signedUser = auth().currentUser;
  if (signedUser?.uid) {
    await Analytics.setUserId(signedUser.uid);
    await Analytics.setUserProperty("auth_method", "sms");
  }

  const currentUser = auth().currentUser;

  if (currentUser && cleanName && !currentUser.displayName) {
    try {
      await currentUser.updateProfile({ displayName: cleanName });
      await currentUser.reload().catch(() => {});
    } catch {}
  }

  const res = await ensureParticipantDoc({ displayName: cleanName || null });
  await ensurePublicProfile({ displayName: cleanName || null });
  const shouldShowWelcome = !!res?.shouldShowWelcome;

  if (shouldShowWelcome) {
    router.replace("/onboarding/welcome");
  } else {
    router.replace("/(drawer)/(tabs)/AccueilScreen");
  }
}

export default function PhoneLoginScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { colors } = useTheme();

  const initialPhone = typeof params?.phone === "string" ? params.phone : "";
  const initialDisplayName =
    typeof params?.displayName === "string" ? sanitizeDisplayName(params.displayName) : "";
  const resumeStep = params?.step === "2" ? 2 : 1;

  const [step, setStep] = useState(resumeStep);
  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [phone, setPhone] = useState(initialPhone);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [phoneVerified, setPhoneVerified] = useState(false);

  const confirmationRef = useRef(null);
  const completingRef = useRef(false);
  const sentOnceRef = useRef(false);
  const lastSentPhoneRef = useRef(null);
  const displayNameRef = useRef("");
  const normalizedRef = useRef("");

  const normalized = useMemo(() => normalizePhone(phone), [phone]);
  const canSend = useMemo(() => E164.test(normalized), [normalized]);
  const canConfirm = useMemo(() => {
    if (busy) return false;
    if (code.trim().length >= 4) return true;
    return phoneVerified;
  }, [busy, code, phoneVerified]);

  displayNameRef.current = displayName;
  normalizedRef.current = normalized;

  const resumePendingVerification = useCallback(() => {
    const pending = peekPendingPhoneVerification(normalizedRef.current);
    if (!pending?.confirmation) return false;

    confirmationRef.current = pending.confirmation;
    if (pending.phone) {
      setPhone(pending.phone);
      normalizedRef.current = pending.phone;
      lastSentPhoneRef.current = pending.phone;
    }
    if (pending.displayName) {
      setDisplayName(sanitizeDisplayName(pending.displayName));
    }
    sentOnceRef.current = true;
    setStep(2);
    setBusy(false);
    return true;
  }, []);

  useFocusEffect(
    useCallback(() => {
      resumePendingVerification();
    }, [resumePendingVerification])
  );

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        resumePendingVerification();
      }
    });
    return () => sub.remove();
  }, [resumePendingVerification]);

  useEffect(() => {
    if (resumeStep === 2) {
      resumePendingVerification();
    }
  }, [resumeStep, resumePendingVerification]);

  useEffect(() => {
    if (step !== 2) {
      setPhoneVerified(false);
      return undefined;
    }

    const syncVerified = () => {
      setPhoneVerified(isSignedInForPhone(normalizedRef.current));
    };

    const unsub = auth().onAuthStateChanged(syncVerified);
    syncVerified();
    return unsub;
  }, [step]);

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

      await Analytics.authStart("sms_login");

      const prep = await prepareForPhoneVerification(normalized);
      if (prep.alreadySignedIn) {
        completingRef.current = true;
        await completePhoneLoginFlow({
          displayName: sanitizeDisplayName(displayName || displayNameRef.current),
          router,
        });
        return;
      }

      const forceResend =
        sentOnceRef.current && lastSentPhoneRef.current === normalized;
      const nameForStash = sanitizeDisplayName(displayName);
      stashPendingPhoneVerification(normalized, null, nameForStash);
      const confirmation = await sendPhoneVerification(normalized, {
        forceResend,
        displayName: nameForStash,
      });
      confirmationRef.current = confirmation;
      stashPendingPhoneVerification(normalized, confirmation, nameForStash);
      sentOnceRef.current = true;
      lastSentPhoneRef.current = normalized;

      setPhone(normalized);
      setStep(2);

      Alert.alert(
        i18n.t("auth.phoneLogin.codeSentTitle", { defaultValue: "Code sent" }),
        i18n.t("auth.phoneLogin.codeSentBody", { defaultValue: "Check your SMS." })
      );
    } catch (e) {
      console.log("SMS send error:", e?.code, e?.message);
      alertForPhoneSendError(e?.code, e?.message);
    } finally {
      setBusy(false);
    }
  };

  const confirmCode = async () => {
    try {
      setBusy(true);
      const nameForCompletion = sanitizeDisplayName(displayName || displayNameRef.current);

      const finishIfSignedIn = async () => {
        if (!(await waitForSignedInPhone(normalized))) return false;
        completingRef.current = true;
        await completePhoneLoginFlow({ displayName: nameForCompletion, router });
        return true;
      };

      if (!code.trim() || code.trim().length < 4) {
        if (await finishIfSignedIn()) return;

        Alert.alert(
          i18n.t("auth.phoneLogin.codeRequiredTitle", { defaultValue: "Code required" }),
          i18n.t("auth.phoneLogin.codeRequiredBody", {
            defaultValue: "Enter the code you received by SMS.",
          })
        );
        return;
      }

      const confirmation = confirmationRef.current;
      if (!confirmation) {
        if (await finishIfSignedIn()) return;

        Alert.alert(
          i18n.t("auth.phoneLogin.sessionExpiredTitle", { defaultValue: "Session expired" }),
          i18n.t("auth.phoneLogin.sessionExpiredBody", {
            defaultValue: "Try sending the code again.",
          })
        );
        setStep(1);
        setCode("");
        return;
      }

      completingRef.current = true;

      try {
        await confirmation.confirm(code.trim());
        await completePhoneLoginFlow({ displayName: nameForCompletion, router });
      } catch (confirmErr) {
        if (isSessionExpiredError(confirmErr) && (await finishIfSignedIn())) return;
        throw confirmErr;
      }
    } catch (e) {
      completingRef.current = false;
      const msg = String(e?.message || e);

      if (msg.includes("invalid-verification-code")) {
        Alert.alert(
          i18n.t("auth.phoneLogin.invalidCodeTitle", { defaultValue: "Invalid code" }),
          i18n.t("auth.phoneLogin.invalidCodeBody", { defaultValue: "Double-check the code." })
        );
      } else if (isSessionExpiredError(e)) {
        if (await waitForSignedInPhone(normalized)) {
          completingRef.current = true;
          try {
            await completePhoneLoginFlow({ displayName: nameForCompletion, router });
            return;
          } catch (completeErr) {
            completingRef.current = false;
            console.log("phone login recovery failed:", completeErr?.code, completeErr?.message);
          }
        }

        Alert.alert(
          i18n.t("auth.phoneLogin.sessionExpiredTitle", { defaultValue: "Session expired" }),
          i18n.t("auth.phoneLogin.sessionExpiredBody", {
            defaultValue: "Try sending the code again.",
          })
        );
        setStep(1);
        setCode("");
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
                {i18n.t("auth.phoneLogin.displayNameLabel", {
                  defaultValue: "First name (optional)",
                })}
              </Text>
              <TextInput
                value={displayName}
                onChangeText={setDisplayName}
                placeholder={i18n.t("auth.phoneLogin.displayNamePlaceholder", {
                  defaultValue: "e.g., Marcel",
                })}
                autoCapitalize="words"
                style={{ borderWidth: 1, borderRadius: 10, padding: 12 }}
              />

              <Text>
                {i18n.t("auth.phoneLogin.phoneLabel", {
                  defaultValue: "Phone (you can type 5145551234)",
                })}
              </Text>
              <TextInput
                placeholder={i18n.t("auth.phoneLogin.phonePlaceholder", {
                  defaultValue: "5145551234",
                })}
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
              <Text>
                {i18n.t("auth.phoneLogin.codeLabel", { defaultValue: "Code received by SMS" })}
              </Text>

              <TextInput
                placeholder={i18n.t("auth.phoneLogin.codePlaceholder", { defaultValue: "123456" })}
                value={code}
                onChangeText={setCode}
                keyboardType="number-pad"
                maxLength={6}
                style={{ borderWidth: 1, borderRadius: 10, padding: 12, letterSpacing: 4 }}
              />

              {phoneVerified && code.trim().length < 4 ? (
                <Text style={{ color: "#059669" }}>
                  {i18n.t("auth.phoneLogin.autoVerifiedHint", {
                    defaultValue:
                      "Numéro vérifié automatiquement. Entrez le code reçu ou appuyez sur Confirmer.",
                  })}
                </Text>
              ) : null}

              <TouchableOpacity
                onPress={confirmCode}
                disabled={!canConfirm}
                style={{
                  backgroundColor: "#b91c1c",
                  padding: 14,
                  borderRadius: 10,
                  alignItems: "center",
                  opacity: !canConfirm ? 0.6 : 1,
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
                onPress={async () => {
                  if (busy) return;
                  setCode("");
                  confirmationRef.current = null;
                  await sendCode();
                }}
                disabled={busy}
                style={{ padding: 10, alignItems: "center" }}
              >
                <Text style={{ color: "#6B7280" }}>
                  {i18n.t("auth.phoneLogin.resendLink", {
                    defaultValue: "Resend code",
                  })}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  clearPendingPhoneVerification();
                  setStep(1);
                  setCode("");
                  confirmationRef.current = null;
                }}
                disabled={busy}
                style={{ padding: 10, alignItems: "center" }}
              >
                <Text style={{ color: "#6B7280" }}>
                  {i18n.t("auth.phoneLogin.changeNumberLink", {
                    defaultValue: "Use a different number",
                  })}
                </Text>
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </>
  );
}