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
import TpParticipantsList from "@src/defis/results/TpParticipantsList";

export default function TpParticipantsModal({
  visible,
  onClose,
  bundle,
  entries = [],
  loading = false,
  currentUid = "",
  colors,
}) {
  const gameCount = Number(bundle?.gameCount || bundle?.games?.length || 0);

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
            <TpParticipantsList
              bundle={bundle}
              entries={entries}
              loading={loading}
              currentUid={currentUid}
              colors={colors}
            />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
