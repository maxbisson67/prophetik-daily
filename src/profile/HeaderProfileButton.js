import { TouchableOpacity, Image } from "react-native";
import { useAuth } from "@src/auth/AuthProvider"; // ou import firebase auth si tu n'as pas de hook
import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@src/lib/firebase";

export function HeaderProfileButton({ onPress }) {
  const { user } = useAuth?.() ?? { user: null };
  const [photoURL, setPhotoURL] = useState(user?.photoURL || null);

  useEffect(() => {
    if (!user?.uid) return;
    const unsub = onSnapshot(doc(db, "participants", user.uid), (snap) => {
      const p = snap.data();
      setPhotoURL(p?.photoURL || user.photoURL || null);
    });
    return () => unsub?.();
  }, [user?.uid]);

  return (
    <TouchableOpacity onPress={onPress} style={{ paddingHorizontal: 8 }}>
      <Image
        source={photoURL ? { uri: photoURL } : require("@src/assets/avatar-placeholder.png")}
        style={{ width: 28, height: 28, borderRadius: 14 }}
      />
    </TouchableOpacity>
  );
}