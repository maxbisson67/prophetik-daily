// src/ascensions/components/AscensionJackpotBanner.js
// ✅ AscensionJackpotBanner — ASC7 only
// - Affiche un mini bandeau “Sommet Prophetik” + jackpot (+2/jour)
// - Optionnel: CTA pour ouvrir le progrès (si onPress fourni)
// - Ne dépend plus de ASC4

import React, { useMemo } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import i18n from "@src/i18n/i18n";
import useAscensionGlobalState from "@src/ascensions/useAscensionGlobalState";

function toNum(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export default function AscensionJackpotBanner({
  colors,
  groupId,
  onPress, // optionnel: open progress modal
  hideWhenDisabled = true,
}) {
  const asc7 = useAscensionGlobalState({ groupId, ascKey: "ASC7" });

  const enabled = !!asc7?.state?.enabled;
  const jackpotTotal = toNum(asc7?.state?.jackpotTotal, 0);

  // "En cours" si run actif et pas complété
  const inProgress = useMemo(() => {
    const st = asc7?.state || null;
    if (!st) return false;
    if (st.enabled === false) return false;
    if (!st.activeRunId) return false;
    return st.completed !== true;
  }, [asc7?.state]);

  // Masquer si pas pertinent
  if (!groupId) return null;
  if (!enabled && hideWhenDisabled) return null;

  const Wrapper = onPress ? TouchableOpacity : View;
  const wrapperProps = onPress
    ? { onPress, activeOpacity: 0.9 }
    : {};

  return (
    <Wrapper
      {...wrapperProps}
      style={{
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.card,
        borderRadius: 16,
        padding: 12,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <View style={{ flexDirection: "row", alignItems: "center", flexShrink: 1 }}>
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: 12,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: colors.card2,
              borderWidth: 1,
              borderColor: colors.border,
              marginRight: 10,
            }}
          >
            <Text style={{ fontSize: 18 }}>🏔</Text>
          </View>

          <View style={{ flexShrink: 1 }}>
            <Text style={{ color: colors.text, fontWeight: "900", fontSize: 14 }}>
              {i18n.t("ascensions.summit.title", { defaultValue: "Sommet Prophetik" })}
            </Text>

            <Text style={{ color: colors.subtext, marginTop: 2 }} numberOfLines={2}>
              {inProgress
                ? i18n.t("ascensions.banner.inProgress", { defaultValue: "Ascension en cours — continue ta quête." })
                : i18n.t("ascensions.banner.ready", { defaultValue: "Prêt pour une nouvelle quête ?" })}
            </Text>
          </View>
        </View>

        <View style={{ alignItems: "flex-end", flexShrink: 0 }}>
          <Text style={{ color: colors.subtext, fontWeight: "800", fontSize: 12 }}>
            {i18n.t("ascensions.labels.jackpot", { defaultValue: "Jackpot" })}
          </Text>
          <Text style={{ color: colors.text, fontWeight: "900", fontSize: 16 }}>
            {jackpotTotal}
          </Text>
        </View>
      </View>

      <View style={{ marginTop: 10 }}>
        <Text style={{ color: colors.subtext }}>
          {i18n.t("ascensions.labels.dailyPlus", { defaultValue: "+2 points ajoutés par jour" })}
        </Text>

        {onPress ? (
          <Text style={{ color: colors.text, fontWeight: "900", marginTop: 6 }}>
            {i18n.t("ascensions.banner.cta", { defaultValue: "Voir ma progression →" })}
          </Text>
        ) : null}
      </View>
    </Wrapper>
  );
}