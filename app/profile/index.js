// app/profile/index.js
import { Platform,View, Text, TextInput, TouchableOpacity, Image, ActivityIndicator, Alert, ScrollView } from "react-native";

import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';

import * as FileSystem from "expo-file-system";
import { useEffect, useState } from "react";
import { doc, getDoc, setDoc, serverTimestamp, updateDoc } from "firebase/firestore";
import { ref as storageRef, uploadString, getDownloadURL } from "firebase/storage";
import { signInAnonymously, updateProfile } from "firebase/auth";

import { useAuth } from "@src/auth/AuthProvider";
import { db, storage, auth } from "@src/lib/firebase";
import { useRouter } from "expo-router";

// crédits
import CreditsWallet from "@src/credits/CreditsWallet";
import { useCredits } from "@src/credits/useCredits";

export default function ProfileScreen() {
  const { user, ready, signOut } = useAuth();
  const router = useRouter();
  const { credits, loading: creditsLoading, topUpFree } = useCredits();

  const [displayName, setDisplayName] = useState(user?.displayName || "");
  const [photoURL, setPhotoURL] = useState(user?.photoURL || null);
  const [photoB64, setPhotoB64] = useState(null); // 👈 nouveau: base64 pour upload fiable
  const [busy, setBusy] = useState(false);
  const [participant, setParticipant] = useState(null);

  //const headerHeight = useHeaderHeight();

  useEffect(() => {
    setDisplayName(user?.displayName || "");
    setPhotoURL(user?.photoURL || null);
    setPhotoB64(null);
  }, [user?.uid]);

  useEffect(() => {
    (async () => {
      if (!user?.uid) return;
      const snap = await getDoc(doc(db, "participants", user.uid));
      if (snap.exists()) {
        const p = snap.data();
        setDisplayName(p?.displayName || user.displayName || "");
        setPhotoURL(p?.photoURL || user.photoURL || null);
        setParticipant({ id: snap.id, ...p });
      } else {
        setParticipant(null);
      }
    })();
  }, [user?.uid]);

    // juste après le useEffect qui charge `participant`
  useEffect(() => {
    if (!user?.uid) return;
    const needsFlag =
      !participant?.onboarding ||
      typeof participant?.onboarding?.welcomeSeen !== 'boolean';
    if (needsFlag) {
      // patch silencieux
      setDoc(
        doc(db, 'participants', user.uid),
        { onboarding: { welcomeSeen: false } },
        { merge: true }
      ).catch(() => {});
    }
  }, [user?.uid, participant?.onboarding?.welcomeSeen]);

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
          onboarding: {
            welcomeSeen: false,
          }
        },
        { merge: true } 
      );
      // Redirige immédiatement après 1ère création :
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

  
const saveProfile = async () => {
  if (!user?.uid) {
    Alert.alert("Non connecté", "Connecte-toi d’abord.");
    return;
  }
  try {
    setBusy(true);
    let newPhotoURL = user.photoURL || null;
    const isFirstSave = !participant; // 👈 pas encore de doc participant côté app

    // --- upload éventuel de l’avatar choisi localement ---
    if (photoURL && photoURL.startsWith("file:")) {
      if (!storage) throw new Error("Firebase storage non initialisé");
      const fileName = photoURL.split("/").pop() || `avatar_${Date.now()}.jpg`;
      const ext = (fileName.split(".").pop() || "jpg").toLowerCase();
      const contentType = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
      let base64 = photoB64 || await FileSystem.readAsStringAsync(photoURL, { encoding: "base64" });
      const path = `avatars/${user.uid}.${ext}`;
      const ref = storageRef(storage, path);
      await uploadString(ref, base64, "base64", { contentType });
      newPhotoURL = await getDownloadURL(ref);
    }

    // --- MAJ du profil Auth (affichage + photo) ---
    const cu = auth.currentUser;
    if (cu) {
      await updateProfile(cu, {
        displayName: displayName || null,
        photoURL: newPhotoURL || null,
      });
    }

    const pRef = doc(db, "participants", user.uid);

    if (isFirstSave) {
      // 👇 1ère sauvegarde : on s’assure que le doc existe et on place welcomeSeen=false
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
        },
        { merge: true }
      );

      setPhotoB64(null);
      // Redirige immédiatement vers la page de bienvenue
      router.replace("/onboarding/welcome");
      return; // on sort ici pour éviter l’alerte double
    } else {
      // ✅ toujours updater le profil…
        await updateDoc(pRef, {
          displayName: displayName || null,
          photoURL: newPhotoURL || null,
          updatedAt: serverTimestamp(),
        });

        // …et si le flag manque, on le pose maintenant
        if (needsOnboardingFlag) {
          await setDoc(pRef, { onboarding: { welcomeSeen: false } }, { merge: true });
        }

        setPhotoB64(null);
        Alert.alert("Profil mis à jour");
    }
  } catch (e) {
    Alert.alert("Échec sauvegarde", String(e?.message || e));
  } finally {
    setBusy(false);
  }
};

  if (!ready) {
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

    <KeyboardAwareScrollView
      contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 80 }}
      enableOnAndroid   // ✅
      enableAutomaticScroll // ✅ (utile sur certains OEM)
      extraScrollHeight={100}
      keyboardOpeningTime={0}
      keyboardShouldPersistTaps="handled"
      contentInsetAdjustmentBehavior="always" // iOS
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
          {/* Aller à la boutique d'avatars */}
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
  );
}