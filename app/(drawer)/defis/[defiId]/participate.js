// app/defis/[defiId]/participate-rnfirebase.js
import React, { useEffect, useMemo, useState, useLayoutEffect } from "react";
import { View, Text, ActivityIndicator, TextInput, FlatList, TouchableOpacity, Alert } from "react-native";
import { Stack, useLocalSearchParams, useRouter, useNavigation } from "expo-router";
import { DrawerToggleButton } from "@react-navigation/drawer";
import { HeaderBackButton } from "@react-navigation/elements";
import { Ionicons } from "@expo/vector-icons";
import firestore from "@react-native-firebase/firestore";
import { useAuth } from "@src/auth/SafeAuthProvider";
import { getPlayersForDate } from "@src/nhl/api";

export default function ParticipateScreen() {
  const { user } = useAuth();
  const { defiId } = useLocalSearchParams();
  const router = useRouter();
  const navigation = useNavigation();

  const [loading, setLoading] = useState(true);
  const [defi, setDefi] = useState(null);
  const [error, setError] = useState(null);

  const [allPlayers, setAllPlayers] = useState([]); // {id, fullName, pos, tri}
  const [gamesCount, setGamesCount] = useState(0);
  const [firstISO, setFirstISO] = useState(null);

  const [q, setQ] = useState("");
  const [selected, setSelected] = useState([]); // list of playerId

  // Titre initial (avant d'avoir le défi)
  useLayoutEffect(() => {
    navigation.setOptions({
      title: "Participer",
      headerLeft: ({ tintColor }) => (
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          {navigation.canGoBack() && (
            <HeaderBackButton tintColor={tintColor} onPress={() => navigation.goBack()} />
          )}
          <DrawerToggleButton tintColor={tintColor} />
        </View>
      ),
    });
  }, [navigation]);

  // Charge défi + roster (RNFirebase)
  useEffect(() => {
    (async () => {
      try {
        const ref = firestore().doc(`defis/${String(defiId)}`);
        const snap = await ref.get();
        if (!snap.exists) { setError("Défi introuvable"); setLoading(false); return; }
        const d = { id: snap.id, ...snap.data() };
        setDefi(d);

        const { players, games, firstGameAtUTC } = await getPlayersForDate(d.gameDate);
        setAllPlayers(players || []);
        setGamesCount(games || 0);
        setFirstISO(firstGameAtUTC || null);

        // choix déjà faits ?
        if (user?.uid) {
          const choiceId = `${d.id}_${user.uid}`;
          const cRef = firestore().doc(`defi_choices/${choiceId}`);
          const cSnap = await cRef.get();
          if (cSnap.exists) {
            const dd = cSnap.data() || {};
            if (Array.isArray(dd.players)) setSelected(dd.players.slice(0, d.type));
          }
        }
      } catch (e) {
        console.log(e);
        setError(String(e?.message || e));
      } finally {
        setLoading(false);
      }
    })();
  }, [defiId, user?.uid]);

  // Met à jour le titre quand le défi arrive
  useLayoutEffect(() => {
    const title = defi?.title || (defi?.type ? `Défi ${defi.type}` : "Participer");
    navigation.setOptions({
      title,
      headerLeft: ({ tintColor }) => (
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          {navigation.canGoBack() ? (
            <HeaderBackButton tintColor={tintColor} onPress={() => navigation.goBack()} />
          ) : (
            <TouchableOpacity
              onPress={() => router.replace("/(drawer)/(tabs)/ChallengesScreen")}
              style={{ paddingHorizontal: 8 }}
            >
              <Text style={{ color: tintColor ?? "#111" }}>Retour</Text>
            </TouchableOpacity>
          )}
          <DrawerToggleButton tintColor={tintColor} />
        </View>
      ),
    });
  }, [navigation, router, defi?.title, defi?.type]);

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
    const dl = defi?.signupDeadline;
    const deadline = dl?.toDate?.() ? dl.toDate() : dl ? new Date(dl) : null;
    if (deadline && new Date() > deadline) {
      Alert.alert("Trop tard", "L’heure limite d’inscription est dépassée.");
      return;
    }

    const choiceId = `${defi.id}_${user.uid}`;
    const cRef = firestore().doc(`defi_choices/${choiceId}`);
    await cRef.set({
      id: choiceId,
      defiId: defi.id,
      groupId: defi.groupId,
      userId: user.uid,
      players: selected, // uniquement les playerId !
      createdAt: firestore.FieldValue.serverTimestamp(),
      updatedAt: firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    Alert.alert("Sauvegardé", "Tes choix ont été enregistrés.");
    router.replace("/(drawer)/(tabs)/ChallengesScreen");
  }

  if (loading) {
    return (
      <>
        <Stack.Screen options={{ title: "Chargement…" }} />
        <View style={{ flex:1, alignItems:"center", justifyContent:"center" }}>
          <ActivityIndicator/><Text>Chargement…</Text>
        </View>
      </>
    );
  }

  if (error) {
    return (
      <>
        <Stack.Screen options={{ title: "Erreur" }} />
        <View style={{ flex:1, alignItems:"center", justifyContent:"center", padding:16 }}>
          <Text>Erreur: {String(error)}</Text>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: defi?.title || (defi?.type ? `Défi ${defi.type}` : "Participer"),
          headerLeft: ({ tintColor }) => (
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <HeaderBackButton
                tintColor={tintColor}
                onPress={() => router.replace("/(drawer)/(tabs)/ChallengesScreen")}
              />
              <DrawerToggleButton tintColor={tintColor} />
            </View>
          ),
        }}
      />
      <View style={{ flex:1, padding:16 }}>
        <Text style={{ fontSize:18, fontWeight:"700" }}>
          {defi?.title || `Défi ${defi?.type}x${defi?.type}`}
        </Text>
        <Text style={{ color:"#555", marginBottom:8 }}>
          Date {defi?.gameDate} • {gamesCount} match(s)
          {firstISO ? ` • 1er match ${new Date(firstISO).toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" })}` : ""}
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
          keyExtractor={(it) => String(it.id ?? it.playerId)}
          renderItem={({ item }) => {
            const id = String(item.id ?? item.playerId);
            const active = selected.includes(id);
            return (
              <TouchableOpacity
                onPress={() => togglePick(id)}
                style={{
                  padding:12, borderWidth:1, borderRadius:10, marginBottom:8,
                  backgroundColor: active ? "#111" : "#fff", borderColor: active ? "#111" : "#ddd"
                }}
              >
                <Text style={{ color: active ? "#fff" : "#111", fontWeight:"700" }}>
                  {item.fullName} <Text style={{ fontWeight:"400" }}>({item.pos} • {item.tri})</Text>
                </Text>
                {active && <Text style={{ color:"#fff" }}>Sélectionné</Text>}
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={<Text style={{ color:"#666" }}>Aucun joueur trouvé.</Text>}
        />

        <TouchableOpacity
          onPress={save}
          disabled={selected.length !== maxPick}
          style={{
            marginTop:12, padding:14, borderRadius:12, alignItems:"center",
            backgroundColor: selected.length !== maxPick ? "#9ca3af" : "#111"
          }}
        >
          <Text style={{ color:"#fff", fontWeight:"700" }}>Valider mes {maxPick} choix</Text>
        </TouchableOpacity>
      </View>
    </>
  );
}