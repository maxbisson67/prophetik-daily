// app/(auth)/phone-login.js
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';

export default function PhoneLoginScreen() {
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [code, setCode]   = useState('');
  const [confirm, setConfirm] = useState(null);
  const [busy, setBusy] = useState(false);

  const canSend = /^\+\d{8,15}$/.test(phone.trim());

  const sendCode = async () => {
    try {
      setBusy(true);
      const c = await auth().signInWithPhoneNumber(phone.trim(), true);
      setConfirm(c);
      Alert.alert('Code envoyé', 'Vérifie tes SMS.');
    } catch (e) {
      Alert.alert('Erreur SMS', e?.message ?? 'Impossible d’envoyer le code.');
    } finally { setBusy(false); }
  };

  const confirmCode = async () => {
    try {
      setBusy(true);
      const cred = await confirm.confirm(code.trim()); // connecté ici
      const uid = cred?.user?.uid;
      if (!uid) throw new Error('Utilisateur introuvable.');

      // 🔎 N’autoriser l’accès que si le participant existe déjà
      const snap = await firestore().collection('participants').doc(uid).get();
      if (!snap.exists) {
        await auth().signOut();
        setConfirm(null);
        setCode('');
        Alert.alert(
          'Compte requis',
          "Ce numéro n'est pas associé à un compte existant. Crée d'abord un compte (SMS ou Email)."
        );
        return;
      }

      // Ok -> accueil
      router.replace('/(drawer)/(tabs)/AccueilScreen');
    } catch (e) {
      const msg = String(e?.message || e);
      if (msg.includes('invalid-verification-code')) {
        Alert.alert('Code invalide', 'Vérifie le code.');
      } else {
        Alert.alert('Échec de connexion', msg);
      }
    } finally { setBusy(false); }
  };

  return (
    <View style={{ flex:1, padding:16, justifyContent:'center', gap:12 }}>
      <Text style={{ fontSize:22, fontWeight:'800' }}>Se connecter par SMS</Text>

      {!confirm ? (
        <>
          <Text>Téléphone (format international)</Text>
          <TextInput
            placeholder="+15145551234"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            autoComplete="tel"
            style={{ borderWidth:1, borderRadius:10, padding:12 }}
          />
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