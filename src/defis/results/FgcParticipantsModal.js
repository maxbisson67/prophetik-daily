import React from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import i18n from "@src/i18n/i18n";
import {
  getFgcResultPlayerId,
  getFgcResultPlayerName,
  getFgcResultPrefix,
  getFgcResultTeamAbbr,
  getFgcTitle,
} from "@src/firstGoal/fgcChallengeUtils";

function entryPickName(entry) {
  return (
    entry?.playerName ||
    entry?.selectedPlayerName ||
    entry?.pickPlayerName ||
    "—"
  );
}

function isCorrectPick(entry, winnerPlayerId) {
  if (!winnerPlayerId || !entry?.playerId) return false;
  return String(entry.playerId) === String(winnerPlayerId);
}

export default function FgcParticipantsModal({
  visible,
  onClose,
  challenge,
  entries = [],
  loading = false,
  currentUid = "",
  colors,
}) {
  const winnerPlayerId = getFgcResultPlayerId(challenge);
  const winnerName = getFgcResultPlayerName(challenge);
  const winnerTeam = getFgcResultTeamAbbr(challenge);
  const uid = String(currentUid || "");

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
                    }`
                  : i18n.t("firstGoal.home.noWinner", { defaultValue: "Aucun gagnant" })}
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

          <Text style={{ color: colors.text, fontWeight: "800", marginBottom: 8 }}>
            {i18n.t("firstGoal.live.picksTitle", { defaultValue: "Participants & choix" })}
            {!loading && entries.length > 0 ? ` (${entries.length})` : ""}
          </Text>

          <ScrollView contentContainerStyle={{ paddingBottom: 18 }} keyboardShouldPersistTaps="handled">
            {loading ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <ActivityIndicator size="small" color={colors.subtext} />
                <Text style={{ color: colors.subtext, fontSize: 13 }}>
                  {i18n.t("common.loading", { defaultValue: "Chargement…" })}
                </Text>
              </View>
            ) : entries.length === 0 ? (
              <Text style={{ color: colors.subtext, fontSize: 13 }}>
                {i18n.t("firstGoal.live.noEntriesYet", { defaultValue: "Aucune participation encore." })}
              </Text>
            ) : (
              <View style={{ gap: 6 }}>
                {entries.map((entry) => {
                  const who =
                    entry.displayName || entry.name || String(entry.uid || "").slice(0, 6);
                  const pick = entryPickName(entry);
                  const correct = isCorrectPick(entry, winnerPlayerId);
                  const isMe = String(entry.uid) === uid;

                  return (
                    <View
                      key={String(entry.uid)}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        paddingVertical: 8,
                        paddingHorizontal: 10,
                        borderRadius: 10,
                        borderWidth: 1,
                        borderColor: isMe ? "rgba(22,163,74,0.35)" : colors.border,
                        backgroundColor: isMe ? colors.card2 : colors.card,
                      }}
                    >
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={{ color: colors.text, fontWeight: "900" }} numberOfLines={1}>
                          {who}
                          {isMe
                            ? ` ${i18n.t("challenges.youSuffix", { defaultValue: "(toi)" })}`
                            : ""}
                        </Text>
                        <Text style={{ color: colors.subtext, fontSize: 12 }} numberOfLines={1}>
                          {pick}
                        </Text>
                      </View>

                      <Ionicons
                        name={correct ? "checkmark-circle" : "close-circle"}
                        size={20}
                        color={correct ? "#16a34a" : "#dc2626"}
                      />
                    </View>
                  );
                })}
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
