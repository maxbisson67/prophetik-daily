// app/defis/[defiId]/components/MatchupRow.js
import React, { useMemo } from "react";
import { View, Text, Image } from "react-native";
import { useTheme } from "@src/theme/ThemeProvider";
import TeamMetaBadge from "./TeamMetaBadge";
import { fmtStartLocalHMFromUTCString } from "../utils/defiFormatters";

export default function MatchupRow({
  g,
  teamLogo,
  showTime = true,
  tierLower = "free", // ✅ NEW
}) {
  const { colors } = useTheme();

  const tier = String(tierLower || "free").toLowerCase();
  const isVip = tier === "vip";
  const isPro = tier === "pro" || isVip;
  const showLine2 = isPro; // ✅ ligne 2 uniquement Pro/VIP

  const home = g?.home || {};
  const away = g?.away || {};

  const homeAbbr = String(home.abbr || "").toUpperCase();
  const awayAbbr = String(away.abbr || "").toUpperCase();

  const COL_TIME = showTime ? 58 : 0;

  const timeStr = useMemo(() => fmtStartLocalHMFromUTCString(g?.startTimeUTC), [g?.startTimeUTC]);

  return (
    <View
      style={{
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderColor: colors.border,
        gap: showLine2 ? 10 : 0,
      }}
    >
      {/* Row 1: time | away @ home */}
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <View style={{ width: COL_TIME }}>
          {showTime ? (
            <Text
              style={{
                color: colors.text,
                fontWeight: "900",
                fontVariant: ["tabular-nums"],
              }}
            >
              {timeStr}
            </Text>
          ) : null}
        </View>

        {/* away */}
        <View style={{ flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 8 }}>
          {!!awayAbbr && teamLogo ? (
            <Image source={teamLogo(awayAbbr)} style={{ width: 22, height: 22 }} />
          ) : null}
          <Text numberOfLines={1} style={{ color: colors.text, fontWeight: "900", flexShrink: 1 }}>
            {awayAbbr}
          </Text>
        </View>

        <Text style={{ width: 28, textAlign: "center", color: colors.subtext, fontWeight: "900" }}>
          @
        </Text>

        {/* home */}
        <View
          style={{
            flex: 1,
            minWidth: 0,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "flex-end",
            gap: 8,
          }}
        >
          <Text numberOfLines={1} style={{ color: colors.text, fontWeight: "900", flexShrink: 1 }}>
            {homeAbbr}
          </Text>
          {!!homeAbbr && teamLogo ? (
            <Image source={teamLogo(homeAbbr)} style={{ width: 22, height: 22 }} />
          ) : null}
        </View>
      </View>

      {/* ✅ Row 2: badges (PRO/VIP seulement) */}
      {showLine2 ? (
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <View style={{ width: COL_TIME }} />

          <View style={{ flex: 1, minWidth: 0, alignItems: "flex-start" }}>
            <TeamMetaBadge rankOverall={away.rankOverall} goalDifferential={away.goalDifferential} />
          </View>

          <View style={{ width: 28 }} />

          <View style={{ flex: 1, minWidth: 0, alignItems: "flex-end" }}>
            <TeamMetaBadge rankOverall={home.rankOverall} goalDifferential={home.goalDifferential} />
          </View>
        </View>
      ) : null}
    </View>
  );
}