import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import i18n from "@src/i18n/i18n";
import { useTheme } from "@src/theme/ThemeProvider";
import { PROPHETIK_RED, prophetikCardShadow } from "@src/achievements/components/prophetikCardStyles";

function BannerCard({ colors, accentColor, icon, title, body, ctaLabel, onPress }) {
  const content = (
    <View
      style={[
        {
          borderRadius: 10,
          borderWidth: 1,
          borderColor: `${accentColor}55`,
          backgroundColor: `${accentColor}14`,
          paddingHorizontal: 14,
          paddingVertical: 12,
          borderLeftWidth: 4,
          borderLeftColor: accentColor,
        },
        prophetikCardShadow(),
      ]}
    >
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
        <MaterialCommunityIcons name={icon} size={22} color={accentColor} style={{ marginTop: 1 }} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.text, fontWeight: "900", fontSize: 14 }}>{title}</Text>
          {body ? (
            <Text style={{ color: colors.subtext, marginTop: 4, fontSize: 13, lineHeight: 18 }}>{body}</Text>
          ) : null}
          {ctaLabel ? (
            <Text style={{ color: accentColor, marginTop: 8, fontWeight: "800", fontSize: 12 }}>{ctaLabel}</Text>
          ) : null}
        </View>
      </View>
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity activeOpacity={0.85} onPress={onPress}>
        {content}
      </TouchableOpacity>
    );
  }

  return content;
}

export default function SeasonTransitionBanners({
  championBanner,
  playoffsBanner,
  onOpenLeaderboard,
}) {
  const { colors } = useTheme();

  if (!championBanner && !playoffsBanner) return null;

  const sportLabel =
    String(championBanner?.sport || playoffsBanner?.sport || "").toLowerCase() === "mlb"
      ? "MLB"
      : "NHL";

  return (
    <View style={{ gap: 10 }}>
      {championBanner ? (
        <BannerCard
          colors={colors}
          accentColor="#ca8a04"
          icon="trophy"
          title={i18n.t("home.seasonTransition.championTitle", {
            defaultValue: "Champion·ne de la saison régulière",
          })}
          body={i18n.t("home.seasonTransition.championBody", {
            defaultValue: "{{names}} remporte la saison régulière {{sport}} avec {{points}} points.",
            names: championBanner.winnerNames,
            sport: sportLabel,
            points: championBanner.winnerPoints,
          })}
          ctaLabel={onOpenLeaderboard ? i18n.t("home.viewLeaderboard", { defaultValue: "Classement détaillé" }) : null}
          onPress={onOpenLeaderboard}
        />
      ) : null}

      {playoffsBanner ? (
        <BannerCard
          colors={colors}
          accentColor={PROPHETIK_RED}
          icon="flag-checkered"
          title={i18n.t("home.seasonTransition.playoffsTitle", {
            defaultValue: "Les séries éliminatoires sont lancées!",
          })}
          body={i18n.t("home.seasonTransition.playoffsBody", {
            defaultValue:
              "Les défis quotidiens incluent maintenant les matchs de séries. Un nouveau classement {{sport}} est ouvert.",
            sport: sportLabel,
          })}
          ctaLabel={onOpenLeaderboard ? i18n.t("home.seasonTransition.playoffsCta", { defaultValue: "Voir le classement séries" }) : null}
          onPress={onOpenLeaderboard}
        />
      ) : null}
    </View>
  );
}
