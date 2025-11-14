// app/avatars/index.js
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Modal, Pressable, ScrollView } from 'react-native';
import { Stack, useRouter } from 'expo-router';
// Safe auth
import { useAuth } from '@src/auth/SafeAuthProvider';

import firestore from '@react-native-firebase/firestore';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export default function BoutiqueHub() {
  const { user } = useAuth();
  const router = useRouter();

  const [me, setMe] = useState(null);
  const [groupIds, setGroupIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showPicker, setShowPicker] = useState(false);
  const [groupsMeta, setGroupsMeta] = useState({}); // id -> {name}
  const metaUnsubs = useRef(new Map());

  // Me + mes memberships (uid | participantId)
  useEffect(() => {
    if (!user?.uid) { setLoading(false); return; }

    const unsubMe = firestore()
      .doc(`participants/${user.uid}`)
      .onSnapshot(s => setMe(s?.exists ? ({ uid: s.id, ...s.data() }) : null));

    const q1 = firestore().collection('group_memberships').where('uid', '==', String(user.uid));
    const q2 = firestore().collection('group_memberships').where('participantId', '==', String(user.uid));

    let a = [], b = [];
    const recompute = () => {
      const ids = Array.from(new Set([...a, ...b].map(r => r.groupId).filter(Boolean))).sort();
      setGroupIds(ids);
      setLoading(false);
    };

    const u1 = q1.onSnapshot(
      s => { a = (s?.docs || []).map(d => d.data() || {}); recompute(); },
      () => { a = []; recompute(); }
    );
    const u2 = q2.onSnapshot(
      s => { b = (s?.docs || []).map(d => d.data() || {}); recompute(); },
      () => { b = []; recompute(); }
    );

    return () => { try { u1?.(); } catch {} try { u2?.(); } catch {} try { unsubMe?.(); } catch {} };
  }, [user?.uid]);

  // Métadonnées de chaque groupe (nom)
  useEffect(() => {
    // retire les listeners obsolètes
    for (const [gid, un] of metaUnsubs.current) {
      if (!groupIds.includes(gid)) { try { un(); } catch {} metaUnsubs.current.delete(gid); }
    }

   groupIds.forEach(gid => {
    if (metaUnsubs.current.has(gid)) return;
    const un = firestore().doc(`groups/${gid}`).onSnapshot(s => {
      const data = typeof s?.data === 'function' ? (s.data() || {}) : {};
      setGroupsMeta(prev => ({ ...prev, [gid]: { name: data.name || data.title || gid } }));
    });
    metaUnsubs.current.set(gid, un);
  });

    return () => {};
  }, [groupIds]);

  const goPersonal = () => router.push('/avatars/AvatarsScreen');

  const goGroup = () => {
    if (groupIds.length === 0) return setShowPicker(false);
    if (groupIds.length === 1) {
      return router.push({ pathname: '/avatars/GroupAvatarsScreen', params: { groupId: groupIds[0] } });
    }
    setShowPicker(true);
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Boutique' }} />
      <ScrollView contentContainerStyle={{ padding:16, gap:12 }}>
        <View style={{ padding:14, borderWidth:1, borderRadius:12, backgroundColor:'#fff' }}>
          <Text style={{ fontWeight:'800', fontSize:16, marginBottom:6 }}>Choisis une catégorie</Text>
          <Text style={{ color:'#6b7280' }}>Personnalise ton profil ou l’identité d’un groupe.</Text>
        </View>

        <TouchableOpacity
          onPress={goPersonal}
          style={{
            backgroundColor:'#fff',
            borderWidth:1, borderColor:'#fee2e2', borderRadius:12, padding:16,
            flexDirection:'row', alignItems:'center', justifyContent:'space-between'
          }}
        >
          <View style={{ flexDirection:'row', alignItems:'center' }}>
            <MaterialCommunityIcons name="account-circle" size={28} color="#ef4444" />
            <Text style={{ marginLeft:10, fontWeight:'800' }}>Avatar personnel</Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={22} color="#111" />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={goGroup}
          style={{
            backgroundColor:'#fff',
            borderWidth:1, borderColor:'#fee2e2', borderRadius:12, padding:16,
            flexDirection:'row', alignItems:'center', justifyContent:'space-between'
          }}
        >
          <View style={{ flexDirection:'row', alignItems:'center' }}>
            <MaterialCommunityIcons name="shield" size={28} color="#ef4444" />
            <Text style={{ marginLeft:10, fontWeight:'800' }}>Avatar de groupe</Text>
          </View>
          {loading ? <ActivityIndicator /> : <MaterialCommunityIcons name="chevron-right" size={22} color="#111" />}
        </TouchableOpacity>

        <Modal visible={showPicker} transparent animationType="fade" onRequestClose={()=>setShowPicker(false)}>
          <View style={{ flex:1, backgroundColor:'rgba(0,0,0,0.4)', justifyContent:'center', padding:24 }}>
            <View style={{ backgroundColor:'#fff', borderRadius:12, padding:16 }}>
              <Text style={{ fontWeight:'800', fontSize:16, marginBottom:8 }}>Sélectionner un groupe</Text>
              {groupIds.length === 0 ? (
                <Text style={{ color:'#6b7280' }}>Aucun groupe disponible.</Text>
              ) : groupIds.map(gid => (
                <Pressable
                  key={gid}
                  onPress={() => {
                    setShowPicker(false);
                    router.push({ pathname:'/avatars/GroupAvatarsScreen', params:{ groupId: gid }});
                  }}
                  style={({pressed})=>({ paddingVertical:12, borderBottomWidth:1, borderColor:'#eee', opacity: pressed?0.6:1 })}
                >
                  <Text style={{ fontWeight:'600' }}>{groupsMeta[gid]?.name || gid}</Text>
                </Pressable>
              ))}
              <TouchableOpacity onPress={()=>setShowPicker(false)} style={{ marginTop:10, alignSelf:'flex-end' }}>
                <Text style={{ color:'#ef4444', fontWeight:'700' }}>Annuler</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </ScrollView>
    </>
  );
}