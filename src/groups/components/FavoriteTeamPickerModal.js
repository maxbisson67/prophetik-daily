import { useMemo } from "react";
import {
  View,
  Text,
  Modal,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Pressable,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import i18n from "@src/i18n/i18n";
import { useTeamsBySport } from "@src/groups/hooks/useTeamsBySport";
import TeamLogoBadge from "@src/sports/TeamLogoBadge";

function teamsMatch(a, b) {
  if (!a || !b) return false;
  return a.sport === b.sport && a.teamId === b.teamId;
}

export default function FavoriteTeamPickerModal({
  visible,
  onClose,
  sport,
  value,
  onSelect,
  colors,
}) {
  const { teams, loading } = useTeamsBySport(sport);

  const visibleTeams = useMemo(() => {
    const seen = new Set();
    return teams.filter((t) => {
      const key = `${t.sport}:${t.teamId || ""}:${t.abbreviation || ""}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [teams]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[styles.sheet, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.text }]}>
              {i18n.t("groups.config.pickFavoriteTeam", { defaultValue: "Choisir une équipe" })}
            </Text>
            <TouchableOpacity onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          <Text style={{ color: colors.subtext, fontSize: 12, marginBottom: 8 }}>
            {loading
              ? i18n.t("groups.config.loadingTeams", { defaultValue: "Chargement…" })
              : `${teams.length} ${i18n.t("groups.config.teamsCount", { defaultValue: "équipes" })}`}
          </Text>

          <View
            style={{
              flex: 1,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 10,
              overflow: "hidden",
              backgroundColor: colors.background,
              minHeight: 200,
            }}
          >
            {loading ? (
              <View style={styles.centered}>
                <ActivityIndicator color={colors.primary} />
              </View>
            ) : visibleTeams.length === 0 ? (
              <Text style={[styles.empty, { color: colors.subtext }]}>
                {i18n.t("groups.config.noTeamsAvailable", {
                  defaultValue: "Aucune équipe disponible.",
                })}
              </Text>
            ) : (
              <ScrollView keyboardShouldPersistTaps="always" showsVerticalScrollIndicator>
                {visibleTeams.map((item) => {
                  const selected = teamsMatch(value, item);
                  const rowKey = `${item.sport}:${item.teamId || "na"}:${item.abbreviation || "na"}`;
                  return (
                    <TouchableOpacity
                      key={rowKey}
                      onPress={() => onSelect(item)}
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
                      {selected ? (
                        <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
                      ) : null}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}
          </View>

          {value ? (
            <TouchableOpacity
              onPress={() => onSelect(null)}
              style={{
                marginTop: 10,
                paddingVertical: 12,
                alignItems: "center",
                borderRadius: 10,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <Text style={{ color: colors.subtext, fontWeight: "700" }}>
                {i18n.t("groups.config.clearFavoriteTeam", { defaultValue: "Retirer l'équipe" })}
              </Text>
            </TouchableOpacity>
          ) : null}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "flex-end",
  },
  sheet: {
    height: "72%",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderWidth: 1,
    padding: 16,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    flex: 1,
    paddingRight: 12,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 120,
  },
  empty: {
    textAlign: "center",
    padding: 16,
    fontSize: 13,
  },
});
