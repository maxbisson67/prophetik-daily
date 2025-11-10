// app/groups/create.js
import React, { useState, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  ActivityIndicator, Alert, BackHandler
} from 'react-native';
import {
  Stack, useRouter, useLocalSearchParams, useFocusEffect
} from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

// Safe auth
import { useAuth } from '@src/auth/SafeAuthProvider';

import { createGroupService } from '@src/groups/services';
import { db } from '@src/lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';

export default function CreateGroupScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const { from } = useLocalSearchParams();                 // ?from=onboarding
  const fromOnboarding = String(from || '') === 'onboarding';

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [creating, setCreating] = useState(false);

  // 🔙 Gestion du back (annule ou réinitialise onboarding)
  const safeBack = useCallback(async () => {
    if (fromOnboarding) {
      try {
        if (user?.uid) {
          await updateDoc(doc(db, 'participants', user.uid), {
            'onboarding.welcomeSeen': false,
          });
        }
      } catch (e) {
        console.log('Reset onboarding failed:', e?.message || e);
      }
      router.replace('/onboarding/welcome');
      return true;
    }

    if (router.canGoBack?.()) {
      router.back();
      return true;
    }

    // ✅ Redirige vers la bonne page de groupes (dans le Drawer)
    router.replace('/(drawer)/(tabs)/GroupsScreen');
    return true;
  }, [fromOnboarding, router, user?.uid]);

  // 🔙 Support bouton retour physique Android
  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener('hardwareBackPress', safeBack);
      return () => sub.remove();
    }, [safeBack])
  );

  // 🏗️ Création du groupe
  async function onCreate() {
    if (!user?.uid) return Alert.alert('Connexion requise', 'Connecte-toi d’abord.');
    if (!name.trim()) return Alert.alert('Nom requis', 'Donne un nom à ton groupe.');

    try {
      setCreating(true);
      const { groupId } = await createGroupService({
        name: name.trim(),
        description: description.trim(),
      });

      // 👉 Après création, on va directement sur la page du groupe
      router.replace({
        pathname: '/groups/[groupId]',
        params: { groupId },
      });
    } catch (e) {
      Alert.alert('Création échouée', String(e?.message || e));
    } finally {
      setCreating(false);
    }
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Créer un groupe',
          headerLeft: () => (
            <TouchableOpacity onPress={safeBack} style={{ paddingHorizontal: 10 }}>
              <Ionicons name="arrow-back" size={24} color="#111827" />
            </TouchableOpacity>
          ),
        }}
      />

      <View style={{ flex: 1, padding: 20, backgroundColor: '#f9fafb' }}>
        {/* 💥 En-tête inspirante */}
        <View
          style={{
            backgroundColor: '#fff',
            borderRadius: 14,
            padding: 20,
            marginBottom: 18,
            shadowColor: '#000',
            shadowOpacity: 0.1,
            shadowRadius: 8,
            shadowOffset: { width: 0, height: 3 },
            elevation: 3,
          }}
        >
          <Text style={{ fontSize: 22, fontWeight: '900', textAlign: 'center', color: '#111827' }}>
            🎯 Lance ton équipe de visionnaires !
          </Text>
          <Text
            style={{
              marginTop: 8,
              textAlign: 'center',
              color: '#374151',
              fontSize: 15,
              lineHeight: 22,
            }}
          >
            Crée un groupe, défie tes amis et prouve qui a le meilleur instinct
            pour prédire les performances des joueurs 🔥
          </Text>
        </View>

        {/* 🧩 Formulaire */}
        <View
          style={{
            backgroundColor: '#fff',
            borderRadius: 12,
            padding: 16,
            shadowColor: '#000',
            shadowOpacity: 0.05,
            shadowRadius: 4,
            elevation: 2,
          }}
        >
          <Text style={{ fontWeight: '700', fontSize: 16, marginBottom: 6 }}>Nom du groupe</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Ex. Les Snipers du Nord"
            style={{
              borderWidth: 1,
              borderColor: '#ddd',
              borderRadius: 10,
              padding: 12,
              marginBottom: 14,
              backgroundColor: '#fafafa',
            }}
          />

          <Text style={{ fontWeight: '700', fontSize: 16, marginBottom: 6 }}>Description</Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="Ex. Notre pool du samedi entre amis 🍻"
            style={{
              borderWidth: 1,
              borderColor: '#ddd',
              borderRadius: 10,
              padding: 12,
              marginBottom: 14,
              backgroundColor: '#fafafa',
            }}
            multiline
          />

          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TouchableOpacity
              onPress={safeBack}
              style={{
                flex: 1,
                padding: 14,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: '#111827',
                alignItems: 'center',
                backgroundColor: '#fff',
              }}
              disabled={creating}
            >
              <Text style={{ color: '#111827', fontWeight: '700' }}>Annuler</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={onCreate}
              style={{
                flex: 1,
                padding: 14,
                borderRadius: 10,
                alignItems: 'center',
                backgroundColor: '#ef4444',
              }}
              disabled={creating}
            >
              {creating ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={{ color: '#fff', fontWeight: '700' }}>Créer le groupe</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* 💬 Footer motivation */}
        <View style={{ marginTop: 24, alignItems: 'center' }}>
          <Text style={{ color: '#6b7280', fontSize: 13, textAlign: 'center', lineHeight: 20 }}>
            Une fois ton groupe créé, tu pourras inviter tes amis,
            lancer des défis et suivre vos points en direct 📊
          </Text>
        </View>
      </View>
    </>
  );
}