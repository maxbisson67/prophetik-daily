// src/players/PlayerProfileModal.js
import React, { useEffect, useMemo, useState } from "react";
import { Modal, View, Text, TouchableOpacity, ActivityIndicator, Image } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import firestore from "@react-native-firebase/firestore";
import { useTheme } from "@src/theme/ThemeProvider";

function teamLogoUrl(abbr) {
  const a = String(abbr || "").trim().toUpperCase();
  return a ? `https://assets.nhle.com/logos/nhl/svg/${encodeURIComponent(a)}_light.svg` : null;
}

export default function PlayerProfileModal({ visible, playerId, onClose }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const pid = useMemo(() => String(playerId || "").trim(), [playerId]);

  const [loading, setLoading] = useState(false);
  const [doc, setDoc] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!visible) return;
    if (!pid) return;

    setLoading(true);
    setError("");

    const ref = firestore().doc(`nhl_players/${pid}`);
    const unsub = ref.onSnapshot(
      (snap) => {
        setDoc(snap.exists ? { id: snap.id, ...snap.data() } : null);
        setLoading(false);
      },
      (e) => {
        setError(String(e?.message || e));
        setLoading(false);
      }
    );

    return () => {
      try { unsub(); } catch {}
    };
  }, [visible, pid]);

  const fullName = doc?.fullName || doc?.name || "Joueur";
  const teamAbbr = doc?.teamAbbr || doc?.currentTeamAbbr || "";
  const position = doc?.position || doc?.pos || "";
  const sweater = doc?.sweaterNumber || doc?.jerseyNumber || "";

  return (
    <Modal
      visible={!!visible}
      animationType="slide"
      onRequestClose={onClose}
      presentationStyle="pageSheet"
    >
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        {/* Header */}
        <View
          style={{
            paddingTop: 10,
            paddingHorizontal: 16,
            paddingBottom: 12,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
            flexDirection: "row",
            alignItems: "center",
          }}
        >
          <Text style={{ flex: 1, color: colors.text, fontWeight: "900", fontSize: 16 }} numberOfLines={1}>
            {fullName}
          </Text>

          <TouchableOpacity
            onPress={onClose}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: colors.card,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Ionicons name="close" size={20} color={colors.text} />
          </TouchableOpacity>
        </View>

        {/* Body */}
        <View style={{ flex: 1, padding: 16, paddingBottom: 16 + insets.bottom }}>
          {loading ? (
            <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
              <ActivityIndicator color={colors.primary} />
              <Text style={{ color: colors.subtext }}>Chargement…</Text>
            </View>
          ) : error ? (
            <Text style={{ color: "#b91c1c", fontWeight: "800" }}>{error}</Text>
          ) : !doc ? (
            <Text style={{ color: colors.subtext }}>
              Joueur introuvable (id: {pid})
            </Text>
          ) : (
            <View style={{ gap: 12 }}>
              {/* Ligne équipe / meta */}
              <View
                style={{
                  padding: 12,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.card,
                  borderRadius: 12,
                }}
              >
                <Text style={{ color: colors.subtext, fontSize: 12, fontWeight: "800" }}>
                  Équipe
                </Text>
                <Text style={{ color: colors.text, fontWeight: "900", marginTop: 2 }}>
                  {teamAbbr || "—"}
                </Text>

                <Text style={{ color: colors.subtext, marginTop: 8, fontSize: 12, fontWeight: "800" }}>
                  Profil
                </Text>
                <Text style={{ color: colors.text, fontWeight: "900", marginTop: 2 }}>
                  {position ? `Position: ${position}` : "Position: —"}
                  {sweater ? `   •   #${sweater}` : ""}
                </Text>
              </View>

              {/* Debug / data brute (option MVS) */}
              {/* <Text style={{ color: colors.subtext, fontSize: 12 }}>{JSON.stringify(doc, null, 2)}</Text> */}
            </View>
          )}
        </View>
      </SafeAreaView>
    </Modal>
  );
}