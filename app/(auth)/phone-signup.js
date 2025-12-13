// app/(auth)/phone-signup.js
import React, { useState, useRef, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';

// i18n
import i18n from '@src/i18n/i18n';

// --- Helpers E.164 ---
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

function sanitizeDisplayName(s) {
  return String(s || '')
    .replace(/\s+/g, ' ')
    .replace(/[<>]/g, '')
    .trim()
    .slice(0, 48);
}

function stripUndefined(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj || {})) if (v !== undefined) out[k] = v;
  return out;
}

async function ensureParticipantDoc(displayNameRaw) {
  const user = auth().currentUser;
  if (!user) throw new Error(i18n.t('auth.phoneSignup.errors.notAuthenticated', { defaultValue: 'Not authenticated' }));

  const displayName = sanitizeDisplayName(displayNameRaw);
  const now = firestore.FieldValue.serverTimestamp();

  const payload = stripUndefined({
    displayName: displayName || user.displayName || null,
    phoneNumber: user.phoneNumber ?? null,
    email: user.email ?? null,
    photoURL: user.photoURL ?? null,
    createdAt: now,
    updatedAt: now,
  });

  await firestore().collection('participants').doc(user.uid).set(payload, { merge: true });
}

export default function PhoneSignUpScreen() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const confirmationRef = useRef(null);

  const normalized = useMemo(() => normalizePhone(phone), [phone]);
  const canSend = useMemo(() => E164.test(normalized), [normalized]);

  const requestCode = async () => {
    try {
      if (!displayName.trim()) {
        Alert.alert(
          i18n.t('auth.phoneSignup.errors.displayNameRequiredTitle', { defaultValue: 'Name required' }),
          i18n.t('auth.phoneSignup.errors.displayNameRequiredBody', { defaultValue: 'Enter a display name.' })
        );
        return;
      }

      if (!canSend) {
        Alert.alert(
          i18n.t('auth.phoneSignup.errors.invalidPhoneTitle', { defaultValue: 'Invalid phone number' }),
          i18n.t('auth.phoneSignup.errors.invalidPhoneBody', {
            defaultValue: 'Enter a valid number (e.g., 5145551234).',
          })
        );
        return;
      }

      setBusy(true);
      const confirmation = await auth().signInWithPhoneNumber(normalized, true);
      confirmationRef.current = confirmation;

      setStep(2);
      setPhone(normalized);

      Alert.alert(
        i18n.t('auth.phoneSignup.alerts.codeSentTitle', { defaultValue: 'Code sent' }),
        i18n.t('auth.phoneSignup.alerts.codeSentBody', {
          defaultValue: 'Check your SMS at {{phone}}.',
          phone: normalized,
        })
      );
    } catch (e) {
      Alert.alert(
        i18n.t('auth.phoneSignup.alerts.sendFailedTitle', { defaultValue: 'Send failed' }),
        e?.message || String(e)
      );
    } finally {
      setBusy(false);
    }
  };

  const confirmCode = async () => {
    try {
      if (!code.trim() || code.trim().length < 4) {
        Alert.alert(
          i18n.t('auth.phoneSignup.errors.codeRequiredTitle', { defaultValue: 'Code required' }),
          i18n.t('auth.phoneSignup.errors.codeRequiredBody', { defaultValue: 'Enter the code you received by SMS.' })
        );
        return;
      }

      setBusy(true);

      const confirmation = confirmationRef.current;
      if (!confirmation) {
        Alert.alert(
          i18n.t('auth.phoneSignup.errors.sessionExpiredTitle', { defaultValue: 'Session expired' }),
          i18n.t('auth.phoneSignup.errors.sessionExpiredBody', { defaultValue: 'Try sending the code again.' })
        );
        setStep(1);
        return;
      }

      const cred = await confirmation.confirm(code.trim());
      const user = cred?.user || auth().currentUser;
      if (!user) {
        throw new Error(
          i18n.t('auth.phoneSignup.errors.userUnavailable', {
            defaultValue: 'User not available after confirmation.',
          })
        );
      }

      const cleanName = sanitizeDisplayName(displayName);
      if (cleanName && user.displayName !== cleanName) {
        await user.updateProfile({ displayName: cleanName }).catch(() => {});
        await auth().currentUser?.reload().catch(() => {});
      }

      // 1) Crée / met à jour le doc participant de base
      await ensureParticipantDoc(cleanName);

      // 2) Initialise l'onboarding si pas encore fait
      await firestore()
        .collection('participants')
        .doc(user.uid)
        .set(
          {
            onboarding: { welcomeSeen: false },
            updatedAt: firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );

      Alert.alert(
        i18n.t('auth.phoneSignup.alerts.welcomeTitle', { defaultValue: 'Welcome!' }),
        i18n.t('auth.phoneSignup.alerts.welcomeBody', { defaultValue: 'Your account has been created.' })
      );

      // 3) Envoie directement vers l'onboarding
      router.replace('/onboarding/welcome');
    } catch (e) {
      const msg = String(e?.message || e);

      if (msg.includes('invalid-verification-code')) {
        Alert.alert(
          i18n.t('auth.phoneSignup.errors.invalidCodeTitle', { defaultValue: 'Invalid code' }),
          i18n.t('auth.phoneSignup.errors.invalidCodeBody', { defaultValue: 'Check the code and try again.' })
        );
      } else if (msg.includes('session-expired')) {
        Alert.alert(
          i18n.t('auth.phoneSignup.errors.sessionExpiredTitle', { defaultValue: 'Session expired' }),
          i18n.t('auth.phoneSignup.errors.sessionExpiredBody2', { defaultValue: 'Request a new code.' })
        );
        setStep(1);
        confirmationRef.current = null;
      } else {
        Alert.alert(
          i18n.t('auth.phoneSignup.errors.verifyFailedTitle', { defaultValue: 'Verification failed' }),
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
          title: i18n.t('auth.phoneSignup.title', { defaultValue: 'Create account (SMS)' }),
        }}
      />
      <SafeAreaView style={{ flex: 1 }}>
        <View style={{ flex: 1, padding: 16, gap: 16 }}>
          {step === 1 ? (
            <View style={{ gap: 14 }}>
              <Text style={{ fontSize: 22, fontWeight: '800' }}>
                {i18n.t('auth.phoneSignup.step1.h1', { defaultValue: 'SMS sign up' })}
              </Text>
              <Text style={{ color: '#6B7280' }}>
                {i18n.t('auth.phoneSignup.step1.subtitle', {
                  defaultValue:
                    'Enter a display name and your phone number (e.g., 5145551234 or +15145551234).',
                })}
              </Text>

              <View style={{ gap: 6 }}>
                <Text>
                  {i18n.t('auth.phoneSignup.step1.displayNameLabel', {
                    defaultValue: 'Display name',
                  })}
                </Text>
                <TextInput
                  value={displayName}
                  onChangeText={setDisplayName}
                  placeholder={i18n.t('auth.phoneSignup.step1.displayNamePlaceholder', {
                    defaultValue: 'Your name',
                  })}
                  autoCapitalize="words"
                  style={{ borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 12 }}
                />
              </View>

              <View style={{ gap: 6 }}>
                <Text>
                  {i18n.t('auth.phoneSignup.step1.phoneLabel', { defaultValue: 'Phone' })}
                </Text>
                <TextInput
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                  placeholder={i18n.t('auth.phoneSignup.step1.phonePlaceholder', {
                    defaultValue: '5145551234',
                  })}
                  autoCapitalize="none"
                  style={{ borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 12 }}
                />
                {!!normalized && (
                  <Text style={{ color: '#6B7280' }}>
                    {i18n.t('auth.phoneSignup.step1.sendingAs', {
                      defaultValue: 'Sending as: {{phone}}',
                      phone: normalized,
                    })}
                  </Text>
                )}
              </View>

              <TouchableOpacity
                disabled={busy || !canSend}
                onPress={requestCode}
                style={{
                  backgroundColor: '#111',
                  paddingVertical: 14,
                  borderRadius: 12,
                  alignItems: 'center',
                  opacity: busy || !canSend ? 0.7 : 1,
                }}
              >
                {busy ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={{ color: '#fff', fontWeight: '800' }}>
                    {i18n.t('auth.phoneSignup.step1.sendCodeCta', { defaultValue: 'Send code' })}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          ) : (
            <View style={{ gap: 14 }}>
              <Text style={{ fontSize: 22, fontWeight: '800' }}>
                {i18n.t('auth.phoneSignup.step2.h1', { defaultValue: 'Code verification' })}
              </Text>
              <Text style={{ color: '#6B7280' }}>
                {i18n.t('auth.phoneSignup.step2.subtitle', {
                  defaultValue: 'An SMS code was sent to {{phone}}.',
                  phone,
                })}
              </Text>

              <View style={{ gap: 6 }}>
                <Text>
                  {i18n.t('auth.phoneSignup.step2.codeLabel', { defaultValue: 'SMS code' })}
                </Text>
                <TextInput
                  value={code}
                  onChangeText={setCode}
                  keyboardType="number-pad"
                  placeholder={i18n.t('auth.phoneSignup.step2.codePlaceholder', { defaultValue: '123456' })}
                  maxLength={6}
                  style={{
                    borderWidth: 1,
                    borderColor: '#ddd',
                    borderRadius: 10,
                    padding: 12,
                    letterSpacing: 4,
                  }}
                />
              </View>

              <TouchableOpacity
                onPress={confirmCode}
                disabled={busy}
                style={{
                  backgroundColor: '#111',
                  padding: 14,
                  borderRadius: 10,
                  alignItems: 'center',
                  opacity: busy ? 0.7 : 1,
                }}
              >
                {busy ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={{ color: '#fff', fontWeight: '700' }}>
                    {i18n.t('auth.phoneSignup.step2.confirmCta', { defaultValue: 'Confirm' })}
                  </Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  setStep(1);
                  setCode('');
                }}
                disabled={busy}
                style={{ paddingVertical: 12, alignItems: 'center' }}
              >
                <Text style={{ color: '#111' }}>
                  {i18n.t('auth.phoneSignup.step2.changeNumberCta', {
                    defaultValue: 'Change number / Resend code',
                  })}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </SafeAreaView>
    </>
  );
}