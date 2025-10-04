// app/groups/join.js
import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Alert } from "react-native";
import { Stack, useRouter } from "expo-router";
import { httpsCallable } from "firebase/functions";
import { functions } from "@src/lib/firebase";
import { useAuth } from "@src/auth/AuthProvider";

const CODE_LEN = 8;
const ALPHABET = "ABCDEFGHIJKLMNPQRSTUVWXYZ123456789"; // sans 0 ni O




export default function JoinGroupScreen() {
  const r = useRouter();
  const { user } = useAuth();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  const sanitize = (s) =>
    s.toUpperCase().replace(/[^A-Z0-9]/g, "").replace(/O/g, ""); // retire O au cas où

  const onChange = (t) => setCode(sanitize(t));

  const validateCode = (c) =>
    c.length === CODE_LEN && [...c].every((ch) => ALPHABET.includes(ch));

  const onJoin = async () => {
    const cleaned = sanitize(code);
    if (!user?.uid) {
      return Alert.alert("Connexion requise", "Connecte-toi pour rejoindre un groupe.");
    }
    if (!validateCode(cleaned)) {
      return Alert.alert(
        "Code invalide",
        `Le code doit contenir ${CODE_LEN} caractères (A–Z sans O, 1–9 sans 0).`
      );
    }

    try {
      setBusy(true);
      // 🔥 Cloud Function recommandée
      const joinFn = httpsCallable(functions, "joinGroupByCode");
      const { data } = await joinFn({ code: cleaned });

      if (!data?.groupId) {
        throw new Error("Réponse inattendue du serveur.");
      }

      // ✅ Navigation vers la page du groupe
      r.replace({
        pathname: `/groups/${data.groupId}`,
        params: { initial: JSON.stringify({ id: data.groupId }) },
      });
    } catch (e) {
      // messages utiles
      const msg = String(e?.message || e);
      if (msg.includes("not-found")) {
        Alert.alert("Code introuvable", "Vérifie le code et réessaie.");
      } else if (msg.includes("unauthenticated")) {
        Alert.alert("Connexion requise", "Connecte-toi pour rejoindre un groupe.");
      } else {
        Alert.alert("Impossible de rejoindre", msg);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: "Rejoindre un groupe" }} />

      <View style={{ flex: 1, padding: 16, gap: 14 }}>
        <Text style={{ fontSize: 22, fontWeight: "700" }}>Entrer le code d’invitation</Text>
        <Text style={{ color: "#555" }}>
          Entrez le code à {CODE_LEN} caractères (ex: <Text style={{ fontWeight: "700" }}>Z3H8K7QM</Text>).
        </Text>

        <TextInput
          value={code}
          onChangeText={onChange}
          autoCapitalize="characters"
          autoCorrect={false}
          placeholder="XXXXXXXX"
          maxLength={CODE_LEN}
          style={{
            borderWidth: 1,
            borderColor: "#ddd",
            borderRadius: 12,
            padding: 14,
            fontSize: 20,
            letterSpacing: 2,
          }}
        />

        <TouchableOpacity
          onPress={onJoin}
          disabled={busy || !validateCode(code)}
          style={{
            backgroundColor: busy || !validateCode(code) ? "#999" : "#111827",
            padding: 14,
            borderRadius: 12,
            alignItems: "center",
          }}
        >
          {busy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={{ color: "#fff", fontWeight: "600" }}>Rejoindre le groupe</Text>
          )}
        </TouchableOpacity>

        <Text style={{ color: "#777" }}>
          Astuce : le code ne contient jamais la lettre “O” ni le chiffre “0”.
        </Text>
      </View>
    </>
  );
}