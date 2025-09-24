// app/(tabs)/GroupsScreen.js
import React, { useMemo, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, Modal, TextInput, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useGroups } from '../../src/groups/useGroups';
import { createGroupService } from '../../src/groups/services';
import { useAuth } from '../../src/auth/AuthProvider';
import { signOut } from 'firebase/auth';
import { auth } from '../../src/lib/firebase';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function GroupsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { groups, loading, error, refresh } = useGroups(user?.uid);

  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [initialCredits, setInitialCredits] = useState('100');
  const [creating, setCreating] = useState(false);

  const myOwnerGroups = useMemo(() => groups.filter(g => g.role === 'owner'), [groups]);
  const myMemberGroups = useMemo(() => groups.filter(g => g.role !== 'owner'), [groups]);

  function openGroup(g) {
    router.push({ pathname: `/group/${g.id}` });
  }

  if (!user) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 }}>
      <Text>Connecte-toi pour voir tes groupes.</Text>
      <TouchableOpacity
        onPress={() => router.push('/(auth)/sign-in')}
        style={{ backgroundColor: '#111827', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12 }}
      >
        <Text style={{ color: 'white', fontWeight: '600' }}>Se connecter</Text>
      </TouchableOpacity>
    </View>
  );
}

  async function onCreateGroup() {
    if (!name.trim()) return Alert.alert('Nom requis', 'Donne un nom à ton groupe.');
    const init = parseInt(initialCredits, 10);
    if (Number.isNaN(init) || init < 0) return Alert.alert('Crédits initiaux invalides', 'Entre un nombre ≥ 0');
    try {
      setCreating(true);
      const { groupId } = await createGroupService({ 
        name: name.trim(), 
        description: description.trim(), 
        initialCreditsPerMember: init 
      });
      setCreating(false);
      setCreateOpen(false);
      setName(''); setDescription(''); setInitialCredits('100');
      router.push(`/group/${groupId}`);
    } catch (e) {
      setCreating(false);
      Alert.alert('Erreur', e?.message || 'Création du groupe échouée');
    }
  }

  if (!user) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Text>Connecte-toi pour voir tes groupes.</Text>
      </View>
    );
  }

  return (
     <SafeAreaView style={{ flex: 1, backgroundColor: '#f3f4f6' }}>
    <View style={{ flex: 1 }}>
      <View style={{ padding: 16, flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={{ fontSize: 22, fontWeight: '700' }}>Mes groupes</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
    <TouchableOpacity 
      onPress={() => setCreateOpen(true)} 
      style={{ backgroundColor: '#111827', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12 }}
    >
      <Text style={{ color: 'white', fontWeight: '600' }}>Créer</Text>
    </TouchableOpacity>
    
    <TouchableOpacity 
      onPress={() => signOut(auth)} 
      style={{ borderWidth: 1, borderColor: '#111827', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12 }}
    >
      <Text style={{ fontWeight: '600' }}>Déconnexion</Text>
    </TouchableOpacity>
  </View>
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator />
          <Text style={{ marginTop: 8 }}>Chargement…</Text>
        </View>
      ) : error ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <Text>Erreur: {String(error)}</Text>
          <TouchableOpacity onPress={refresh} style={{ marginTop: 12, padding: 10, borderWidth: 1, borderRadius: 10 }}>
            <Text>Réessayer</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={[{ header: true, title: 'Groupes que je gère' }, ...myOwnerGroups, { header: true, title: 'Groupes où je suis membre' }, ...myMemberGroups]}
          keyExtractor={(item, idx) => (item.header ? `h-${idx}` : item.id)}
          renderItem={({ item }) =>
            item.header ? (
              <Text style={{ paddingHorizontal: 16, paddingVertical: 8, fontSize: 16, fontWeight: '700' }}>{item.title}</Text>
            ) : (
              <TouchableOpacity onPress={() => openGroup(item)} style={{ marginHorizontal: 16, marginVertical: 6, padding: 14, borderRadius: 14, borderWidth: 1 }}>
                <Text style={{ fontSize: 16, fontWeight: '600' }}>{item.name}</Text>
                {!!item.description && <Text style={{ marginTop: 2 }}>{item.description}</Text>}
                <View style={{ marginTop: 8, flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text>Solde: {item.balance ?? 0} crédits</Text>
                  <Text>{item.role === 'owner' ? 'Propriétaire' : 'Membre'}</Text>
                </View>
              </TouchableOpacity>
            )
          }
          ListEmptyComponent={() => (
            <View style={{ alignItems: 'center', marginTop: 40 }}>
              <Text>Tu n’as pas encore de groupes.</Text>
            </View>
          )}
        />
      )}

      {/* Modal création */}
      <Modal visible={createOpen} animationType="slide" onRequestClose={() => setCreateOpen(false)}>
        <View style={{ flex: 1, padding: 16 }}>
          <Text style={{ fontSize: 20, fontWeight: '700', marginBottom: 12 }}>Nouveau groupe</Text>
          <TextInput placeholder="Nom du groupe" value={name} onChangeText={setName} style={{ borderWidth: 1, borderRadius: 10, padding: 10, marginBottom: 10 }} />
          <TextInput placeholder="Description (optionnel)" value={description} onChangeText={setDescription} style={{ borderWidth: 1, borderRadius: 10, padding: 10, marginBottom: 10 }} />
          <TextInput placeholder="Crédits initiaux" value={initialCredits} onChangeText={setInitialCredits} keyboardType="number-pad" style={{ borderWidth: 1, borderRadius: 10, padding: 10, marginBottom: 20 }} />

          <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
            <TouchableOpacity onPress={() => setCreateOpen(false)} style={{ padding: 12, borderWidth: 1, borderRadius: 12 }}>
              <Text>Annuler</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onCreateGroup} disabled={creating} style={{ padding: 12, borderRadius: 12, backgroundColor: '#111827' }}>
              {creating ? <ActivityIndicator color="#fff" /> : <Text style={{ color: 'white', fontWeight: '600' }}>Créer</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
    </SafeAreaView>
  );
}