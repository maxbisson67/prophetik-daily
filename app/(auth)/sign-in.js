import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { auth } from '../../src/lib/firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';

export default function SignInScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSignIn() {
    if (!email || !pass) return Alert.alert('Champs requis', 'Entre ton courriel et ton mot de passe.');
    try {
      setLoading(true);
      await signInWithEmailAndPassword(auth, email.trim(), pass);
      setLoading(false);
      router.replace('/(tabs)/GroupsScreen'); // revient à GroupsScreen
    } catch (e) {
      setLoading(false);
      Alert.alert('Connexion échouée', e?.message || 'Vérifie tes informations.');
    }
  }

  async function onSignUp() {
    if (!email || !pass) return Alert.alert('Champs requis', 'Entre ton courriel et un mot de passe.');
    try {
      setLoading(true);
      await createUserWithEmailAndPassword(auth, email.trim(), pass);
      setLoading(false);
      router.back();
    } catch (e) {
      setLoading(false);
      Alert.alert('Création de compte échouée', e?.message || 'Réessaye avec un autre courriel.');
    }
  }

  return (
    <View style={{ flex: 1, padding: 16, gap: 12 }}>
      <Text style={{ fontSize: 22, fontWeight: '700', marginBottom: 8 }}>Se connecter</Text>

      <TextInput
        placeholder="Courriel"
        keyboardType="email-address"
        autoCapitalize="none"
        value={email}
        onChangeText={setEmail}
        style={{ borderWidth: 1, borderRadius: 10, padding: 12 }}
      />
      <TextInput
        placeholder="Mot de passe"
        secureTextEntry
        value={pass}
        onChangeText={setPass}
        style={{ borderWidth: 1, borderRadius: 10, padding: 12 }}
      />

      <TouchableOpacity
        disabled={loading}
        onPress={onSignIn}
        style={{ backgroundColor: '#111827', padding: 14, borderRadius: 12, alignItems: 'center' }}
      >
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={{ color: 'white', fontWeight: '600' }}>Connexion</Text>}
      </TouchableOpacity>

      <View style={{ alignItems: 'center', marginVertical: 6 }}>
        <Text style={{ color: '#6B7280' }}>— ou —</Text>
      </View>

      <TouchableOpacity
        disabled={loading}
        onPress={onSignUp}
        style={{ borderColor: '#111827', borderWidth: 1, padding: 14, borderRadius: 12, alignItems: 'center' }}
      >
        <Text style={{ fontWeight: '600' }}>Créer un compte</Text>
      </TouchableOpacity>
    </View>
  );
}