// app/firebaseauth/link.js
import { useEffect } from "react";
import { useRouter, useLocalSearchParams } from "expo-router";
import { ActivityIndicator, View, Text } from "react-native";

export default function FirebaseAuthLink() {
  const router = useRouter();
  const params = useLocalSearchParams();

  useEffect(() => {
    // 🔥 HOTFIX : ne plus envoyer systématiquement vers auth-choice
    // -> Pour l’instant, on revient simplement à l’écran précédent.
    //    Comme ça, si ce screen est appelé en plein phone-login,
    //    tu restes dans ton flow.
    router.back();

    // Variante possible si tu préfères :
    // router.replace("/(auth)/phone-login");
  }, [router]);

  return (
    <View style={{ flex:1, justifyContent:'center', alignItems:'center' }}>
      <ActivityIndicator />
      <Text style={{ marginTop:10 }}>Traitement du lien…</Text>
    </View>
  );
}