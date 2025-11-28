// src/credits/CreditsWallet.js
import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Pressable,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { app } from '@src/lib/firebase';
import { useTheme } from '@src/theme/ThemeProvider';

const PACKS = [
  { id: 'p25', credits: 25, priceCents: 500, tag: 'Starter' },
  { id: 'p60', credits: 60, priceCents: 1200, tag: 'Populaire' },
  { id: 'p140', credits: 140, priceCents: 2500, tag: 'Meilleure valeur' },
];

const fmtPrice = (cents) =>
  (cents / 100).toLocaleString('fr-CA', { style: 'currency', currency: 'CAD' });

function AmountPill({ amount }) {
  const { colors } = useTheme();
  const n = Number(amount) || 0;
  const isPlus = n > 0;
  const isMinus = n < 0;

  const isDark = colors.background === '#111827';

  let bg, fg;
  if (isPlus) {
    bg = isDark ? '#022c22' : '#ECFDF5';
    fg = isDark ? '#6ee7b7' : '#065F46';
  } else if (isMinus) {
    bg = isDark ? '#7f1d1d' : '#FEF2F2';
    fg = isDark ? '#fecaca' : '#991B1B';
  } else {
    bg = isDark ? '#111827' : '#F3F4F6';
    fg = isDark ? colors.text : '#374151';
  }

  return (
    <View
      style={{
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 999,
        backgroundColor: bg,
      }}
    >
      <Text style={{ color: fg, fontWeight: '800' }}>{n > 0 ? `+${n}` : n}</Text>
    </View>
  );
}

function RowIcon({ name, tint }) {
  const { colors } = useTheme();
  const isDark = colors.background === '#111827';

  let color;
  if (tint === 'in') {
    color = isDark ? '#6ee7b7' : '#047857';
  } else if (tint === 'out') {
    color = isDark ? '#fecaca' : '#B91C1C';
  } else {
    color = isDark ? '#9ca3af' : '#6B7280';
  }

  return <MaterialCommunityIcons name={name} size={20} color={color} />;
}

export default function CreditsWallet({ credits }) {
  const { colors } = useTheme();

  const balance = useMemo(
    () => (typeof credits === 'number' ? credits : credits?.balance ?? 0),
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

  const isDark = colors.background === '#111827';

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
        backgroundColor: colors.card,
      }}
    >
      {/* Bandeau solde */}
      <LinearGradient
        colors={['#020617', '#0f172a']} // bandeau sombre, OK dans les 2 thèmes
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
            <Text
              style={{
                color: '#9CA3AF',
                fontWeight: '700',
                letterSpacing: 0.4,
              }}
            >
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
      <View style={{ backgroundColor: colors.card, padding: 16 }}>
        <Text
          style={{
            fontWeight: '900',
            fontSize: 16,
            marginBottom: 10,
            color: colors.text,
          }}
        >
          Acheter des crédits
        </Text>

        {/* Packs (chips) */}
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
          {PACKS.map((p) => {
            const active = selectedPack?.id === p.id;
            const borderColor = active ? colors.text : colors.border;
            const bg = active ? (isDark ? '#111827' : colors.card2) : colors.card;

            return (
              <TouchableOpacity
                key={p.id}
                onPress={() => setSelectedPack(p)}
                style={{
                  borderWidth: active ? 2 : 1,
                  borderColor,
                  backgroundColor: bg,
                  paddingVertical: 10,
                  paddingHorizontal: 12,
                  borderRadius: 12,
                }}
              >
                <Text style={{ fontWeight: '800', color: colors.text }}>
                  {p.credits} crédits
                </Text>
                <Text style={{ color: colors.subtext, fontSize: 12 }}>{p.tag}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Résumé + bouton acheter */}
        <View
          style={{
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 14,
            padding: 12,
            backgroundColor: colors.card2,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <View>
            <Text style={{ fontWeight: '800', color: colors.text }}>
              {selectedPack.credits} crédits
            </Text>
            <Text style={{ color: colors.subtext, marginTop: 2 }}>
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

        <Text
          style={{
            color: colors.subtext,
            fontSize: 12,
            marginTop: 10,
          }}
        >
          Paiements sécurisés • Reçus envoyés par courriel • Crédits livrés instantanément
        </Text>
      </View>
    </View>
  );
}