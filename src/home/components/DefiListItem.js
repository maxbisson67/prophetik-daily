// src/home/components/DefiListItem.js
import React from "react";
import { View, Text, TouchableOpacity, Image } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import i18n from "@src/i18n/i18n";

import ProphetikIcons from "@src/ui/ProphetikIcons";
import { ascensionIconSource } from "@src/home/homeUtils";


import {
  fmtTSLocalHM,
  computeUiStatus,
  statusStyle,
  canJoinDefiUi,
  isAscensionDefi,
  ascLabel,
  normalDefiLabel,
  getSignupDeadlineOrFallback
} from "@src/home/homeUtils";

// --- UI atoms locaux ---
function Chip({ bg, fg, icon, label }) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        alignSelf: "flex-start",
        paddingVertical: 4,
        paddingHorizontal: 8,
        borderRadius: 999,
        backgroundColor: bg,
      }}
    >
      <MaterialCommunityIcons name={icon} size={14} color={fg} />
      <Text style={{ color: fg, marginLeft: 6, fontWeight: "700" }}>
        {label}
      </Text>
    </View>
  );
}

function AscBadge({ ascKey, colors }) {
  const icon = ascensionIconSource(ascKey);
  const label = ascKey === "ASC7" ? "ASC7" : "ASC4";

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        alignSelf: "flex-start",
        gap: 6,
        paddingVertical: 4,
        paddingHorizontal: 8,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.card2,
      }}
    >
      {icon && (
        <Image
          source={icon}
          style={{
            width: 18,
            height: 18,
            resizeMode: "contain",
          }}
        />
      )}

      <Text
        style={{
          fontSize: 11,
          fontWeight: "900",
          color: colors.text,
        }}
      >
        {label}
      </Text>
    </View>
  );
}

export default function DefiListItem({
  item,
  colors,
  tierLower,
  groupName,
  onPress,
  onPressUpgrade,
  onPressResults,
  onPressParticipate,
}) {
  const RED_DARK = "#b91c1c";

  const uiStatus = computeUiStatus(item);
  const st2 = statusStyle(uiStatus);

  const pot = Number(item?.pot || 0);

  const signupDeadlineValue = getSignupDeadlineOrFallback(item, 15);

  const { canJoin, lockedBy } = canJoinDefiUi({
    tier: tierLower,
    defiType: item?.type,
    uiStatus,
    signupDeadline: signupDeadlineValue,
  });

  const lockedByPlan = lockedBy === "PLAN";
  const lockedByDeadline = lockedBy === "DEADLINE";

 
  const showResultsCta =
    lockedByDeadline ||
    uiStatus === "live" ||
    uiStatus === "awaiting_result" ||
    uiStatus === "completed";

  const isAsc = isAscensionDefi(item);
  const title = isAsc ? ascLabel(item) : normalDefiLabel(item);

  

  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderColor: colors.border,
      }}
      activeOpacity={0.9}
    >
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <View style={{ flex: 1, paddingRight: 10 }}>
          <Text
            style={{
              fontSize: 12,
              fontWeight: "600",
              color: colors.subtext,
              marginBottom: 2,
            }}
            numberOfLines={1}
          >
            {groupName}
          </Text>

          {isAsc ? (
            <View style={{ marginBottom: 6 }}>
              <AscBadge ascKey={item?.ascension?.key} colors={colors} />
            </View>
          ) : null}

          <Text style={{ fontWeight: "900", color: colors.text }} numberOfLines={2}>
            {title}
          </Text>
        </View>

        <View style={{ alignItems: "flex-end" }}>
          <Chip bg={st2.bg} fg={st2.fg} icon={st2.icon} label={st2.label} />
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              marginTop: 4,
              gap: 6,
            }}
          >
            <MaterialCommunityIcons name="sack" size={16} color={colors.text} />
            {/* Ici tu utilisais ProphetikIcons; laisse le parent le faire si tu veux,
               mais on garde comme avant en “simple label” ou tu peux réimporter ProphetikIcons.
               -> Je te conseille de réimporter ProphetikIcons ici pour garder l’UI identique.
            */}
            <ProphetikIcons amount={pot} size="sm" iconPosition="after" />
          </View>
        </View>
      </View>

      <View style={{ marginTop: 4 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <MaterialCommunityIcons
            name="calendar-blank-outline"
            size={16}
            color={colors.subtext}
          />
          <Text style={{ color: colors.subtext }}>
            {i18n.t("home.challengeDate")}: {item?.gameDate || "—"}
          </Text>
        </View>

        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 }}>
          <MaterialCommunityIcons name="clock-outline" size={16} color={colors.subtext} />
          <Text style={{ color: colors.subtext }}>
            {signupDeadlineValue
              ? `${i18n.t("home.challengeLimit")} ${fmtTSLocalHM(signupDeadlineValue)}`
              : item?.firstGameUTC
              ? `${i18n.t("home.challengeStarts")} ${fmtTSLocalHM(item.firstGameUTC)}`
              : "—"}
          </Text>
        </View>

        <View style={{ flexDirection: "row", justifyContent: "flex-end", marginTop: 8 }}>
          {lockedByPlan ? (
            <View style={{ alignItems: "flex-end", gap: 6 }}>
              <Text style={{ color: colors.subtext, fontSize: 12, fontWeight: "700" }}>
                {i18n.t("home.upgradeToJoin", {
                  defaultValue: "Passe à Pro/Vip pour participer à ce défi.",
                })}
              </Text>

              <TouchableOpacity
                onPress={onPressUpgrade}
                activeOpacity={0.85}
                style={{
                  backgroundColor: colors.card,
                  borderWidth: 1,
                  borderColor: colors.border,
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: 10,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <MaterialCommunityIcons name="lock-open-outline" size={16} color={RED_DARK} />
                <Text style={{ color: RED_DARK, fontWeight: "900", fontSize: 13 }}>
                  {i18n.t("home.upgradeCta", { defaultValue: "Voir les forfaits" })}
                </Text>
                <MaterialCommunityIcons name="chevron-right" size={16} color={RED_DARK} />
              </TouchableOpacity>
            </View>
          ) : showResultsCta ? (
            <TouchableOpacity
              onPress={onPressResults}
              activeOpacity={0.85}
              style={{
                backgroundColor: colors.card,
                borderWidth: 1,
                borderColor: colors.border,
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: 10,
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
              }}
            >
              <MaterialCommunityIcons name="clipboard-text-outline" size={16} color={RED_DARK} />
              <Text style={{ color: RED_DARK, fontWeight: "900", fontSize: 13 }}>
                {i18n.t("home.viewResults", { defaultValue: "Voir les résultats" })}
              </Text>
              <MaterialCommunityIcons name="chevron-right" size={16} color={RED_DARK} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              disabled={!canJoin}
              onPress={onPressParticipate}
              activeOpacity={0.85}
              style={[
                {
                  backgroundColor: RED_DARK,
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: 10,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                },
                !canJoin && { opacity: 0.45 },
              ]}
            >
              <Text style={{ color: "#fff", fontWeight: "900", fontSize: 13 }}>
                {i18n.t("home.participate", { defaultValue: "Participer" })}
              </Text>
              <MaterialCommunityIcons name="arrow-right" size={16} color="#fff" />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}