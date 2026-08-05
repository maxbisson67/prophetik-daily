import React, { useState } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator, Alert } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import i18n from "@src/i18n/i18n";
import { useTheme } from "@src/theme/ThemeProvider";
import { PROPHETIK_RED, prophetikCardShadow } from "@src/achievements/components/prophetikCardStyles";
import { setMembershipParticipationService } from "@src/groups/setMembershipParticipationService";
import { PARTICIPATION } from "@src/groups/participationUtils";

export default function SportSeasonSwitchBanner({ prompt, onDismiss, onActivated }) {
  const { colors } = useTheme();
  const [busy, setBusy] = useState(false);

  if (!prompt?.inactiveGroup) return null;

  const inactiveName = prompt.inactiveGroup.name || prompt.inactiveGroup.id;
  const activeName = prompt.activeGroup?.name || "";
  const sportLabel = prompt.sportLabel || "NHL";

  const onActivate = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await setMembershipParticipationService({
        groupId: prompt.inactiveGroup.id,
        participation: PARTICIPATION.ACTIVE,
      });
      Alert.alert(
        i18n.t("groups.participation.activateSuccessTitle", {
          defaultValue: "Participation activée",
        }),
        i18n.t("groups.participation.switchSuccessMessage", {
          defaultValue: "Tu participes maintenant aux défis de ce groupe.",
        })
      );
      onActivated?.(prompt.inactiveGroup.id);
    } catch (e) {
      Alert.alert(
        i18n.t("groups.alertErrorTitle", { defaultValue: "Erreur" }),
        String(e?.message || e)
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <View
      style={[
        {
          borderRadius: 10,
          borderWidth: 1,
          borderColor: "rgba(59,130,246,0.35)",
          backgroundColor: "rgba(59,130,246,0.1)",
          paddingHorizontal: 14,
          paddingVertical: 12,
          borderLeftWidth: 4,
          borderLeftColor: "#2563eb",
        },
        prophetikCardShadow(),
      ]}
    >
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
        <MaterialCommunityIcons name="swap-horizontal" size={22} color="#2563eb" style={{ marginTop: 1 }} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.text, fontWeight: "900", fontSize: 14 }}>
            {i18n.t("home.sportSwitch.title", {
              defaultValue: "Nouvelle saison {{sport}}",
              sport: sportLabel,
            })}
          </Text>
          <Text style={{ color: colors.subtext, marginTop: 4, fontSize: 13, lineHeight: 18 }}>
            {i18n.t("home.sportSwitch.body", {
              defaultValue:
                "Tu es actif dans « {{activeGroup}} ». Active « {{inactiveGroup}} » pour jouer les défis {{sport}} — ton autre groupe passera en mode inactif.",
              activeGroup: activeName,
              inactiveGroup: inactiveName,
              sport: sportLabel,
            })}
          </Text>

          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 10 }}>
            <TouchableOpacity
              onPress={onActivate}
              disabled={busy}
              activeOpacity={0.85}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: 8,
                backgroundColor: PROPHETIK_RED,
                opacity: busy ? 0.7 : 1,
              }}
            >
              {busy ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={{ color: "#fff", fontWeight: "800", fontSize: 12 }}>
                  {i18n.t("home.sportSwitch.activateCta", {
                    defaultValue: "Activer {{group}}",
                    group: inactiveName,
                  })}
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity onPress={onDismiss} disabled={busy} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={{ color: colors.subtext, fontWeight: "700", fontSize: 12, paddingVertical: 8 }}>
                {i18n.t("home.sportSwitch.dismiss", { defaultValue: "Plus tard" })}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );
}
