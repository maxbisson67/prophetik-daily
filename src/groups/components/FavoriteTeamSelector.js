import { useState } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import i18n from "@src/i18n/i18n";
import TeamLogoBadge from "@src/sports/TeamLogoBadge";
import FavoriteTeamPickerModal from "@src/groups/components/FavoriteTeamPickerModal";

export function favoriteTeamLabel(favoriteTeam) {
  if (!favoriteTeam) {
    return i18n.t("groups.config.noFavoriteTeam", { defaultValue: "Aucune équipe" });
  }
  const abbr = favoriteTeam.abbreviation || "—";
  const name = favoriteTeam.name || "";
  return name && name !== abbr ? `${abbr} • ${name}` : abbr;
}

export default function FavoriteTeamSelector({
  sport,
  value,
  onChange,
  colors,
  disabled = false,
}) {
  const [modalOpen, setModalOpen] = useState(false);

  const handleSelect = (team) => {
    onChange(team);
    setModalOpen(false);
  };

  return (
    <>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          padding: 10,
          borderRadius: 10,
          borderWidth: 1,
          borderColor: value ? colors.primary : colors.border,
          backgroundColor: colors.card2 || colors.background,
          gap: 10,
        }}
      >
        {value ? (
          <>
            <TeamLogoBadge team={value} size={26} colors={colors} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: "800", color: colors.text }}>
                {value.abbreviation || "—"}
              </Text>
              {value.name ? (
                <Text style={{ color: colors.subtext, fontSize: 13, marginTop: 2 }}>
                  {value.name}
                </Text>
              ) : null}
            </View>
          </>
        ) : (
          <Text style={{ color: colors.subtext, flex: 1 }}>
            {i18n.t("groups.config.noFavoriteTeam", { defaultValue: "Aucune équipe" })}
          </Text>
        )}

        {!disabled ? (
          <TouchableOpacity
            onPress={() => setModalOpen(true)}
            style={{
              paddingVertical: 8,
              paddingHorizontal: 12,
              borderRadius: 8,
              backgroundColor: colors.primary,
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "800" }}>
              {i18n.t("groups.config.selectTeam", { defaultValue: "Sélectionner" })}
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <FavoriteTeamPickerModal
        visible={modalOpen}
        onClose={() => setModalOpen(false)}
        sport={sport}
        value={value}
        onSelect={handleSelect}
        colors={colors}
      />
    </>
  );
}
