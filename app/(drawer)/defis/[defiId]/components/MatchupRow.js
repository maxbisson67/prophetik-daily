// app/defis/[defiId]/components/MatchupRow.js
import React, { useMemo } from "react";
import { View, Text, Image } from "react-native";
import { useTheme } from "@src/theme/ThemeProvider";
import TeamLogoBadge from "@src/sports/TeamLogoBadge";
import TeamMetaBadge from "./TeamMetaBadge";
import MlbMatchupDetailRow from "./MlbMatchupDetailRow";
import { fmtStartLocalHMFromUTCString } from "../utils/defiFormatters";

export default function MatchupRow({
  g,
  teamLogo,
  showTime = true,
  tierLower = "free", // ✅ NEW
  formatStandingsLine = null,
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

  const isMlb = String(g?.sport || "").toUpperCase() === "MLB";
  const showMlbDetails = isMlb && typeof formatStandingsLine === "function";

  const awayTeam = isMlb
    ? { sport: "MLB", abbreviation: awayAbbr, teamId: away.teamId, logo: away.logo }
    : null;
  const homeTeam = isMlb
    ? { sport: "MLB", abbreviation: homeAbbr, teamId: home.teamId, logo: home.logo }
    : null;

  const renderTeamLogo = (side) => {
    const abbr = side === "away" ? awayAbbr : homeAbbr;
    if (!abbr) return null;

    if (isMlb) {
      const team = side === "away" ? awayTeam : homeTeam;
      return <TeamLogoBadge team={team} size={22} colors={colors} />;
    }

    if (!teamLogo) return null;
    const src = teamLogo(abbr);
    if (!src) return null;
    return <Image source={src} style={{ width: 22, height: 22 }} />;
  };

  return (
    <View
      style={{
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderColor: colors.border,
        gap: showLine2 || showMlbDetails ? 10 : 0,
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
          {renderTeamLogo("away")}
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
          {renderTeamLogo("home")}
        </View>
      </View>

      {/* ✅ Row 2: badges NHL (PRO/VIP seulement) */}
      {showLine2 && !isMlb ? (
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

      {showMlbDetails ? (
        <MlbMatchupDetailRow
          g={g}
          colors={colors}
          formatStandingsLine={formatStandingsLine}
          colTime={COL_TIME}
        />
      ) : null}
    </View>
  );
}