import React, { useEffect, useState } from 'react';
import { View, Text, FlatList } from 'react-native';
import { db } from '../../src/lib/firebase';
import { collection, getDocs } from 'firebase/firestore';

export default function ResultsScreen() {
  const [games, setGames] = useState([]);

  useEffect(() => {
    // Placeholder: adapte à ta source réelle (API, collection Firestore, etc.)
    (async () => {
      try {
        const snap = await getDocs(collection(db, 'nhlResultsSample')); // ex: collection fictive pour tests
        setGames(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (e) {
        setGames([]);
      }
    })();
  }, []);

  return (
    <View style={{ flex: 1, padding: 16 }}>
      <Text style={{ fontSize: 22, fontWeight: '800', marginBottom: 12 }}>Résultats</Text>

      <FlatList
        data={games}
        keyExtractor={(g) => g.id}
        ListEmptyComponent={<Text>Pas de résultats pour le moment.</Text>}
        renderItem={({ item }) => (
          <View style={{ backgroundColor:'#fff', borderRadius:12, padding:12, marginBottom:8,
                         shadowColor:'#000',shadowOpacity:0.05,shadowRadius:6,shadowOffset:{width:0,height:2},elevation:2 }}>
            <Text style={{ fontWeight:'700' }}>{item.away ?? 'AWY'} @ {item.home ?? 'HME'}</Text>
            <Text style={{ color:'#374151' }}>{item.score ?? '—'}</Text>
            <Text style={{ color:'#6b7280' }}>{item.status ?? 'À venir'}</Text>
          </View>
        )}
      />
    </View>
  );
}