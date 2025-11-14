// app/avatars/GroupAvatarsScreen.js
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ActivityIndicator, FlatList, TouchableOpacity, Image, Alert } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import firestore from '@react-native-firebase/firestore';
import functions from '@react-native-firebase/functions';
// Safe auth
import { useAuth } from '@src/auth/SafeAuthProvider';  
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

const DEFAULT_PRICE = 5;

const FALLBACK = [
  { id:'wolves',  name:'Les Loups',          url:'https://picsum.photos/seed/wolves/400',  sort:10, price:5 },
  { id:'titans',  name:'Les Titans',         url:'https://picsum.photos/seed/titans/400',  sort:20, price:5 },
  { id:'visions', name:'Les Visionnaires',   url:'https://picsum.photos/seed/visions/400', sort:30, price:5 },
  { id:'dragons', name:'Les Dragons',        url:'https://picsum.photos/seed/dragons/400', sort:40, price:5 },
  { id:'skaters', name:'Les Patineurs Fous', url:'https://picsum.photos/seed/skaters/400', sort:50, price:5 },
  { id:'blizzard',name:'Le Blizzard',        url:'https://picsum.photos/seed/blizzard/400',sort:60, price:5 },
];

function Chip({ icon, color, bg, label }) {
  return (
    <View style={{ flexDirection:'row', alignItems:'center', alignSelf:'flex-start',
      paddingVertical:4, paddingHorizontal:8, borderRadius:999, backgroundColor:bg || '#F3F4F6' }}>
      {!!icon && <MaterialCommunityIcons name={icon} size={14} color={color || '#111'} />}
      <Text style={{ color: color || '#111', marginLeft: icon ? 6 : 0, fontWeight:'700' }}>{label}</Text>
    </View>
  );
}

