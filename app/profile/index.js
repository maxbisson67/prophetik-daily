import { View, Text, TextInput, TouchableOpacity, Image, ActivityIndicator, Alert, ScrollView } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useEffect, useState } from "react";
import { useRouter } from "expo-router";
import { signInAnonymously, signOut, updateProfile as fbUpdateProfile } from "firebase/auth";
import { auth, db, storage } from "@src/lib/firebase";
import { doc, getDoc, setDoc, serverTimestamp, updateDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { useAuth } from "@src/auth/AuthProvider";

export default function ProfileScreen() {
  const r = useRouter();
  const { user, initializing } = useAuth?.() ?? { user: auth.currentUser, initializing: false };
  const [displayName, setDisplayName] = useState(user?.displayName || "");
  const [photoURL, setPhotoURL] = useState(user?.photoURL || null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setDisplayName(user?.displayName || "");
    setPhotoURL(user?.photoURL || null);
  }, [user?.uid]);

  useEffect(() => {
    // hydrate depuis participants
    (async () => {
      if (!user?.uid) return;
      const snap = await getDoc(doc(db, "participants", user.uid));
      if (snap.exists()) {
        const p = snap.data();
        setDisplayName(p?.displayName || user.displayName || "");
        setPhotoURL(p?.photoURL || user.photoURL || null);
      }
    })();
  }, [user?.uid]);

  const ensureParticipantDoc = async (u) => {
    const refDoc = doc(db, "participants", u.uid);
    const snap = await getDoc(refDoc);
    if (!snap.exists()) {
      await setDoc(refDoc, {
        displayName: u.displayName || null,
        email: u.email || null,
        photoURL: u.photoURL || null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        credits: 0,           // sera mis à jour par CF onCreate (+25)
        betaEligible: true
      }, { merge: true });
    }
  };

  const onSignIn = async () => {
    try {
      setBusy(true);
      // Exemple rapide: anonyme. Remplace par Google/Email selon ton flux.
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
      await signOut(auth);
      Alert.alert("Déconnecté");
      r.back();
    } catch (e) {
      Alert.alert("Déconnexion impossible", String(e?.message || e));
    } finally {
      setBusy(false);
    }
  };

  const pickAvatar = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission refusée", "Autorise l’accès à la galerie pour changer l’avatar.");
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8 });
    if (res.canceled) return;
    const asset = res.assets[0];
    setPhotoURL(asset.uri);
  };

  const saveProfile = async () => {
    if (!user?.uid) {
      Alert.alert("Non connecté", "Connecte-toi d’abord.");
      return;
    }
    try {
      setBusy(true);
      let newPhotoURL = user.photoURL || null;

      // upload avatar si local
      if (photoURL && photoURL.startsWith("file:")) {
        const blob = await (await fetch(photoURL)).blob();
        const avatarRef = ref(storage, `avatars/${user.uid}.jpg`);
        await uploadBytes(avatarRef, blob);
        newPhotoURL = await getDownloadURL(avatarRef);
      }

      // MAJ Auth (affiche nom + avatar dans Firebase Auth)
      await fbUpdateProfile(user, {
        displayName: displayName || null,
        photoURL: newPhotoURL || null
      });

      // MAJ participants
      await updateDoc(doc(db, "participants", user.uid), {
        displayName: displayName || null,
        photoURL: newPhotoURL || null,
        updatedAt: serverTimestamp()
      });

      Alert.alert("Profil mis à jour");
    } catch (e) {
      Alert.alert("Échec sauvegarde", String(e?.message || e));
    } finally {
      setBusy(false);
    }
  };

  if (initializing) {
    return <View style={{ flex:1, alignItems:"center", justifyContent:"center" }}><ActivityIndicator /><Text> Initialisation…</Text></View>;
  }

  return (
    <ScrollView contentContainerStyle={{ padding:16, gap:16 }}>
      <Text style={{ fontSize:22, fontWeight:"700" }}>Profil</Text>

      <View style={{ alignItems:"center", gap:12 }}>
        <Image
          source={photoURL ? { uri: photoURL } : require("@src/assets/avatar-placeholder.png")}
          style={{ width:96, height:96, borderRadius:48, backgroundColor:"#eee" }}
        />
        <TouchableOpacity onPress={pickAvatar} style={{ paddingHorizontal:12, paddingVertical:8, borderRadius:10, borderWidth:1, borderColor:"#ddd" }}>
          <Text>Changer l’avatar</Text>
        </TouchableOpacity>
      </View>

      <View style={{ gap:6 }}>
        <Text style={{ fontWeight:"600" }}>Nom d’affichage</Text>
        <TextInput
          value={displayName}
          onChangeText={setDisplayName}
          placeholder="Ton nom"
          style={{ borderWidth:1, borderColor:"#ddd", borderRadius:10, paddingHorizontal:12, paddingVertical:10 }}
        />
      </View>

      {busy ? <ActivityIndicator /> : null}

      {user ? (
        <View style={{ gap:10 }}>
          <TouchableOpacity onPress={saveProfile} style={{ backgroundColor:"#111", padding:14, borderRadius:10, alignItems:"center" }}>
            <Text style={{ color:"#fff", fontWeight:"600" }}>Sauvegarder</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onSignOut} style={{ backgroundColor:"#fff5f5", padding:14, borderRadius:10, alignItems:"center", borderWidth:1, borderColor:"#ffd6d6" }}>
            <Text style={{ color:"#b00020", fontWeight:"600" }}>Se déconnecter</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity onPress={onSignIn} style={{ backgroundColor:"#111", padding:14, borderRadius:10, alignItems:"center" }}>
          <Text style={{ color:"#fff", fontWeight:"600" }}>Se connecter</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}