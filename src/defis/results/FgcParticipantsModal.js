import React from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import i18n from "@src/i18n/i18n";
import {
  getFgcLeague,
  getFgcResultPlayerId,
  getFgcResultPrefix,
  getFgcResultOutcomeLabel,
  getFgcTitle,
  resolveFgcHideOthersPicks,
  resolveFgcRevealTimeLabel,
} from "@src/firstGoal/fgcChallengeUtils";
import { resolveFgcEffectiveResult } from "@src/firstGoal/fgcMutualizedGameUtils";
import useFgcMutualizedGame from "@src/firstGoal/useFgcMutualizedGame";
import FgcParticipantsList from "@src/defis/results/FgcParticipantsList";

export default function FgcParticipantsModal({
  visible,
  onClose,
  challenge,
  entries = [],
  loading = false,
  currentUid = "",
  matchTask = null,
  colors,
}) {
  const { data: mutualizedGame } = useFgcMutualizedGame(challenge, { enabled: visible });
  const effectiveResult = resolveFgcEffectiveResult(challenge, mutualizedGame);
  const winnerPlayerId = getFgcResultPlayerId(challenge);
  const winnerName = effectiveResult?.playerName || null;
  const winnerTeam = effectiveResult?.teamAbbr || null;
  const awaitingFinalConfirmation = !!effectiveResult?.awaitingFinalConfirmation;
  const hideOthersPicks = resolveFgcHideOthersPicks(challenge);
  const revealTimeLabel = resolveFgcRevealTimeLabel(challenge);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" }}>
        <View
          style={{
            backgroundColor: colors.background,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            padding: 16,
            maxHeight: "80%",
          }}
        >
          <View style={{ alignItems: "center", marginBottom: 8 }}>
            <View
              style={{ width: 48, height: 4, borderRadius: 2, backgroundColor: colors.border }}
            />
          </View>

          <View style={{ flexDirection: "row", alignItems: "flex-start", marginBottom: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text, fontWeight: "900", fontSize: 16 }} numberOfLines={2}>
                {getFgcTitle(challenge, i18n.t.bind(i18n))}
              </Text>
              <Text style={{ color: colors.subtext, fontSize: 12, marginTop: 4 }} numberOfLines={2}>
                {winnerName
                  ? `${getFgcResultPrefix(challenge, i18n.t.bind(i18n))} ${winnerName}${
                      winnerTeam ? ` (${winnerTeam})` : ""
                    }${
                      awaitingFinalConfirmation
                        ? ` · ${i18n.t("firstGoal.awaitingFinalConfirmation", {
                            defaultValue: "En attente de confirmation finale",
                          })}`
                        : ""
                    }`
                  : getFgcResultOutcomeLabel(
                      challenge,
                      i18n.t.bind(i18n),
                      matchTask?.state
                    )}
              </Text>
            </View>

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
                marginLeft: 10,
              }}
            >
              <Ionicons name="close" size={20} color={colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={{ paddingBottom: 18 }} keyboardShouldPersistTaps="handled">
            <FgcParticipantsList
              entries={entries}
              loading={loading}
              winnerPlayerId={winnerPlayerId}
              currentUid={currentUid}
              colors={colors}
              league={getFgcLeague(challenge)}
              hideOthersPicks={hideOthersPicks}
              revealTimeLabel={revealTimeLabel}
            />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
