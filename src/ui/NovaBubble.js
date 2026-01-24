// src/ui/NovaBubble.js
import React, { useMemo } from "react";
import { View, Text, Image } from "react-native";
import { useTheme } from "@src/theme/ThemeProvider";

/**
 * NovaBubble
 * - Affiche UNE seule image Nova selon `variant`
 * - Affiche une bulle de dialogue (title + body)
 *
 * Variants supportés (selon tes fichiers):
 * - neutral
 * - groups
 * - format
 * - calendar
 * - thumbsUp
 * - ascension
 * - point
 */
export default function NovaBubble({
  variant = "neutral",
  title,
  body,
  style,
  bubbleStyle,
  imageStyle,
  titleStyle,
  bodyStyle,
}) {
  const { colors } = useTheme();

  const source = useMemo(() => {
    switch (String(variant || "neutral")) {
      case "groups":
        return require("@src/assets/nova/nova_groups.png");
      case "format":
        return require("@src/assets/nova/nova_defis_format.png");
      case "calendar":
        return require("@src/assets/nova/nova_calendar.png");
      case "thumbsUp":
        return require("@src/assets/nova/nova_thumbs_up.png");
      case "ascension":
        return require("@src/assets/nova/nova_ascension.png");
      case "point":
        return require("@src/assets/nova/nova_point.png");
      case "neutral":
      default:
        return require("@src/assets/nova/nova_neutral.png");
    }
  }, [variant]);

  return (
    <View
      style={[
        {
          flexDirection: "row",
          alignItems: "flex-start",
          gap: 12,
        },
        style,
      ]}
    >
      {/* ✅ UNE SEULE image Nova */}
      <Image
        source={source}
        resizeMode="contain"
        style={[
          {
            width: 144,
            height: 144,
          },
          imageStyle,
        ]}
      />

      {/* Bulle */}
      <View
        style={[
          {
            flex: 1,
            paddingVertical: 10,
            paddingHorizontal: 12,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.card2,
            position: "relative",
          },
          bubbleStyle,
        ]}
      >
        {/* petit “pointeur” de bulle */}
        <View
          style={{
            position: "absolute",
            left: -7,
            top: 16,
            width: 14,
            height: 14,
            backgroundColor: colors.card2,
            borderLeftWidth: 1,
            borderBottomWidth: 1,
            borderColor: colors.border,
            transform: [{ rotate: "45deg" }],
          }}
        />

        {!!title && (
          <Text
            style={[
              {
                color: colors.text,
                fontWeight: "900",
                fontSize: 13,
                marginBottom: 4,
              },
              titleStyle,
            ]}
          >
            {title}
          </Text>
        )}

        {!!body && (
          <Text
            style={[
              {
                color: colors.subtext,
                fontWeight: "700",
                fontSize: 12,
                lineHeight: 16,
              },
              bodyStyle,
            ]}
          >
            {body}
          </Text>
        )}
      </View>
    </View>
  );
}