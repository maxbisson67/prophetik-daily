import React from "react";
import { View, Text } from "react-native";
import i18n from "@src/i18n/i18n";
import { useTheme } from "@src/theme/ThemeProvider";
import {
  getParticipantPredictionDividerColor,
  getParticipantPredictionFrameStyle,
} from "@src/defis/participant/participantPredictionFrameStyles";

export default function ParticipantPredictionFrame({
  colors,
  isDark: isDarkProp,
  accentColor = null,
  backgroundColor = null,
  statusChip = null,
  label = null,
  children,
  style = null,
}) {
  const { isDark: themeIsDark } = useTheme();
  const isDark = isDarkProp ?? themeIsDark;
  const frameStyle = getParticipantPredictionFrameStyle(colors, isDark, {
    accentColor,
    backgroundColor,
  });
  const dividerColor = getParticipantPredictionDividerColor(colors, isDark);
  const labelText =
    label ??
    i18n.t("tp.home.myPrediction", {
      defaultValue: "Ma prédiction",
    });

  return (
    <View style={[frameStyle, style]}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 10,
        }}
      >
        <Text style={{ color: colors.subtext, fontSize: 12, fontWeight: "700", flex: 1 }}>
          {labelText}
        </Text>
        {statusChip}
      </View>

      <View style={{ height: 1, backgroundColor: dividerColor }} />

      {children}
    </View>
  );
}
