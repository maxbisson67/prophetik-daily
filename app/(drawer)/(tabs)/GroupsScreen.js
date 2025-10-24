// app/(tabs)/GroupsScreen.js
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity,
  ActivityIndicator, Modal, TextInput, Alert, Image,
  KeyboardAvoidingView, Platform, TouchableWithoutFeedback, Keyboard
} from 'react-native';

import { MaterialCommunityIcons } from '@expo/vector-icons';

import { useRouter, Stack } from 'expo-router';
import { useGroups } from '@src/groups/useGroups';
import { createGroupService } from '@src/groups/services';
import { useAuth } from '@src/auth/AuthProvider';
import { SafeAreaView } from 'react-native-safe-area-context';
import { doc, onSnapshot, setDoc, updateDoc, serverTimestamp, deleteField, getDoc } from 'firebase/firestore';

import { db } from '@src/lib/firebase';


export default function GroupsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { groups, loading, error, refresh } = useGroups(user?.uid);

  // Création
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [creating, setCreating] = useState(false);

  // Favori (abonné au doc participant)
  const [favoriteGroupId, setFavoriteGroupId] = useState(null);
  const [loadingFavorite, setLoadingFavorite] = useState(!!user?.uid);

  

    useEffect(() => {
      if (!user?.uid) { setFavoriteGroupId(null); setLoadingFavorite(false); return; }
      setLoadingFavorite(true);
      const ref = doc(db, 'participants', user.uid);
      const unsub = onSnapshot(ref, (snap) => {
        const data = snap.data() || {};
        setFavoriteGroupId(data.favoriteGroupId || null);
        setLoadingFavorite(false);
      }, (err) => {
        console.log('participants onSnapshot error:', err);
        setLoadingFavorite(false);
        Alert.alert('Lecture du favori', String(err?.message || err));
      });
      return () => { try { unsub(); } catch {} };
    }, [user?.uid]);

  // Groupes: owner / member
  const myOwnerGroups = useMemo(
    () => groups.filter(g => g.role === 'owner' || g.ownerId === user?.uid),
    [groups, user?.uid]
  );
  const myMemberGroups = useMemo(
    () => groups.filter(g => !(g.role === 'owner' || g.ownerId === user?.uid)),
    [groups, user?.uid]
  );

  function openGroup(g) {
    router.push({ pathname: `/groups/${encodeURIComponent(String(g.id))}`, params: { initial: JSON.stringify(g) }});
  }

  async function onCreateGroup() {
    if (!name.trim()) return Alert.alert('Nom requis', 'Donne un nom à ton groupe.');
    try {
      setCreating(true);
      const { groupId } = await createGroupService({
        name: name.trim(),
        description: description.trim()
      });
      setCreating(false);
      setCreateOpen(false);
      setName(''); setDescription('');
      router.push({ pathname: '/groups/[groupId]', params: { groupId } });
    } catch (e) {
      setCreating(false);
      Alert.alert('Erreur', e?.message || 'Création du groupe échouée');
    }
  }

  
