import { useMemo, useState } from 'react';
import { View, Text, TextInput, FlatList, TouchableOpacity } from 'react-native';

function extract(pMap, item) {
  const p = pMap[item.uid] || {};
  const name = p.displayName || p.name || item.displayName || item.name || '—';
  const email = p.email || item.email || '—';
  let credits = null;
  if (typeof p.credits === 'number') credits = p.credits;
  else if (p.credits && typeof p.credits.balance === 'number') credits = p.credits.balance;
  else if (typeof p.balance === 'number') credits = p.balance;
  return { name, email, credits, uid: item.uid };
}

export default function MembersTable({ members = [], participantsMap = {} }) {
  const [q, setQ] = useState('');
  const [sort, setSort] = useState({ key: 'name', dir: 'asc' });

  const rows = useMemo(() => {
    const base = members.map(m => extract(participantsMap, m));
    const filtered = q
      ? base.filter(r => (r.name + ' ' + r.email).toLowerCase().includes(q.toLowerCase()))
      : base;
    const sorted = [...filtered].sort((a,b) => {
      const sign = sort.dir === 'asc' ? 1 : -1;
      const av = a[sort.key] ?? '';
      const bv = b[sort.key] ?? '';
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * sign;
      return String(av).localeCompare(String(bv)) * sign;
    });
    return sorted;
  }, [members, participantsMap, q, sort]);

  const toggleSort = (key) => setSort(s => ({ key, dir: s.key === key && s.dir === 'asc' ? 'desc' : 'asc' }));

  const Header = () => (
    <View style={{ marginBottom:12 }}>
      <TextInput
        placeholder="Rechercher un membre…"
        value={q}
        onChangeText={setQ}
        style={{ borderWidth:1, borderColor:'#ddd', borderRadius:10, padding:10, marginBottom:10 }}
      />
      <View style={{ flexDirection:'row', paddingHorizontal:4 }}>
        <TouchableOpacity onPress={() => toggleSort('name')} style={{ flex:3 }}>
          <Text style={{ fontWeight:'700' }}>
            Nom {sort.key==='name' ? (sort.dir==='asc'?'↑':'↓') : ''}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => toggleSort('email')} style={{ flex:3 }}>
          <Text style={{ fontWeight:'700' }}>
            Email {sort.key==='email' ? (sort.dir==='asc'?'↑':'↓') : ''}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => toggleSort('credits')} style={{ width:80 }}>
          <Text style={{ textAlign:'right', fontWeight:'700' }}>
            Crédits {sort.key==='credits' ? (sort.dir==='asc'?'↑':'↓') : ''}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const Row = ({ item }) => (
    <View style={{ padding:12, borderWidth:1, borderColor:'#eee', borderRadius:12, marginBottom:8 }}>
      <View style={{ flexDirection:'row', alignItems:'center' }}>
        <Text style={{ flex:3 }}>{item.name}</Text>
        <Text style={{ flex:3, color:'#555' }} numberOfLines={1} ellipsizeMode="tail">{item.email}</Text>
        <Text style={{ width:80, textAlign:'right' }}>{item.credits ?? '—'}</Text>
      </View>
    </View>
  );

  return (
    <View style={{ padding:16 }}>
      <Header />
      <FlatList
        data={rows}
        keyExtractor={(it) => it.uid}
        renderItem={({ item }) => <Row item={item} />}
        ListEmptyComponent={<Text style={{ color:'#666' }}>Aucun membre.</Text>}
      />
    </View>
  );
}