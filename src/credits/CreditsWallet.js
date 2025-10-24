// src/credits/CreditsWallet.js
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from '@src/lib/firebase'; // assure-toi d’exporter "app" depuis ton init Firebase

export default function CreditsWallet({ credits }) {
  // Normalise: credits peut être un nombre OU { balance, updatedAt }
  const balance = typeof credits === 'number'
    ? credits
    : (credits?.balance ?? 0);

  const [loadingTopUp, setLoadingTopUp] = useState(false);

  const onFreeTopUp = async () => {
    try {
      setLoadingTopUp(true);
      const functions = getFunctions(app, 'us-central1'); // 👈 région de déploiement
      const freeTopUp = httpsCallable(functions, 'freeTopUp');
      const res = await freeTopUp({ delta: 25, reason: 'bonus_daily' });
      const newBalance = res?.data?.newBalance;
      // Pas besoin de forcer un setState ici si tu as un onSnapshot sur participants.
      Alert.alert('Crédits ajoutés', `Ton nouveau solde est ${newBalance ?? 'mis à jour'}.`);
    } catch (e) {
      // Affiche clairement l’erreur si rien ne “se passe”
      Alert.alert('Top-up impossible mon toi', String(e?.message || e));
      console.log('freeTopUp error', e);
    } finally {
      setLoadingTopUp(false);
    }
  };

  return (
    <View style={{ padding:12, backgroundColor:"#fafafa", borderRadius:12, borderWidth:1, borderColor:"#eee", gap:10 ,elevation:3}}>
      <Text style={{ fontWeight:"700", fontSize:16 }}>
        Crédits: {balance}
      </Text>

      <View style={{ flexDirection:"row", gap:8 }}>
        <TouchableOpacity
          onPress={onFreeTopUp}
          disabled={loadingTopUp}
          style={{
            backgroundColor: loadingTopUp ? '#9ca3af' : '#111',
            paddingHorizontal:14, paddingVertical:10, borderRadius:10
          }}
        >
          {loadingTopUp
            ? <ActivityIndicator color="#fff" />
            : <Text style={{ color:"#fff", fontWeight:"700" }}>Bonus gratuit +25</Text>}
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