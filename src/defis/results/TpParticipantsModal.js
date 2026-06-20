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
import { countTpPickStatsForEntry } from "@src/defis/tpBundleDisplayHelpers";

function entryDisplayName(entry) {
  return entry?.displayName || entry?.name || String(entry?.uid || "").slice(0, 6);
}

function entryTotalPoints(entry) {
  return Number(entry?.totalPoints ?? 0) || 0;
}

export default function TpParticipantsModal({
  visible,
  onClose,
  bundle,
  entries = [],
  loading = false,
  currentUid = "",
  colors,
}) {
  const uid = String(currentUid || "");
  const gameCount = Number(bundle?.gameCount || bundle?.games?.length || 0);

  const sorted = [...entries].sort((a, b) => {
    const diff = entryTotalPoints(b) - entryTotalPoints(a);
    if (diff !== 0) return diff;
    return entryDisplayName(a).localeCompare(entryDisplayName(b));
  });

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
                {i18n.t("tp.home.title", { defaultValue: "Prédire l'issue des matchs" })}
              </Text>
              <Text style={{ color: colors.subtext, fontSize: 12, marginTop: 4 }}>
                {i18n.t("tp.results.participantsModalSubtitle", {
                  defaultValue: "{{count}} match(s) · classement par points",
                  count: gameCount,
                })}
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
            {loading ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <ActivityIndicator size="small" color={colors.subtext} />
                <Text style={{ color: colors.subtext, fontSize: 13 }}>
                  {i18n.t("common.loading", { defaultValue: "Chargement…" })}
                </Text>
              </View>
            ) : sorted.length === 0 ? (
              <Text style={{ color: colors.subtext, fontSize: 13 }}>
                {i18n.t("firstGoal.live.noEntriesYet", { defaultValue: "Aucune participation encore." })}
              </Text>
            ) : (
              <View style={{ gap: 6 }}>
                {sorted.map((entry, index) => {
                  const who = entryDisplayName(entry);
                  const points = entryTotalPoints(entry);
                  const isMe = String(entry.uid) === uid;
                  const { winnersCorrect, exactScores } = countTpPickStatsForEntry(entry, bundle);

                  return (
                    <View
                      key={String(entry.uid)}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        paddingVertical: 10,
                        paddingHorizontal: 10,
                        borderRadius: 10,
                        borderWidth: 1,
                        borderColor: isMe ? "rgba(22,163,74,0.35)" : colors.border,
                        backgroundColor: isMe ? colors.card2 : colors.card,
                      }}
                    >
                      <Text
                        style={{
                          color: colors.subtext,
                          fontWeight: "900",
                          width: 24,
                          fontSize: 13,
                        }}
                      >
                        {index + 1}.
                      </Text>

                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={{ color: colors.text, fontWeight: "900" }} numberOfLines={1}>
                          {who}
                          {isMe
                            ? ` ${i18n.t("challenges.youSuffix", { defaultValue: "(toi)" })}`
                            : ""}
                        </Text>
                        {gameCount > 0 ? (
                          <Text style={{ color: colors.subtext, fontSize: 12 }}>
                            {i18n.t("tp.results.participantStats", {
                              defaultValue:
                                "{{winners}} bon(s) choix(s) · {{exact}} pointage(s) exact(s)",
                              winners: winnersCorrect,
                              exact: exactScores,
                            })}
                          </Text>
                        ) : null}
                      </View>

                      <Text style={{ color: colors.text, fontWeight: "900", fontSize: 14 }}>
                        {points}{" "}
                        <Text style={{ color: colors.subtext, fontWeight: "700", fontSize: 12 }}>
                          {i18n.t("challenges.pointsShort", { defaultValue: "pt(s)" })}
                        </Text>
                      </Text>
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
