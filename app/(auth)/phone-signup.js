// app/(auth)/phone-signup.js
import React, { useState, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, SafeAreaView, ActivityIndicator } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';

// --- Helpers E.164 ---
// Par défaut on ajoute +1 pour Canada/USA (ajuste selon ton pays, ex: '+509' pour Haïti)
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
  return String(s || '').replace(/\s+/g, ' ').replace(/[<>]/g, '').trim().slice(0, 48);
}
function stripUndefined(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj || {})) if (v !== undefined) out[k] = v;
  return out;
}

async function ensureParticipantDoc(displayNameRaw) {
  const user = auth().currentUser;
  if (!user) throw new Error('Non authentifié');

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

  const normalized = normalizePhone(phone);
  const canSend = E164.test(normalized);

  const requestCode = async () => {
    try {
      if (!displayName.trim()) {
        Alert.alert('Nom requis', 'Entre un nom d’affichage.');
        return;
      }
      if (!canSend) {
        Alert.alert('Numéro invalide', 'Entre un numéro valide (ex. 5145551234).');
        return;
      }

      setBusy(true);
      const confirmation = await auth().signInWithPhoneNumber(normalized, true);
      confirmationRef.current = confirmation;
      setStep(2);
      setPhone(normalized); // reflète la normalisation dans l’UI
      Alert.alert('Code envoyé', `Vérifie tes SMS au ${normalized}.`);
    } catch (e) {
      Alert.alert('Échec de l’envoi', e?.message || String(e));
    } finally {
      setBusy(false);
    }
  };

  const confirmCode = async () => {
    try {
      if (!code.trim() || code.trim().length < 4) {
        Alert.alert('Code requis', 'Entre le code reçu par SMS.');
        return;
      }
      setBusy(true);

      const confirmation = confirmationRef.current;
      if (!confirmation) {
        Alert.alert('Session expirée', 'Réessaie l’envoi du code.');
        setStep(1);
        return;
      }

      const cred = await confirmation.confirm(code.trim());
      const user = cred?.user || auth().currentUser;
      if (!user) throw new Error('Utilisateur non disponible après confirmation.');

      const cleanName = sanitizeDisplayName(displayName);
      if (cleanName && user.displayName !== cleanName) {
        await user.updateProfile({ displayName: cleanName }).catch(() => {});
        await auth().currentUser?.reload().catch(() => {});
      }

      await ensureParticipantDoc(cleanName);

      Alert.alert('Bienvenue!', 'Ton compte a été créé.');
      router.replace('/(drawer)/(tabs)/AccueilScreen');
    } catch (e) {
      const msg = String(e?.message || e);
      if (msg.includes('invalid-verification-code')) {
        Alert.alert('Code invalide', 'Vérifie le code et réessaie.');
      } else if (msg.includes('session-expired')) {
        Alert.alert('Session expirée', 'Redemande un nouveau code.');
        setStep(1);
        confirmationRef.current = null;
      } else {
        Alert.alert('Échec de vérification', msg);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Créer un compte (SMS)' }} />
      <SafeAreaView style={{ flex: 1 }}>
        <View style={{ flex: 1, padding: 16, gap: 16 }}>
          {step === 1 ? (
            <View style={{ gap: 14 }}>
              <Text style={{ fontSize: 22, fontWeight: '800' }}>Inscription par SMS</Text>
              <Text style={{ color: '#6B7280' }}>
                Entre un nom d’affichage et ton numéro (ex. 5145551234 ou +15145551234).
              </Text>

              <View style={{ gap: 6 }}>
                <Text>Nom d’affichage</Text>
                <TextInput
                  value={displayName}
                  onChangeText={setDisplayName}
                  placeholder="Ton nom"
                  autoCapitalize="words"
                  style={{ borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 12 }}
                />
              </View>

              <View style={{ gap: 6 }}>
                <Text>Téléphone</Text>
                <TextInput
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                  placeholder="5145551234"
                  autoCapitalize="none"
                  style={{ borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 12 }}
                />
                {!!normalized && (
                  <Text style={{ color: '#6B7280' }}>Envoi comme : {normalized}</Text>
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
                  <Text style={{ color: '#fff', fontWeight: '800' }}>Envoyer le code</Text>
                )}
              </TouchableOpacity>
            </View>
          ) : (
            <View style={{ gap: 14 }}>
              <Text style={{ fontSize: 22, fontWeight: '800' }}>Vérification du code</Text>
              <Text style={{ color: '#6B7280' }}>
                Un code SMS a été envoyé à <Text style={{ fontWeight: '700' }}>{phone}</Text>.
              </Text>

              <View style={{ gap: 6 }}>
                <Text>Code reçu (SMS)</Text>
                <TextInput
                  value={code}
                  onChangeText={setCode}
                  keyboardType="number-pad"
                  placeholder="123456"
                  maxLength={6}
                  style={{ borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 12, letterSpacing: 4 }}
                />
              </View>

              <TouchableOpacity
                onPress={confirmCode}
                disabled={busy}
                style={{ backgroundColor: '#111', padding: 14, borderRadius: 10, alignItems: 'center', opacity: busy ? 0.7 : 1 }}
              >
                {busy ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '700' }}>Confirmer</Text>}
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => { setStep(1); setCode(''); }}
                disabled={busy}
                style={{ paddingVertical: 12, alignItems: 'center' }}
              >
                <Text style={{ color: '#111' }}>Changer de numéro / Renvoyer un code</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </SafeAreaView>
    </>
  );
}