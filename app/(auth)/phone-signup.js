// app/(auth)/phone-signup.js
import React, { useState, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, SafeAreaView, ActivityIndicator } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';

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
    // ne pas toucher à credits/balance côté client (tes règles l’interdisent)
  });

  await firestore().collection('participants').doc(user.uid).set(payload, { merge: true });
}

export default function PhoneSignUpScreen() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState(''); // e.g. +15145551234
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const confirmationRef = useRef(null);

  const normalizePhone = (raw) => raw.replace(/\s+/g, '');

  const requestCode = async () => {
    try {
      if (!displayName.trim()) {
        Alert.alert('Nom requis', 'Entre un nom d’affichage.');
        return;
      }
      const p = normalizePhone(phone);
      if (!/^\+\d{8,15}$/.test(p)) {
        Alert.alert('Numéro invalide', 'Utilise le format international E.164, ex. +15145551234');
        return;
      }
      setBusy(true);
      const confirmation = await auth().signInWithPhoneNumber(p); // recaptcha natif par RNFirebase
      confirmationRef.current = confirmation;
      setStep(2);
      Alert.alert('Code envoyé', 'Vérifie tes SMS et entre le code.');
    } catch (e) {
      const msg = String(e?.message || e);
      if (msg.includes('not authorized')) {
        Alert.alert('Configuration requise', 'Vérifie la configuration Firebase Phone Auth.');
      } else if (msg.includes('TOO_SHORT') || msg.includes('format')) {
        Alert.alert('Numéro invalide', 'Le numéro semble invalide.');
      } else {
        Alert.alert('Échec de l’envoi', msg);
      }
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

      const cred = await confirmation.confirm(code.trim()); // connecte l’utilisateur
      const user = cred?.user || auth().currentUser;
      if (!user) throw new Error('Utilisateur non disponible après confirmation.');

      const cleanName = sanitizeDisplayName(displayName);
      if (cleanName && user.displayName !== cleanName) {
        await user.updateProfile({ displayName: cleanName }).catch(() => {});
        await auth().currentUser?.reload().catch(() => {});
      }

      // ✅ IMPORTANT: appeler avec un seul argument (displayName)
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
                Entre un nom d’affichage et ton numéro (format international, ex. +15145551234).
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
                <Text>Téléphone (E.164)</Text>
                <TextInput
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                  placeholder="+15145551234"
                  autoCapitalize="none"
                  style={{ borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 12 }}
                />
              </View>

              <TouchableOpacity
                onPress={requestCode}
                disabled={busy}
                style={{ backgroundColor: '#111', padding: 14, borderRadius: 10, alignItems: 'center', opacity: busy ? 0.7 : 1 }}
              >
                {busy ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '700' }}>Envoyer le code</Text>}
              </TouchableOpacity>
            </View>
          ) : (
            <View style={{ gap: 14 }}>
              <Text style={{ fontSize: 22, fontWeight: '800' }}>Vérification du code</Text>
              <Text style={{ color: '#6B7280' }}>
                Un code SMS a été envoyé à <Text style={{ fontWeight: '700' }}>{normalizePhone(phone)}</Text>.
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
                style={{ padding: 12, alignItems: 'center' }}
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