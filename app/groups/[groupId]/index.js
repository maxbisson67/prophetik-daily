// app/groups/[groupId]/index.js
import { View, Text, ActivityIndicator, FlatList, ScrollView, TouchableOpacity, Alert, Share } from 'react-native';
import { useEffect, useMemo, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@src/lib/firebase';

function fmtDate(ts) {
  // Firestore Timestamp | Date | number -> 'YYYY-MM-DD HH:mm'
  try {
    const d =
      ts?.toDate?.() ??
      (typeof ts === 'number' ? new Date(ts) : ts instanceof Date ? ts : null);
    if (!d) return null;
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch {
    return null;
  }
}

export default function GroupDetailScreen() {
  const params = useLocalSearchParams();
  const id = useMemo(() => {
    const raw = params.groupId;
    return Array.isArray(raw) ? String(raw[0]) : String(raw || '');
  }, [params.groupId]);

  const initial = useMemo(() => {
    try { return params.initial ? JSON.parse(params.initial) : null; }
    catch { return null; }
  }, [params.initial]);

  const [group, setGroup] = useState(initial);
  const [loading, setLoading] = useState(!initial);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError(null);
    const ref = doc(db, 'groups', id);
    const unsub = onSnapshot(ref,
      (snap) => {
        if (snap.exists()) {
          setGroup({ id: snap.id, ...snap.data() });
          setLoading(false);
        } else {
          setGroup(null);
          setLoading(false);
        }
      },
      (e) => { setError(e); setLoading(false); }
    );
    return () => unsub();
  }, [id]);

  if (loading) {
    return (
      <View style={{ flex:1, alignItems:'center', justifyContent:'center' }}>
        <ActivityIndicator />
        <Text>Chargement du groupe…</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={{ flex:1, alignItems:'center', justifyContent:'center', padding:16 }}>
        <Text>Erreur : {String(error.message || error)}</Text>
        <Text style={{ marginTop:6 }}>ID: {id}</Text>
      </View>
    );
  }

  if (!group) {
    return (
      <View style={{ flex:1, alignItems:'center', justifyContent:'center', padding:16 }}>
        <Text>Aucun groupe trouvé (ID: {id})</Text>
      </View>
    );
  }

  // Champs possibles (tous optionnels, on affiche seulement si présents)
  const {
    name,
    description,
    inviteCode,
    ownerId,
    managers,           // ex: ['uid1','uid2'] ou [{uid, name}]
    members,            // ex: [{uid, displayName}] (objet)
    membersIds,         // ex: ['uid1','uid2'] (ids)
    createdAt,
    updatedAt,
    privacy,            // ex: 'private' | 'public'
    sport, level,       // si tu as ces champs
  } = group;

  const managersList = Array.isArray(managers)
    ? managers.map((m) => (typeof m === 'string' ? { uid: m } : m))
    : [];

  const memberList = Array.isArray(members)
    ? members
    : Array.isArray(membersIds)
      ? membersIds.map((uid) => ({ uid }))
      : [];

  const managersCount = managersList.length;
  const membersCount = memberList.length;

  const inviteMessage = `Rejoins mon groupe "${name || id}" dans Prophetik-daily.\nCode: ${inviteCode ?? '—'}\nID: ${group.id}`;

  const onShareInvite = async () => {
    try {
      await Share.share({ message: inviteMessage });
    } catch (e) {
      Alert.alert('Partage impossible', String(e?.message ?? e));
    }
  };

  const onCreateChallenge = () => {
    Alert.alert('À venir', 'Création de défi à implémenter.');
  };

  const onLeaveGroup = () => {
    Alert.alert('Quitter le groupe', 'Cette action sera implémentée prochainement.', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'OK' }
    ]);
  };

  const infoRow = (label, value) =>
    value ? (
      <View style={{ flexDirection:'row', gap:8, marginBottom:6 }}>
        <Text style={{ fontWeight:'600', width:120 }}>{label}</Text>
        <Text style={{ flex:1 }}>{value}</Text>
      </View>
    ) : null;

  return (
    <ScrollView style={{ flex:1 }} contentContainerStyle={{ padding:16, gap:16 }}>
      {/* En-tête */}
      <View style={{ gap:6 }}>
        <Text style={{ fontSize:22, fontWeight:'700' }}>
          {name || `Groupe ${group.id}`}
        </Text>
        <Text style={{ color:'#666' }}>ID : {group.id}</Text>
        <Text style={{ color:'#666' }}>Gestionnaires: {managersCount} · Membres: {membersCount}</Text>
        {description ? <Text style={{ color:'#333' }}>{description}</Text> : null}
      </View>

      {/* Métadonnées */}
      <View style={{ backgroundColor:'#fafafa', padding:12, borderRadius:12, borderWidth:1, borderColor:'#eee' }}>
        {infoRow('Propriétaire', ownerId)}
        {infoRow('Confidentialité', privacy)}
        {infoRow('Sport / Niveau', [sport, level].filter(Boolean).join(' · '))}
        {infoRow('Code d’invitation', inviteCode)}
        {infoRow('Créé le', fmtDate(createdAt))}
        {infoRow('Mis à jour', fmtDate(updatedAt))}
      </View>

      {/* Gestionnaires */}
      <View style={{ backgroundColor:'#fff', padding:12, borderRadius:12, borderWidth:1, borderColor:'#eee' }}>
        <Text style={{ fontWeight:'700', marginBottom:8 }}>Gestionnaires ({managersList.length})</Text>
        {managersList.length ? (
          <FlatList
            data={managersList}
            keyExtractor={(m, i) => m.uid ?? m.id ?? String(i)}
            renderItem={({ item }) => (
              <View style={{ paddingVertical:8, borderBottomWidth:1, borderColor:'#f0f0f0' }}>
                <Text>{item.displayName ?? item.name ?? item.email ?? item.uid}</Text>
              </View>
            )}
          />
        ) : (
          <Text style={{ color:'#666' }}>Aucun gestionnaire listé.</Text>
        )}
      </View>

      {/* Membres */}
      <View style={{ backgroundColor:'#fff', padding:12, borderRadius:12, borderWidth:1, borderColor:'#eee' }}>
        <Text style={{ fontWeight:'700', marginBottom:8 }}>Membres ({memberList.length})</Text>
        {memberList.length ? (
          <FlatList
            data={memberList}
            keyExtractor={(m, i) => m.uid ?? m.id ?? String(i)}
            renderItem={({ item }) => (
              <View style={{ paddingVertical:8, borderBottomWidth:1, borderColor:'#f0f0f0' }}>
                <Text>{item.displayName ?? item.name ?? item.email ?? item.uid}</Text>
              </View>
            )}
          />
        ) : (
          <Text style={{ color:'#666' }}>Aucun membre pour le moment.</Text>
        )}
      </View>

      {/* Actions */}
      <View style={{ gap:8 }}>
        <Text style={{ fontWeight:'700', marginBottom:4 }}>Actions</Text>

        <TouchableOpacity
          onPress={onShareInvite}
          style={{ backgroundColor:'#111', padding:14, borderRadius:10, alignItems:'center' }}
        >
          <Text style={{ color:'#fff', fontWeight:'600' }}>
            Partager le code d’invitation{inviteCode ? ` (${inviteCode})` : ''}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={onCreateChallenge}
          style={{ backgroundColor:'#f2f2f2', padding:14, borderRadius:10, alignItems:'center', borderWidth:1, borderColor:'#e5e5e5' }}
        >
          <Text style={{ fontWeight:'600' }}>Créer un défi</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={onLeaveGroup}
          style={{ backgroundColor:'#fff5f5', padding:14, borderRadius:10, alignItems:'center', borderWidth:1, borderColor:'#ffd6d6' }}
        >
          <Text style={{ fontWeight:'600', color:'#b00020' }}>Quitter ce groupe</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}