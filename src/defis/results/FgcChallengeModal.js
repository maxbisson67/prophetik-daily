import React from "react";
import { View, Text, TouchableOpacity, Modal } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import i18n from "@src/i18n/i18n";
import FirstGoalLiveCard from "@src/firstGoal/FirstGoalLiveCard";
import { getFgcTitle } from "@src/firstGoal/fgcChallengeUtils";

export default function FgcChallengeModal({ visible, item, colors, onClose }) {
  const challenge = item?.raw || {};
  const challengeId = String(item?.id || challenge?.id || "");
  const gameId = String(challenge?.gameId || "");

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.4)",
          justifyContent: "flex-end",
        }}
      >
        <View
          style={{
            backgroundColor: colors.background,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            padding: 16,
            maxHeight: "85%",
          }}
        >
          <View style={{ alignItems: "center", marginBottom: 8 }}>
            <View
              style={{
                width: 48,
                height: 4,
                borderRadius: 2,
                backgroundColor: colors.border,
              }}
            />
          </View>

          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 10,
            }}
          >
            <Text style={{ color: colors.text, fontWeight: "900", fontSize: 16, flex: 1 }}>
              {getFgcTitle(challenge, i18n.t.bind(i18n))}
            </Text>

            <TouchableOpacity
              onPress={onClose}
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: colors.card,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <MaterialCommunityIcons name="close" size={20} color={colors.text} />
            </TouchableOpacity>
          </View>

          <FirstGoalLiveCard
            visible={visible}
            gameId={gameId}
            challengeId={challengeId}
            colors={colors}
          />
        </View>
      </View>
    </Modal>
  );
}
