// src/credits/CreditsWallet.js
import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Alert, Pressable, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { app } from '@src/lib/firebase';

const PACKS = [
  { id: 'p25', credits: 25, priceCents: 500,  tag: 'Starter' },
  { id: 'p60', credits: 60, priceCents: 1200, tag: 'Populaire' },
  { id: 'p140', credits: 140, priceCents: 2500, tag: 'Meilleure valeur' },
];

const fmtPrice = (cents) =>
  (cents / 100).toLocaleString('fr-CA', { style: 'currency', currency: 'CAD' });

export default function CreditsWallet({ credits }) {
  const balance = useMemo(
    () => (typeof credits === 'number' ? credits : (credits?.balance ?? 0)),
    [credits]
  );

  const [loadingTopUp, setLoadingTopUp] = useState(false);
  const [buying, setBuying] = useState(false);
  const [selectedPack, setSelectedPack] = useState(PACKS[0]);

  // Appel cross-platform de la CF freeTopUp
  async function callFreeTopUp(payload) {
    if (Platform.OS === 'web') {
      const { getFunctions, httpsCallable } = await import('firebase/functions');
      const f = getFunctions(app, 'us-central1');
      const fn = httpsCallable(f, 'freeTopUp');
      return fn(payload);
    } else {
      const functions = (await import('@react-native-firebase/functions')).default;
      const fn = functions().httpsCallable('freeTopUp');
      return fn(payload);
    }
  }

  const onFreeTopUp = async () => {
    try {
      setLoadingTopUp(true);

      // La CF gère maintenant la règle "1 bonus / 10 jours"
      const res = await callFreeTopUp({
        delta: 25,
        reason: 'bonus_10days',
      });

      const awarded = res?.data?.amount ?? 25;

      Alert.alert(
        '🎉 Bonus crédité',
        `Tu viens de recevoir +${awarded} crédits.\nTon solde va se mettre à jour.`
      );
    } catch (e) {
      console.log('[freeTopUp] error:', e);

      const code = e?.code || '';
      const message = e?.message || String(e);
      const details = e?.details || {};

      // Cas "cooldown 10 jours" -> failed-precondition + nextAvailableDay
      if (code === 'failed-precondition' && details.nextAvailableDay) {
        const nextDay = details.nextAvailableDay; // ex: "2025-11-30"

        Alert.alert(
          'Bonus déjà utilisé',
          `Tu as déjà utilisé ton bonus récemment.\nTu pourras en redemander à partir du ${nextDay}.`
        );
        setLoadingTopUp(false);
        return;
      }

      if (code === 'unauthenticated') {
        Alert.alert(
          'Connexion requise',
          "Tu dois être connecté pour demander un bonus de crédits."
        );
        setLoadingTopUp(false);
        return;
      }

      Alert.alert('Oups', message);
    } finally {
      setLoadingTopUp(false);
    }
  };

  const onBuy = async () => {
    try {
      setBuying(true);
      // TODO: branchement avec ta CF de checkout (Stripe / autre)
      Alert.alert(
        'Bientôt',
        `Achat de ${selectedPack.credits} crédits (${fmtPrice(selectedPack.priceCents)})`
      );
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
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ padding: 18 }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View
            style={{
              width: 42,
              height: 42,
              borderRadius: 12,
              backgroundColor: 'rgba(255,255,255,0.08)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <MaterialCommunityIcons name="credit-card-outline" size={26} color="#fff" />
          </View>

          <View style={{ flex: 1 }}>
            <Text style={{ color: '#9CA3AF', fontWeight: '700', letterSpacing: 0.4 }}>
              MON SOLDE
            </Text>
            <Text
              style={{
                color: '#fff',
                fontWeight: '900',
                fontSize: 34,
                marginTop: 2,
              }}
            >
              {balance}
            </Text>
          </View>

          {/* Bonus gratuit (1 / 10 jours) */}
          <Pressable
            onPress={onFreeTopUp}
            disabled={loadingTopUp}
            style={({ pressed }) => ({
              opacity: loadingTopUp ? 0.6 : pressed ? 0.85 : 1,
              backgroundColor: '#22c55e',
              paddingHorizontal: 14,
              paddingVertical: 10,
              borderRadius: 12,
            })}
          >
            {loadingTopUp ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={{ color: '#fff', fontWeight: '800' }}>+25 Bonus</Text>
            )}
          </Pressable>
        </View>
      </LinearGradient>

      {/* Corps : packs + action */}
      <View style={{ backgroundColor: '#fff', padding: 16 }}>
        <Text style={{ fontWeight: '900', fontSize: 16, marginBottom: 10 }}>
          Acheter des crédits
        </Text>

        {/* Packs (chips) */}
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
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
                <Text style={{ fontWeight: '800' }}>{p.credits} crédits</Text>
                <Text style={{ color: '#6B7280', fontSize: 12 }}>{p.tag}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Résumé + bouton acheter */}
        <View
          style={{
            borderWidth: 1,
            borderColor: '#E5E7EB',
            borderRadius: 14,
            padding: 12,
            backgroundColor: '#F9FAFB',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <View>
            <Text style={{ fontWeight: '800' }}>{selectedPack.credits} crédits</Text>
            <Text style={{ color: '#6B7280', marginTop: 2 }}>
              {fmtPrice(selectedPack.priceCents)}
            </Text>
          </View>

          <Pressable
            onPress={onBuy}
            disabled={buying}
            style={({ pressed }) => ({
              backgroundColor: '#111827',
              paddingVertical: 12,
              paddingHorizontal: 18,
              borderRadius: 12,
              opacity: buying ? 0.6 : pressed ? 0.85 : 1,
            })}
          >
            {buying ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={{ color: '#fff', fontWeight: '900' }}>Acheter</Text>
            )}
          </Pressable>
        </View>

        <Text style={{ color: '#6B7280', fontSize: 12, marginTop: 10 }}>
          Paiements sécurisés • Reçus envoyés par courriel • Crédits livrés instantanément
        </Text>
      </View>
    </View>
  );
}