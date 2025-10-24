import React, { useEffect, useMemo, useState } from "react";
import { View, Text, ActivityIndicator, TextInput, FlatList, TouchableOpacity, Alert } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "@src/lib/firebase";
import { useAuth } from "@src/auth/AuthProvider";
import { getPlayersForDate } from "@src/nhl/api";

export default function ParticipateScreen() {
  const { user } = useAuth();
  const { defiId } = useLocalSearchParams();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [defi, setDefi] = useState(null);
  const [error, setError] = useState(null);

  const [allPlayers, setAllPlayers] = useState([]); // {id, fullName, pos, tri}
  const [gamesCount, setGamesCount] = useState(0);
  const [firstISO, setFirstISO] = useState(null);

  const [q, setQ] = useState("");
  const [selected, setSelected] = useState([]); // list of playerId

  // charge défi
  useEffect(() => {
    (async () => {
      try {
        const snap = await getDoc(doc(db, "defis", String(defiId)));
        if (!snap.exists()) { setError("Défi introuvable"); setLoading(false); return; }
        const d = { id: snap.id, ...snap.data() };
        setDefi(d);

        // roster du jour
        const { players, games, firstGameAtUTC } = await getPlayersForDate(d.gameDate);
        setAllPlayers(players);
        setGamesCount(games);
        setFirstISO(firstGameAtUTC);

        // si l’utilisateur a déjà des choix, pré-charger (optionnel)
        const choiceId = `${d.id}_${user?.uid || "anon"}`;
        const cSnap = await getDoc(doc(db, "defi_choices", choiceId));
        if (cSnap.exists()) {
          const dd = cSnap.data();
          if (Array.isArray(dd.players)) setSelected(dd.players.slice(0, d.type));
        }
      } catch (e) {
        console.log(e);
        setError(String(e?.message || e));
      } finally {
        setLoading(false);
      }
    })();
  }, [defiId, user?.uid]);

  const maxPick = useMemo(() => Number(defi?.type || 1), [defi?.type]);
  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    if (!qq) return allPlayers;
    return allPlayers.filter(p =>
      (p.fullName || "").toLowerCase().includes(qq) ||
      (p.tri || "").toLowerCase().includes(qq) ||
      (p.pos || "").toLowerCase().includes(qq)
    );
  }, [q, allPlayers]);

  function togglePick(id) {
    setSelected(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id);
      if (prev.length >= maxPick) return prev; // pas plus que N
      return [...prev, id];
    });
  }

  async function save() {
    if (!user?.uid) { Alert.alert("Connexion requise"); return; }
    if (selected.length !== maxPick) {
      Alert.alert("Sélection incomplète", `Choisis exactement ${maxPick} joueur(s).`);
      return;
    }
    // deadline respectée ?
    if (defi?.signupDeadline?.toDate) {
      if (new Date() > defi.signupDeadline.toDate()) {
        Alert.alert("Trop tard", "L’heure limite d’inscription est dépassée.");
        return;
      }
    }

    const choiceId = `${defi.id}_${user.uid}`;
    await setDoc(doc(db, "defi_choices", choiceId), {
      id: choiceId,
      defiId: defi.id,
      groupId: defi.groupId,
      userId: user.uid,
      players: selected,         // <— uniquement les playerId !
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    }, { merge: true });

    Alert.alert("Sauvegardé", "Tes choix ont été enregistrés.");
    router.back();
  }

  if (loading) return (
    <View style={{ flex:1, alignItems:'center', justifyContent:'center' }}>
      <ActivityIndicator/><Text>Chargement…</Text>
    </View>
  );
  if (error) return (
    <View style={{ flex:1, alignItems:'center', justifyContent:'center', padding:16 }}>
      <Text>Erreur: {String(error)}</Text>
    </View>
  );

  return (
    <View style={{ flex:1, padding:16 }}>
      <Text style={{ fontSize:18, fontWeight:'700' }}>{defi?.title || `Défi ${defi?.type}x${defi?.type}`}</Text>
      <Text style={{ color:'#555', marginBottom:8 }}>
        Date {defi?.gameDate} • {gamesCount} match(s){firstISO ? ` • 1er match ${new Date(firstISO).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}` : ""}
      </Text>

      <TextInput
        placeholder="Rechercher (nom, équipe, pos)…"
        value={q}
        onChangeText={setQ}
        style={{ borderWidth:1, borderRadius:10, padding:10, marginBottom:10 }}
      />

      <Text style={{ marginBottom:6 }}>Sélection: {selected.length}/{maxPick}</Text>

      <FlatList
        data={filtered}
        keyExtractor={(it) => it.id}
        renderItem={({ item }) => {
          const active = selected.includes(item.id);
          return (
            <TouchableOpacity
              onPress={() => togglePick(item.id)}
              style={{
                padding:12, borderWidth:1, borderRadius:10, marginBottom:8,
                backgroundColor: active ? '#111' : '#fff', borderColor: active ? '#111' : '#ddd'
              }}
            >
              <Text style={{ color: active ? '#fff' : '#111', fontWeight:'700' }}>
                {item.fullName} <Text style={{ fontWeight:'400' }}>({item.pos} • {item.tri})</Text>
              </Text>
              {active && <Text style={{ color:'#fff' }}>Sélectionné</Text>}
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={<Text style={{ color:'#666' }}>Aucun joueur trouvé.</Text>}
      />

      <TouchableOpacity
        onPress={save}
        disabled={selected.length !== maxPick}
        style={{
          marginTop:12, padding:14, borderRadius:12, alignItems:'center',
          backgroundColor: selected.length !== maxPick ? '#9ca3af' : '#111'
        }}
      >
        <Text style={{ color:'#fff', fontWeight:'700' }}>Valider mes {maxPick} choix</Text>
      </TouchableOpacity>
    </View>
  );
}