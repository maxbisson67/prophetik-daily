// app/(auth)/phone-login.js
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';

import functions from '@react-native-firebase/functions';

// --- Helpers E.164 ---
// Ajuste DEFAULT_COUNTRY à ton cas (p. ex. '+1' pour Canada/US, '+509' pour Haïti)
const DEFAULT_COUNTRY = '+1';
const E164 = /^\+\d{8,15}$/;

function normalizePhone(input) {
  if (!input) return '';
  const raw = String(input).trim();

  // Si l'utilisateur a déjà mis un '+', on garde uniquement chiffres derrière.
  if (raw.startsWith('+')) {
    const digits = raw.replace(/[^\d+]/g, '');
    return digits.replace(/\+(?=\+)/g, ''); // sécurité: un seul +
  }

  // Sinon on enlève tout sauf chiffres
  const digitsOnly = raw.replace(/\D+/g, '');

  // Heuristique par défaut: si 10 chiffres → +1XXXXXXXXXX, sinon on préfixe juste '+'
  if (digitsOnly.length === 10) return `${DEFAULT_COUNTRY}${digitsOnly}`;
  if (digitsOnly.length > 0)    return `+${digitsOnly}`;

  return '';
}

export default function PhoneLoginScreen() {
  const router = useRouter();
  const [phone, setPhone] = useState('');          // saisi par l’utilisateur (libre)
  const [code, setCode]   = useState('');
  const [confirm, setConfirm] = useState(null);
  const [busy, setBusy] = useState(false);

  // Active le bouton en fonction du numéro normalisé
  const normalized = normalizePhone(phone);
  const canSend = E164.test(normalized);

  const sendCode = async () => {
    try {
      if (!canSend) {
        Alert.alert('Numéro invalide', 'Entre un numéro valide (ex. 5145551234).');
        return;
      }
      setBusy(true);

      // 1) Pre-check côté serveur
      const precheck = functions().httpsCallable('precheckPhoneLogin'); // région us-central1 par défaut
      const { data } = await precheck({ phone: normalized });

      console.log("Retour de la fonction: " +data)

      if (!data?.allowed) {
        Alert.alert(
          'Compte requis',
          "Ce numéro n'est pas associé à un compte existant. Crée d'abord un compte (SMS ou Email)."
        );
        return;
      }

      // 2) Si autorisé → envoyer le SMS
      const c = await auth().signInWithPhoneNumber(normalized, true);
      setConfirm(c);
      setPhone(normalized); // optionnel, refléter l’E.164 dans l’UI
      Alert.alert('Code envoyé', 'Vérifie tes SMS.');
    } catch (e) {
      Alert.alert('Erreur SMS', e?.message ?? 'Impossible d’envoyer le code.');
    } finally {
      setBusy(false);
    }
  };

  const confirmCode = async () => {
    try {
      setBusy(true);
      const cred = await confirm.confirm(code.trim()); // l'utilisateur est connecté ici
      const uid = cred?.user?.uid;
      if (!uid) throw new Error('Utilisateur introuvable.');

      // Vérifie si le participant existe déjà
      const snap = await firestore().collection('participants').doc(uid).get();
      if (!snap.exists) {
        // Supprime le compte Auth fraîchement créé + déconnexion (bloque la création “accidentelle”)
        try {
          await auth().currentUser?.delete();
        } catch (e) {
          console.log('delete() failed:', e?.message || String(e));
        }
        await auth().signOut();
        setConfirm(null);
        setCode('');
        Alert.alert(
          'Compte requis',
          "Ce numéro n'est pas associé à un compte existant. Crée d'abord un compte (SMS ou Email)."
        );
        return;
      }

      // Ok → accueil
      router.replace('/(drawer)/(tabs)/AccueilScreen');
    } catch (e) {
      const msg = String(e?.message || e);
      if (msg.includes('invalid-verification-code')) {
        Alert.alert('Code invalide', 'Vérifie le code.');
      } else {
        Alert.alert('Échec de connexion', msg);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex:1, padding:16, justifyContent:'center', gap:12 }}>
      <Text style={{ fontSize:22, fontWeight:'800' }}>Se connecter par SMS</Text>

      {!confirm ? (
        <>
          <Text>Téléphone (tu peux écrire 5145551234)</Text>
          <TextInput
            placeholder="5145551234"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            autoComplete="tel"
            style={{ borderWidth:1, borderRadius:10, padding:12 }}
          />
          {/* Astuce UI: montrer la version qui sera envoyée */}
          {!!normalized && (
            <Text style={{ color:'#6B7280' }}>Envoi comme&nbsp;: {normalized}</Text>
          )}

          <TouchableOpacity
            onPress={sendCode}
            disabled={busy || !canSend}
            style={{ backgroundColor:'#111827', padding:14, borderRadius:10, alignItems:'center', opacity: busy || !canSend ? 0.6 : 1 }}
          >
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={{ color:'#fff', fontWeight:'800' }}>Recevoir le code</Text>}
          </TouchableOpacity>
        </>
      ) : (
        <>
          <Text>Code reçu par SMS</Text>
          <TextInput
            placeholder="123456"
            value={code}
            onChangeText={setCode}
            keyboardType="number-pad"
            maxLength={6}
            style={{ borderWidth:1, borderRadius:10, padding:12, letterSpacing:4 }}
          />
          <TouchableOpacity
            onPress={confirmCode}
            disabled={busy || code.trim().length < 4}
            style={{ backgroundColor:'#0ea5e9', padding:14, borderRadius:10, alignItems:'center', opacity: busy || code.trim().length < 4 ? 0.6 : 1 }}
          >
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={{ color:'#fff', fontWeight:'800' }}>Confirmer</Text>}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => { setConfirm(null); setCode(''); }}
            disabled={busy}
            style={{ padding: 10, alignItems:'center' }}
          >
            <Text>Changer de numéro / Renvoyer un code</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}