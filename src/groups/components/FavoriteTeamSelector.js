import { useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import i18n from "@src/i18n/i18n";
import { useTeamsBySport } from "@src/groups/hooks/useTeamsBySport";
import TeamLogoBadge from "@src/sports/TeamLogoBadge";

export function favoriteTeamLabel(favoriteTeam) {
  if (!favoriteTeam) {
    return i18n.t("groups.config.noFavoriteTeam", { defaultValue: "Aucune équipe" });
  }
  const abbr = favoriteTeam.abbreviation || "—";
  const name = favoriteTeam.name || "";
  return name && name !== abbr ? `${abbr} • ${name}` : abbr;
}

function teamsMatch(a, b) {
  if (!a || !b) return false;
  return a.sport === b.sport && a.teamId === b.teamId;
}

/**
 * Liste d'équipes toujours visible (pas de modal / dropdown).
 * Fiable dans les ScrollView et Modal iOS.
 */
export default function FavoriteTeamSelector({
  sport,
  value,
  onChange,
  colors,
  disabled = false,
  listHeight = 240,
}) {
  const [query, setQuery] = useState("");
  const { teams, loading, usingFallback } = useTeamsBySport(sport);

  const filteredTeams = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return teams;
    return teams.filter(
      (t) =>
        t.abbreviation.toLowerCase().includes(q) ||
        t.name.toLowerCase().includes(q)
    );
  }, [teams, query]);

  return (
    <View style={{ gap: 8 }}>
      {value ? (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            padding: 10,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: colors.primary,
            backgroundColor: colors.card2 || colors.background,
            gap: 10,
          }}
        >
          <TeamLogoBadge team={value} size={26} colors={colors} />
          <Text style={{ color: colors.text, fontWeight: "700", flex: 1 }}>
            {favoriteTeamLabel(value)}
          </Text>
          {!disabled ? (
            <TouchableOpacity onPress={() => onChange(null)} hitSlop={8}>
              <Text style={{ color: colors.subtext, fontWeight: "700" }}>
                {i18n.t("groups.config.clearFavoriteTeam", { defaultValue: "Retirer" })}
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}

      <TextInput
        value={query}
        onChangeText={setQuery}
        editable={!disabled}
        placeholder={i18n.t("groups.config.searchTeam", {
          defaultValue: "Rechercher une équipe…",
        })}
        placeholderTextColor={colors.subtext}
        autoCorrect={false}
        autoCapitalize="characters"
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

      <Text style={{ color: colors.subtext, fontSize: 12 }}>
        {loading
          ? i18n.t("groups.config.loadingTeams", { defaultValue: "Chargement…" })
          : `${teams.length} ${i18n.t("groups.config.teamsCount", { defaultValue: "équipes" })}${
              usingFallback ? " · liste locale" : ""
            }`}
      </Text>

      <View
        style={{
          height: listHeight,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 10,
          overflow: "hidden",
          backgroundColor: colors.card,
        }}
      >
        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : filteredTeams.length === 0 ? (
          <Text style={[styles.empty, { color: colors.subtext }]}>
            {i18n.t("groups.config.noTeamsAvailable", {
              defaultValue: "Aucune équipe disponible.",
            })}
          </Text>
        ) : (
          <ScrollView
            style={{ flex: 1 }}
            nestedScrollEnabled
            keyboardShouldPersistTaps="always"
            showsVerticalScrollIndicator
          >
            {filteredTeams.map((item) => {
              const selected = teamsMatch(value, item);
              return (
                <TouchableOpacity
                  key={`${item.sport}:${item.teamId}`}
                  disabled={disabled}
                  onPress={() => onChange(item)}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 10,
                    paddingHorizontal: 12,
                    paddingVertical: 11,
                    borderBottomWidth: StyleSheet.hairlineWidth,
                    borderBottomColor: colors.border,
                    backgroundColor: selected ? colors.card2 || colors.background : "transparent",
                  }}
                >
                  <TeamLogoBadge team={item} size={24} colors={colors} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: "800", color: colors.text }}>
                      {item.abbreviation}
                    </Text>
                    <Text style={{ color: colors.subtext, fontSize: 13, marginTop: 2 }}>
                      {item.name}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  empty: {
    textAlign: "center",
    padding: 16,
    fontSize: 13,
  },
});
