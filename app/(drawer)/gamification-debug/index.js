// app/(drawer)/gamification-debug/index.js
import React, { useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useTheme } from "@src/theme/ThemeProvider";
import { useAuth } from "@src/auth/SafeAuthProvider";
import { debugSimulateGamification } from "@src/lib/gamification/debugApi";

const EVENTS = [
  { id: "PARTICIPATION", label: "+1 participation" },
  { id: "JUST_HIT_THREE", label: "justHitThree (3 participations)" },
  { id: "JUST_HIT_FIVE", label: "justHitFive (5 participations)" },

  // 🆕 Nouveau bouton debug pour le streak 3 jours
  { id: "THREE_DAYS_STEP", label: "+1 jour de streak (3 jours consécutifs)" },

  { id: "FIRST_DEFI_CREATED", label: "Premier défi créé" },
  { id: "FIRST_GROUP_CREATED", label: "Premier groupe créé" },
];

export default function GamificationDebugScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const [loadingEvent, setLoadingEvent] = useState(null);

  if (!user?.uid) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={[styles.title, { color: colors.text }]}>
          Debug gamification
        </Text>
        <Text style={{ color: colors.text }}>
          Tu dois être connecté pour utiliser cet écran.
        </Text>
      </View>
    );
  }

  const handleRun = async (eventId) => {
    try {
      setLoadingEvent(eventId);

      const res = await debugSimulateGamification(eventId, {
        uid: user.uid,        // 👈 IMPORTANT : on envoie l'UID à la CF
        // groupId: "...",    // optionnel si tu veux overrider le DEBUG_GROUP_ID
      });

      console.log("debugSimulateGamification result:", res);
      Alert.alert("OK", `Événement ${eventId} simulé pour ${user.uid}`);
    } catch (e) {
      console.log("handleRun error", e);
      Alert.alert("Erreur", e?.message || "Échec de la simulation");
    } finally {
      setLoadingEvent(null);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.title, { color: colors.text }]}>
        Debug gamification
      </Text>

      <Text style={[styles.subtitle, { color: colors.muted }]}>
        Participant courant : {user.uid}
      </Text>

      <Text style={[styles.sectionTitle, { color: colors.text }]}>
        Simuler un événement (via Cloud Function admin)
      </Text>

      {EVENTS.map((ev) => (
        <Pressable
          key={ev.id}
          onPress={() => handleRun(ev.id)}
          style={({ pressed }) => [
            styles.button,
            {
              backgroundColor: pressed
                ? colors.primaryMuted ?? colors.primary
                : colors.primary,
            },
          ]}
          disabled={!!loadingEvent}
        >
          {loadingEvent === ev.id ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>{ev.label}</Text>
          )}
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 12 },
  title: { fontSize: 20, fontWeight: "700", marginBottom: 4 },
  subtitle: { fontSize: 12, marginBottom: 12 },
  sectionTitle: { marginTop: 16, fontSize: 16, fontWeight: "600" },
  button: {
    marginTop: 8,
    borderRadius: 999,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  buttonText: { color: "#fff", fontWeight: "600" },
});