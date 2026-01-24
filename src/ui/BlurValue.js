// src/ui/BlurValue.js
import React from "react";
import { Text, View } from "react-native";

/**
 * Affiche une valeur.
 * - blurred=false => texte normal
 * - blurred=true  => texte flouté/masqué (léger)
 *
 * Props:
 * - value (string)
 * - blurred (boolean)
 * - colors (theme)
 * - style (optionnel)
 */
export default function BlurValue({ value, blurred = false, colors, style }) {
  const safe = value === null || value === undefined || value === "" ? "—" : String(value);

  if (!blurred) {
    return (
      <Text
        style={[
          { color: colors?.text ?? "#111", fontSize: 18, fontWeight: "900" },
          style,
        ]}
        numberOfLines={1}
      >
        {safe}
      </Text>
    );
  }

  // “flou léger” : on garde la longueur mais on masque
  const masked = safe.replace(/[0-9A-Za-z]/g, "•"); // garde % . etc.

  return (
    <View style={{ alignSelf: "flex-start" }}>
      <Text
        style={[
          { color: colors?.text ?? "#111", fontSize: 18, fontWeight: "900", opacity: 0.25 },
          style,
        ]}
        numberOfLines={1}
      >
        {masked}
      </Text>
    </View>
  );
}