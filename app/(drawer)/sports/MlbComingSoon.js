import React from "react";
import { View, Text } from "react-native";
import { Stack } from "expo-router";
import { useTheme } from "@src/theme/ThemeProvider";

export default function MlbComingSoon() {
  const { colors } = useTheme();
  return (
    <>
   
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background, padding: 24 }}>
        <Text style={{ color: colors.text, fontWeight: "900", fontSize: 18 }}>MLB</Text>
        <Text style={{ color: colors.subtext, marginTop: 8, textAlign: "center" }}>
          Bientôt disponible.
        </Text>
      </View>
    </>
  );
}