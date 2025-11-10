// app/(tabs)/GroupsScreen.js
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, ActivityIndicator, Modal, TextInput,
  Alert, Image, KeyboardAvoidingView, Platform, TouchableWithoutFeedback, Keyboard
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';

// Auth
import { useAuth } from '@src/auth/SafeAuthProvider';

// Firebase
import {
  collection, doc, onSnapshot, query, where,
  setDoc, updateDoc, getDoc, serverTimestamp, deleteField
} from 'firebase/firestore';
import { db } from '@src/lib/firebase';

import { createGroupService } from '@src/groups/services';


// ----------------------------------------------------
// Utils
// ----------------------------------------------------
function uniq(arr) {
  return Array.from(new Set(arr.filter(Boolean)));
}
function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// ----------------------------------------------------
// Écran
// ----------------------------------------------------
export default function GroupsScreen() {
  const router = useRouter();
  const { user } = useAuth();

  // Création
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [creating, setCreating] = useState(false);

  // Favori
  const [favoriteGroupId, setFavoriteGroupId] = useState(null);
  const [loadingFavorite, setLoadingFavorite] = useState(!!user?.uid);

  // Memberships (source de vérité)
  // rolesByGroupId: { [groupId]: 'owner' | 'member' | 'admin' | ... }
  const [rolesByGroupId, setRolesByGroupId] = useState({});
  const [loadingMemberships, setLoadingMemberships] = useState(!!user?.uid);

  // Détails des groupes (abonnements par docId)
  const [groupsMap, setGroupsMap] = useState({}); // { [groupId]: { id, name, ... } }
  const groupsUnsubsRef = useRef([]);

  // -------------------------
  // Favori live (participants/{uid})
  // -------------------------
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

  // -------------------------
  // Écoute group_memberships pour CE user (uid | userId | participantId)
  // -> remplit rolesByGroupId
  // -------------------------
  useEffect(() => {
    if (!user?.uid) {
      setRolesByGroupId({});
      setLoadingMemberships(false);
      return;
    }
    setLoadingMemberships(true);

    const fields = ['uid', 'userId', 'participantId'];
    const buffers = [];
    const unsubs = [];

    const merge = (parts) => {
      const merged = {};
      parts.forEach(list => {
        (list || []).forEach(row => {
          const prev = merged[row.groupId];
          const r = (row.role || 'member').toLowerCase();
          // owner prioritaire si plusieurs entrées existent
          merged[row.groupId] = prev === 'owner' ? 'owner' : (r === 'owner' ? 'owner' : (prev || r));
        });
      });
      setRolesByGroupId(merged);
      setLoadingMemberships(false);
    };

    fields.forEach((field, idx) => {
      try {
        const qRef = query(collection(db, 'group_memberships'), where(field, '==', String(user.uid)));
        const un = onSnapshot(qRef, (snap) => {
          const rows = snap.docs.map(d => {
            const x = d.data() || {};
            const active = x.active === true || x.status === undefined || String(x.status).toLowerCase() === 'active';
            return active ? {
              id: d.id,
              groupId: x.groupId,
              role: x.role || 'member',
            } : null;
          }).filter(Boolean);
          buffers[idx] = rows;
          merge(buffers);
        }, (e) => {
          console.log('[GroupsScreen] memberships listener error:', e?.message || e);
          buffers[idx] = [];
          merge(buffers);
        });
        unsubs.push(un);
      } catch (e) {
        console.log('[GroupsScreen] memberships query setup error:', e?.message || e);
      }
    });

    return () => { unsubs.forEach(u => u && u()); };
  }, [user?.uid]);

  // -------------------------
  // Abonnement en temps réel aux docs groups/{id} trouvés
  // -------------------------
  useEffect(() => {
    // stop anciens abonnements
    groupsUnsubsRef.current.forEach(u => { try { u(); } catch {} });
    groupsUnsubsRef.current = [];
    setGroupsMap({});

    const ids = uniq(Object.keys(rolesByGroupId || {}));
    if (ids.length === 0) return;

    const nextMap = {};
    ids.forEach((gid) => {
      try {
        const unsub = onSnapshot(doc(db, 'groups', String(gid)), (snap) => {
          if (snap.exists()) {
            nextMap[String(gid)] = { id: snap.id, ...snap.data() };
          } else {
            // doc supprimé: retirer si présent
            delete nextMap[String(gid)];
          }
          // setState immuable à chaque update
          setGroupsMap(prev => ({ ...prev, [String(gid)]: nextMap[String(gid)] }));
        }, (e) => {
          console.log('[GroupsScreen] group doc listener error:', gid, e?.message || e);
        });
        groupsUnsubsRef.current.push(unsub);
      } catch (e) {
        console.log('[GroupsScreen] group doc subscribe error:', gid, e?.message || e);
      }
    });

    return () => {
      groupsUnsubsRef.current.forEach(u => { try { u(); } catch {} });
      groupsUnsubsRef.current = [];
    };
  }, [JSON.stringify(Object.keys(rolesByGroupId || {}))]);

  // -------------------------
  // Partition owner / member à partir des rôles + groupsMap
  // -------------------------
  const allGroups = useMemo(() => {
    const ids = Object.keys(rolesByGroupId || {});
    return ids.map(id => {
      const base = groupsMap[id] || { id, name: '(groupe)' };
      const role = (rolesByGroupId[id] || 'member').toLowerCase();
      return { ...base, id, role };
    });
  }, [rolesByGroupId, groupsMap]);

  const myOwnerGroups = useMemo(
    () => allGroups.filter(g => g.role === 'owner'),
    [allGroups]
  );
  const myMemberGroups = useMemo(
    () => allGroups.filter(g => g.role !== 'owner'),
    [allGroups]
  );

  // -------------------------
  // Actions
  // -------------------------
  function openGroup(g) {
    router.push({ pathname: `/(drawer)/groups/${encodeURIComponent(String(g.id))}`, params: { initial: JSON.stringify(g) }});
  }

  async function onCreateGroup() {
    if (!name.trim()) return Alert.alert('Nom requis', 'Donne un nom à ton groupe.');
    if (!user?.uid)   return Alert.alert('Non connecté', 'Connecte-toi pour créer un groupe.');

    try {
      setCreating(true);
      const { groupId } = await createGroupService({
        name: name.trim(),
        description: description.trim(),
        uid: user.uid,                           // ← INDISPENSABLE
        displayName: user.displayName || null,
        avatarUrl: user.photoURL || null,
      });
      setCreating(false);
      setCreateOpen(false);
      setName(''); setDescription('');
      router.push({ pathname: '/(drawer)/groups/[groupId]', params: { groupId } });
    } catch (e) {
      setCreating(false);
      Alert.alert('Erreur', String(e?.message || e));
    }
  }

  async function toggleFavorite(gid) {
    if (!user?.uid) return;
    const ref = doc(db, 'participants', user.uid);

    try {
      const snap = await getDoc(ref);
      const current = snap.exists() ? snap.data()?.favoriteGroupId || null : null;

      if (current === gid) {
        // UNFAVORITE
        try {
          await updateDoc(ref, {
            favoriteGroupId: deleteField(),
            favoriteGroupAt: deleteField(),
            updatedAt: serverTimestamp(),
          });
        } catch (e) {
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
        setFavoriteGroupId(null);
        return;
      }

      // SET FAVORITE
      await setDoc(ref, {
        favoriteGroupId: gid,
        favoriteGroupAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }, { merge: true });

      setFavoriteGroupId(gid);
    } catch (e) {
      console.log('toggleFavorite error:', e);
      Alert.alert('Favori', `Impossible de mettre à jour: ${String(e?.message || e)}`);
    }
  }

  // -------------------------
  // UI
  // -------------------------
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

  const isLoading = loadingMemberships || loadingFavorite;

  return (
    <>
   

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

        {isLoading ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator />
            <Text style={{ marginTop: 8 }}>Chargement…</Text>
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
                    shadowColor: '#000',
                    shadowOpacity: 0.1,
                    shadowRadius: 6,
                    shadowOffset: { width: 0, height: 3 },
                    elevation: 3,
                    position: 'relative'
                  }}
                >
                  {/* Favori */}
                  <TouchableOpacity
                    onPress={(e) => {
                      e.stopPropagation();
                      toggleFavorite(item.id);
                    }}
                    hitSlop={{ top: 10, left: 10, right: 10, bottom: 10 }}
                    style={{ position: 'absolute', top: 8, right: 8 }}
                  >
                    <MaterialCommunityIcons
                      name={favoriteGroupId === item.id ? 'star' : 'star-outline'}
                      size={22}
                      // Pas de code couleur ambigu : icône pleine vs contour
                      color={'#111827'}
                    />
                  </TouchableOpacity>

                  <View style={{ flexDirection:'row', alignItems:'center', paddingRight:28 }}>
                    <Image
                      source={item.avatarUrl ? { uri: item.avatarUrl } : require('@src/assets/group-placeholder.png')}
                      style={{
                        width: 40, height: 40, borderRadius: 20,
                        backgroundColor: '#f3f4f6', marginRight: 10, borderWidth:1, borderColor:'#eee'
                      }}
                    />
                    <View style={{ flex:1 }}>
                      <Text style={{ fontSize: 16, fontWeight: '600' }}>
                        {item.name || item.id}
                      </Text>
                      {!!item.description && (
                        <Text style={{ marginTop: 2 }} numberOfLines={1}>
                          {item.description}
                        </Text>
                      )}
                    </View>
                  </View>

                  <View style={{ marginTop: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text>Code invitation: {item.codeInvitation || '—'}</Text>
                    <Text style={{ fontWeight: '700' }}>
                      {item.role === 'owner' ? 'Propriétaire' : 'Membre'}
                    </Text>
                  </View>
                </TouchableOpacity>
              )
            }
            ListEmptyComponent={() => (
              <View style={{ alignItems: 'center', marginTop: 40 }}>
                <Text>Aucun groupe trouvé pour ce compte.</Text>
              </View>
            )}
          />
        )}

        {/* Modal création */}
        <Modal
          visible={createOpen}
          animationType="fade"
          onRequestClose={() => setCreateOpen(false)}
          transparent
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={{ flex: 1,paddingTop: 60, backgroundColor: 'rgba(0,0,0,0.25)', justifyContent: 'flex-start' }}>
              <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 24 : 0}
              >
                <SafeAreaView style={{
                  backgroundColor: '#fff',
                  borderBottomLeftRadius: 18,
                  borderBottomRightRadius: 18,
                  paddingBottom: 16,
                  maxHeight: '92%',
                  marginBottom: 12 
                }}>
                 

                  <View style={{ paddingHorizontal:16, paddingTop:12, paddingBottom:8 }}>
                    <View style={{ flexDirection:'row', alignItems:'center', gap:10, marginBottom:6 }}>
                      <MaterialCommunityIcons name="rocket-launch-outline" size={22} />
                      <Text style={{ fontSize:20, fontWeight:'900' }}>Nouveau groupe</Text>
                    </View>
                    <Text>Rassemble ton crew et dominez les défis.</Text>
                  </View>

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
                      <Text style={{ marginTop:4, fontSize:12 }}>
                        {name.length}/40
                      </Text>
                    </View>

                    <View>
                      <Text style={{ fontWeight:'700', marginBottom:6 }}>Description (optionnel)</Text>
                      <TextInput
                        placeholder="Ex. Notre pool du samedi entre amis"
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

                  <View style={{ paddingHorizontal:16, paddingVertical:16, flexDirection:'row', gap:10 }}>
                    <TouchableOpacity
                      onPress={() => setCreateOpen(false)}
                      style={{ flex:1, paddingVertical:14, borderRadius:12, borderWidth:1, alignItems:'center' }}
                      disabled={creating}
                    >
                      <Text style={{ fontWeight:'700' }}>Annuler</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={onCreateGroup}
                      disabled={creating || !name.trim()}
                      style={{ flex:1, paddingVertical:14, borderRadius:12, alignItems:'center',
                        backgroundColor: (!name.trim() || creating) ? '#9ca3af' : '#111827'
                      }}
                    >
                      {creating ? <ActivityIndicator color="#fff" /> : <Text style={{ color:'#fff', fontWeight:'700' }}>Créer</Text>}
                    </TouchableOpacity>
                  </View>
                </SafeAreaView>
              </KeyboardAvoidingView>
            </View>
          </TouchableWithoutFeedback>
        </Modal>
      </View>
    </>
  );
}