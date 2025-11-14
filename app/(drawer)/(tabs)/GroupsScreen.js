// app/(tabs)/GroupsScreen.js
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, ActivityIndicator, Modal, TextInput,
  Alert, Image, KeyboardAvoidingView, Platform, TouchableWithoutFeedback, Keyboard
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '@src/auth/SafeAuthProvider';
import { createGroupService } from '@src/groups/services';

/* ----------------------------------------------------
   Firestore helpers (RNFirebase natif / Web SDK)
---------------------------------------------------- */
const isWeb = Platform.OS === 'web';

// Snap helpers (compatibles web & RNFirebase)
const snapExists = (s) => (typeof s?.exists === 'function' ? s.exists() : !!s?.exists);
const snapData   = (s) => (typeof s?.data   === 'function' ? s.data()   : s?.data);

function fw() {
  if (isWeb) {
    const web = require('firebase/firestore');
    const { app } = require('@src/lib/firebase'); // côté web, ton wrapper exporte app
    const db = web.getFirestore(app);
    return {
      mode: 'web',
      db,
      doc: web.doc,
      collection: web.collection,
      query: web.query,
      where: web.where,
      onSnapshot: web.onSnapshot,
      getDoc: web.getDoc,
      setDoc: web.setDoc,
      updateDoc: web.updateDoc,
      serverTimestamp: web.serverTimestamp,
      deleteField: web.deleteField,
    };
  }
  const rn = require('@react-native-firebase/firestore').default;
  const FieldValue = rn.FieldValue;
  return {
    mode: 'native',
    rn,
    serverTimestamp: () => FieldValue.serverTimestamp(),
    deleteField: () => FieldValue.delete(),
  };
}

function subParticipant(uid, onNext, onError) {
  if (!uid) return () => {};
  const w = fw();
  if (w.mode === 'web') {
    const ref = w.doc(w.db, 'participants', uid);
    return w.onSnapshot(ref, onNext, onError);
  }
  return w.rn().collection('participants').doc(uid).onSnapshot(onNext, onError);
}

function subMembershipsBy(field, uid, onNext, onError) {
  const w = fw();
  if (w.mode === 'web') {
    const q = w.query(w.collection(w.db, 'group_memberships'), w.where(field, '==', String(uid)));
    return w.onSnapshot(q, onNext, onError);
  }
  return w.rn()
    .collection('group_memberships')
    .where(field, '==', String(uid))
    .onSnapshot(onNext, onError);
}

function subGroupDoc(gid, onNext, onError) {
  const w = fw();
  if (w.mode === 'web') {
    const ref = w.doc(w.db, 'groups', String(gid));
    return w.onSnapshot(ref, onNext, onError);
  }
  return w.rn().collection('groups').doc(String(gid)).onSnapshot(onNext, onError);
}

async function readParticipant(uid) {
  const w = fw();
  if (w.mode === 'web') {
    const ref = w.doc(w.db, 'participants', uid);
    return w.getDoc(ref);
  }
  return w.rn().collection('participants').doc(uid).get();
}

async function updParticipant(uid, patch) {
  const w = fw();
  if (w.mode === 'web') {
    const ref = w.doc(w.db, 'participants', uid);
    return w.updateDoc(ref, patch);
  }
  return w.rn().collection('participants').doc(uid).update(patch);
}

async function setParticipant(uid, data, merge = true) {
  const w = fw();
  if (w.mode === 'web') {
    const ref = w.doc(w.db, 'participants', uid);
    return w.setDoc(ref, data, { merge });
  }
  return w.rn().collection('participants').doc(uid).set(data, { merge });
}

/* ----------------------------------------------------
   Utils
---------------------------------------------------- */
function uniq(arr) {
  return Array.from(new Set(arr.filter(Boolean)));
}

