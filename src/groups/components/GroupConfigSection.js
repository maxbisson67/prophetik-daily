import { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator, Alert } from "react-native";
import i18n from "@src/i18n/i18n";
import { updateGroupConfigService } from "@src/groups/manageGroupService";
import GroupConfigFields, { favoriteTeamLabel } from "@src/groups/components/GroupConfigFields";

function configsEqual(a, b) {
  const ap = a?.autopilotEnabled === b?.autopilotEnabled;
  const af = JSON.stringify(a?.favoriteTeam ?? null);
  const bf = JSON.stringify(b?.favoriteTeam ?? null);
  return ap && af === bf;
}

export default function GroupConfigSection({ group, isOwner, colors }) {
  const groupId = group?.id;

  const serverConfig = useMemo(
    () => ({
      autopilotEnabled: group?.autopilotEnabled !== false,
      favoriteTeam: group?.favoriteTeam ?? null,
    }),
    [group?.autopilotEnabled, group?.favoriteTeam]
  );

  const [autopilotEnabled, setAutopilotEnabled] = useState(serverConfig.autopilotEnabled);
  const [favoriteTeam, setFavoriteTeam] = useState(serverConfig.favoriteTeam);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setAutopilotEnabled(serverConfig.autopilotEnabled);
    setFavoriteTeam(serverConfig.favoriteTeam);
  }, [serverConfig]);

  const draftConfig = useMemo(
    () => ({ autopilotEnabled, favoriteTeam }),
    [autopilotEnabled, favoriteTeam]
  );
  const dirty = !configsEqual(draftConfig, serverConfig);

  const onSave = useCallback(async () => {
    if (!groupId || !isOwner || !dirty) return;
    try {
      setSaving(true);
      await updateGroupConfigService({
        groupId,
        autopilotEnabled,
        favoriteTeam,
        sport: group?.sport || group?.league || favoriteTeam?.sport,
      });
    } catch (e) {
      Alert.alert(
        i18n.t("groups.config.saveErrorTitle", { defaultValue: "Erreur" }),
        String(e?.message || e)
      );
    } finally {
      setSaving(false);
    }
  }, [groupId, isOwner, dirty, autopilotEnabled, favoriteTeam]);

  if (!isOwner) {
    return (
      <View
        style={{
          padding: 12,
          borderWidth: 1,
          borderRadius: 12,
          backgroundColor: colors.card,
          borderColor: colors.border,
        }}
      >
        <Text style={{ fontWeight: "800", textAlign: "center", color: colors.text }}>
          {i18n.t("groups.config.sectionTitle", { defaultValue: "Configuration" })}
        </Text>
        <View style={{ marginTop: 10, gap: 6 }}>
          <Text style={{ color: colors.subtext }}>
            {i18n.t("groups.config.autopilotLabel", {
              defaultValue: "Création automatique des défis",
            })}:{" "}
            {serverConfig.autopilotEnabled
              ? i18n.t("common.on", { defaultValue: "Activé" })
              : i18n.t("common.off", { defaultValue: "Désactivé" })}
          </Text>
          <Text style={{ color: colors.subtext }}>
            {i18n.t("groups.config.favoriteTeamLabel", { defaultValue: "Équipe favorite" })}:{" "}
            {favoriteTeamLabel(serverConfig.favoriteTeam)}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View
      style={{
        padding: 12,
        borderWidth: 1,
        borderRadius: 12,
        backgroundColor: colors.card,
        borderColor: colors.border,
        gap: 12,
      }}
    >
      <GroupConfigFields
        colors={colors}
        autopilotEnabled={autopilotEnabled}
        onAutopilotEnabledChange={setAutopilotEnabled}
        favoriteTeam={favoriteTeam}
        onFavoriteTeamChange={setFavoriteTeam}
        sport={group?.sport || group?.favoriteTeam?.sport || "NHL"}
        disabled={saving}
      />

      {dirty && (
        <TouchableOpacity
          onPress={onSave}
          disabled={saving}
          style={{
            backgroundColor: colors.primary,
            padding: 14,
            borderRadius: 10,
            alignItems: "center",
            opacity: saving ? 0.6 : 1,
          }}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={{ color: "#fff", fontWeight: "700" }}>
              {i18n.t("groups.config.save", { defaultValue: "Enregistrer" })}
            </Text>
          )}
        </TouchableOpacity>
      )}
    </View>
  );
}
