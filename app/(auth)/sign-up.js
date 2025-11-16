// app/(auth)/SignUpScreen.js
import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, Image, Alert } from "react-native";
import { useRouter } from "expo-router";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { auth, db, storage } from "@src/lib/firebase";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

async function ensureParticipantDoc(u, displayName) {
  await setDoc(
    doc(db, "participants", u.uid),
    {
      displayName: displayName || u.displayName || null,
      email: u.email || null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      credits: 0, // ta CF onCreate ajoutera +25
      betaEligible: true,
    },
    { merge: true }
  );
}

export default function SignUpScreen() {
  const r = useRouter();
  const [email, setEmail] = useState("");
  const [pwd, setPwd] = useState("");
  const [pwd2, setPwd2] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);


  const onSignUp = async () => {
    try {
      if (!displayName.trim() || !email.trim() || !pwd || !pwd2) {
        Alert.alert("Champs requis", "Nom, courriel et mot de passe sont requis.");
        return;
      }
      if (pwd.length < 6) {
        Alert.alert("Mot de passe trop court", "Minimum 6 caractères.");
        return;
      }
      if (pwd !== pwd2) {
        Alert.alert("Mismatch", "Les mots de passe ne correspondent pas.");
        return;
      }

      setBusy(true);

      // 1) Création du compte
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), pwd);
      const user = cred.user;

      // 2) Update profil Auth
      await updateProfile(user, {
        displayName: displayName.trim()
      });

      // 4) Firestore participants/{uid}
      await ensureParticipantDoc(user, displayName.trim());

      Alert.alert("Compte créé", "Bienvenue !");
      r.replace('/(drawer)/(tabs)/AccueilScreen');
    } catch (e) {
      // Messages d’erreur un peu plus clairs
      const msg = String(e?.message || e);
      if (msg.includes("email-already-in-use")) {
        Alert.alert("Création échouée", "Ce courriel est déjà utilisé.");
      } else if (msg.includes("invalid-email")) {
        Alert.alert("Création échouée", "Le format du courriel est invalide.");
      } else if (msg.includes("network")) {
        Alert.alert("Création échouée", "Problème réseau. Réessaie.");
      } else {
        Alert.alert("Création échouée", msg);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1, padding: 16, gap: 12 }}>
      <Text style={{ fontSize: 22, fontWeight: "700" }}>Créer un compte</Text>

      {/* Nom */}
      <View style={{ gap: 6 }}>
        <Text>Nom d’affichage</Text>
        <TextInput
          value={displayName}
          onChangeText={setDisplayName}
          placeholder="Ton nom"
          autoCapitalize="words"
          style={{ borderWidth: 1, borderColor: "#ddd", borderRadius: 10, padding: 12 }}
        />
      </View>

      {/* Email */}
      <View style={{ gap: 6 }}>
        <Text>Courriel</Text>
        <TextInput
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          placeholder="toi@exemple.com"
          style={{ borderWidth: 1, borderColor: "#ddd", borderRadius: 10, padding: 12 }}
        />
      </View>

      {/* Password */}
      <View style={{ gap: 6 }}>
        <Text>Mot de passe</Text>
        <TextInput
          value={pwd}
          onChangeText={setPwd}
          secureTextEntry
          placeholder="••••••••"
          style={{ borderWidth: 1, borderColor: "#ddd", borderRadius: 10, padding: 12 }}
        />
      </View>
      <View style={{ gap: 6 }}>
        <Text>Confirmer le mot de passe</Text>
        <TextInput
          value={pwd2}
          onChangeText={setPwd2}
          secureTextEntry
          placeholder="••••••••"
          style={{ borderWidth: 1, borderColor: "#ddd", borderRadius: 10, padding: 12 }}
        />
      </View>

      <TouchableOpacity
        onPress={onSignUp}
        disabled={busy}
        style={{ backgroundColor: "#111", padding: 14, borderRadius: 10, alignItems: "center", opacity: busy ? 0.7 : 1 }}
      >
        <Text style={{ color: "#fff", fontWeight: "600" }}>{busy ? "Création…" : "Créer le compte"}</Text>
      </TouchableOpacity>
    </View>
  );
}