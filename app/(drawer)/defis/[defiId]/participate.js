// app/defis/[defiId]/participate-rnfirebase.js
import React, {
  useEffect,
  useMemo,
  useState,
  useLayoutEffect,
} from "react";
import {
  View,
  Text,
  ActivityIndicator,
  TextInput,
  FlatList,
  TouchableOpacity,
  Alert,
  StyleSheet,
} from "react-native";
import {
  Stack,
  useLocalSearchParams,
  useRouter,
  useNavigation,
} from "expo-router";
import { DrawerToggleButton } from "@react-navigation/drawer";
import { HeaderBackButton } from "@react-navigation/elements";
import firestore from "@react-native-firebase/firestore";

import { useAuth } from "@src/auth/SafeAuthProvider";
import { getPlayersForDate } from "@src/nhl/api";
import { useTheme } from "@src/theme/ThemeProvider";

export default function ParticipateScreen() {
  const { user } = useAuth();
  const { defiId } = useLocalSearchParams();
  const router = useRouter();
  const navigation = useNavigation();
  const { colors } = useTheme();
  const styles = makeStyles(colors);

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
      headerStyle: { backgroundColor: colors.card },
      headerTitleStyle: { color: colors.text },
      headerTintColor: colors.text,
      headerLeft: ({ tintColor }) => (
        <View style={styles.headerLeftContainer}>
          {navigation.canGoBack() && (
            <HeaderBackButton
              tintColor={tintColor ?? colors.text}
              onPress={() => navigation.goBack()}
            />
          )}
          <DrawerToggleButton tintColor={tintColor ?? colors.text} />
        </View>
      ),
    });
  }, [navigation, colors.card, colors.text, styles.headerLeftContainer]);

  // Charge défi + roster (RNFirebase)
  useEffect(() => {
    (async () => {
      try {
        const ref = firestore().doc(`defis/${String(defiId)}`);
        const snap = await ref.get();
        if (!snap.exists) {
          setError("Défi introuvable");
          setLoading(false);
          return;
        }
        const d = { id: snap.id, ...snap.data() };
        setDefi(d);

        const { players, games, firstGameAtUTC } = await getPlayersForDate(
          d.gameDate
        );
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
    const title =
      defi?.title || (defi?.type ? `Défi ${defi.type}` : "Participer");
    navigation.setOptions({
      title,
      headerStyle: { backgroundColor: colors.card },
      headerTitleStyle: { color: colors.text },
      headerTintColor: colors.text,
      headerLeft: ({ tintColor }) => (
        <View style={styles.headerLeftContainer}>
          {navigation.canGoBack() ? (
            <HeaderBackButton
              tintColor={tintColor ?? colors.text}
              onPress={() => navigation.goBack()}
            />
          ) : (
            <TouchableOpacity
              onPress={() => router.replace("/(drawer)/(tabs)/ChallengesScreen")}
              style={styles.headerBackTouchable}
            >
              <Text style={[styles.headerBackText, { color: tintColor ?? colors.text }]}>
                Retour
              </Text>
            </TouchableOpacity>
          )}
          <DrawerToggleButton tintColor={tintColor ?? colors.text} />
        </View>
      ),
    });
  }, [navigation, router, defi?.title, defi?.type, colors.card, colors.text, styles.headerLeftContainer, styles.headerBackText, styles.headerBackTouchable]);

  const maxPick = useMemo(
    () => Number(defi?.type || 1),
    [defi?.type]
  );

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    if (!qq) return allPlayers;
    return allPlayers.filter(
      (p) =>
        (p.fullName || "").toLowerCase().includes(qq) ||
        (p.tri || "").toLowerCase().includes(qq) ||
        (p.pos || "").toLowerCase().includes(qq)
    );
  }, [q, allPlayers]);

  function togglePick(id) {
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= maxPick) return prev; // pas plus que N
      return [...prev, id];
    });
  }

  async function save() {
    if (!user?.uid) {
      Alert.alert("Connexion requise");
      return;
    }
    if (selected.length !== maxPick) {
      Alert.alert(
        "Sélection incomplète",
        `Choisis exactement ${maxPick} joueur(s).`
      );
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
    await cRef.set(
      {
        id: choiceId,
        defiId: defi.id,
        groupId: defi.groupId,
        userId: user.uid,
        players: selected,
        createdAt: firestore.FieldValue.serverTimestamp(),
        updatedAt: firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    Alert.alert("Sauvegardé", "Tes choix ont été enregistrés.");
    router.replace("/(drawer)/(tabs)/ChallengesScreen");
  }

  if (loading) {
    return (
      <>
        <Stack.Screen
          options={{
            title: "Chargement…",
            headerStyle: { backgroundColor: colors.card },
            headerTitleStyle: { color: colors.text },
            headerTintColor: colors.text,
          }}
        />
        <View style={[styles.screen, styles.center]}>
          <ActivityIndicator color={colors.primary} />
          <Text style={[styles.subtext, { marginTop: 8 }]}>
            Chargement…
          </Text>
        </View>
      </>
    );
  }

  if (error) {
    return (
      <>
        <Stack.Screen
          options={{
            title: "Erreur",
            headerStyle: { backgroundColor: colors.card },
            headerTitleStyle: { color: colors.text },
            headerTintColor: colors.text,
          }}
        />
        <View style={[styles.screen, styles.center, { padding: 16 }]}>
          <Text style={styles.text}>
            Erreur: {String(error)}
          </Text>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title:
            defi?.title || (defi?.type ? `Défi ${defi.type}` : "Participer"),
          headerStyle: { backgroundColor: colors.card },
          headerTitleStyle: { color: colors.text },
          headerTintColor: colors.text,
          headerLeft: ({ tintColor }) => (
            <View style={styles.headerLeftContainer}>
              <HeaderBackButton
                tintColor={tintColor ?? colors.text}
                onPress={() =>
                  router.replace("/(drawer)/(tabs)/ChallengesScreen")
                }
              />
              <DrawerToggleButton tintColor={tintColor ?? colors.text} />
            </View>
          ),
        }}
      />
      <View style={styles.screen}>
        <Text style={styles.title}>
          {defi?.title || `Défi ${defi?.type}x${defi?.type}`}
        </Text>
        <Text style={[styles.subtext, { marginBottom: 8 }]}>
          Date {defi?.gameDate} • {gamesCount} match(s)
          {firstISO
            ? ` • 1er match ${new Date(firstISO).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}`
            : ""}
        </Text>

        <TextInput
          placeholder="Rechercher (nom, équipe, pos)…"
          placeholderTextColor={colors.subtext}
          value={q}
          onChangeText={setQ}
          style={styles.searchInput}
        />

        <Text style={[styles.text, { marginBottom: 6 }]}>
          Sélection: {selected.length}/{maxPick}
        </Text>

        <FlatList
          data={filtered}
          keyExtractor={(it) => String(it.id ?? it.playerId)}
          renderItem={({ item }) => {
            const id = String(item.id ?? item.playerId);
            const active = selected.includes(id);
            return (
              <TouchableOpacity
                onPress={() => togglePick(id)}
                style={[
                  styles.playerItem,
                  active && styles.playerItemActive,
                ]}
              >
                <Text
                  style={[
                    styles.playerName,
                    active && styles.playerNameActive,
                  ]}
                >
                  {item.fullName}{" "}
                  <Text
                    style={[
                      styles.playerMeta,
                      active && styles.playerMetaActive,
                    ]}
                  >
                    ({item.pos} • {item.tri})
                  </Text>
                </Text>
                {active && (
                  <Text style={styles.playerSelectedText}>
                    Sélectionné
                  </Text>
                )}
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            <Text style={styles.subtext}>
              Aucun joueur trouvé.
            </Text>
          }
        />

        <TouchableOpacity
          onPress={save}
          disabled={selected.length !== maxPick}
          style={[
            styles.validateButton,
            selected.length !== maxPick && styles.validateButtonDisabled,
          ]}
        >
          <Text style={styles.validateButtonText}>
            Valider mes {maxPick} choix
          </Text>
        </TouchableOpacity>
      </View>
    </>
  );
}

/* ============================
   Styles thème-aware
============================ */
function makeStyles(colors) {
  return StyleSheet.create({
    screen: {
      flex: 1,
      padding: 16,
      backgroundColor: colors.background,
    },
    center: {
      alignItems: "center",
      justifyContent: "center",
    },
    headerLeftContainer: {
      flexDirection: "row",
      alignItems: "center",
    },
    headerBackTouchable: {
      paddingHorizontal: 8,
    },
    headerBackText: {
      fontWeight: "600",
    },
    text: {
      color: colors.text,
    },
    subtext: {
      color: colors.subtext,
    },
    title: {
      fontSize: 18,
      fontWeight: "700",
      color: colors.text,
    },
    searchInput: {
      borderWidth: 1,
      borderRadius: 10,
      padding: 10,
      marginBottom: 10,
      borderColor: colors.border,
      backgroundColor: colors.card,
      color: colors.text,
    },
    playerItem: {
      padding: 12,
      borderWidth: 1,
      borderRadius: 10,
      marginBottom: 8,
      backgroundColor: colors.card,
      borderColor: colors.border,
    },
    playerItemActive: {
      backgroundColor: "#ef4444",
      borderColor: "#ef4444",
    },
    playerName: {
      fontWeight: "700",
      color: colors.text,
    },
    playerNameActive: {
      color: "#fff",
    },
    playerMeta: {
      fontWeight: "400",
      color: colors.subtext,
    },
    playerMetaActive: {
      color: "#e5e7eb",
    },
    playerSelectedText: {
      color: "#fee2e2",
      marginTop: 2,
    },
    validateButton: {
      marginTop: 12,
      padding: 14,
      borderRadius: 12,
      alignItems: "center",
      backgroundColor: "#ef4444",
    },
    validateButtonDisabled: {
      backgroundColor: colors.subtext,
    },
    validateButtonText: {
      color: "#fff",
      fontWeight: "700",
    },
  });
}