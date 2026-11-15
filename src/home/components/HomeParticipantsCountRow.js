import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import i18n from "@src/i18n/i18n";

export default function HomeParticipantsCountRow({
  count = 0,
  colors,
  onPressViewPicks = null,
}) {
  const showLink = typeof onPressViewPicks === "function";

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        marginTop: 8,
        flexWrap: "wrap",
        gap: 4,
      }}
    >
      <MaterialCommunityIcons name="account-group" size={16} color={colors.subtext} />
      <Text style={{ color: colors.subtext, fontSize: 13 }} numberOfLines={1}>
        {count}{" "}
        {i18n.t("common.participants", { defaultValue: "participant(s)" })}
      </Text>
      {showLink ? (
        <TouchableOpacity
          onPress={onPressViewPicks}
          activeOpacity={0.85}
          hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
          accessibilityRole="button"
          accessibilityLabel={i18n.t("home.viewParticipantsPicks", {
            defaultValue: "Voir les choix des participants",
          })}
        >
          <Text style={{ color: colors.primary, fontWeight: "800", fontSize: 12 }}>
            {i18n.t("home.viewParticipantsPicksShort", {
              defaultValue: "Voir les choix",
            })}
          </Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}
