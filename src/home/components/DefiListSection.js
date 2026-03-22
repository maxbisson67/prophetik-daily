// src/home/components/DefiListSection.js
import React, { useState } from "react";
import { View, Text, ActivityIndicator, TouchableOpacity } from "react-native";
import i18n from "@src/i18n/i18n";
import DefiListItem from "./DefiListItem";
import ProphetikIcons from "@src/ui/ProphetikIcons";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import { computeUiStatus } from "@src/home/homeUtils";

function InfoBubbleTodayChallenge({ colors }) {
  const [open, setOpen] = useState(false);

  return (
    <View
      style={{
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.card2,
        marginBottom: 10,
        overflow: "hidden",
      }}
    >
      <TouchableOpacity
        onPress={() => setOpen((v) => !v)}
        activeOpacity={0.85}
        style={{
          paddingHorizontal: 12,
          paddingVertical: 10,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
          <MaterialCommunityIcons
            name="information-outline"
            size={18}
            color={colors.subtext}
            style={{ marginTop: 1 }}
          />
          <Text style={{ color: colors.text, fontWeight: "900", marginLeft: 8, flex: 1 }}>
            {i18n.t("home.todayChallengeInfoTitle", {
              defaultValue: "C’est quoi le défi du jour?",
            })}
          </Text>
        </View>

        <MaterialCommunityIcons
          name={open ? "chevron-up" : "chevron-down"}
          size={22}
          color={colors.subtext}
        />
      </TouchableOpacity>

      {open ? (
        <View
          style={{
            paddingHorizontal: 12,
            paddingBottom: 12,
            borderTopWidth: 1,
            borderTopColor: colors.border,
          }}
        >
          <Text style={{ color: colors.subtext, marginTop: 10, lineHeight: 18 }}>
            {i18n.t("home.todayChallengeInfoBody", {
              defaultValue:
                "Chaque défi du jour te demande de choisir un certain nombre de joueurs selon le format (ex. 2x2, 3x3). Tes joueurs accumulent des points réels selon leurs performances, et le meilleur total remporte le défi.",
            })}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

export default function DefiListSection(props) {
  const {
    colors,
    flat = false,
    hideHeader = false,
    loadingGroups,
    loadingDefis,
    groupIds,
    activeDefis,
    groupsMeta,
    tierLower,
    onOpenDefi,
    onUpgrade,
  } = props;

  const routeForItem = (item) => {
    const uiStatus = computeUiStatus(item);

    if (uiStatus === "live" || uiStatus === "awaiting_result" || uiStatus === "completed") {
      return `${item.id}/results`;
    }

    return item.id;
  };

  return (
    <View
      style={
        flat || (!groupIds?.length && !loadingGroups)
          ? null
          : {
              backgroundColor: colors.card,
              borderColor: colors.border,
              borderWidth: 1,
              borderRadius: 16,
              overflow: "hidden",
              padding: 12,
            }
      }
    >
      {!hideHeader ? (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            marginBottom: 8,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
            <ProphetikIcons
              mode="emoji"
              emoji="🎯"
              size="lg"
              style={{ marginRight: 8 }}
            />
            <Text
              style={{
                fontWeight: "800",
                fontSize: 16,
                color: colors.text,
              }}
            >
              {i18n.t("home.todayChallenge")}
            </Text>
          </View>

          {loadingGroups || loadingDefis ? <ActivityIndicator /> : null}
        </View>
      ) : null}

      {/* ✅ Bulle info */}
      <InfoBubbleTodayChallenge colors={colors} />

      {!groupIds?.length && !loadingGroups ? (
        <Text style={{ color: colors.subtext }}>{i18n.t("home.noGroups")}</Text>
      ) : !activeDefis?.length && !loadingDefis ? (
        <Text style={{ color: colors.subtext }}>
          {i18n.t("home.noActiveChallenges")}
        </Text>
      ) : (
        <View>
          {activeDefis.map((item) => {
            const groupName =
              groupsMeta?.[item.groupId]?.name || i18n.t("home.unknownGroup");

            const primaryRoute = routeForItem(item);

            return (
              <DefiListItem
                key={item.id}
                item={item}
                colors={colors}
                tierLower={tierLower}
                groupName={groupName}
                onPress={() => onOpenDefi(primaryRoute)}
                onPressUpgrade={onUpgrade}
                onPressResults={() => onOpenDefi(`${item.id}/results`)}
                onPressParticipate={() => onOpenDefi(item.id)}
              />
            );
          })}
        </View>
      )}
    </View>
  );
}