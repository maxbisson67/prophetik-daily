// src/profile/HeaderProfileButton.js
import { TouchableOpacity, Image, View } from "react-native";
import { useAuth } from "@src/auth/AuthProvider";
import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@src/lib/firebase";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

export function HeaderProfileButton() {
  const r = useRouter();
  const { user } = useAuth?.() ?? { user: null };
  const [photoURL, setPhotoURL] = useState(null);

  useEffect(() => {
    let unsub;
    if (user?.uid) {
      unsub = onSnapshot(doc(db, "participants", user.uid), (snap) => {
        const p = snap.data();
        setPhotoURL(p?.photoURL || user.photoURL || null);
      });
    } else {
      setPhotoURL(null); // avatar générique si déconnecté
    }
    return () => unsub?.();
  }, [user?.uid]);

  const go = () => {
    if (user?.uid) r.push("/profile");
    else r.push("/(auth)/sign-in");     // 👈 vers ta page sign-in existante
  };

  return (
    <TouchableOpacity onPress={go} style={{ paddingHorizontal: 8 }} activeOpacity={0.6}>
      <View style={{ position: "relative" }}>
        <Image
          source={photoURL ? { uri: photoURL } : require("@src/assets/avatar-placeholder.png")}
          style={{ width: 32, height: 32, borderRadius: 16, borderWidth: 2, borderColor: "#111", backgroundColor: "#eee" }}
        />
        <Ionicons
          name="person-circle-outline"
          size={14}
          color="#111"
          style={{ position: "absolute", bottom: -2, right: -2, backgroundColor: "#fff", borderRadius: 7 }}
        />
      </View>
    </TouchableOpacity>
  );
}