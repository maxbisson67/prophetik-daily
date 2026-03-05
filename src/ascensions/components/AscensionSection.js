// src/ascensions/components/AscensionSection.js
import React, { useMemo } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { useLanguage } from "@src/i18n/LanguageProvider";
import i18n from "@src/i18n/i18n";
import useAscensionGlobalState from "../useAscensionGlobalState";

function isLockedByTier(ascKey, tierLower) {
  const k = String(ascKey || "").toUpperCase();
  const t = String(tierLower || "free").toLowerCase();
  return k === "ASC7" && t === "free";
}

export default function AscensionSection({ colors, groupId, ascKey, tierLower, onPressOpen }) {
  const router = useRouter();
  const { lang } = useLanguage();

  // ✅ hooks TOUJOURS appelés
  const locked = useMemo(() => isLockedByTier(ascKey, tierLower), [ascKey, tierLower]);

  // ✅ hook accepte ascKey (ASC4/ASC7) — et retourne { loading, state, error }
  const { loading, state } = useAscensionGlobalState({
    groupId: locked ? null : groupId,
    ascKey: locked ? null : ascKey,
  });

  const header = useMemo(() => {
    const k = String(ascKey || "").toUpperCase();
    const n = k === "ASC7" ? 7 : 4;
    return i18n.t("ascensions.badgeDays", { n, defaultValue: "Ascensions sur {{n}} jours" });
  }, [ascKey, lang]);

  const statusText = useMemo(() => {
    if (!state) return "";
    if (!state.enabled) return i18n.t("ascensions.status.disabled", { defaultValue: "Désactivée" });
    if (state.completed) return i18n.t("ascensions.status.completed", { defaultValue: "Terminée" });
    return i18n.t("ascensions.status.inProgress", { defaultValue: "En cours" });
  }, [state, lang]);

  // ✅ ensuite seulement : returns conditionnels
  if (locked) {
    return (
      <View style={{ backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: 16, padding: 14 }}>
        <Text style={{ color: colors.text, fontWeight: "900" }}>{header}</Text>
        <Text style={{ color: colors.subtext, marginTop: 8 }}>
          {i18n.t("ascensions.lockedAsc7Text", { defaultValue: "Ascension 7 est réservé aux abonnés." })}
        </Text>
        <TouchableOpacity
          onPress={() => router.push("/(drawer)/subscriptions")}
          style={{ marginTop: 12, padding: 12, borderRadius: 12, backgroundColor: "#b91c1c", alignItems: "center" }}
        >
          <Text style={{ color: "#fff", fontWeight: "900" }}>
            {i18n.t("ascensions.viewSubscriptions", { defaultValue: "Voir les abonnements" })}
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={{ backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: 16, padding: 14 }}>
        <ActivityIndicator />
        <Text style={{ marginTop: 8, color: colors.subtext }}>
          {i18n.t("common.loading", { defaultValue: "Chargement…" })}
        </Text>
      </View>
    );
  }

  if (!state || state.enabled === false) return null;

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={() => onPressOpen?.(state)}
      style={{ backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: 16, padding: 14 }}
    >
      <Text style={{ color: colors.text, fontWeight: "900" }}>{header}</Text>
      <Text style={{ color: colors.text, marginTop: 8, fontWeight: "900" }}>{statusText}</Text>

      {!!state.lastTickNote ? (
        <Text style={{ color: colors.subtext, marginTop: 6, fontSize: 12 }}>
          {state.lastTickNote}
        </Text>
      ) : null}
    </TouchableOpacity>
  );
}