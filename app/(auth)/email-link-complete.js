// app/(auth)/email-link-complete.js
import React, { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, ActivityIndicator, Alert, Platform } from "react-native";
import { Stack, useRouter, useLocalSearchParams } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import auth from "@react-native-firebase/auth";
import firestore from "@react-native-firebase/firestore";
import i18n from "@src/i18n/i18n";

import { webAuth } from "@src/lib/firebase";
import {
  signInWithEmailLink as webSignInWithEmailLink,
  isSignInWithEmailLink as webIsSignInWithEmailLink,
} from "firebase/auth";

const PENDING_EMAIL_KEY = "auth:emailLink:pendingEmail";
const PENDING_NAME_KEY = "auth:emailLink:pendingName";

function looksLikeEmailSignInLink(u) {
  if (!u || typeof u !== "string") return false;
  return u.includes("mode=signIn") && u.includes("oobCode=");
}

async function ensureParticipantDoc({ displayName }) {
  const u = auth().currentUser;
  if (!u) return;

  const uid = u.uid;
  const now = firestore.FieldValue.serverTimestamp();

  await firestore().collection("participants").doc(uid).set(
    {
      displayName: displayName || u.displayName || null,
      email: u.email ?? null,
      phoneNumber: u.phoneNumber ?? null,
      photoURL: u.photoURL ?? null,
      betaEligible: true,
      updatedAt: now,
    },
    { merge: true }
  );
}

async function ensurePublicProfile({ displayName }) {
    console.log("[EmailLinkComplete] user =", auth().currentUser?.uid, auth().currentUser?.email);
  const u = auth().currentUser;
  if (!u) return;

  const uid = u.uid;
  const now = firestore.FieldValue.serverTimestamp();

  await firestore().collection("profiles_public").doc(uid).set(
    {
      displayName: displayName || u.displayName || null,
      avatarUrl: u.photoURL ?? null,
      updatedAt: now,
    },
    { merge: true }
  );
}

function normalizeEmailLink(maybeWrapperUrl) {
  if (!maybeWrapperUrl || typeof maybeWrapperUrl !== "string") return "";

  try {
    const u = new URL(maybeWrapperUrl);

    // Si c’est le wrapper Firebase /__/auth/links?link=...
    const inner = u.searchParams.get("link");
    if (inner) {
      // inner peut être déjà partiellement décodé selon la plateforme
      try {
        return decodeURIComponent(inner);
      } catch {
        return inner;
      }
    }

    // sinon c’est déjà un lien action (ou hosting continueUrl)
    return maybeWrapperUrl;
  } catch {
    return maybeWrapperUrl;
  }
}

export default function EmailLinkCompleteScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [busy, setBusy] = useState(true);
  const hasRunRef = useRef(false);

