// app/(tabs)/AvatarsScreen.js
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ActivityIndicator, FlatList, TouchableOpacity, Image, Alert } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { collection, doc, onSnapshot, orderBy, query, runTransaction, serverTimestamp } from 'firebase/firestore';
import { db } from '@src/lib/firebase';
import { useAuth } from '@src/auth/AuthProvider';
import { MaterialCommunityIcons } from '@expo/vector-icons';

const DEFAULT_PRICE = 5;

const FALLBACK_AVATARS = [
  { id: 'rough-01', name: 'Le Rought', url: 'https://picsum.photos/seed/rough/400', tags: ['hockey', 'barbu'], price: 5 },
  { id: 'clown-01', name: 'Le Clown', url: 'https://picsum.photos/seed/clown/400', tags: ['fun'], price: 5 },
  { id: 'espi-01', name: "L'Espiègle", url: 'https://picsum.photos/seed/espi/400', tags: ['malin'], price: 5 },
  { id: 'fresh-01', name: 'Le Fresh', url: 'https://picsum.photos/seed/fresh/400', tags: ['stylé'], price: 5 },
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

export default function AvatarsScreen() {
  const r = useRouter();
  const { user } = useAuth();

  const [me, setMe] = useState(null);
  const [loadingMe, setLoadingMe] = useState(true);

  const [storeAvatars, setStoreAvatars] = useState(null);
  const [loadingAvatars, setLoadingAvatars] = useState(true);

  const [selectedId, setSelectedId] = useState(null);
  const selectedItem = useMemo(
    () => (storeAvatars || []).find(a => a.id === selectedId) || null,
    [storeAvatars, selectedId]
  );

  const currentAvatarId = me?.avatarId || null;
  const alreadyBought = hasBoughtAvatarBefore(me);
  const effectivePrice = getEffectivePrice({ me, selectedItem });

  // Participant (solde)
  useEffect(() => {
    if (!user?.uid) { setMe(null); setLoadingMe(false); return; }
    setLoadingMe(true);
    const ref = doc(db, 'participants', user.uid);
    const unsub = onSnapshot(ref, (snap) => {
      setMe(snap.exists() ? ({ uid: snap.id, ...snap.data() }) : null);
      setLoadingMe(false);
    }, () => setLoadingMe(false));
    return () => { try { unsub(); } catch {} };
  }, [user?.uid]);

  // Avatars store
  useEffect(() => {
    setLoadingAvatars(true);
    const q = query(collection(db, 'catalog_avatars'), orderBy('sort', 'asc'));
    const unsub = onSnapshot(q, (snap) => {
      const rows = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setStoreAvatars(rows.length ? rows : FALLBACK_AVATARS);
      setLoadingAvatars(false);
    }, () => {
      setStoreAvatars(FALLBACK_AVATARS);
      setLoadingAvatars(false);
    });
    return () => { try { unsub(); } catch {} };
  }, []);

  const credits = useMemo(() => {
    if (typeof me?.credits === 'number') return me.credits;
    if (typeof me?.credits?.balance === 'number') return me.credits.balance;
    if (typeof me?.balance === 'number') return me.balance;
    return 0;
  }, [me]);

  // Détermine si l'utilisateur a déjà acheté/activé un avatar auparavant
function hasBoughtAvatarBefore(me) {
  if (!me) return false;
  // signaux possibles : un avatarId stocké, une date d'achat, un champ photoURL venant de la boutique
  if (me.avatarId) return true;
  if (me.avatarPurchasedAt) return true;
  if (me.avatarHistory && Array.isArray(me.avatarHistory) && me.avatarHistory.length > 0) return true;
  // si tu as migré les vieux avatars dans photoURL, on peut considérer que c'était un achat
  // return !!me.photoURL;
  return false;
}

// Prix effectif : 5 crédits la 1ère fois, 1 crédit si on a déjà acheté et qu'on CHANGE d'avatar
function getEffectivePrice({ me, selectedItem }) {
  const FIRST_PRICE = 5;
  const SWITCH_PRICE = 1;

  if (!selectedItem) return FIRST_PRICE;
  const alreadyBought = hasBoughtAvatarBefore(me);
  const currentId = me?.avatarId || null;

  if (!alreadyBought) return FIRST_PRICE;
  // déjà acheté : si on choisit le même, 0 ? (on peut aussi empêcher)
  if (currentId && selectedItem.id === currentId) return 0;
  return SWITCH_PRICE;
}

  async function handleBuy() {
    if (!user?.uid) return Alert.alert('Connexion requise', 'Connecte-toi pour acheter un avatar.');
    if (!selectedItem) return Alert.alert('Choisis un avatar', 'Sélectionne un avatar avant d’acheter.');

    const price = Number.isFinite(selectedItem.price) ? selectedItem.price : DEFAULT_PRICE;
    if (credits < price) return Alert.alert('Crédits insuffisants', `Il te faut ${price} crédits (solde: ${credits}).`);

    try {
      const userRef = doc(db, 'participants', user.uid);
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(userRef);
        if (!snap.exists()) throw new Error("Profil introuvable.");
        const data = snap.data() || {};

        let bal = 0;
        if (typeof data.credits === 'number') bal = data.credits;
        else if (data.credits && typeof data.credits.balance === 'number') bal = data.credits.balance;
        else if (typeof data.balance === 'number') bal = data.balance;

        if (bal < price) throw new Error(`Solde insuffisant (${bal} < ${price}).`);
        const newBal = bal - price;

        tx.set(userRef, {
          credits: { balance: newBal, updatedAt: serverTimestamp() },
          avatarId: selectedItem.id,
          photoURL: selectedItem.url, // <-- harmonisé avec AccueilScreen (photoUrl)
          avatarPurchasedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }, { merge: true });

        const logRef = doc(collection(userRef, 'credit_logs'));
        tx.set(logRef, {
          type: 'purchase_avatar',
          amount: -price,
          avatarId: selectedItem.id,
          avatarUrl: selectedItem.url,
          before: bal,
          after: newBal,
          createdAt: serverTimestamp(),
        });
      });

      Alert.alert('Achat confirmé', `Ton nouvel avatar est activé 🎉`);
    } catch (e) {
      Alert.alert('Achat impossible', String(e?.message || e));
    }
  }

  if (!user) {
    return (
      <>
        <Stack.Screen options={{ title: 'Avatars' }} />
        <View style={{ flex:1, alignItems:'center', justifyContent:'center', padding:24 }}>
          <Text>Connecte-toi pour accéder à la boutique d’avatars.</Text>
          <TouchableOpacity
            onPress={() => r.push('/(auth)/auth-choice')}
            style={{ marginTop:12, backgroundColor:'#111', paddingHorizontal:16, paddingVertical:10, borderRadius:10 }}
          >
            <Text style={{ color:'#fff', fontWeight:'700' }}>Se connecter</Text>
          </TouchableOpacity>
        </View>
      </>
    );
  }

  // ------- SINGLE FLATLIST (pas de ScrollView) -------
  return (
    <>
      <Stack.Screen options={{ title: 'Boutique' }} />
      <FlatList
        data={storeAvatars || []}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={{ gap:12 }}
        ItemSeparatorComponent={() => <View style={{ height:12 }} />}
        contentContainerStyle={{ padding:16, gap:12 }}
        // Header : carte info + aperçu sélectionné + bouton Achat directement sous l'avatar
        ListHeaderComponent={
          <View style={{ gap:12 }}>
            {/* Carte info / crédits */}
            <View style={{
              padding:14, borderWidth:1, borderRadius:12, backgroundColor:'#fff',
              elevation:3, shadowColor:'#000', shadowOpacity:0.08, shadowRadius:6, shadowOffset:{width:0,height:3}
            }}>
              <Text style={{ fontWeight:'800', fontSize:16, marginBottom:6 }}>Avatars exclusifs</Text>
              <Text style={{ color:'#374151' }}>
                Personnalise ton profil avec un avatar unique. Chaque avatar coûte <Text style={{ fontWeight:'800' }}>{DEFAULT_PRICE} crédits</Text>.
              </Text>

              <View style={{ marginTop:10, flexDirection:'row', justifyContent:'space-between', alignItems:'center' }}>
                <Chip icon="information" color="#b91c1c" bg="#fee2e2" label="Usage personnel non transférable" />
                <View style={{ alignItems:'flex-end' }}>
                  <Text style={{ fontSize:12, color:'#6b7280' }}>Tes crédits</Text>
                  {loadingMe ? <ActivityIndicator /> : <Text style={{ fontWeight:'900', fontSize:20 }}>{credits}</Text>}
                </View>
              </View>
            </View>

            {/* Aperçu sélection + bouton Achat juste en dessous */}
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

                {/* --- Bouton Achat juste sous l'icône --- */}
               {(() => {
                const price = Number.isFinite(selectedItem?.price) ? selectedItem.price : DEFAULT_PRICE;
                const disabled =
                  !selectedItem ||
                  effectivePrice === 0 ||
                  credits < effectivePrice;

                return (
                  <>
                    <TouchableOpacity
                      onPress={handleBuy}
                      disabled={disabled}
                      style={{
                        backgroundColor:
                          (!selectedItem ||
                            credits < (Number.isFinite(selectedItem?.price) ? selectedItem.price : DEFAULT_PRICE))
                            ? '#9ca3af'
                            : '#ef4444',
                        paddingVertical: 14,
                        paddingHorizontal: 20,   // ✅ marge interne horizontale
                        borderRadius: 12,
                        alignItems: 'center',
                        justifyContent: 'center', // ✅ centrage parfait du texte
                        elevation: 3,
                        shadowColor: '#000',
                        shadowOpacity: 0.15,
                        shadowRadius: 4,
                        shadowOffset: { width: 0, height: 2 },
                      }}
                    >
                      <Text style={{ color: '#fff', fontWeight: '900' }}>
                        {!selectedItem
                          ? 'Choisis un avatar'
                          : effectivePrice === 0
                          ? 'Avatar déjà actif'
                          : `Acheter (${effectivePrice} crédit${effectivePrice > 1 ? 's' : ''})`}
                      </Text>
                    </TouchableOpacity>

                    {alreadyBought && selectedItem && effectivePrice === 1 && (
                      <Text
                        style={{
                          color: '#6b7280',
                          fontSize: 12,
                          marginTop: 6,
                          textAlign: 'center',
                        }}
                      >
                        Tu as déjà un avatar : changer coûte 1 crédit.
                      </Text>
                    )}
                  </>
                );
              })()}
              </View>
            </View>

            {/* Titre catalogue */}
            <Text style={{ fontWeight:'700' }}>Catalogue</Text>
            {loadingAvatars && (
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
        // Footer : note légale
        ListFooterComponent={
          <View style={{ gap:8, marginTop:12, marginBottom:16 }}>
            <Text style={{ color:'#6b7280', fontSize:12, textAlign:'center' }}>
              En achetant, tu acceptes un usage personnel dans l’app. Aucun remboursement.
            </Text>
          </View>
        }
      />
    </>
  );
}
