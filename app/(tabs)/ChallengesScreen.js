import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/auth/AuthProvider';
import { db } from '../../src/lib/firebase';
import { collection, onSnapshot, query, where } from 'firebase/firestore';

export default function ChallengesScreen() {
  const r = useRouter();
  const { user } = useAuth();
  const [rows, setRows] = useState([]);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'challenges'), where('participants', 'array-contains', user.uid));
    const unsub = onSnapshot(q, snap => {
      setRows(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [user?.uid]);

  return (
    <View style={{ flex: 1, padding: 16 }}>
      <Text style={{ fontSize: 22, fontWeight: '800', marginBottom: 12 }}>Mes défis</Text>

      <Pressable
        onPress={() => r.push('/create-challenge')}
        style={{ backgroundColor: '#e5e7eb', borderRadius: 12, padding: 12, marginBottom: 12 }}
      >
        <Text>🎯 Créer un défi</Text>
      </Pressable>

      <FlatList
        data={rows}
        keyExtractor={(it) => it.id}
        ListEmptyComponent={<Text>Aucun défi.</Text>}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => r.push({ pathname: '/challenge/[id]', params: { id: item.id } })}
            style={{ backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 8,
                     shadowColor:'#000',shadowOpacity:0.05,shadowRadius:6,shadowOffset:{width:0,height:2},elevation:2 }}
          >
            <Text style={{ fontWeight:'700' }}>{item.title ?? 'Défi'}</Text>
            <Text style={{ color:'#374151' }}>{item.status ?? '—'}</Text>
          </Pressable>
        )}
      />
    </View>
  );
}