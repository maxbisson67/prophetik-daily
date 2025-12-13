// app/(auth)/phone-login.js
import React, { useState, useMemo } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import functions from '@react-native-firebase/functions';

// i18n
import i18n from '@src/i18n/i18n';

// --- Helpers E.164 ---
// Ajuste DEFAULT_COUNTRY à ton cas (p. ex. '+1' pour Canada/US, '+509' pour Haïti)
const DEFAULT_COUNTRY = '+1';
const E164 = /^\+\d{8,15}$/;

function normalizePhone(input) {
  if (!input) return '';
  const raw = String(input).trim();

  if (raw.startsWith('+')) {
    const digits = raw.replace(/[^\d+]/g, '');
    return digits.replace(/\+(?=\+)/g, '');
  }

  const digitsOnly = raw.replace(/\D+/g, '');

  if (digitsOnly.length === 10) return `${DEFAULT_COUNTRY}${digitsOnly}`;
  if (digitsOnly.length > 0) return `+${digitsOnly}`;

  return '';
}

export default function PhoneLoginScreen() {
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [confirm, setConfirm] = useState(null);
  const [busy, setBusy] = useState(false);

  const normalized = useMemo(() => normalizePhone(phone), [phone]);
  const canSend = useMemo(() => E164.test(normalized), [normalized]);

  const goHome = () => router.replace('/(drawer)/(tabs)/AccueilScreen');

  const sendCode = async () => {
    try {
      if (!canSend) {
        Alert.alert(
          i18n.t('auth.phoneLogin.invalidPhoneTitle', { defaultValue: 'Invalid phone number' }),
          i18n.t('auth.phoneLogin.invalidPhoneBody', {
            defaultValue: 'Enter a valid number (e.g., 5145551234).',
          })
        );
        return;
      }

      setBusy(true);

      // 1) Pre-check côté serveur
      const precheck = functions().httpsCallable('precheckPhoneLogin');
      const { data } = await precheck({ phone: normalized });

      if (!data?.allowed) {
        Alert.alert(
          i18n.t('auth.phoneLogin.accountRequiredTitle', { defaultValue: 'Account required' }),
          i18n.t('auth.phoneLogin.accountRequiredBody', {
            defaultValue:
              "This number isn't linked to an existing account. Create an account first (SMS or Email).",
          })
        );
        return;
      }

      // 2) Si autorisé → envoyer le SMS
      const c = await auth().signInWithPhoneNumber(normalized, true);
      setConfirm(c);
      setPhone(normalized);

      Alert.alert(
        i18n.t('auth.phoneLogin.codeSentTitle', { defaultValue: 'Code sent' }),
        i18n.t('auth.phoneLogin.codeSentBody', { defaultValue: 'Check your SMS.' })
      );
    } catch (e) {
      Alert.alert(
        i18n.t('auth.phoneLogin.smsErrorTitle', { defaultValue: 'SMS error' }),
        e?.message ??
          i18n.t('auth.phoneLogin.smsErrorBody', { defaultValue: "Couldn't send the code." })
      );
    } finally {
      setBusy(false);
    }
  };

  const confirmCode = async () => {
    try {
      setBusy(true);

      const cred = await confirm.confirm(code.trim());
      const uid = cred?.user?.uid;
      if (!uid) throw new Error(i18n.t('auth.phoneLogin.userNotFound', { defaultValue: 'User not found.' }));

      // Vérifie si le participant existe déjà
      const snap = await firestore().collection('participants').doc(uid).get();
      if (!snap.exists) {
        try {
          await auth().currentUser?.delete();
        } catch (e) {
          console.log('delete() failed:', e?.message || String(e));
        }
        await auth().signOut();
        setConfirm(null);
        setCode('');

        Alert.alert(
          i18n.t('auth.phoneLogin.accountRequiredTitle', { defaultValue: 'Account required' }),
          i18n.t('auth.phoneLogin.accountRequiredBody', {
            defaultValue:
              "This number isn't linked to an existing account. Create an account first (SMS or Email).",
          })
        );
        return;
      }

      goHome();
    } catch (e) {
      const msg = String(e?.message || e);

      if (msg.includes('invalid-verification-code')) {
        Alert.alert(
          i18n.t('auth.phoneLogin.invalidCodeTitle', { defaultValue: 'Invalid code' }),
          i18n.t('auth.phoneLogin.invalidCodeBody', { defaultValue: 'Double-check the code.' })
        );
      } else {
        Alert.alert(
          i18n.t('auth.phoneLogin.signInFailedTitle', { defaultValue: 'Sign-in failed' }),
          msg
        );
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: i18n.t('auth.phoneLogin.title', { defaultValue: 'Sign in by SMS' }),
          headerShown: true,
        }}
      />

      <View style={{ flex: 1, padding: 16, justifyContent: 'center', gap: 12 }}>
        <Text style={{ fontSize: 22, fontWeight: '800' }}>
          {i18n.t('auth.phoneLogin.h1', { defaultValue: 'Sign in by SMS' })}
        </Text>

        {!confirm ? (
          <>
            <Text>
              {i18n.t('auth.phoneLogin.phoneLabel', {
                defaultValue: 'Phone (you can type 5145551234)',
              })}
            </Text>

            <TextInput
              placeholder={i18n.t('auth.phoneLogin.phonePlaceholder', {
                defaultValue: '5145551234',
              })}
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              autoComplete="tel"
              style={{ borderWidth: 1, borderRadius: 10, padding: 12 }}
            />

            {!!normalized && (
              <Text style={{ color: '#6B7280' }}>
                {i18n.t('auth.phoneLogin.sendingAs', {
                  defaultValue: 'Sending as: {{phone}}',
                  phone: normalized,
                })}
              </Text>
            )}

            <TouchableOpacity
              onPress={sendCode}
              disabled={busy || !canSend}
              style={{
                backgroundColor: '#111827',
                padding: 14,
                borderRadius: 10,
                alignItems: 'center',
                opacity: busy || !canSend ? 0.6 : 1,
              }}
            >
              {busy ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={{ color: '#fff', fontWeight: '800' }}>
                  {i18n.t('auth.phoneLogin.receiveCodeCta', { defaultValue: 'Get code' })}
                </Text>
              )}
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text>
              {i18n.t('auth.phoneLogin.codeLabel', { defaultValue: 'Code received by SMS' })}
            </Text>

            <TextInput
              placeholder={i18n.t('auth.phoneLogin.codePlaceholder', {
                defaultValue: '123456',
              })}
              value={code}
              onChangeText={setCode}
              keyboardType="number-pad"
              maxLength={6}
              style={{ borderWidth: 1, borderRadius: 10, padding: 12, letterSpacing: 4 }}
            />

            <TouchableOpacity
              onPress={confirmCode}
              disabled={busy || code.trim().length < 4}
              style={{
                backgroundColor: '#0ea5e9',
                padding: 14,
                borderRadius: 10,
                alignItems: 'center',
                opacity: busy || code.trim().length < 4 ? 0.6 : 1,
              }}
            >
              {busy ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={{ color: '#fff', fontWeight: '800' }}>
                  {i18n.t('auth.phoneLogin.confirmCta', { defaultValue: 'Confirm' })}
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                setConfirm(null);
                setCode('');
              }}
              disabled={busy}
              style={{ padding: 10, alignItems: 'center' }}
            >
              <Text>
                {i18n.t('auth.phoneLogin.changeNumberCta', {
                  defaultValue: 'Change number / Resend code',
                })}
              </Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </>
  );
}