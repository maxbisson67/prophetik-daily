import { useEffect } from "react";
import { View, Text, Switch } from "react-native";
import i18n from "@src/i18n/i18n";
import FavoriteTeamSelector, { favoriteTeamLabel } from "@src/groups/components/FavoriteTeamSelector";
import { normalizeConfigSport } from "@src/groups/hooks/useTeamsBySport";

export { favoriteTeamLabel };

export default function GroupConfigFields({
  colors,
  autopilotEnabled,
  onAutopilotEnabledChange,
  favoriteTeam,
  onFavoriteTeamChange,
  sport = "NHL",
  disabled = false,
  showSectionTitle = true,
  teamListHeight = 240,
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
        <Text style={{ fontWeight: "800", color: colors.text }}>
          {i18n.t("groups.config.sectionTitle", { defaultValue: "Configuration" })}
        </Text>
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
            {i18n.t("groups.config.autopilotHint", {
              defaultValue: "Les défis sont créés automatiquement pour le groupe.",
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
          listHeight={teamListHeight}
        />
      </View>
    </View>
  );
}