async function toggleFavorite(gid) {
  if (!user?.uid) return;
  const ref = doc(db, 'participants', user.uid);

  try {
    const snap = await getDoc(ref);
    const current = snap.exists() ? snap.data()?.favoriteGroupId || null : null;

    if (current === gid) {
      // --- UNFAVORITE: utiliser updateDoc pour supprimer proprement les champs ---
      try {
        await updateDoc(ref, {
          favoriteGroupId: deleteField(),
          favoriteGroupAt: deleteField(),
          updatedAt: serverTimestamp(),
        });
      } catch (e) {
        // Si le doc n'existe pas encore, on crée un doc vide puis on réessaie
        if (String(e?.message || e).includes('No document to update')) {
          await setDoc(ref, { updatedAt: serverTimestamp() }, { merge: true });
          await updateDoc(ref, {
            favoriteGroupId: deleteField(),
            favoriteGroupAt: deleteField(),
            updatedAt: serverTimestamp(),
          });
        } else {
          throw e;
        }
      }
      setFavoriteGroupId(null); // UI optimiste
      return;
    }

    // --- SET NEW FAVORITE (A -> B) : écrire directement B, sans faire unremove avant
    await setDoc(ref, {
      favoriteGroupId: gid,
      favoriteGroupAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }, { merge: true });

    setFavoriteGroupId(gid); // UI optimiste
  } catch (e) {
    console.log('toggleFavorite error:', e);
    Alert.alert('Favori', `Impossible de mettre à jour: ${String(e?.message || e)}`);
  }
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

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: 'transparent' }}>
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
              onPress={() => router.push('/groups/join')}
              style={{ borderWidth: 1, borderColor: '#111827', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12 }}
            >
              <Text style={{ fontWeight: '600' }}>Joindre</Text>
            </TouchableOpacity>
          </View>
        </View>

        {loading || loadingFavorite ? (
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
            data={[
              { header: true, title: 'Groupes que je gère' },
              ...myOwnerGroups,
              { header: true, title: 'Groupes où je suis membre' },
              ...myMemberGroups
            ]}
            keyExtractor={(item, idx) => (item.header ? `h-${idx}` : String(item.id))}
            renderItem={({ item }) =>
              item.header ? (
                <Text style={{ paddingHorizontal: 16, paddingVertical: 8, fontSize: 16, fontWeight: '700' }}>
                  {item.title}
                </Text>
              ) : (
                <TouchableOpacity
                  onPress={() => openGroup(item)}
                  style={{
                    marginHorizontal: 16,
                    marginVertical: 6,
                    padding: 14,
                    borderRadius: 14,
                    backgroundColor: '#fff',
                    // ombre iOS
                    shadowColor: '#000',
                    shadowOpacity: 0.1,
                    shadowRadius: 6,
                    shadowOffset: { width: 0, height: 3 },
                    // élévation Android
                    elevation: 3,
                    position: 'relative'
                  }}
                >
                  {/* Étoile favori en haut-droite */}
                  <TouchableOpacity
                    onPress={(e) => {
                      e.stopPropagation(); // éviter d’ouvrir la carte
                      toggleFavorite(item.id);
                    }}
                    hitSlop={{ top: 10, left: 10, right: 10, bottom: 10 }}
                    style={{ position: 'absolute', top: 8, right: 8 }}
                  >
                    <MaterialCommunityIcons
                      name={favoriteGroupId === item.id ? 'star' : 'star-outline'}
                      size={22}
                      color={favoriteGroupId === item.id ? '#ef4444' : '#9ca3af'}
                    />
                  </TouchableOpacity>

                 <View style={{ flexDirection:'row', alignItems:'center', paddingRight:28 /* laisser la place à l’étoile */ }}>
                  <Image
                    source={item.avatarUrl ? { uri: item.avatarUrl } : require('@src/assets/group-placeholder.png')}
                    style={{
                      width: 40, height: 40, borderRadius: 20,
                      backgroundColor: '#f3f4f6', marginRight: 10, borderWidth:1, borderColor:'#eee'
                    }}
                  />
                  <View style={{ flex:1 }}>
                    <Text style={{ fontSize: 16, fontWeight: '600' }}>
                      {item.name}
                    </Text>
                    {!!item.description && (
                      <Text style={{ marginTop: 2, color:'#6b7280' }} numberOfLines={1}>
                        {item.description}
                      </Text>
                    )}
                    {item.avatarId && (
                      <View style={{ paddingHorizontal:8, paddingVertical:4, borderRadius:999, backgroundColor:'#f1f5f9' }}>
                        <Text style={{ fontSize:11, color:'#334155' }}>Avatar actif</Text>
                      </View>
                    )}
                  </View>
                </View>
                  {!!item.description && <Text style={{ marginTop: 2 }}>{item.description}</Text>}

                  <View style={{ marginTop: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text>Code invitation: {item.codeInvitation}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      {favoriteGroupId === item.id ? (
                        <View style={{
                          paddingHorizontal: 8,
                          paddingVertical: 4,
                          borderRadius: 999,
                          backgroundColor: '#fee2e2',
                          borderWidth: 1,
                          borderColor: '#fecaca'
                        }}>
                          <Text style={{ color: '#b91c1c', fontWeight: '700', fontSize: 12 }}>Favori</Text>
                        </View>
                      ) : null}
                      <Text>{item.role === 'owner' ? 'Propriétaire' : 'Membre'}</Text>
                    </View>
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
        <Modal
          visible={createOpen}
          animationType="slide"
          onRequestClose={() => setCreateOpen(false)}
          transparent
        >
          {/* Fond assombri + dismiss clavier au tap */}
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={{
              flex: 1,
              backgroundColor: 'rgba(0,0,0,0.25)',
              justifyContent: 'flex-end'
            }}>
              <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 24 : 0}
              >
                <SafeAreaView style={{
                  backgroundColor: '#fff',
                  borderTopLeftRadius: 18,
                  borderTopRightRadius: 18,
                  paddingBottom: 16,
                  maxHeight: '92%'
                }}>
                  {/* Handle drag visuel */}
                  <View style={{ alignItems:'center', paddingTop:8 }}>
                    <View style={{ width:48, height:5, borderRadius:3, backgroundColor:'#e5e7eb' }} />
                  </View>

                  {/* Header inspirant */}
                  <View style={{ paddingHorizontal:16, paddingTop:12, paddingBottom:8 }}>
                    <View style={{ flexDirection:'row', alignItems:'center', gap:10, marginBottom:6 }}>
                      <MaterialCommunityIcons name="rocket-launch-outline" size={22} color="#ef4444" />
                      <Text style={{ fontSize:20, fontWeight:'900' }}>Nouveau groupe</Text>
                    </View>
                    <Text style={{ color:'#6b7280' }}>
                      Rassemble ton crew et dominez les défis 🔥
                    </Text>
                  </View>

                  {/* Form */}
                  <View style={{ paddingHorizontal:16, paddingTop:12, gap:12 }}>
                    <View>
                      <Text style={{ fontWeight:'700', marginBottom:6 }}>Nom du groupe</Text>
                      <TextInput
                        placeholder="Ex. Les Snipers du Nord"
                        value={name}
                        onChangeText={setName}
                        autoCorrect={false}
                        style={{
                          borderWidth:1, borderColor:'#e5e7eb', borderRadius:12,
                          paddingHorizontal:12, paddingVertical:12, backgroundColor:'#fafafa'
                        }}
                      />
                      <Text style={{ marginTop:4, color:'#9ca3af', fontSize:12 }}>
                        {name.length}/40
                      </Text>
                    </View>

                    {/* Suggestions rapides */}
                    <View>
                      <Text style={{ fontWeight:'700', marginBottom:6 }}>Inspiration</Text>
                      <View style={{ flexDirection:'row', flexWrap:'wrap', gap:8 }}>
                        {['Les Visionnaires', 'Pool du Samedi', 'Team Hot Takes', 'Les Prophètes'].map((sugg) => (
                          <TouchableOpacity
                            key={sugg}
                            onPress={() => setName(sugg)}
                            style={{
                              paddingHorizontal:12, paddingVertical:8, borderRadius:999,
                              backgroundColor:'#f3f4f6', borderWidth:1, borderColor:'#e5e7eb'
                            }}
                          >
                            <Text style={{ color:'#111827', fontWeight:'600' }}>{sugg}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>

                    <View>
                      <Text style={{ fontWeight:'700', marginBottom:6 }}>Description (optionnel)</Text>
                      <TextInput
                        placeholder="Ex. Notre pool du samedi entre amis 🍻"
                        value={description}
                        onChangeText={setDescription}
                        multiline
                        style={{
                          borderWidth:1, borderColor:'#e5e7eb', borderRadius:12,
                          paddingHorizontal:12, paddingVertical:12, minHeight:70, backgroundColor:'#fafafa'
                        }}
                      />
                    </View>
                  </View>

                  {/* Actions */}
                  <View style={{ paddingHorizontal:16, paddingVertical:16, flexDirection:'row', gap:10 }}>
                    <TouchableOpacity
                      onPress={() => setCreateOpen(false)}
                      style={{
                        flex:1, paddingVertical:14, borderRadius:12,
                        borderWidth:1, borderColor:'#111827', alignItems:'center', backgroundColor:'#fff'
                      }}
                      disabled={creating}
                    >
                      <Text style={{ color:'#111827', fontWeight:'700' }}>Annuler</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={onCreateGroup}
                      disabled={creating || !name.trim()}
                      style={{
                        flex:1, paddingVertical:14, borderRadius:12, alignItems:'center',
                        backgroundColor: (!name.trim() || creating) ? '#9ca3af' : '#ef4444'
                      }}
                    >
                      {creating ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <Text style={{ color:'#fff', fontWeight:'700' }}>Créer</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </SafeAreaView>
              </KeyboardAvoidingView>
            </View>
          </TouchableWithoutFeedback>
        </Modal>
      </View>
    </SafeAreaView>
  );
}