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

// i18n
import i18n from '@src/i18n/i18n';

const PACKS = [
  { id: 'p25', credits: 25, priceCents: 500, tagKey: 'credits.wallet.packs.starter', tagFallback: 'Starter' },
  { id: 'p60', credits: 60, priceCents: 1200, tagKey: 'credits.wallet.packs.popular', tagFallback: 'Popular' },
  { id: 'p140', credits: 140, priceCents: 2500, tagKey: 'credits.wallet.packs.bestValue', tagFallback: 'Best value' },
];

// format CAD selon langue
const fmtPrice = (cents) => {
  const amount = (Number(cents) || 0) / 100;
  const locale = i18n?.locale || i18n?.language || 'fr-CA';
  try {
    return amount.toLocaleString(locale, { style: 'currency', currency: 'CAD' });
  } catch {
    return amount.toLocaleString('fr-CA', { style: 'currency', currency: 'CAD' });
  }
};

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
      i18n.t('credits.wallet.bonusSuccessTitle', {
        defaultValue: '🎉 Bonus credited',
      }),
      i18n.t('credits.wallet.bonusSuccessBody', {
        defaultValue:
          'You just received +{{amount}} credits.\nYour balance will update shortly.',
        amount: Number(awarded),
      })
    );
    } catch (e) {
      console.log('[freeTopUp] error:', e);

      const code = e?.code || '';
      const message = e?.message || String(e);
      const details = e?.details || {};

      if (code === 'failed-precondition' && details.nextAvailableDay) {
        const nextDay = details.nextAvailableDay; // ex: "2025-11-30"

        Alert.alert(
          i18n.t('credits.wallet.bonusAlreadyUsedTitle', {
            defaultValue: 'Bonus already used',
          }),
          i18n.t('credits.wallet.bonusAlreadyUsedBody', {
            defaultValue:
              'You have already used your bonus recently.\nYou can request it again starting {{date}}.',
            date: nextDay,
          })
        );
        setLoadingTopUp(false);
        return;
      }

      if (code === 'unauthenticated') {
        Alert.alert(
          i18n.t('credits.wallet.loginRequiredTitle', 'Sign-in required'),
          i18n.t('credits.wallet.loginRequiredBody', 'You must be logged in to request a credit bonus.')
        );
        setLoadingTopUp(false);
        return;
      }

      Alert.alert(i18n.t('common.unknownError', 'Unknown error'), message);
    } finally {
      setLoadingTopUp(false);
    }
  };

  const onBuy = async () => {
    try {
      setBuying(true);
      // TODO: branchement avec ta CF de checkout (Stripe / autre)
    Alert.alert(
      i18n.t('credits.wallet.comingSoonTitle', { defaultValue: 'Coming soon' }),
      i18n.t('credits.wallet.comingSoonBody', {
        defaultValue: 'Purchase of {{credits}} credits ({{price}})',
        credits: Number(selectedPack.credits),
        price: fmtPrice(selectedPack.priceCents),
      })
    );
    } catch (e) {
      Alert.alert(i18n.t('credits.wallet.paymentTitle', 'Payment'), String(e?.message || e));
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
        colors={['#020617', '#0f172a']}
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
              {i18n.t('credits.wallet.balanceLabel', 'MY BALANCE')}
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
              <Text style={{ color: '#fff', fontWeight: '800' }}>
                {i18n.t('credits.wallet.bonusButton', '+25 Bonus')}
              </Text>
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
          {i18n.t('credits.wallet.buyTitle', 'Buy credits')}
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
                  {i18n.t('credits.wallet.creditsLabel', {
                    defaultValue: '{{count}} credits',
                    count: Number(p.credits),
                  })}
                </Text>
                <Text style={{ color: colors.subtext, fontSize: 12 }}>
                  {i18n.t(p.tagKey, p.tagFallback)}
                </Text>
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
              {i18n.t('credits.wallet.creditsLabel', {
                defaultValue: '{{count}} credits',
                count: Number(selectedPack.credits),
              })}
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
              <Text style={{ color: '#fff', fontWeight: '900' }}>
                {i18n.t('credits.wallet.buyButton', 'Buy')}
              </Text>
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
          {i18n.t(
            'credits.wallet.footerNote',
            'Secure payments • Receipts by email • Credits delivered instantly'
          )}
        </Text>
      </View>
    </View>
  );
}