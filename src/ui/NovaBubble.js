// src/ui/NovaBubble.js
import React, { useMemo } from "react";
import { View, Text, Image, ScrollView } from "react-native";
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
  imageSource = null,
  layout = "default",
  title,
  body,
  style,
  bubbleStyle,
  imageStyle,
  titleStyle,
  bodyStyle,
  bodyScrollMaxHeight,
}) {
  const { colors } = useTheme();
  const isCoachLayout = layout === "coach";
  const coachImageSize = 209;
  const coachLeftSlotWidth = 108;
  const coachImageShiftLeft = 32;
  const coachBubbleOverlap = 56;
  const coachBubbleMarginLeft =
    -coachBubbleOverlap + Math.round(coachImageSize * 0.3);

  const source = useMemo(() => {
    if (imageSource) return imageSource;

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
  }, [variant, imageSource]);

  if (isCoachLayout) {
    return (
      <View
        style={[
          {
            flexDirection: "row",
            alignItems: "flex-end",
            flexWrap: "nowrap",
            width: "100%",
            marginTop: 8,
          },
          style,
        ]}
      >
        <View
          style={{
            width: coachLeftSlotWidth,
            height: coachImageSize,
            overflow: "visible",
            flexShrink: 0,
          }}
        >
          <Image
            source={source}
            resizeMode="contain"
            style={[
              {
                width: coachImageSize,
                height: coachImageSize,
                marginLeft: -coachImageShiftLeft,
                zIndex: 2,
              },
              imageStyle,
            ]}
          />
        </View>

        <View
          style={[
            {
              flex: 1,
              minWidth: 0,
              marginLeft: coachBubbleMarginLeft,
              paddingVertical: 10,
              paddingHorizontal: 12,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.card2,
              position: "relative",
              zIndex: 1,
            },
            bubbleStyle,
          ]}
        >
          <View
            style={{
              position: "absolute",
              left: 16,
              top: 22,
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

          {!!body &&
            (bodyScrollMaxHeight ? (
              <ScrollView
                style={{ maxHeight: bodyScrollMaxHeight }}
                nestedScrollEnabled
                showsVerticalScrollIndicator
                keyboardShouldPersistTaps="handled"
              >
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
              </ScrollView>
            ) : (
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
            ))}
        </View>
      </View>
    );
  }

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
            zIndex: 0,
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

        {!!body &&
          (bodyScrollMaxHeight ? (
            <ScrollView
              style={{ maxHeight: bodyScrollMaxHeight }}
              nestedScrollEnabled
              showsVerticalScrollIndicator
              keyboardShouldPersistTaps="handled"
            >
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
            </ScrollView>
          ) : (
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
          ))}
      </View>
    </View>
  );
}