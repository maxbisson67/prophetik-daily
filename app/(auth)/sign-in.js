import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, Alert } from "react-native";
import { useRouter, Link } from "expo-router";
import { signInWithEmailAndPassword, sendPasswordResetEmail } from "firebase/auth";
import { auth } from "@src/lib/firebase";
import { Ionicons } from "@expo/vector-icons";

export default function SignInScreen() {
  const r = useRouter();
  const [email, setEmail] = useState("");
  const [pwd, setPwd] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [busy, setBusy] = useState(false);

  const onSignIn = async () => {
    try {
      setBusy(true);
      await signInWithEmailAndPassword(auth, email.trim(), pwd);
      r.replace("/profile"); // ou r.back()
    } catch (e) {
      Alert.alert("Connexion échouée", String(e?.message || e));
    } finally {
      setBusy(false);
    }
  };

  const onForgot = async () => {
    if (!email.trim()) return Alert.alert("Mot de passe oublié", "Entre ton courriel d’abord.");
    try {
      await sendPasswordResetEmail(auth, email.trim());
      Alert.alert("Email envoyé", "Vérifie ta boîte de réception.");
    } catch (e) {
      Alert.alert("Erreur", String(e?.message || e));
    }
  };

  return (
    <View style={{ flex:1, padding:16, gap:12 }}>
      <Text style={{ fontSize:22, fontWeight:"700" }}>Se connecter</Text>

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

      <View style={{ gap:6 }}>
        <Text>Mot de passe</Text>
        <View style={{ borderWidth:1, borderColor:"#ddd", borderRadius:10, flexDirection:"row", alignItems:"center" }}>
          <TextInput
            value={pwd}
            onChangeText={setPwd}
            secureTextEntry={!showPwd}
            placeholder="••••••••"
            style={{ flex:1, padding:12 }}
          />
          <TouchableOpacity onPress={() => setShowPwd(s => !s)} style={{ paddingHorizontal:12 }}>
            <Ionicons name={showPwd ? "eye-off" : "eye"} size={20} />
          </TouchableOpacity>
        </View>
      </View>

      <TouchableOpacity onPress={onSignIn} disabled={busy} style={{ backgroundColor:"#111", padding:14, borderRadius:10, alignItems:"center" }}>
        <Text style={{ color:"#fff", fontWeight:"600" }}>{busy ? "Connexion…" : "Se connecter"}</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={onForgot} style={{ alignSelf:"flex-start", paddingVertical:8 }}>
        <Text style={{ color:"#2563eb" }}>Mot de passe oublié ?</Text>
      </TouchableOpacity>

      <View style={{ flexDirection:"row", gap:6 }}>
        <Text>Pas encore de compte ?</Text>
        <Link href="/(auth)/sign-up" style={{ color:"#2563eb", fontWeight:"600" }}>
          Créer un compte
        </Link>
      </View>
    </View>
  );
}