/* ----------------------------------------------------
   Écran
---------------------------------------------------- */
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

  // Memberships
  const [rolesByGroupId, setRolesByGroupId] = useState({});
  const [loadingMemberships, setLoadingMemberships] = useState(!!user?.uid);

  // Détails des groupes
  const [groupsMap, setGroupsMap] = useState({});
  const groupsUnsubsRef = useRef([]);

  /* -------------------------
     Favori live (participants/{uid})
  ------------------------- */
  useEffect(() => {
    if (!user?.uid) { setFavoriteGroupId(null); setLoadingFavorite(false); return; }
    setLoadingFavorite(true);
   const unsub = subParticipant(
      user.uid,
      (snap) => {
        const d = snapExists(snap) ? (snapData(snap) || {}) : {};
        setFavoriteGroupId(d.favoriteGroupId || null);
        setLoadingFavorite(false);
      },
      (err) => {
        console.log('participants onSnapshot error:', err?.code, err?.message || String(err));
        setLoadingFavorite(false);
        Alert.alert('Lecture du favori', String(err?.message || err));
      }
    );
    return () => { try { unsub(); } catch {} };
  }, [user?.uid]);

  /* -------------------------
     Écoute group_memberships (uid | userId | participantId)
  ------------------------- */
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
      parts.forEach((list) => {
        (list || []).forEach((row) => {
          const prev = merged[row.groupId];
          const r = (row.role || 'member').toLowerCase();
          merged[row.groupId] = prev === 'owner' ? 'owner' : (r === 'owner' ? 'owner' : (prev || r));
        });
      });
      setRolesByGroupId(merged);
      setLoadingMemberships(false);
    };

    fields.forEach((field, idx) => {
      try {
        const un = subMembershipsBy(
          field,
          user.uid,
          (snap) => {
            // web: snap.docs ; natif: snap.docs aussi (API équivalente)
            const docs = snap?.docs || [];
            const rows = docs.map((d) => {
              const x = d.data() || {};
              const active = x.active === true || x.status === undefined || String(x.status || '').toLowerCase() === 'active';
              return active ? { id: d.id, groupId: x.groupId, role: x.role || 'member' } : null;
            }).filter(Boolean);
            buffers[idx] = rows;
            merge(buffers);
          },
          (e) => {
            console.log('[GroupsScreen] memberships listener error:', e?.code, e?.message || e);
            buffers[idx] = [];
            merge(buffers);
          }
        );
        unsubs.push(un);
      } catch (e) {
        console.log('[GroupsScreen] memberships query setup error:', e?.message || e);
      }
    });

    return () => { unsubs.forEach((u) => { try { u && u(); } catch {} }); };
  }, [user?.uid]);

  /* -------------------------
     Abonnements aux groups/{id}
  ------------------------- */
  useEffect(() => {
    // stop anciens
    groupsUnsubsRef.current.forEach((u) => { try { u(); } catch {} });
    groupsUnsubsRef.current = [];
    setGroupsMap({});

    const ids = uniq(Object.keys(rolesByGroupId || {}));
    if (ids.length === 0) return;

    ids.forEach((gid) => {
      try {
        const un = subGroupDoc(
          gid,
          (snap) => {
            // web: snap.exists() ; natif: snap.exists
            const exists = typeof snap.exists === 'function' ? snap.exists() : snap.exists;
            if (exists) {
              const data = typeof snap.data === 'function' ? snap.data() : snap.data;
              setGroupsMap((prev) => ({ ...prev, [String(gid)]: { id: String(gid), ...data } }));
            } else {
              setGroupsMap((prev) => {
                const n = { ...prev };
                delete n[String(gid)];
                return n;
              });
            }
          },
          (e) => {
            console.log('[GroupsScreen] group doc listener error:', gid, e?.code, e?.message || e);
          }
        );
        groupsUnsubsRef.current.push(un);
      } catch (e) {
        console.log('[GroupsScreen] group doc subscribe error:', gid, e?.message || e);
      }
    });

    return () => {
      groupsUnsubsRef.current.forEach((u) => { try { u(); } catch {} });
      groupsUnsubsRef.current = [];
    };
  }, [JSON.stringify(Object.keys(rolesByGroupId || {}))]);

  /* -------------------------
     Partition owner / member
  ------------------------- */
  const allGroups = useMemo(() => {
    const ids = Object.keys(rolesByGroupId || {});
    return ids.map((id) => {
      const base = groupsMap[id] || { id, name: '(groupe)' };
      const role = (rolesByGroupId[id] || 'member').toLowerCase();
      return { ...base, id, role };
    });
  }, [rolesByGroupId, groupsMap]);


  const myOwnerGroups = useMemo(() => allGroups.filter((g) => g.role === 'owner'), [allGroups]);
  const myMemberGroups = useMemo(() => allGroups.filter((g) => g.role !== 'owner'), [allGroups]);

  const ownedEmpty = myOwnerGroups.length === 0;
  const memberEmpty = myMemberGroups.length === 0;
  const allEmpty = ownedEmpty && memberEmpty;
  /* -------------------------
     Actions
  ------------------------- */
  function openGroup(g) {
    // garde l’URL drawer cohérente avec ton app
    router.push({ pathname: `/(drawer)/groups/${encodeURIComponent(String(g.id))}`, params: { initial: JSON.stringify(g) } });
  }

  async function onCreateGroup() {
    if (!name.trim()) return Alert.alert('Nom requis', 'Donne un nom à ton groupe.');
    if (!user?.uid)   return Alert.alert('Non connecté', 'Connecte-toi pour créer un groupe.');

    try {
      setCreating(true);
      const { groupId } = await createGroupService({
        name: name.trim(),
        description: description.trim(),
        uid: user.uid,
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
    const w = fw();

    try {
      const snap = await readParticipant(user.uid);
      // web: snap.exists() ; natif: snap.exists
      const exists = typeof snap.exists === 'function' ? snap.exists() : snap.exists;
      const data = exists ? (typeof snap.data === 'function' ? snap.data() : snap.data()) : {};

      const current = data?.favoriteGroupId || null;

      if (current === gid) {
        // UNFAVORITE
        try {
          await updParticipant(user.uid, {
            favoriteGroupId: w.deleteField(),
            favoriteGroupAt: w.deleteField(),
            updatedAt: w.serverTimestamp(),
          });
        } catch (e) {
          // Si “No document to update”, on crée un shell puis on update
          const msg = String(e?.message || e).toLowerCase();
          if (msg.includes('no document to update')) {
            await setParticipant(user.uid, { updatedAt: w.serverTimestamp() }, true);
            await updParticipant(user.uid, {
              favoriteGroupId: w.deleteField(),
              favoriteGroupAt: w.deleteField(),
              updatedAt: w.serverTimestamp(),
            });
          } else {
            throw e;
          }
        }
        setFavoriteGroupId(null);
        return;
      }

      // SET FAVORITE
      await setParticipant(user.uid, {
        favoriteGroupId: gid,
        favoriteGroupAt: w.serverTimestamp(),
        updatedAt: w.serverTimestamp(),
      }, true);

      setFavoriteGroupId(gid);
    } catch (e) {
      console.log('toggleFavorite error:', e);
      Alert.alert('Favori', `Impossible de mettre à jour: ${String(e?.message || e)}`);
    }
  }

  /* -------------------------
     UI
  ------------------------- */
  if (!user) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 }}>
        <Text>Connecte-toi pour voir tes groupes.</Text>
        <TouchableOpacity
          onPress={() => router.push('/(auth)/auth-choice')}
          style={{ backgroundColor: '#111827', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12 }}
        >
          <Text style={{ color: 'white', fontWeight: '600' }}>Se connecter</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const isLoading = loadingMemberships || loadingFavorite;

  return (
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

        {allEmpty && (
          <View style={{ marginHorizontal:16, marginTop:6, padding:12, borderRadius:12, backgroundColor:'#F9FAFB', borderWidth:1, borderColor:'#E5E7EB' }}>
            <Text style={{ fontWeight:'700' }}>Bienvenue 👋</Text>
            <Text style={{ color:'#6B7280', marginTop:4 }}>
              Commence par créer un groupe avec tes amis ou rejoins-en un avec un code d’invitation.
            </Text>
          </View>
        )}
      {isLoading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator />
          <Text style={{ marginTop: 8 }}>Chargement…</Text>
        </View>
      ) : (
        <FlatList
          data={[
            { header: true, title: 'Groupes que je gère', subtitle: ownedEmpty ? "Aucun groupe pour l’instant." : null },
            ...myOwnerGroups,
            { header: true, title: 'Groupes où je suis membre', subtitle: memberEmpty ? "Tu n’as rejoint aucun groupe pour le moment." : null },
            ...myMemberGroups,
          ]}
          keyExtractor={(item, idx) => (item.header ? `h-${idx}` : String(item.id))}
          renderItem={({ item }) =>
            item.header ? (
              <View style={{ paddingHorizontal: 16, paddingVertical: 8 }}>
                <Text style={{ fontSize: 16, fontWeight: '700' }}>{item.title}</Text>
                {!!item.subtitle && (
                  <Text style={{ marginTop: 2, fontStyle: 'italic', color: '#6B7280' }}>{item.subtitle}</Text>
                )}
              </View>
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
            <View style={{ alignItems: 'center', marginTop: 48, paddingHorizontal: 24 }}>
              <Image
                source={require('@src/assets/group-placeholder.png')}
                style={{ width: 120, height: 120, borderRadius: 60, opacity: 0.9, marginBottom: 14, backgroundColor: '#F3F4F6' }}
              />
              <Text style={{ fontSize: 18, fontWeight: '800', textAlign: 'center' }}>
                Crée ton premier groupe ou rejoins tes amis
              </Text>
              <Text style={{ marginTop: 6, color: '#6B7280', textAlign: 'center' }}>
                Organise vos défis, invite tes amis et commence à gagner des crédits.
              </Text>

              <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
                <TouchableOpacity
                  onPress={() => setCreateOpen(true)}
                  style={{ backgroundColor: '#111827', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12 }}
                >
                  <Text style={{ color: 'white', fontWeight: '700' }}>Créer un groupe</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => router.push('/groups/join')}
                  style={{ borderWidth: 1, borderColor: '#111827', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12 }}
                >
                  <Text style={{ fontWeight: '700' }}>Rejoindre</Text>
                </TouchableOpacity>
              </View>

              {/* Petit rappel utile */}
              <Text style={{ marginTop: 10, fontSize: 12, color: '#9CA3AF' }}>
                Astuce : tu peux définir un groupe favori avec l’icône ★
              </Text>
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
  );
}