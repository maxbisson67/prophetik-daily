// src/credits/CreditsWallet.js
import { View, Text, ActivityIndicator, TouchableOpacity, Alert } from "react-native";
import { useCredits } from "./useCredits";

export default function CreditsWallet() {
  const { credits, loading, error, topUpFree } = useCredits();

  if (loading) {
    return (
      <View style={{ padding:12, backgroundColor:"#fafafa", borderRadius:12, borderWidth:1, borderColor:"#eee", alignItems:"center", gap:8 }}>
        <ActivityIndicator />
        <Text>Chargement du solde…</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={{ padding:12, backgroundColor:"#fff5f5", borderRadius:12, borderWidth:1, borderColor:"#ffd6d6" }}>
        <Text style={{ color:"#b00020" }}>Erreur: {String(error.message || error)}</Text>
      </View>
    );
  }

  return (
    <View style={{ padding:12, backgroundColor:"#fafafa", borderRadius:12, borderWidth:1, borderColor:"#eee", gap:10 }}>
      <Text style={{ fontWeight:"700", fontSize:16 }}>Crédits: {credits}</Text>

      <View style={{ flexDirection:"row", gap:8 }}>
        <TouchableOpacity
          onPress={async () => {
            try {
              const res = await topUpFree();
              Alert.alert("Top-up", `Nouveau solde: ${res.credits}`);
            } catch (e) {
              Alert.alert("Top-up impossible", String(e?.message || e));
            }
          }}
          style={{ flex:1, backgroundColor:"#111", padding:12, borderRadius:10, alignItems:"center" }}
        >
          <Text style={{ color:"#fff", fontWeight:"600" }}>+25 gratuits (bêta)</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => Alert.alert("Bientôt", "Achat (5$) à venir…")}
          style={{ flex:1, backgroundColor:"#f2f2f2", padding:12, borderRadius:10, alignItems:"center", borderWidth:1, borderColor:"#e5e5e5" }}
        >
          <Text style={{ fontWeight:"600" }}>Acheter (5$)</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}