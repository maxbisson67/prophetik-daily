import React, { useMemo, useState } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import i18n from "@src/i18n/i18n";
import {
  computeUiStatus,
  canJoinDefiUi,
} from "@src/home/homeUtils";

const RED = "#b91c1c";

function InfoBubbleAscension({ colors }) {
  const [open, setOpen] = useState(false);

  return (
    <View
      style={{
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.card2,
        marginTop: 8,
        marginBottom: 8,
        overflow: "hidden",
      }}
    >
      <TouchableOpacity
        onPress={() => setOpen((v) => !v)}
        activeOpacity={0.85}
        style={{
          paddingHorizontal: 12,
          paddingVertical: 10,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
          <MaterialCommunityIcons
            name="information-outline"
            size={18}
            color={colors.subtext}
            style={{ marginTop: 1 }}
          />
          <Text
            style={{
              color: colors.text,
              fontWeight: "900",
              marginLeft: 8,
              flex: 1,
            }}
          >
            {i18n.t("ascensions.infoTitle", {
              defaultValue: "What is an Ascension?",
            })}
          </Text>
        </View>

        <MaterialCommunityIcons
          name={open ? "chevron-up" : "chevron-down"}
          size={22}
          color={colors.subtext}
        />
      </TouchableOpacity>

      {open ? (
        <View
          style={{
            paddingHorizontal: 12,
            paddingBottom: 12,
            borderTopWidth: 1,
            borderTopColor: colors.border,
          }}
        >
          <Text style={{ color: colors.subtext, marginTop: 10, lineHeight: 18 }}>
            {i18n.t("ascensions.infoBody", {
              defaultValue:
                "An Ascension is a multi-day challenge where you progress step by step. Each completed challenge advances your climb, and daily bonus points can increase the reward at the summit.",
            })}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function ProgressBar({ value, max, colors }) {
  const pct = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;

  return (
    <View style={{ marginTop: 8 }}>
      <View
        style={{
          height: 12,
          borderRadius: 999,
          backgroundColor: colors.card2,
          borderWidth: 1,
          borderColor: colors.border,
          overflow: "hidden",
        }}
      >
        <View
          style={{
            width: `${pct * 100}%`,
            height: "100%",
            backgroundColor: RED,
          }}
        />
      </View>

      <View style={{ marginTop: 6, alignItems: "center" }}>
        <Text style={{ color: colors.subtext, fontWeight: "900" }}>
          {value} / {max}{" "}
          {i18n.t("ascensions.labels.challenges", {
            defaultValue: "challenges",
          })}
        </Text>
      </View>
    </View>
  );
}

function getDefiSize(defi) {
  const typeNum = Number(defi?.type);
  if (Number.isFinite(typeNum) && typeNum > 0) return typeNum;

  const format = String(defi?.format || defi?.title || "");
  const m = format.match(/(\d+)\s*x\s*(\d+)/i);
  if (m) return Number(m[1]);

  return 7;
}

export default function AscensionHomeCard({
  colors,
  title,
  tierLower = "vip",
  inProgress,
  loadingMember,
  progress,
  pointsBonisTotal,
  defi,
  onPressCreateAscension,
  onPressDefi,
  onPressResults,
  onPressDetails,
  onPressPast,
  createLabel,
}) {
  const lang = i18n.language || i18n.locale || "fr";

  const size = useMemo(() => getDefiSize(defi), [defi]);

  const uiStatus = useMemo(() => {
    return defi ? computeUiStatus(defi) : "open";
  }, [defi]);

  const { canJoin, lockedBy } = useMemo(() => {
    if (!defi) return { canJoin: false, lockedBy: null };

    return canJoinDefiUi({
      tier: tierLower,
      defiType: defi?.type,
      uiStatus,
      signupDeadline: defi?.signupDeadline,
    });
  }, [defi, tierLower, uiStatus]);

  const lockedByPlan = lockedBy === "PLAN";
  const lockedByDeadline = lockedBy === "DEADLINE";

  const showResultsCta =
    lockedByDeadline ||
    uiStatus === "live" ||
    uiStatus === "awaiting_result" ||
    uiStatus === "completed";

  const challengeTitle = useMemo(() => {
    if (!defi) {
      return i18n.t("ascensions.challenge.none", {
        defaultValue: "No active ascension challenge right now.",
      });
    }

    return i18n.t("ascensions.challenge.title", {
      size,
      defaultValue: `Take on the ${size}x${size} challenge`,
    });
  }, [defi, size, lang]);

  const challengeCta = useMemo(() => {
    if (showResultsCta) {
      return i18n.t("home.viewResults", {
        defaultValue: "Voir les résultats",
      });
    }

    if (Number(size) === 1) {
      return i18n.t("ascensions.challenge.ctaOne", {
        defaultValue: "Choisir mon joueur",
      });
    }

    return i18n.t("ascensions.challenge.ctaMany", {
      size,
      defaultValue: `Choisir mes ${size} joueurs`,
    });
  }, [showResultsCta, size, lang]);

  const handlePrimaryPress = () => {
    if (!defi) return;
    if (showResultsCta) {
      onPressResults?.();
      return;
    }
    onPressDefi?.();
  };

  return (
    <View>
      <InfoBubbleAscension colors={colors} />

      {loadingMember ? (
        <View style={{ marginTop: 10, alignItems: "center" }}>
          <ActivityIndicator />
        </View>
      ) : (
        <ProgressBar
          value={progress?.stepsDone || 0}
          max={progress?.maxSteps || 7}
          colors={colors}
        />
      )}

      <View style={{ marginTop: 12 }}>
        <Text style={{ color: "#f97316", fontWeight: "900", fontSize: 14 }}>
          🔥{" "}
          {i18n.t("ascensions.labels.pointsBonis", {
            defaultValue: "Points bonis",
          })}
          : +{pointsBonisTotal}
        </Text>
      </View>

      {defi ? (
        <View style={{ marginTop: 12 }}>
          <View
            style={{
              padding: 12,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.card2,
            }}
          >
            <Text style={{ color: colors.text, fontWeight: "900" }}>
              {challengeTitle}
            </Text>

            {lockedByPlan ? (
              <TouchableOpacity
                onPress={onPressDetails}
                activeOpacity={0.9}
                style={{
                  marginTop: 10,
                  paddingVertical: 10,
                  borderRadius: 12,
                  alignItems: "center",
                  backgroundColor: colors.card,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <Text style={{ color: colors.text, fontWeight: "900" }}>
                  {i18n.t("home.upgradeCta", {
                    defaultValue: "Voir les forfaits",
                  })}
                </Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                onPress={handlePrimaryPress}
                activeOpacity={0.9}
                style={{
                  marginTop: 10,
                  paddingVertical: 10,
                  borderRadius: 12,
                  alignItems: "center",
                  backgroundColor: RED,
                  opacity: !canJoin && !showResultsCta ? 0.5 : 1,
                }}
              >
                <Text style={{ color: "#fff", fontWeight: "900" }}>
                  {challengeCta}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      ) : (
        <View style={{ marginTop: 12 }}>
          <Text style={{ color: colors.subtext }}>
            {i18n.t("ascensions.labels.noLinkedDefi", {
              defaultValue: "No active ascension challenge right now.",
            })}
          </Text>

          {!inProgress ? (
            <TouchableOpacity
              onPress={onPressCreateAscension}
              activeOpacity={0.9}
              style={{
                marginTop: 10,
                paddingVertical: 10,
                borderRadius: 12,
                alignItems: "center",
                backgroundColor: RED,
              }}
            >
              <Text style={{ color: "#fff", fontWeight: "900" }}>
                {createLabel ||
                  i18n.t("common.create", { defaultValue: "Create" })}
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>
      )}

      <TouchableOpacity
        onPress={onPressDetails}
        style={{
          marginTop: 12,
          paddingVertical: 12,
          borderRadius: 14,
          alignItems: "center",
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.card2,
        }}
      >
        <Text style={{ color: colors.text, fontWeight: "900" }}>
          {i18n.t("ascensions.cta.details", {
            defaultValue: "Ascension details",
          })}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={onPressPast}
        style={{
          marginTop: 10,
          paddingVertical: 12,
          borderRadius: 14,
          alignItems: "center",
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.card2,
        }}
      >
        <Text style={{ color: colors.text, fontWeight: "900" }}>
          {i18n.t("ascensions.cta.past", {
            defaultValue: "View past ascensions",
          })}
        </Text>
      </TouchableOpacity>
    </View>
  );
}