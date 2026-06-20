import { View, Image } from "react-native";
import SportGlyph from "@src/sports/SportGlyph";

export default function GroupAvatar({ group, size = 40, colors, style }) {
  const baseStyle = {
    width: size,
    height: size,
    borderRadius: size / 2,
    backgroundColor: colors?.card2 || colors?.background || colors?.card || "#fff",
    borderWidth: 1,
    borderColor: colors?.border || "#e5e7eb",
    overflow: "hidden",
  };

  if (group?.avatarUrl) {
    return (
      <Image
        source={{ uri: group.avatarUrl }}
        style={[baseStyle, style]}
      />
    );
  }

  const glyphSize = Math.max(16, Math.round(size * 0.52));

  return (
    <View style={[baseStyle, { alignItems: "center", justifyContent: "center" }, style]}>
      <SportGlyph sport={group} colors={colors} size={glyphSize} />
    </View>
  );
}
