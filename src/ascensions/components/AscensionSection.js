// src/ascensions/components/AscensionSection.js
import React, { useMemo } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator,Image } from "react-native";
import { useRouter } from "expo-router";
import useAscensionGlobalState from "../useAscensionGlobalState";

function badgeLabel(ascKey) {
  const k = String(ascKey || "").toUpperCase();
  return k === "ASC7" ? "Ascensions sur 7 jours" : "Ascensions sur 4 jours";
}

function titleLabel(ascKey) {
  const k = String(ascKey || "").toUpperCase();
  return k === "ASC7" ? "Ascension 7" : "Ascension 4";
}

function isLockedByTier(ascKey, tierLower) {
  const k = String(ascKey || "").toUpperCase();
  const t = String(tierLower || "free").toLowerCase();

  // 👉 règle simple (ajuste si tu veux: vip seulement, etc.)
  if (k === "ASC7" && t === "free") return true;
  return false;
}

function fmtRange(startYmd, endYmd) {
  if (!startYmd && !endYmd) return null;
  if (startYmd && endYmd) return `${startYmd} → ${endYmd}`;
  return startYmd || endYmd;
}

export default function AscensionSection({
  colors,
  groupId,
  ascKey,
  tierLower,
  onPressOpen, // optionnel: ouvrir un écran ascension
}) {
  const router = useRouter();
  const locked = isLockedByTier(ascKey, tierLower);

  const { loading, state } = useAscensionGlobalState({
    groupId: locked ? null : groupId, // ⚠️ si locked, on évite même le read
    ascKey: locked ? null : ascKey,
  });

  const header = useMemo(() => badgeLabel(ascKey), [ascKey]);
  const title = useMemo(() => titleLabel(ascKey), [ascKey]);

  const ASC4_ICON = require("@src/assets/asc4.png");
  const ASC7_ICON = require("@src/assets/asc7.png");  

  const kUpper = String(ascKey || "").toUpperCase();
    
  const ascIcon = kUpper === "ASC7" ? ASC7_ICON : ASC4_ICON;


  const containerStyle = {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
  };

  const pillStyle = {
    alignSelf: "flex-start",
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: colors.card2,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 10,
  };

  // --- LOCKED UI (CTA) ---
  if (locked) {
    return (
      <View style={containerStyle}>
        <View style={[pillStyle, { flexDirection: "row", alignItems: "center", gap: 8 }]}>
            <Image source={ascIcon} style={{ width: 18, height: 18 }} resizeMode="contain" />
        <Text style={{ color: colors.text, fontWeight: "900", fontSize: 12 }}>{header}</Text>
        </View>

        <Text style={{ color: colors.subtext, marginTop: 6 }}>
          Débloque Ascension 7 pour accéder à la quête hebdomadaire (Dim→Sam) et au suivi complet.
        </Text>

        <TouchableOpacity
          onPress={() => router.push("/(drawer)/subscriptions")}
          style={{
            marginTop: 12,
            backgroundColor: "#111",
            paddingVertical: 10,
            borderRadius: 12,
            alignItems: "center",
          }}
        >
          <Text style={{ color: "#fff", fontWeight: "900" }}>Voir les abonnements</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // --- LOADING ---
  if (loading) {
    return (
      <View style={containerStyle}>
        <View style={[pillStyle, { flexDirection: "row", alignItems: "center", gap: 8 }]}>
            <Image source={ascIcon} style={{ width: 18, height: 18 }} resizeMode="contain" />
        <Text style={{ color: colors.text, fontWeight: "900", fontSize: 12 }}>{header}</Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <ActivityIndicator />
          <Text style={{ marginLeft: 10, color: colors.subtext }}>Chargement…</Text>
        </View>
      </View>
    );
  }

  // --- EMPTY (no doc) ---
  if (!state) {
    return (
      <View style={containerStyle}>
        <View style={[pillStyle, { flexDirection: "row", alignItems: "center", gap: 8 }]}>
            <Image source={ascIcon} style={{ width: 18, height: 18 }} resizeMode="contain" />
        <Text style={{ color: colors.text, fontWeight: "900", fontSize: 12 }}>{header}</Text>
        </View>
     
        <Text style={{ color: colors.subtext, marginTop: 6 }}>
          Pas encore initialisée pour ce groupe.
        </Text>
      </View>
    );
  }

  const completedCount = (state.completedWinners || []).length;
  const isCompleted = completedCount > 0;

  const range = fmtRange(state.cycleStartYmd, state.cycleEndYmd);
  const nextYmd = state.nextGameYmd || null;

  const statusText = !state.enabled
    ? "Désactivée"
    : isCompleted
    ? `Complétée (${completedCount} gagnant${completedCount > 1 ? "s" : ""})`
    : "En cours";

  const statusColor = !state.enabled
    ? colors.subtext
    : isCompleted
    ? "#16a34a"
    : colors.text;

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={() => {
        if (onPressOpen) return onPressOpen(state);
        // option: une page dédiée
        // router.push(`/(drawer)/ascensions/${String(groupId)}/${String(ascKey).toUpperCase()}`);
      }}
      style={containerStyle}
    >
    <View style={[pillStyle, { flexDirection: "row", alignItems: "center", gap: 8 }]}>
        <Image source={ascIcon} style={{ width:36, height: 36 }} resizeMode="contain" />
        <Text style={{ color: colors.text, fontWeight: "900", fontSize: 12 }}>{header}</Text>
    </View>

      <Text style={{ color: statusColor, marginTop: 6, fontWeight: "800" }}>
        {statusText}
      </Text>

      {range ? (
        <Text style={{ color: colors.subtext, marginTop: 6 }}>
          Cycle: {range}
        </Text>
      ) : null}

      {nextYmd ? (
        <Text style={{ color: colors.subtext, marginTop: 4 }}>
          Prochaine étape: {nextYmd}
        </Text>
      ) : null}

    </TouchableOpacity>
  );
}