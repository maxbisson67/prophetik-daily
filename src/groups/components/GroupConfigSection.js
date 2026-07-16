import { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator, Alert } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import i18n from "@src/i18n/i18n";
import { updateGroupConfigService } from "@src/groups/manageGroupService";
import GroupConfigFields, { favoriteTeamLabel } from "@src/groups/components/GroupConfigFields";
import { parseGroupConfigError } from "@src/subscriptions/autopilotErrors";

const RED = "#b91c1c";

function leftAccentCardStyle(colors) {
  return {
    backgroundColor: colors.card,
    borderRadius: 16,
    overflow: "hidden",
    padding: 12,
    borderLeftWidth: 4,
    borderLeftColor: RED,
  };
}

function configsEqual(a, b) {
  const an = String(a?.name || "").trim() === String(b?.name || "").trim();
  const ap = a?.autopilotEnabled === b?.autopilotEnabled;
  const af = JSON.stringify(a?.favoriteTeam ?? null);
  const bf = JSON.stringify(b?.favoriteTeam ?? null);
  return an && ap && af === bf;
}

export default function GroupConfigSection({ group, isOwner, colors, onFavoriteTeamDraftChange }) {
  const groupId = group?.id;

  const serverConfig = useMemo(
    () => ({
      name: String(group?.name || group?.title || "").trim(),
      autopilotEnabled: group?.autopilotEnabled !== false,
      favoriteTeam: group?.favoriteTeam ?? null,
    }),
    [group?.name, group?.title, group?.autopilotEnabled, group?.favoriteTeam]
  );

  const [groupName, setGroupName] = useState(serverConfig.name);
  const [autopilotEnabled, setAutopilotEnabled] = useState(serverConfig.autopilotEnabled);
  const [favoriteTeam, setFavoriteTeam] = useState(serverConfig.favoriteTeam);
  const [saving, setSaving] = useState(false);

  const resetDraftFromServer = useCallback(() => {
    setGroupName(serverConfig.name);
    setAutopilotEnabled(serverConfig.autopilotEnabled);
    setFavoriteTeam(serverConfig.favoriteTeam);
    onFavoriteTeamDraftChange?.(serverConfig.favoriteTeam);
  }, [serverConfig, onFavoriteTeamDraftChange]);

  useEffect(() => {
    resetDraftFromServer();
  }, [resetDraftFromServer]);

  useFocusEffect(
    useCallback(() => {
      resetDraftFromServer();
    }, [resetDraftFromServer])
  );

  useEffect(() => {
    onFavoriteTeamDraftChange?.(favoriteTeam);
  }, [favoriteTeam, onFavoriteTeamDraftChange]);

  const draftConfig = useMemo(
    () => ({ name: groupName, autopilotEnabled, favoriteTeam }),
    [groupName, autopilotEnabled, favoriteTeam]
  );
  const dirty = !configsEqual(draftConfig, serverConfig);

  const onSave = useCallback(async () => {
    if (!groupId || !isOwner || !dirty) return;

    const trimmedName = String(groupName || "").trim();
    if (!trimmedName) {
      Alert.alert(
        i18n.t("groups.alertNameRequiredTitle", { defaultValue: "Nom requis" }),
        i18n.t("groups.alertNameRequiredMessage", {
          defaultValue: "Donne un nom à ton groupe.",
        })
      );
      return;
    }

    try {
      setSaving(true);
      await updateGroupConfigService({
        groupId,
        name: trimmedName,
        autopilotEnabled,
        favoriteTeam,
        sport: group?.sport || group?.league || favoriteTeam?.sport,
      });
    } catch (e) {
      Alert.alert(
        i18n.t("groups.config.saveErrorTitle", { defaultValue: "Erreur" }),
        parseGroupConfigError(e)
      );
    } finally {
      setSaving(false);
    }
  }, [groupId, isOwner, dirty, groupName, autopilotEnabled, favoriteTeam, group?.sport, group?.league]);

  if (!isOwner) {
    return (
      <View style={leftAccentCardStyle(colors)}>
        <View style={{ padding: 4 }}>
          <Text style={{ fontSize: 18, fontWeight: "700", color: colors.text }}>
            {i18n.t("groups.config.sectionTitle", { defaultValue: "Configuration" })}
          </Text>
        </View>
        <View style={{ marginTop: 10, gap: 6 }}>
          <Text style={{ color: colors.subtext }}>
            {i18n.t("groups.fieldNameLabel", { defaultValue: "Nom du groupe" })}:{" "}
            {serverConfig.name || "—"}
          </Text>
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
    <View style={[leftAccentCardStyle(colors), { gap: 12 }]}>
      <GroupConfigFields
        colors={colors}
        groupName={groupName}
        onGroupNameChange={setGroupName}
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