const emailLink = useMemo(() => {
  const mode = typeof params?.mode === "string" ? params.mode : "";
  const oobCode = typeof params?.oobCode === "string" ? params.oobCode : "";
  const lang = typeof params?.lang === "string" ? params.lang : "fr";

  // 1) apiKey peut venir soit de params.apiKey, soit de params.link (?apiKey=...)
  let apiKey = typeof params?.apiKey === "string" ? params.apiKey : "";

  const rawLinkParam = typeof params?.link === "string" ? params.link : "";
  if (!apiKey && rawLinkParam) {
    try {
      const u = new URL(rawLinkParam);
      apiKey = u.searchParams.get("apiKey") || "";
    } catch {}
  }

  // ✅ Si on a apiKey + oobCode + mode, on reconstruit LE VRAI ACTION LINK (canonique)
  if (apiKey && oobCode && mode) {
    const actionBase = "https://capitaine.firebaseapp.com/__/auth/action";
    const continueUrl = "https://capitaine.web.app/email-link/"; // doit matcher ton continueUrl Firebase/hosting

    const qs = new URLSearchParams({
      apiKey,
      oobCode,
      mode,          // "signIn" ok
      continueUrl,   // IMPORTANT: continueUrl (camelCase)
      lang,
    }).toString();

    return `${actionBase}?${qs}`;
  }

  // 3) Sinon: on tente de décoder params.link (double decode) + wrapper /__/auth/links?link=...
  if (!rawLinkParam) return "";

  let decoded = rawLinkParam;
  try { decoded = decodeURIComponent(decoded); } catch {}
  try { decoded = decodeURIComponent(decoded); } catch {}

  // Wrapper Firebase
  try {
    const u = new URL(decoded);
    const inner = u.searchParams.get("link");
    if (inner) {
      try { return decodeURIComponent(inner); } catch { return inner; }
    }
  } catch {}

  return decoded;
}, [params]);

  useEffect(() => {
    if (hasRunRef.current) return;
    hasRunRef.current = true;

    const run = async () => {
      try {
        setBusy(true);

        console.log("[EmailLinkComplete] params =", params);
        console.log("[EmailLinkComplete] emailLink =", emailLink);

        if (!emailLink) {
          Alert.alert(
            i18n.t("auth.emailLink.missingLinkTitle", { defaultValue: "Missing link" }),
            i18n.t("auth.emailLink.missingLinkBody", {
              defaultValue: "Open the link from your email on this device.",
            })
          );
          router.replace("/(auth)/auth-choice");
          return;
        }

        if (!looksLikeEmailSignInLink(emailLink)) {
          Alert.alert(
            i18n.t("auth.emailLink.invalidLinkTitle", { defaultValue: "Invalid link" }),
            "Link is missing oobCode/mode=signIn (it got truncated)."
          );
          router.replace("/(auth)/auth-choice");
          return;
        }

        // ✅ Valider AVANT sign-in
        const nativeOk = auth().isSignInWithEmailLink(emailLink);
        const webOk =
          Platform.OS === "web"
            ? webIsSignInWithEmailLink(webAuth, emailLink)
            : false;

        if (!nativeOk && !webOk) {
          Alert.alert(
            i18n.t("auth.emailLink.invalidLinkTitle", { defaultValue: "Invalid link" }),
            i18n.t("auth.emailLink.invalidLinkBody", {
              defaultValue: "This link is not a valid sign-in link.",
            })
          );
          router.replace("/(auth)/auth-choice");
          return;
        }

        const email = await AsyncStorage.getItem(PENDING_EMAIL_KEY);
        if (!email) {
          Alert.alert(
            i18n.t("auth.emailLink.missingEmailTitle", { defaultValue: "Missing email" }),
            i18n.t("auth.emailLink.missingEmailBody2", {
              defaultValue: "Please re-enter your email to continue.",
            })
          );
          router.replace("/(auth)/email-link");
          return;
        }

        if (Platform.OS === "web") {
          await webSignInWithEmailLink(webAuth, email, emailLink);
        } else {
          await auth().signInWithEmailLink(email, emailLink);
          try {
            await webSignInWithEmailLink(webAuth, email, emailLink);
          } catch {}
        }

        const pendingName = String(
          (await AsyncStorage.getItem(PENDING_NAME_KEY)) || ""
        ).trim();

        if (pendingName && auth().currentUser && !auth().currentUser.displayName) {
          try {
            await auth().currentUser.updateProfile({ displayName: pendingName });
            await auth().currentUser.reload().catch(() => {});
          } catch {}
        }

        try {
            await ensureParticipantDoc({ displayName: pendingName || null });
            await ensurePublicProfile({ displayName: pendingName || null });
        } catch (e) {
        console.log("[EmailLinkComplete] profile write skipped:", e?.code || e?.message || e);
        // ne bloque pas le sign-in
        }

        await AsyncStorage.removeItem(PENDING_EMAIL_KEY);
        await AsyncStorage.removeItem(PENDING_NAME_KEY);

        router.replace("/(drawer)/(tabs)/AccueilScreen");
      } catch (e) {
        Alert.alert(
          i18n.t("auth.emailLink.signInFailedTitle", { defaultValue: "Sign-in failed" }),
          String(e?.message || e)
        );
        router.replace("/(auth)/auth-choice");
      } finally {
        setBusy(false);
      }
    };

    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emailLink]);

  return (
    <>
      <Stack.Screen
        options={{
          title: i18n.t("auth.emailLink.completing", {
            defaultValue: "Signing you in…",
          }),
        }}
      />
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24 }}>
        {busy ? <ActivityIndicator /> : null}
        <Text style={{ marginTop: 10, textAlign: "center" }}>
          {i18n.t("auth.emailLink.completingBody", {
            defaultValue: "Completing secure sign-in…",
          })}
        </Text>
      </View>
    </>
  );
}