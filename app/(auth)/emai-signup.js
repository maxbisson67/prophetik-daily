// app/(auth)/SignUpScreen.js
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import RNFBAuth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';

// Création / mise à jour du participant (côté client, sans toucher credits/balance)
async function ensureParticipantDoc(displayName) {
  const user = RNFBAuth().currentUser;
  if (!user) throw new Error('Utilisateur non authentifié.');

  const uid = user.uid;
  const now = firestore.FieldValue.serverTimestamp();

  // Évite les "Unsupported field value undefined"
  const data = {
    displayName: (displayName ?? user.displayName ?? null) || null,
    email: user.email ?? null,
    phoneNumber: user.phoneNumber ?? null,
    photoURL: user.photoURL ?? null,
    betaEligible: true,
    updatedAt: now,
  };

  // createdAt seulement à la création
  await firestore().collection('participants').doc(uid).set(
    { ...data, createdAt: now },
    { merge: true }
  );
}

export default function SignUpScreen() {
  const r = useRouter();
  const [email, setEmail] = useState('');
  const [pwd, setPwd] = useState('');
  const [pwd2, setPwd2] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [busy, setBusy] = useState(false);

  const onSignUp = async () => {
    try {
      if (!displayName.trim() || !email.trim() || !pwd || !pwd2) {
        Alert.alert('Champs requis', 'Nom, courriel et mot de passe sont requis.');
        return;
      }
      if (pwd.length < 6) {
        Alert.alert('Mot de passe trop court', 'Minimum 6 caractères.');
        return;
      }
      if (pwd !== pwd2) {
        Alert.alert('Mismatch', 'Les mots de passe ne correspondent pas.');
        return;
      }

      setBusy(true);

      // 1) Création du compte (RNFirebase)
      await RNFBAuth().createUserWithEmailAndPassword(email.trim(), pwd);

      // 2) Update profil Auth (displayName)
      const user = RNFBAuth().currentUser;
      await user?.updateProfile({ displayName: displayName.trim() });
      await user?.reload().catch(() => {}); // parfois nécessaire sous Android

      // 3) participants/{uid}
      await ensureParticipantDoc(displayName.trim());

      Alert.alert('Compte créé', 'Bienvenue !');
      r.replace('/(drawer)/(tabs)/AccueilScreen');
    } catch (e) {
      const msg = String(e?.message || e);
      if (msg.includes('email-already-in-use')) {
        Alert.alert('Création échouée', 'Ce courriel est déjà utilisé.');
      } else if (msg.includes('invalid-email')) {
        Alert.alert('Création échouée', 'Le format du courriel est invalide.');
      } else if (msg.includes('network')) {
        Alert.alert('Création échouée', 'Problème réseau. Réessaie.');
      } else {
        Alert.alert('Création échouée', msg);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1, padding: 16, gap: 12 }}>
      <Text style={{ fontSize: 22, fontWeight: '700' }}>Créer un compte</Text>

      {/* Nom */}
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

      {/* Email */}
      <View style={{ gap: 6 }}>
        <Text>Courriel</Text>
        <TextInput
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          placeholder="toi@exemple.com"
          style={{ borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 12 }}
        />
      </View>

      {/* Password */}
      <View style={{ gap: 6 }}>
        <Text>Mot de passe</Text>
        <TextInput
          value={pwd}
          onChangeText={setPwd}
          secureTextEntry
          placeholder="••••••••"
          style={{ borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 12 }}
        />
      </View>
      <View style={{ gap: 6 }}>
        <Text>Confirmer le mot de passe</Text>
        <TextInput
          value={pwd2}
          onChangeText={setPwd2}
          secureTextEntry
          placeholder="••••••••"
          style={{ borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 12 }}
        />
      </View>

      <TouchableOpacity
        onPress={onSignUp}
        disabled={busy}
        style={{
          backgroundColor: '#111', padding: 14, borderRadius: 10,
          alignItems: 'center', opacity: busy ? 0.7 : 1,
        }}
      >
        {busy
          ? <ActivityIndicator color="#fff" />
          : <Text style={{ color: '#fff', fontWeight: '600' }}>Créer le compte</Text>}
      </TouchableOpacity>
    </View>
  );
}