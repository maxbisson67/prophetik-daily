import { View, Text } from "react-native";
import { SvgUri } from "react-native-svg";
import { TeamLogo, TeamInitials } from "@src/nhl/nhlAssets";

function mlbLogoUrl(teamId) {
  if (teamId == null || teamId === "") return null;
  return `https://www.mlbstatic.com/team-logos/${teamId}.svg`;
}

export default function TeamLogoBadge({ team, size = 28, colors, style }) {
  if (!team) return null;

  const sport = String(team.sport || "").toUpperCase();
  const abbr = team.abbreviation || "—";

  if (sport === "NHL") {
    return (
      <View style={[{ alignItems: "center", justifyContent: "center" }, style]}>
        <TeamLogo abbr={abbr} size={size} />
      </View>
    );
  }

  if (sport === "MLB") {
    const url = team.logo || mlbLogoUrl(team.teamId);
    return (
      <View
        style={[
          {
            width: size + 10,
            height: size + 10,
            borderRadius: 8,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#fff",
            borderWidth: 1,
            borderColor: colors?.border || "#e5e7eb",
            overflow: "hidden",
          },
          style,
        ]}
      >
        {url ? (
          <SvgUri uri={url} width={size} height={size} />
        ) : (
          <Text style={{ color: colors?.subtext || "#6b7280", fontWeight: "900", fontSize: 11 }}>
            {abbr}
          </Text>
        )}
      </View>
    );
  }

  return (
    <View style={style}>
      <TeamInitials abbr={abbr} size={size} />
    </View>
  );
}