export default function GroupAvatarsScreen() {
  const params = useLocalSearchParams();
  const groupId = useMemo(() => (Array.isArray(params.groupId) ? params.groupId[0] : params.groupId) || '', [params.groupId]);

  const router = useRouter();
  const { user } = useAuth();

  const [me, setMe] = useState(null);
  const [loadingMe, setLoadingMe] = useState(true);

  const [group, setGroup] = useState(null);
  const [loadingGroup, setLoadingGroup] = useState(true);

  const [items, setItems] = useState(null);
  const [loadingItems, setLoadingItems] = useState(true);

  const [busy, setBusy] = useState(false);

  const [selectedId, setSelectedId] = useState(null);
  const selectedItem = useMemo(() => (items || []).find(a => a.id === selectedId) || null, [items, selectedId]);

  // Me (credits)
  useEffect(() => {
    if (!user?.uid) { setMe(null); setLoadingMe(false); return; }
    setLoadingMe(true);
    const ref = firestore().doc(`participants/${user.uid}`);
    const unsub = ref.onSnapshot(
      (snap) => {
        setMe(snap.exists ? ({ uid: snap.id, ...snap.data() }) : null);
        setLoadingMe(false);
      },
      () => setLoadingMe(false)
    );
    return () => { try { unsub(); } catch {} };
  }, [user?.uid]);

  // Group meta
  useEffect(() => {
    if (!groupId) { setGroup(null); setLoadingGroup(false); return; }
    setLoadingGroup(true);
    const ref = firestore().doc(`groups/${String(groupId)}`);
    const unsub = ref.onSnapshot(
      (snap) => {
        setGroup(snap.exists ? ({ id: snap.id, ...snap.data() }) : null);
        setLoadingGroup(false);
      },
      () => setLoadingGroup(false)
    );
    return () => { try { unsub(); } catch {} };
  }, [groupId]);

  // Catalog (group avatars)
  useEffect(() => {
    setLoadingItems(true);
    const qRef = firestore().collection('catalog_group_avatars').orderBy('sort', 'asc');
    const unsub = qRef.onSnapshot(
      (snap) => {
        const rows = snap?.docs?.map(d => ({ id: d.id, ...d.data() })) || [];
        setItems(rows.length ? rows : FALLBACK);
        setLoadingItems(false);
      },
      () => {
        setItems(FALLBACK);
        setLoadingItems(false);
      }
    );
    return () => { try { unsub(); } catch {} };
  }, []);

  // 🔧 util crédit(s) – couvre plusieurs schémas possibles
  function readCredits(me) {
    if (!me) return 0;

    // numériques directs
    if (typeof me.credits === 'number') return me.credits;
    if (typeof me.balance === 'number') return me.balance;

    // objets connus
    if (me.credits && typeof me.credits === 'object') {
      if (typeof me.credits.balance === 'number') return me.credits.balance;
      if (typeof me.credits.total === 'number' && typeof me.credits.spent === 'number') {
        return me.credits.total - me.credits.spent;
      }
    }

    // autres variantes fréquemment vues
    if (me.wallets && me.wallets.main && typeof me.wallets.main.balance === 'number') {
      return me.wallets.main.balance;
    }
    if (typeof me.creditBalance === 'number') return me.creditBalance;

    // strings → nombre
    const candidates = [
      me.credits, me.balance,
      me?.credits?.balance, me?.wallets?.main?.balance, me.creditBalance
    ].filter(v => typeof v === 'string');
    for (const s of candidates) {
      const n = Number(s);
      if (Number.isFinite(n)) return n;
    }

    return 0;
  }

  const credits = useMemo(() => readCredits(me), [me]);

  const canManage =
    !!user?.uid &&
    !!group &&
    (
      group.ownerId === user.uid ||
      group.createdBy === user.uid ||
      String(group.ownerUid || '').toLowerCase() === String(user.uid).toLowerCase() ||
      (Array.isArray(group.admins) && group.admins.includes(user.uid))
    );

  async function handleBuy() {
    if (!user?.uid)  return Alert.alert('Connexion requise', 'Connecte-toi pour acheter un avatar.');
    if (!group?.id)  return Alert.alert('Groupe requis', 'Aucun groupe n’a été fourni.');
    if (!selectedItem) return Alert.alert('Choisis un avatar', 'Sélectionne un avatar avant d’acheter.');
    if (!canManage)   return Alert.alert('Accès refusé', 'Seul le propriétaire du groupe peut changer son avatar.');

    const price = Number.isFinite(selectedItem.price) ? selectedItem.price : DEFAULT_PRICE;
    //if (credits < price) return Alert.alert('Crédits insuffisants', `Il te faut ${price} crédits (solde: ${credits}).`);

    try {
      setBusy(true);
      const call = functions().httpsCallable('purchaseGroupAvatar');
      const res = await call({
        groupId: group.id,
        avatarId: selectedItem.id,
        price,
        avatarUrl: selectedItem.url,
      });

      if (res?.data?.ok) {
        Alert.alert(
          'Avatar défini 🎉',
          `Le groupe “${group?.name || group?.title || group?.id}” a un nouvel avatar !`,
          [{ text: 'OK', onPress: () => router.back() }]
        );
      } else {
        throw new Error(res?.data?.error || 'Erreur inconnue');
      }
    } catch (e) {
      Alert.alert('Achat impossible', String(e?.message || e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Avatars de groupe',
          headerLeft: () => (
            <TouchableOpacity
              onPress={() => router.replace('/(drawer)/boutique')}
              style={{ paddingHorizontal: 10 }}
            >
              <Ionicons name="arrow-back" size={24} color="#111827" />
            </TouchableOpacity>
          ),
        }}
      />
      <FlatList
        data={items || []}
        keyExtractor={(it) => it.id}
        numColumns={2}
        columnWrapperStyle={{ gap:12 }}
        ItemSeparatorComponent={() => <View style={{ height:12 }} />}
        contentContainerStyle={{ padding:16, gap:12 }}
        ListHeaderComponent={
          <View style={{ gap:12 }}>
            {/* Bandeau groupe + crédits */}
            <View style={{ padding:14, borderWidth:1, borderRadius:12, backgroundColor:'#fff',
              elevation:3, shadowColor:'#000', shadowOpacity:0.08, shadowRadius:6, shadowOffset:{width:0,height:3} }}>
              <Text style={{ fontWeight:'800', fontSize:16, marginBottom:6 }}>Groupe</Text>
              <Text style={{ fontWeight:'700' }}>
                {loadingGroup ? 'Chargement…' : (group?.name || group?.title || group?.id || '—')}
              </Text>

              <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginTop:8 }}>
                <Chip
                  icon={canManage ? 'shield-check' : 'lock'}
                  color={canManage ? '#065F46' : '#991B1B'}
                  bg={canManage ? '#ECFDF5' : '#FEE2E2'}
                  label={canManage ? 'Tu es propriétaire' : 'Lecture seule'}
                />
                <View style={{ alignItems:'flex-end' }}>
                  <Text style={{ fontSize:12, color:'#6b7280' }}>Tes crédits</Text>
                  {loadingMe ? <ActivityIndicator /> : <Text style={{ fontWeight:'900', fontSize:20 }}>{credits}</Text>}
                </View>
              </View>
            </View>

            {/* Aperçu sélection + bouton achat */}
            <View style={{ padding:12, borderWidth:1, borderRadius:12, backgroundColor:'#fff' }}>
              <Text style={{ fontWeight:'700', marginBottom:8 }}>Aperçu</Text>
              <View style={{ alignItems:'center', justifyContent:'center' }}>
                {selectedItem?.url ? (
                  <Image source={{ uri: selectedItem.url }} style={{ width:180, height:180, borderRadius:90, backgroundColor:'#eee' }} />
                ) : (
                  <View style={{ width:180, height:180, borderRadius:90, backgroundColor:'#f3f4f6', alignItems:'center', justifyContent:'center' }}>
                    <Text style={{ color:'#9ca3af' }}>Sélectionne un avatar</Text>
                  </View>
                )}
                {!!selectedItem && (
                  <Text style={{ marginTop:8, fontWeight:'700' }}>
                    {selectedItem.name || selectedItem.id}
                  </Text>
                )}

                <TouchableOpacity
                  onPress={handleBuy}
                  disabled={busy || !selectedItem || !canManage}
                  style={{
                    marginTop:12,
                    backgroundColor: (busy || !selectedItem || !canManage) ? '#9ca3af' : '#ef4444',
                    paddingVertical:14,
                    paddingHorizontal:16,
                    borderRadius:12,
                    alignItems:'center',
                    elevation:2
                  }}
                >
                  <Text style={{ color:'#fff', fontWeight:'900' }}>
                    {busy
                      ? 'Traitement…'
                      : selectedItem
                        ? `Acheter pour le groupe (${(Number.isFinite(selectedItem.price) ? selectedItem.price : DEFAULT_PRICE)} crédits)`
                        : 'Choisis un avatar'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Titre catalogue */}
            <Text style={{ fontWeight:'700' }}>Catalogue</Text>
            {loadingItems && (
              <View style={{ alignItems:'center', paddingVertical:16 }}>
                <ActivityIndicator />
                <Text style={{ marginTop:8 }}>Chargement…</Text>
              </View>
            )}
          </View>
        }
        renderItem={({ item }) => {
          const active = selectedId === item.id;
          const price = Number.isFinite(item.price) ? item.price : DEFAULT_PRICE;
          return (
            <TouchableOpacity
              onPress={() => setSelectedId(item.id)}
              style={{
                flex:1, padding:10, borderRadius:12, borderWidth:2,
                borderColor: active ? '#ef4444' : '#eee',
                backgroundColor: active ? '#fff1f2' : '#fff'
              }}
            >
              <Image
                source={{ uri: item.url }}
                style={{ width: '100%', aspectRatio: 1, borderRadius: 10, backgroundColor:'#f3f4f6' }}
              />
              <Text style={{ marginTop:8, fontWeight:'700' }} numberOfLines={1}>
                {item.name || item.id}
              </Text>
              <Text style={{ color:'#6b7280', fontSize:12 }}>
                {price} crédit{price>1?'s':''}
              </Text>
            </TouchableOpacity>
          );
        }}
      />
    </>
  );
}