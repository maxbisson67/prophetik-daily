// app/(auth)/phone-login.js
import React, { useRef, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Alert, KeyboardAvoidingView, Platform } from "react-native";
import { Stack, useRouter } from "expo-router";
import { FirebaseRecaptchaVerifierModal } from "expo-firebase-recaptcha";
import { auth, app, db } from "@src/lib/firebase"; // ← ton init Firebase existant
import { RecaptchaVerifier, signInWithPhoneNumber } from "firebase/auth";
import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";

export default function PhoneLoginScreen() {
  const router = useRouter();

  // Firebase config pour la modale reCAPTCHA (expo-firebase-recaptcha)
  const firebaseConfig = app?.options || {};
  const recaptchaRef = useRef(null);

  const [phone, setPhone] = useState("");             // ex. +15145550123
  const [code, setCode] = useState("");               // code OTP
  const [confirmation, setConfirmation] = useState(null);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);

  async function sendCode() {
    const raw = (phone || "").trim();
    if (!raw.startsWith("+")) {
      Alert.alert("Numéro invalide", "Entre ton numéro au format international (ex: +15145550123).");
      return;
    }
    try {
      setSending(true);

      // 1) Crée le vérifieur reCAPTCHA (Expo) si nécessaire
      //    La modal s'ouvre automatiquement lors de signInWithPhoneNumber si utilisée.
      //    Avec expo-firebase-recaptcha, on n'a pas besoin de new RecaptchaVerifier() manuel.
      const provider = await signInWithPhoneNumber(auth, raw, recaptchaRef.current);
      setConfirmation(provider);

      Alert.alert("Code envoyé", "Vérifie le SMS (ou utilise ton numéro de TEST).");
    } catch (e) {
      Alert.alert("Envoi impossible", String(e?.message || e));
    } finally {
      setSending(false);
    }
  }

  async function confirmCode() {
    if (!confirmation) {
      Alert.alert("Aucun code envoyé", "Envoie d’abord le code à ton téléphone.");
      return;
    }
    if (!code.trim()) {
      Alert.alert("Code manquant", "Entre le code reçu par SMS.");
      return;
    }
    try {
      setVerifying(true);
      const cred = await confirmation.confirm(code.trim());

      // Utilisateur connecté → on crée/merge son doc "participants/{uid}" si besoin
      const uid = cred?.user?.uid;
      if (uid) {
        const pref = doc(db, "participants", uid);
        const snap = await getDoc(pref);
        if (!snap.exists()) {
          await setDoc(pref, {
            uid,
            // tu peux stocker le phoneNumber si tu veux :
            phoneNumber: cred.user.phoneNumber || null,
            // modèle de crédits actuel de ton app (à adapter si besoin)
            credits: { balance: 25, updatedAt: serverTimestamp() }, // bonus d’accueil ?
            betaEligible: true,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          }, { merge: true });
        } else {
          await setDoc(pref, { updatedAt: serverTimestamp() }, { merge: true });
        }
      }

      // Redirige vers l’accueil (ou l’écran que tu veux)
      router.replace("/(tabs)");
    } catch (e) {
      Alert.alert("Code invalide", String(e?.message || e));
    } finally {
      setVerifying(false);
    }
  }

  return (
    <>
      <Stack.Screen options={{ title: "Connexion par SMS" }} />
      <KeyboardAvoidingView behavior={Platform.select({ ios: "padding", android: undefined })} style={{ flex: 1 }}>
        <View style={{ flex: 1, padding: 16, gap: 16, justifyContent: "center" }}>
          {/* reCAPTCHA Modal (obligatoire pour Expo en DEV) */}
          <FirebaseRecaptchaVerifierModal
            ref={recaptchaRef}
            firebaseConfig={firebaseConfig}
            // Optionnel : rendu "invisible"
            attemptInvisibleVerification={true}
          />

          <View style={{ padding: 16, borderWidth: 1, borderRadius: 12, backgroundColor: "#fff" }}>
            <Text style={{ fontSize: 18, fontWeight: "700", marginBottom: 8 }}>Entre ton numéro</Text>
            <TextInput
              value={phone}
              onChangeText={setPhone}
              placeholder="+15145550123"
              keyboardType="phone-pad"
              textContentType="telephoneNumber"
              autoComplete="tel"
              style={{
                borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 10,
                paddingHorizontal: 12, paddingVertical: 10, marginBottom: 12,
              }}
            />

            <TouchableOpacity
              onPress={sendCode}
              disabled={sending || !phone.trim()}
              style={{
                backgroundColor: sending || !phone.trim() ? "#9CA3AF" : "#111827",
                paddingVertical: 12, borderRadius: 10, alignItems: "center",
              }}
            >
              {sending
                ? <ActivityIndicator color="#fff" />
                : <Text style={{ color: "#fff", fontWeight: "700" }}>Envoyer le code</Text>}
            </TouchableOpacity>
          </View>

          <View style={{ padding: 16, borderWidth: 1, borderRadius: 12, backgroundColor: "#fff" }}>
            <Text style={{ fontSize: 18, fontWeight: "700", marginBottom: 8 }}>Code reçu</Text>
            <TextInput
              value={code}
              onChangeText={setCode}
              placeholder="123456"
              keyboardType="number-pad"
              maxLength={6}
              style={{
                borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 10,
                paddingHorizontal: 12, paddingVertical: 10, marginBottom: 12,
              }}
            />

            <TouchableOpacity
              onPress={confirmCode}
              disabled={verifying || !confirmation || !code.trim()}
              style={{
                backgroundColor: verifying || !confirmation || !code.trim() ? "#9CA3AF" : "#111827",
                paddingVertical: 12, borderRadius: 10, alignItems: "center",
              }}
            >
              {verifying
                ? <ActivityIndicator color="#fff" />
                : <Text style={{ color: "#fff", fontWeight: "700" }}>Confirmer</Text>}
            </TouchableOpacity>
          </View>

          {/* Astuce: Numéros de TEST Firebase */}
          <View style={{ padding: 12, borderWidth: 1, borderRadius: 12, backgroundColor: "#FFFBEB", borderColor: "#F59E0B" }}>
            <Text style={{ fontWeight: "700", marginBottom: 4 }}>En DEV (Expo Go)</Text>
            <Text style={{ color: "#6B7280" }}>
              Ajoute un <Text style={{ fontWeight: "700" }}>numéro de test</Text> dans Firebase &gt; Auth &gt; Téléphone,
              par ex. +15555550100 avec code 123456. Aucun SMS réel n’est envoyé.
            </Text>
          </View>
        </View>
      </KeyboardAvoidingView>
    </>
  );
}