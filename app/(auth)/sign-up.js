import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { getAuth, createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { createParticipantIfMissing } from '@src/participants/api';

export default function SignUpScreen() {
  const r = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSignUp() {
    try {
      setBusy(true);
      const auth = getAuth();
      const { user } = await createUserWithEmailAndPassword(auth, email.trim(), pass);
      // Optionnel: mettre displayName sur le profil auth
      await updateProfile(user, { displayName: name });

      // Créer le doc participants/{uid}
      await createParticipantIfMissing(user.uid, { name, email });

      Alert.alert('Bienvenue!', 'Compte créé avec succès.');
      r.replace('/'); // va sur la home/tabs
    } catch (e) {
      Alert.alert('Erreur', String(e?.message || e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={{ flex:1, padding:16, gap:12, justifyContent:'center' }}>
      <Text style={{ fontSize:22, fontWeight:'700' }}>Créer un compte</Text>
      <Text>Nom</Text>
      <TextInput
        value={name} onChangeText={setName} placeholder="Votre nom"
        style={{ backgroundColor:'#111', color:'#fff', padding:12, borderRadius:8 }}
      />
      <Text>Email</Text>
      <TextInput
        value={email} onChangeText={setEmail} inputMode="email" autoCapitalize="none"
        placeholder="vous@exemple.com"
        style={{ backgroundColor:'#111', color:'#fff', padding:12, borderRadius:8 }}
      />
      <Text>Mot de passe</Text>
      <TextInput
        value={pass} onChangeText={setPass} secureTextEntry placeholder="••••••••"
        style={{ backgroundColor:'#111', color:'#fff', padding:12, borderRadius:8 }}
      />
      <TouchableOpacity disabled={busy} onPress={onSignUp}
        style={{ marginTop:12, backgroundColor:'#0af', padding:14, borderRadius:12, alignItems:'center' }}>
        <Text style={{ fontWeight:'700' }}>{busy ? 'Création…' : 'Créer le compte'}</Text>
      </TouchableOpacity>
    </View>
  );
}