import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import i18n from "@src/i18n/i18n";

export default function NovaCoachErrorNotice({
  message = null,
  errorKey = null,
  colors,
  onBeforeNavigate = null,
}) {
  const router = useRouter();
  const showSubscribe = errorKey === "QUOTA_EXCEEDED";

  if (!message) return null;

  return (
    <View style={{ gap: 8 }}>
      <Text style={{ color: colors.danger || "#ef4444", fontSize: 13, fontWeight: "700" }}>
        {message}
      </Text>
      {showSubscribe ? (
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => {
            onBeforeNavigate?.();
            router.push("/(drawer)/subscriptions");
          }}
          style={{
            alignSelf: "flex-start",
            paddingHorizontal: 14,
            paddingVertical: 10,
            borderRadius: 10,
            backgroundColor: colors.primary,
          }}
        >
          <Text style={{ color: "#fff", fontWeight: "900", fontSize: 13 }}>
            {i18n.t("novaCoach.quotaSubscribeCta", { defaultValue: "Voir les abonnements" })}
          </Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}
