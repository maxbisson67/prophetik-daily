import { useEffect } from "react";
import { View, Text, Switch, TextInput } from "react-native";
import i18n from "@src/i18n/i18n";
import FavoriteTeamSelector, { favoriteTeamLabel } from "@src/groups/components/FavoriteTeamSelector";
import { normalizeConfigSport } from "@src/groups/hooks/useTeamsBySport";

export { favoriteTeamLabel };

export default function GroupConfigFields({
  colors,
  groupName,
  onGroupNameChange,
  autopilotEnabled,
  onAutopilotEnabledChange,
  favoriteTeam,
  onFavoriteTeamChange,
  sport = "NHL",
  disabled = false,
  showSectionTitle = true,
}) {
  const normalizedSport = normalizeConfigSport(sport) || "NHL";

  useEffect(() => {
    if (!favoriteTeam) return;
    if (favoriteTeam.sport !== normalizedSport) {
      onFavoriteTeamChange(null);
    }
  }, [normalizedSport, favoriteTeam, onFavoriteTeamChange]);

  return (
    <View style={{ gap: 12 }}>
      {showSectionTitle ? (
        <View style={{ padding: 4 }}>
          <Text style={{ fontSize: 18, fontWeight: "700", color: colors.text }}>
            {i18n.t("groups.config.sectionTitle", { defaultValue: "Configuration" })}
          </Text>
        </View>
      ) : null}

      {onGroupNameChange ? (
        <View>
          <Text style={{ fontWeight: "700", color: colors.text, marginBottom: 8 }}>
            {i18n.t("groups.fieldNameLabel", { defaultValue: "Nom du groupe" })}
          </Text>
          <TextInput
            value={groupName}
            onChangeText={onGroupNameChange}
            editable={!disabled}
            placeholder={i18n.t("groups.fieldNamePlaceholder", {
              defaultValue: "Ex. Les Snipers du Nord",
            })}
            placeholderTextColor={colors.subtext}
            style={{
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 10,
              paddingHorizontal: 12,
              paddingVertical: 10,
              backgroundColor: colors.background,
              color: colors.text,
            }}
          />
        </View>
      ) : null}

      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <View style={{ flex: 1, paddingRight: 12 }}>
          <Text style={{ fontWeight: "700", color: colors.text }}>
            {i18n.t("groups.config.autopilotLabel", {
              defaultValue: "Création automatique des défis",
            })}
          </Text>
          <Text style={{ color: colors.subtext, fontSize: 12, marginTop: 2 }}>
            {autopilotEnabled
              ? i18n.t("groups.config.autopilotHintEnabled", {
                  defaultValue:
                    "Les défis quotidiens sont créés automatiquement chaque matin.",
                })
              : i18n.t("groups.config.autopilotHintDisabled", {
                  defaultValue:
                    "Les défis devront être créés manuellement par le propriétaire.",
                })}
          </Text>
        </View>
        <Switch
          value={autopilotEnabled}
          onValueChange={onAutopilotEnabledChange}
          disabled={disabled}
          trackColor={{ false: colors.border, true: colors.primary }}
        />
      </View>

      <View>
        <Text style={{ fontWeight: "700", color: colors.text, marginBottom: 8 }}>
          {i18n.t("groups.config.favoriteTeamLabel", { defaultValue: "Équipe favorite" })}
        </Text>
        <FavoriteTeamSelector
          sport={normalizedSport}
          value={favoriteTeam}
          onChange={onFavoriteTeamChange}
          colors={colors}
          disabled={disabled}
        />
      </View>
    </View>
  );
}
