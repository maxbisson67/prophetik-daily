import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, Image, Alert } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { auth, db, storage } from "@src/lib/firebase";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

async function ensureParticipantDoc(u, displayName, photoURL) {
  await setDoc(doc(db, "participants", u.uid), {
    displayName: displayName || u.displayName || null,
    email: u.email || null,
    photoURL: photoURL || u.photoURL || null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    credits: 0,       // ta CF onCreate mettra +25
    betaEligible: true
  }, { merge: true });
}

export default function SignUpScreen() {
  const r = useRouter();
  const [email, setEmail] = useState("");
  const [pwd, setPwd] = useState("");
  const [pwd2, setPwd2] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [photo, setPhoto] = useState(null); // uri locale
  const [busy, setBusy] = useState(false);

  const pickAvatar = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") return Alert.alert("Permission refusée", "Autorise la galerie pour choisir un avatar.");
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8 });
    if (!res.canceled) setPhoto(res.assets[0].uri);
  };

  const onSignUp = async () => {
    try {
      if (!email.trim() || !pwd || !pwd2 || !displayName.trim()) {
        return Alert.alert("Champs requis", "Nom, courriel et mot de passe sont requis.");
      }
      if (pwd.length < 6) return Alert.alert("Mot de passe trop court", "Minimum 6 caractères.");
      if (pwd !== pwd2) return Alert.alert("Mismatch", "Les mots de passe ne correspondent pas.");

      setBusy(true);

      // 1) Création du compte
      const { user } = await createUserWithEmailAndPassword(auth, email.trim(), pwd);

      // 2) Upload avatar si fourni
      let photoURL = null;
      if (photo?.startsWith("file:")) {
        const blob = await (await fetch(photo)).blob();
        const avatarRef = ref(storage, `avatars/${user.uid}.jpg`);
        await uploadBytes(avatarRef, blob);
        photoURL = await getDownloadURL(avatarRef);
      }

      // 3) Update profil Auth
      await updateProfile(user, {
        displayName: displayName.trim(),
        photoURL: photoURL || null
      });

      // 4) Crée/merge participants/{uid}
      await ensureParticipantDoc(user, displayName.trim(), photoURL);

      Alert.alert("Compte créé", "Bienvenue !");
      r.replace("/profile"); // ou directement vers l’app principale
    } catch (e) {
      Alert.alert("Création échouée", String(e?.message || e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex:1, padding:16, gap:12 }}>
      <Text style={{ fontSize:22, fontWeight:"700" }}>Créer un compte</Text>

      {/* Avatar */}
      <View style={{ alignItems:"center", gap:12 }}>
        <Image
          source={photo ? { uri: photo } : require("@src/assets/avatar-placeholder.png")}
          style={{ width:96, height:96, borderRadius:48, backgroundColor:"#eee" }}
        />
        <TouchableOpacity
          onPress={pickAvatar}
          style={{ paddingHorizontal:12, paddingVertical:8, borderRadius:10, borderWidth:1, borderColor:"#ddd" }}
        >
          <Text>Choisir un avatar</Text>
        </TouchableOpacity>
      </View>

      {/* Nom */}
      <View style={{ gap:6 }}>
        <Text>Nom d’affichage</Text>
        <TextInput
          value={displayName}
          onChangeText={setDisplayName}
          placeholder="Ton nom"
          style={{ borderWidth:1, borderColor:"#ddd", borderRadius:10, padding:12 }}
        />
      </View>

      {/* Email */}
      <View style={{ gap:6 }}>
        <Text>Courriel</Text>
        <TextInput
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          placeholder="toi@exemple.com"
          style={{ borderWidth:1, borderColor:"#ddd", borderRadius:10, padding:12 }}
        />
      </View>

      {/* Password */}
      <View style={{ gap:6 }}>
        <Text>Mot de passe</Text>
        <TextInput
          value={pwd}
          onChangeText={setPwd}
          secureTextEntry
          placeholder="••••••••"
          style={{ borderWidth:1, borderColor:"#ddd", borderRadius:10, padding:12 }}
        />
      </View>
      <View style={{ gap:6 }}>
        <Text>Confirmer le mot de passe</Text>
        <TextInput
          value={pwd2}
          onChangeText={setPwd2}
          secureTextEntry
          placeholder="••••••••"
          style={{ borderWidth:1, borderColor:"#ddd", borderRadius:10, padding:12 }}
        />
      </View>

      <TouchableOpacity onPress={onSignUp} disabled={busy} style={{ backgroundColor:"#111", padding:14, borderRadius:10, alignItems:"center" }}>
        <Text style={{ color:"#fff", fontWeight:"600" }}>{busy ? "Création…" : "Créer le compte"}</Text>
      </TouchableOpacity>
    </View>
  );
}