// app/profile/index.js
import { View, Text, TextInput, TouchableOpacity, Image, ActivityIndicator, Alert } from "react-native";
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';

import React, { useEffect, useState } from "react";
import { Stack } from 'expo-router';
import { doc, getDoc, setDoc, serverTimestamp, updateDoc } from "firebase/firestore";
import { signInAnonymously, updateProfile } from "firebase/auth";

// Safe auth
import { useAuth } from '@src/auth/SafeAuthProvider';

import { db, auth } from "@src/lib/firebase";
import { useRouter } from "expo-router";

// crédits
import CreditsWallet from "@src/credits/CreditsWallet";
import { useCredits } from "@src/credits/useCredits";

export default function ProfileScreen() {
  const { user, authReady, signOut } = useAuth();
  const router = useRouter();
  const { loading: creditsLoading, topUpFree } = useCredits();

  const [displayName, setDisplayName] = useState(user?.displayName || "");
  const [photoURL, setPhotoURL] = useState(user?.photoURL || null);
  const [busy, setBusy] = useState(false);
  const [participant, setParticipant] = useState(null);

  // charge/patch contrôlés
  const [participantLoaded, setParticipantLoaded] = useState(false);
  const didPatchOnboardingRef = React.useRef(false);

  // --- sync visuel sur changement d'UID
  useEffect(() => {
    setDisplayName(user?.displayName || "");
    setPhotoURL(user?.photoURL ?? null);
  }, [user?.uid]);

  // --- fetch participant
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
        const snap = await getDoc(doc(db, "participants", user.uid));
        if (cancelled) return;
        if (snap.exists()) {
          const p = snap.data();
          setDisplayName(p?.displayName || user.displayName || "");
          // rétro-compat: photoURL ou avatarUrl
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

  // --- calcul réutilisable
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
    setDoc(
      doc(db, 'participants', user.uid),
      { onboarding: { welcomeSeen: false } },
      { merge: true }
    )
      .then(() => {
        setParticipant(prev =>
          prev
            ? { ...prev, onboarding: { ...(prev.onboarding || {}), welcomeSeen: false } }
            : prev
        );
      })
      .catch(() => {});
  }, [user?.uid, participantLoaded, needsOnboardingFlag]);

  // --- helpers
  const ensureParticipantDoc = async (u) => {
    const refDoc = doc(db, "participants", u.uid);
    const snap = await getDoc(refDoc);
    if (!snap.exists()) {
      await setDoc(
        refDoc,
        {
          displayName: u.displayName || null,
          email: u.email || null,
          photoURL: u.photoURL || null,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
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

  // === SAUVEGARDE SANS FILE SYSTEM / STORAGE ===
  const saveProfile = async () => {
    if (!user?.uid) {
      Alert.alert("Non connecté", "Connecte-toi d’abord.");
      return;
    }
    try {
      setBusy(true);

      // base: ne jamais perdre une URL existante
      const newPhotoURL =
        photoURL
        ?? participant?.photoURL
        ?? participant?.avatarUrl
        ?? user?.photoURL
        ?? null;

      const isFirstSave = !participant;

      // MAJ profil auth
      const cu = auth.currentUser;
      if (cu) {
        await updateProfile(cu, {
          displayName: displayName || null,
          photoURL: newPhotoURL || null,
        });
      }

      const pRef = doc(db, "participants", user.uid);

      if (isFirstSave) {
        await setDoc(
          pRef,
          {
            displayName: displayName || null,
            email: user.email || null,
            credits: { balance: 0 },
            betaEligible: true,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
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
          updatedAt: serverTimestamp(),
        };
        if (newPhotoURL) {
          updatePayload.photoURL = newPhotoURL;
          updatePayload.avatarUrl = newPhotoURL;
        }
        await updateDoc(pRef, updatePayload);

        if (needsOnboardingFlag && !didPatchOnboardingRef.current) {
          await setDoc(pRef, { onboarding: { welcomeSeen: false } }, { merge: true });
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

      {/* Petit bonus: bouton de top-up si nécessaire */}
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