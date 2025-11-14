// src/credits/CreditsWallet.js
import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Alert, Pressable,Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
//import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from '@src/lib/firebase';

const PACKS = [
  { id: 'p25', credits: 25, priceCents: 500,  tag: 'Starter' },
  { id: 'p60', credits: 60, priceCents: 1200, tag: 'Populaire' },
  { id: 'p140', credits: 140, priceCents: 2500, tag: 'Meilleure valeur' },
];

const fmtPrice = (cents) => (cents/100).toLocaleString('fr-CA', { style:'currency', currency:'CAD' });

export default function CreditsWallet({ credits }) {
  const balance = useMemo(
    () => (typeof credits === 'number' ? credits : (credits?.balance ?? 0)),
    [credits]
  );

  const [loadingTopUp, setLoadingTopUp] = useState(false);
  const [buying, setBuying] = useState(false);
  const [selectedPack, setSelectedPack] = useState(PACKS[0]);

 
   async function callFreeTopUp(payload) {
    if (Platform.OS === 'web') {
      // Web → SDK Web (auth web requise !)
      const { getFunctions, httpsCallable } = await import('firebase/functions');
      const f = getFunctions(app, 'us-central1');
      const fn = httpsCallable(f, 'freeTopUp');
      return fn(payload);
    } else {
      // iOS/Android → RNFirebase (auth native transmise automatiquement)
      const functions = (await import('@react-native-firebase/functions')).default;
      const fn = functions().httpsCallable('freeTopUp');
      return fn(payload);
    }
  }

  const onFreeTopUp = async () => {
    try {
      setLoadingTopUp(true);
      const res = await callFreeTopUp({ delta: 25, reason: 'bonus_daily' });
      Alert.alert('🎉 Bonus crédité', `Nouveau solde: ${res?.data?.newBalance ?? 'mis à jour'}`);
    } catch (e) {
      Alert.alert('Oups', String(e?.message || e));
      console.log('[freeTopUp] error:', e);
    } finally {
      setLoadingTopUp(false);
    }
  };

  const onBuy = async () => {
    try {
      setBuying(true);
      // Branche ici ta CF checkout ex: createCreditCheckout({ packId,... })
      // const url = (await httpsCallable(getFunctions(app,'us-central1'),'createCreditCheckout')({
      //   packId: selectedPack.id, credits: selectedPack.credits, priceCents: selectedPack.priceCents,
      //   successUrl:'prophetik://credits/success', cancelUrl:'prophetik://credits/cancel'
      // })).data?.url;
      // if (url) Linking.openURL(url); else Alert.alert('Bientôt', 'Caisse non configurée.');

      Alert.alert('Bientôt', `Achat de ${selectedPack.credits} crédits (${fmtPrice(selectedPack.priceCents)})`);
    } catch (e) {
      Alert.alert('Paiement', String(e?.message || e));
    } finally {
      setBuying(false);
    }
  };

  return (
    <View
      style={{
        borderRadius: 18,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOpacity: 0.12,
        shadowRadius: 14,
        shadowOffset: { width: 0, height: 8 },
        elevation: 6,
      }}
    >
      {/* Bandeau solde */}
      <LinearGradient
        colors={['#111827', '#0f172a']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={{ padding: 18 }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View
            style={{
              width: 42, height: 42, borderRadius: 12,
              backgroundColor: 'rgba(255,255,255,0.08)',
              alignItems:'center', justifyContent:'center',
            }}
          >
            <MaterialCommunityIcons name="credit-card-outline" size={26} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color:'#9CA3AF', fontWeight:'700', letterSpacing: 0.4 }}>MON SOLDE</Text>
            <Text style={{ color:'#fff', fontWeight:'900', fontSize: 34, marginTop: 2 }}>
              {balance}
            </Text>
          </View>

          {/* Bonus gratuit */}
          <Pressable
            onPress={onFreeTopUp}
            disabled={loadingTopUp}
            style={({ pressed }) => ({
              opacity: loadingTopUp ? 0.6 : (pressed ? 0.85 : 1),
              backgroundColor: '#22c55e',
              paddingHorizontal: 14,
              paddingVertical: 10,
              borderRadius: 12,
            })}
          >
            {loadingTopUp
              ? <ActivityIndicator color="#fff" />
              : <Text style={{ color:'#fff', fontWeight:'800' }}>+25 Bonus</Text>}
          </Pressable>
        </View>
      </LinearGradient>

      {/* Corps : packs + action */}
      <View style={{ backgroundColor:'#fff', padding: 16 }}>
        <Text style={{ fontWeight:'900', fontSize:16, marginBottom: 10 }}>Acheter des crédits</Text>

        {/* Packs (chips) */}
        <View style={{ flexDirection:'row', gap:10, marginBottom: 14 }}>
          {PACKS.map((p) => {
            const active = selectedPack?.id === p.id;
            return (
              <TouchableOpacity
                key={p.id}
                onPress={() => setSelectedPack(p)}
                style={{
                  borderWidth: active ? 2 : 1,
                  borderColor: active ? '#111827' : '#E5E7EB',
                  backgroundColor: active ? '#F3F4F6' : '#FAFAFA',
                  paddingVertical: 10,
                  paddingHorizontal: 12,
                  borderRadius: 12,
                }}
              >
                <Text style={{ fontWeight:'800' }}>{p.credits} crédits</Text>
                <Text style={{ color:'#6B7280', fontSize:12 }}>{p.tag}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Résumé + bouton acheter */}
        <View
          style={{
            borderWidth:1, borderColor:'#E5E7EB', borderRadius: 14,
            padding: 12, backgroundColor:'#F9FAFB', flexDirection:'row',
            alignItems:'center', justifyContent:'space-between'
          }}
        >
          <View>
            <Text style={{ fontWeight:'800' }}>
              {selectedPack.credits} crédits
            </Text>
            <Text style={{ color:'#6B7280', marginTop:2 }}>
              {fmtPrice(selectedPack.priceCents)}
            </Text>
          </View>

          <Pressable
            onPress={onBuy}
            disabled={buying}
            style={({ pressed }) => ({
              backgroundColor:'#111827',
              paddingVertical: 12,
              paddingHorizontal: 18,
              borderRadius: 12,
              opacity: buying ? 0.6 : (pressed ? 0.85 : 1),
            })}
          >
            {buying
              ? <ActivityIndicator color="#fff" />
              : <Text style={{ color:'#fff', fontWeight:'900' }}>Acheter</Text>}
          </Pressable>
        </View>

        {/* Note confiance */}
        <Text style={{ color:'#6B7280', fontSize:12, marginTop:10 }}>
          Paiements sécurisés • Reçus envoyés par courriel • Crédits livrés instantanément
        </Text>
      </View>
    </View>
  );
}