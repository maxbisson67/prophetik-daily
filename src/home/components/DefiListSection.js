// src/home/components/DefiListSection.js
import React from "react";
import { View, Text, ActivityIndicator } from "react-native";
import i18n from "@src/i18n/i18n";
import DefiListItem from "./DefiListItem";
import ProphetikIcons from "@src/ui/ProphetikIcons";

import { computeUiStatus } from "@src/home/homeUtils";

export default function DefiListSection(props) {
  const {
    colors,
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

    // ✅ Règle cohérente:
    // - open => détail (pour participer / voir infos)
    // - live => results
    // - awaiting_result / completed => results
    if (uiStatus === "live" || uiStatus === "awaiting_result" || uiStatus === "completed") {
      return `${item.id}/results`;
    }

    return item.id;
  };

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
        <View
        style={{
            flexDirection: "row",
            alignItems: "center",
            marginBottom: 8,
        }}
        >
        {/* Bloc gauche : emoji + titre */}
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

        {/* Loader à droite */}
        {loadingGroups || loadingDefis ? <ActivityIndicator /> : null}
        </View>

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
                // ✅ tap sur la carte => route selon status
                onPress={() => onOpenDefi(primaryRoute)}
                onPressUpgrade={onUpgrade}
                // ✅ CTA results => toujours results
                onPressResults={() => onOpenDefi(`${item.id}/results`)}
                // ✅ CTA participer => toujours détail
                onPressParticipate={() => onOpenDefi(item.id)}
              />
            );
          })}
        </View>
      )}
    </View>
  );
}