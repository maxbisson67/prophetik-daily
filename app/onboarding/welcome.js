// app/onboarding/welcome.js
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@src/lib/firebase';
// Safe auth
import { useAuth } from '@src/auth/SafeAuthProvider';

import { MaterialCommunityIcons } from '@expo/vector-icons';

const GROUP_PLACEHOLDER = require('@src/assets/group-placeholder.png');

export default function WelcomeOnboarding() {
  const router = useRouter();
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);

  // ✅ Met à jour Firestore + navigue vers la destination
  async function markSeenAndGo(nextPath) {
    if (!user?.uid) return router.replace('/'); // fallback

    try {
      setSaving(true);
      await setDoc(
        doc(db, 'participants', user.uid),
        {
          onboarding: { welcomeSeen: true },
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    } finally {
      setSaving(false);

      // Navigation corrigée selon nouvelle arbo
      if (nextPath) {
        router.replace(nextPath);
      } else {
        router.replace('/(drawer)/(tabs)/AccueilScreen');
      }
    }
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Bienvenue' }} />

      <View style={{ flex: 1, padding: 16, justifyContent: 'center' }}>
        {/* Hero */}
        <View
          style={{
            padding: 16,
            borderWidth: 1,
            borderRadius: 16,
            backgroundColor: '#fff',
            shadowColor: '#000',
            shadowOpacity: 0.08,
            shadowRadius: 8,
            shadowOffset: { width: 0, height: 4 },
          }}
        >
          <View style={{ alignItems: 'center' }}>
            <Image
              source={GROUP_PLACEHOLDER}
              style={{
                width: 120,
                height: 120,
                borderRadius: 60,
                backgroundColor: '#f3f4f6',
                marginBottom: 12,
              }}
            />
            <Text style={{ fontSize: 22, fontWeight: '900', textAlign: 'center' }}>
              Bienvenue sur Prophetik 🎉
            </Text>
            <Text style={{ marginTop: 8, color: '#374151', textAlign: 'center' }}>
              Crée ton premier groupe ou rejoins tes amis pour prédire et gagner des crédits.
            </Text>
          </View>

          {/* CTA zone */}
          <View style={{ marginTop: 16, gap: 10 }}>
            {/* Rejoindre un groupe */}
            <TouchableOpacity
              disabled={saving}
              onPress={() => markSeenAndGo('/groups/join?from=onboarding')}
              style={{
                backgroundColor: '#111827',
                paddingVertical: 14,
                borderRadius: 12,
                alignItems: 'center',
              }}
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={{ color: '#fff', fontWeight: '800' }}>Rejoindre un groupe</Text>
              )}
            </TouchableOpacity>

            {/* Créer un groupe */}
            <TouchableOpacity
              disabled={saving}
              onPress={() => markSeenAndGo('/groups/create?from=onboarding')}
              style={{
                borderWidth: 1,
                borderColor: '#111827',
                paddingVertical: 14,
                borderRadius: 12,
                alignItems: 'center',
                backgroundColor: '#fff',
              }}
            >
              <Text style={{ color: '#111827', fontWeight: '800' }}>Créer un groupe</Text>
            </TouchableOpacity>

            {/* Option “Plus tard” */}
            <TouchableOpacity
              disabled={saving}
              onPress={() => markSeenAndGo(null)}
              style={{ paddingVertical: 12, alignItems: 'center' }}
            >
              <Text style={{ color: '#6b7280' }}>Plus tard</Text>
            </TouchableOpacity>
          </View>

          {/* Points clés */}
          <View style={{ marginTop: 16, gap: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <MaterialCommunityIcons name="trophy" size={18} color="#b91c1c" />
              <Text style={{ marginLeft: 8 }}>Cumule des crédits en gagnant des défis</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <MaterialCommunityIcons name="account-group" size={18} color="#b91c1c" />
              <Text style={{ marginLeft: 8 }}>Joue avec tes amis dans des groupes privés</Text>
            </View>
          </View>
        </View>
      </View>
    </>
  );
}