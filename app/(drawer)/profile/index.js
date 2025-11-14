// app/profile/index.js
import { View, Text, TextInput, TouchableOpacity, Image, ActivityIndicator, Alert } from "react-native";
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import React, { useEffect, useState, useRef } from "react";
import { Stack, useRouter } from 'expo-router';

// 🔁 RN Firebase Firestore
import firestore from '@react-native-firebase/firestore';

// Auth (tu peux garder ton provider actuel)
import { signInAnonymously, updateProfile } from "firebase/auth";

// Safe auth
import { useAuth } from '@src/auth/SafeAuthProvider';

// crédits
import CreditsWallet from "@src/credits/CreditsWallet";
import { useCredits } from "@src/credits/useCredits";

// Si tu utilises encore auth web dans ton SafeAuthProvider :
import { auth } from "@src/lib/firebase";

export default function ProfileScreen() {
  const { user, authReady, signOut } = useAuth();
  const router = useRouter();
  const { loading: creditsLoading, topUpFree } = useCredits();

  const [displayName, setDisplayName] = useState(user?.displayName || "");
  const [photoURL, setPhotoURL] = useState(user?.photoURL || null);
  const [busy, setBusy] = useState(false);
  const [participant, setParticipant] = useState(null);

  const [participantLoaded, setParticipantLoaded] = useState(false);
  const didPatchOnboardingRef = useRef(false);

  // --- sync visuel sur changement d'UID
  useEffect(() => {
    setDisplayName(user?.displayName || "");
    setPhotoURL(user?.photoURL ?? null);
  }, [user?.uid]);

  // --- fetch participant (RNFirebase)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setParticipantLoaded(false);
      if (!user?.uid) {
        setParticipant(null);
        setParticipantLoaded(true);
        return;
      }
      try {
        const snap = await firestore().doc(`participants/${user.uid}`).get();
        if (cancelled) return;
        if (snap.exists) {
          const p = snap.data() || {};
          setDisplayName(p?.displayName || user.displayName || "");
          setPhotoURL(p?.photoURL ?? p?.avatarUrl ?? user.photoURL ?? null);
          setParticipant({ id: snap.id, ...p });
        } else {
          setParticipant(null);
        }
      } finally {
        if (!cancelled) setParticipantLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, [user?.uid]);

  const needsOnboardingFlag =
    !!user?.uid &&
    participantLoaded &&
    (!participant?.onboarding || typeof participant?.onboarding?.welcomeSeen !== 'boolean');

  // --- patch onboarding (une seule fois)
  useEffect(() => {
    if (!user?.uid) return;
    if (!participantLoaded) return;
    if (!needsOnboardingFlag) return;
    if (didPatchOnboardingRef.current) return;

    didPatchOnboardingRef.current = true;
    firestore()
      .doc(`participants/${user.uid}`)
      .set({ onboarding: { welcomeSeen: false } }, { merge: true })
      .then(() => {
        setParticipant(prev =>
          prev
            ? { ...prev, onboarding: { ...(prev?.onboarding || {}), welcomeSeen: false } }
            : prev
        );
      })
      .catch(() => {});
  }, [user?.uid, participantLoaded, needsOnboardingFlag]);

  // --- helpers
  const ensureParticipantDoc = async (u) => {
    const ref = firestore().doc(`participants/${u.uid}`);
    const snap = await ref.get();
    if (!snap.exists) {
      await ref.set(
        {
          displayName: u.displayName || null,
          email: u.email || null,
          photoURL: u.photoURL || null,
          createdAt: firestore.FieldValue.serverTimestamp(),
          updatedAt: firestore.FieldValue.serverTimestamp(),
          credits: { balance: 0 },
          betaEligible: true,
          onboarding: { welcomeSeen: false },
        },
        { merge: true }
      );
      router.replace('/onboarding/welcome');
    }
  };

  const onSignIn = async () => {
    try {
      setBusy(true);
      // Si tu migres vers RNFirebase Auth : await auth().signInAnonymously();
      const res = await signInAnonymously(auth);
      await ensureParticipantDoc(res.user);
      Alert.alert("Connecté", "Bienvenue !");
    } catch (e) {
      Alert.alert("Connexion impossible", String(e?.message || e));
    } finally {
      setBusy(false);
    }
  };

  const onSignOut = async () => {
    try {
      setBusy(true);
      await signOut();
      Alert.alert("Déconnecté");
    } catch (e) {
      Alert.alert("Déconnexion impossible", String(e?.message || e));
    } finally {
      setBusy(false);
    }
  };

  // === SAUVEGARDE (FireStore RNFirebase) ===
  const saveProfile = async () => {
    if (!user?.uid) {
      Alert.alert("Non connecté", "Connecte-toi d’abord.");
      return;
    }
    try {
      setBusy(true);

      const newPhotoURL =
        photoURL
        ?? participant?.photoURL
        ?? participant?.avatarUrl
        ?? user?.photoURL
        ?? null;

      const isFirstSave = !participant;

      // MAJ profil auth
      if (auth?.currentUser) {
        await updateProfile(auth.currentUser, {
          displayName: displayName || null,
          photoURL: newPhotoURL || null,
        });
      }

      const ref = firestore().doc(`participants/${user.uid}`);

      if (isFirstSave) {
        await ref.set(
          {
            displayName: displayName || null,
            email: user.email || null,
            credits: { balance: 0 },
            betaEligible: true,
            createdAt: firestore.FieldValue.serverTimestamp(),
            updatedAt: firestore.FieldValue.serverTimestamp(),
            onboarding: { welcomeSeen: false },
            ...(newPhotoURL ? { photoURL: newPhotoURL, avatarUrl: newPhotoURL } : {}),
          },
          { merge: true }
        );
        router.replace("/onboarding/welcome");
        return;
      } else {
        const updatePayload = {
          displayName: displayName || null,
          updatedAt: firestore.FieldValue.serverTimestamp(),
        };
        if (newPhotoURL) {
          updatePayload.photoURL = newPhotoURL;
          updatePayload.avatarUrl = newPhotoURL;
        }
        await ref.update(updatePayload);

        if (needsOnboardingFlag && !didPatchOnboardingRef.current) {
          await ref.set({ onboarding: { welcomeSeen: false } }, { merge: true });
          didPatchOnboardingRef.current = true;
        }

        Alert.alert("Profil mis à jour");
      }
    } catch (e) {
      Alert.alert("Échec sauvegarde", String(e?.message || e));
    } finally {
      setBusy(false);
    }
  };

  if (!authReady) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator />
        <Text> Initialisation…</Text>
      </View>
    );
  }

  const creditsValue =
    typeof participant?.credits === "number"
      ? participant.credits
      : typeof participant?.credits?.balance === "number"
      ? participant.credits.balance
      : typeof participant?.balance === "number"
      ? participant.balance
      : 0;

  return (
    <>
      <Stack.Screen options={{ title: 'Profil' }} />
      <KeyboardAwareScrollView
        contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 80 }}
        enableOnAndroid
        enableAutomaticScroll
        extraScrollHeight={100}
        keyboardOpeningTime={0}
        keyboardShouldPersistTaps="handled"
        contentInsetAdjustmentBehavior="always"
      >
        <CreditsWallet credits={creditsValue} />

        <View
          style={{
            padding: 16,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: "#eee",
            backgroundColor: "#fff",
            elevation: 3,
            shadowColor: "#000",
            shadowOpacity: 0.08,
            shadowRadius: 6,
            shadowOffset: { width: 0, height: 3 },
            gap: 16,
          }}
        >
          <View style={{ alignItems: "center", gap: 12 }}>
            <Image
              source={photoURL ? { uri: photoURL } : require("@src/assets/avatar-placeholder.png")}
              style={{ width: 96, height: 96, borderRadius: 48, backgroundColor: "#eee" }}
            />
            <TouchableOpacity
              onPress={() => router.push("/avatars/AvatarsScreen")}
              style={{
                paddingHorizontal: 14,
                paddingVertical: 10,
                borderRadius: 10,
                backgroundColor: "#ef4444",
                alignItems: "center",
              }}
            >
              <Text style={{ color: "#fff", fontWeight: "700" }}>🎨 Choisir un avatar</Text>
            </TouchableOpacity>
          </View>

          <View style={{ gap: 6 }}>
            <Text style={{ fontWeight: "600" }}>Nom d’affichage</Text>
            <TextInput
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="Ton nom"
              style={{
                borderWidth: 1,
                borderColor: "#ddd",
                borderRadius: 10,
                paddingHorizontal: 12,
                paddingVertical: 10,
              }}
            />
          </View>
        </View>

        {busy ? <ActivityIndicator /> : null}

        {user ? (
          <View style={{ gap: 10 }}>
            <TouchableOpacity
              onPress={saveProfile}
              style={{ backgroundColor: "#111", padding: 14, borderRadius: 10, alignItems: "center" }}
            >
              <Text style={{ color: "#fff", fontWeight: "600" }}>Sauvegarder</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={onSignOut}
              style={{
                backgroundColor: "#fff5f5",
                padding: 14,
                borderRadius: 10,
                alignItems: "center",
                borderWidth: 1,
                borderColor: "#ffd6d6",
              }}
            >
              <Text style={{ color: "#b00020", fontWeight: "600" }}>Se déconnecter</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            onPress={onSignIn}
            style={{ backgroundColor: "#111", padding: 14, borderRadius: 10, alignItems: "center" }}
          >
            <Text style={{ color: "#fff", fontWeight: "600" }}>Se connecter</Text>
          </TouchableOpacity>
        )}

        {/* Top-up de test */}
        {user && !creditsLoading && creditsValue < 5 ? (
          <TouchableOpacity
            onPress={async () => {
              try {
                const res = await topUpFree();
                Alert.alert("Top-up", `Nouveau solde: ${res.credits}`);
              } catch (e) {
                Alert.alert("Top-up impossible", String(e?.message || e));
              }
            }}
            style={{ marginTop: 8, backgroundColor: "#111", padding: 12, borderRadius: 10, alignItems: "center" }}
          >
            <Text style={{ color: "#fff", fontWeight: "600" }}>+25 gratuits (bêta)</Text>
          </TouchableOpacity>
        ) : null}
      </KeyboardAwareScrollView>
    </>
  );
}