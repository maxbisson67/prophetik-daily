import React from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import i18n from "@src/i18n/i18n";
import FgcResultDetailBlock from "@src/defis/results/FgcResultDetailBlock";
import TpResultDetailBlock from "@src/defis/results/TpResultDetailBlock";
import TsResultDetailBlock from "@src/defis/results/TsResultDetailBlock";
import LiveChallengeKindBadge, { LIVE_BADGE_ACCENTS } from "@src/live/LiveChallengeKindBadge";

export default function LiveChallengePicksModal({
  visible,
  onClose,
  kind = "",
  sport = "NHL",
  colors,
  fgcChallenge = null,
  tpBundle = null,
  tsDefiId = "",
  tsDefi = null,
}) {
  const t = i18n.t.bind(i18n);
  const insets = useSafeAreaInsets();
  const challengeKind = String(kind || "").toLowerCase();
  const league = String(sport || "NHL").toUpperCase();

  const sectionTitles = {
    fgc:
      league === "MLB"
        ? t("live.challenge.fgcTitleMlb", { defaultValue: "Premier point produit" })
        : t("live.challenge.fgcTitleNhl", { defaultValue: "Premier but" }),
    tp: t("live.challenge.tpTitle", { defaultValue: "Prédire le match" }),
    ts: t("live.challenge.tsTitle", { defaultValue: "Trio du jour" }),
  };

  const fgcItem = fgcChallenge
    ? {
        id: String(fgcChallenge.id || ""),
        kind: "fgc",
        raw: fgcChallenge,
      }
    : null;

  const tpItem =
    tpBundle && tpBundle.id
      ? {
          id: String(tpBundle.id),
          kind: "tp",
          subtype: "bundle",
          raw: tpBundle,
        }
      : null;

  const tsItem =
    tsDefiId && tsDefi
      ? {
          id: tsDefiId,
          kind: "ts",
          status: tsDefi.status,
          raw: { id: tsDefiId, ...tsDefi },
        }
      : null;

  const renderBody = () => {
    if (challengeKind === "fgc") {
      if (!fgcItem) {
        return (
          <Text style={{ color: colors.subtext, fontWeight: "700" }}>
            {t("challenges.noDefiForSelectedDay", { defaultValue: "Aucun défi pour cette journée." })}
          </Text>
        );
      }

      return (
        <FgcResultDetailBlock
          item={fgcItem}
          colors={colors}
          accentColor={LIVE_BADGE_ACCENTS.fgc}
          showParticipantsInline
        />
      );
    }

    if (challengeKind === "tp") {
      if (!tpItem) {
        return (
          <Text style={{ color: colors.subtext, fontWeight: "700" }}>
            {t("challenges.noDefiForSelectedDay", { defaultValue: "Aucun défi pour cette journée." })}
          </Text>
        );
      }

      return (
        <TpResultDetailBlock
          item={tpItem}
          colors={colors}
          showLiveScores
          accentColor={LIVE_BADGE_ACCENTS.tp}
          showParticipantsInline
        />
      );
    }

    if (challengeKind === "ts") {
      if (!tsItem) {
        return (
          <Text style={{ color: colors.subtext, fontWeight: "700" }}>
            {t("challenges.noDefiForSelectedDay", { defaultValue: "Aucun défi pour cette journée." })}
          </Text>
        );
      }

      return <TsResultDetailBlock item={tsItem} colors={colors} compact={false} />;
    }

    return null;
  };

  if (!visible || !colors) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle={Platform.OS === "ios" ? "pageSheet" : "fullScreen"}
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <View
          style={{
            paddingTop: insets.top + 8,
            paddingHorizontal: 16,
            paddingBottom: 12,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
            <Text style={{ color: colors.subtext, fontWeight: "800", fontSize: 12 }}>
              {t("firstGoal.live.picksTitle", { defaultValue: "Participants & choix" })}
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <LiveChallengeKindBadge kind={challengeKind} sport={league} colors={colors} compact />
              <Text style={{ color: colors.text, fontWeight: "900", fontSize: 16, flex: 1 }} numberOfLines={2}>
                {sectionTitles[challengeKind] || ""}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            onPress={onClose}
            hitSlop={{ top: 10, left: 10, right: 10, bottom: 10 }}
            style={{
              padding: 8,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.card,
            }}
          >
            <MaterialCommunityIcons name="close" size={20} color={colors.text} />
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={{
            padding: 16,
            paddingBottom: 24 + insets.bottom,
          }}
          keyboardShouldPersistTaps="handled"
        >
          {renderBody()}
        </ScrollView>
      </View>
    </Modal>
  );
}
