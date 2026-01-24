import React from "react";
import { View, Text, Image, TouchableOpacity } from "react-native";
import { Feather } from "@expo/vector-icons";
import i18n from "@src/i18n/i18n";
import GroupsToggleRow from "@src/home/components/GroupsToggleRow";
import ProphetikIcons from "@src/ui/ProphetikIcons";
const ASC4_ICON = require("@src/assets/asc4.png");


export default function ProfileHeaderCard({
  colors,
  avatarUrl,
  displayName,
  points,
  onEditAvatar,
  onPressPoints,
  onCreateDefi,
  onCreateAscension,

  groups = [],
  currentGroupId,
  onSelectGroup,
}) {
  const RED_DARK = "#b91c1c";

  return (
    <View
      style={{
        padding: 14,
        borderWidth: 1,
        borderRadius: 12,
        backgroundColor: colors.card,
        borderColor: colors.border,
        
      }}
    >
      {/* Avatar */}
      <View style={{ alignItems: "center", marginBottom: 12 }}>
        <TouchableOpacity onPress={onEditAvatar} activeOpacity={0.8}>
          <Image
            source={
              avatarUrl
                ? { uri: avatarUrl }
                : require("@src/assets/avatar-placeholder.png")
            }
            style={{
              width: 120,
              height: 120,
              borderRadius: 60,
              borderWidth: 3,
              borderColor: "#eee",
              backgroundColor: "#f3f4f6",
            }}
          />
          <View
            style={{
              position: "absolute",
              bottom: 6,
              right: 6,
              backgroundColor: colors.card,
              borderRadius: 12,
              padding: 4,
              elevation: 3,
            }}
          >
            <Feather name="edit-2" size={14} color={colors.text} />
          </View>
        </TouchableOpacity>

        <Text
          style={{
            fontWeight: "800",
            fontSize: 16,
            marginTop: 8,
            color: colors.text,
          }}
        >
          {i18n.t("home.hello")} {displayName || "—"}
        </Text>
      </View>

      {/* ✅ Sélecteur pleine largeur */}
        <View style={{ alignSelf: "stretch" }}>
        <GroupsToggleRow
            colors={colors}
            groups={groups}
            value={currentGroupId}
            onChange={onSelectGroup}
        />
        </View>

      {/* CTA */}
      <View style={{ marginTop: 12, gap: 10 }}>
        <TouchableOpacity
        onPress={onCreateDefi}
        style={{
            backgroundColor: RED_DARK,
            paddingVertical: 12,
            paddingHorizontal: 16,
            borderRadius: 10,

            // ✅ clé ici
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 8, // RN >= 0.71 / Expo OK
        }}
        >
        <ProphetikIcons
            mode="emoji"
            emoji="🎯"
            size="lg"
            iconOnly
        />

        <Text style={{ color: "#fff", fontWeight: "800" }}>
            {i18n.t("home.createChallenge")}
        </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={onCreateAscension}
          style={{
            backgroundColor: RED_DARK,
            paddingVertical: 12,
            borderRadius: 10,
            alignItems: "center",
            flexDirection: "row",
            justifyContent: "center",
            gap: 8,
          }}
        >
       <Image
        source={ASC4_ICON}
        style={{
            width: 18,
            height: 18,
            tintColor: "#fff", // ✅ si ton icône est noire
        }}
        resizeMode="contain"
        />

        <Text style={{ color: "#fff", fontWeight: "900" }}>
        {i18n.t("home.launchAscension")}
        </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}