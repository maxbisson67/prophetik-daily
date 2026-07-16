import React from "react";
import { View, Text, TouchableOpacity, Image } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import i18n from "@src/i18n/i18n";
import { MlbBvpLine, shouldShowMlbBvpLine } from "@src/mlb/MlbDefiPlayerMeta";
import { getInjuryDisplay } from "@src/players/injuryDisplayHelpers";
import {
  getFgcPlayerPreviousSeasonLine,
  getFgcPlayerStatChips,
} from "@src/players/seasonStatsHelpers";

function initials(name) {
  const s = String(name || "").trim();
  if (!s) return "?";
  const parts = s.split(/\s+/).filter(Boolean);
  const a = parts[0]?.[0] || "";
  const b = parts.length > 1 ? parts[parts.length - 1]?.[0] : "";
  return (a + b).toUpperCase();
}

function StatChip({ chip, colors }) {
  return (
    <View
      style={{
        flex: 1,
        minWidth: 56,
        paddingVertical: 8,
        paddingHorizontal: 6,
        borderRadius: 10,
        backgroundColor: colors.card2,
        borderWidth: 1,
        borderColor: colors.border,
        alignItems: "center",
      }}
    >
      <Text style={{ color: colors.text, fontWeight: "900", fontSize: 16, lineHeight: 20 }}>
        {chip.value}
      </Text>
      <Text style={{ color: colors.subtext, fontWeight: "800", fontSize: 10, marginTop: 2 }}>
        {chip.label}
      </Text>
    </View>
  );
}

function isMlbPick({ league, item }) {
  const L = String(league || item?.league || "").toUpperCase();
  return L === "MLB";
}

function resolveRoleLabel({ league, item, lineupSlot, lineupSideAvailable }) {
  const slot = lineupSlot != null ? Number(lineupSlot) : null;
  const mlb = isMlbPick({ league, item });

  if (Number.isFinite(slot) && slot >= 1 && slot <= 9) {
    return i18n.t("firstGoal.pick.lineupOrder", {
      defaultValue: "{{slot}}e frappeur",
      slot,
    });
  }

  if (mlb) {
    if (lineupSideAvailable) {
      return i18n.t("firstGoal.pick.notInLineup", { defaultValue: "Hors alignement" });
    }
    return i18n.t("firstGoal.pick.lineupPending", {
      defaultValue: "Ordre de frappe à confirmer",
    });
  }

  const pos = String(item?.positionCode || "").trim().toUpperCase();
  return pos || null;
}

function LineupBadge({ slot, colors, provisional = false }) {
  const n = Number(slot);
  if (!Number.isFinite(n) || n < 1 || n > 9) return null;

  return (
    <View
      style={{
        minWidth: 28,
        height: 28,
        paddingHorizontal: 6,
        borderRadius: 8,
        backgroundColor: provisional ? colors.card2 : colors.primary,
        borderWidth: provisional ? 1 : 0,
        borderColor: provisional ? colors.subtext : "transparent",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text
        style={{
          color: provisional ? colors.text : "#fff",
          fontWeight: "900",
          fontSize: 13,
        }}
      >
        {n}
      </Text>
    </View>
  );
}

const FgcPlayerPickCard = React.memo(function FgcPlayerPickCard({
  item,
  disabled,
  locked,
  onPick,
  onNovaPress,
  showNovaButton,
  colors,
  selectedPlayerId,
  pendingPlayerId = null,
  league,
  seasonPair,
  lineupsAvailable = false,
  lineupSideAvailable = false,
  lineupsProvisional = false,
}) {
  const uri = item.headshotUrl || item.headshot || null;
  const name = item.fullName || item.name || item.id;
  const injuryInfo = getInjuryDisplay(item?.injury);
  const isPicked = !!(
    selectedPlayerId &&
    (String(selectedPlayerId) === String(item?.id) ||
      String(selectedPlayerId) === String(item?.playerId))
  );
  const isPending = !!(
    pendingPlayerId &&
    (String(pendingPlayerId) === String(item?.id) ||
      String(pendingPlayerId) === String(item?.playerId))
  );

  const statChips = getFgcPlayerStatChips(item, league, seasonPair);
  const previousSeason = getFgcPlayerPreviousSeasonLine(item, league, seasonPair);
  const roleLabel = resolveRoleLabel({
    league,
    item,
    lineupSlot: item?.lineupSlot,
    lineupSideAvailable,
  });

  return (
    <View
      style={{
        borderRadius: 14,
        borderWidth: 2,
        borderColor: isPending ? colors.warning || "#FB8C00" : isPicked ? colors.primary : colors.border,
        backgroundColor: isPicked ? colors.card2 : colors.card,
        opacity: disabled && !isPending ? 0.55 : 1,
        overflow: "hidden",
      }}
    >
      <TouchableOpacity
        onPress={() => onPick(item)}
        disabled={disabled}
        activeOpacity={0.85}
        style={{ padding: 12, gap: 10 }}
      >
        <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
          <View
            style={{
              width: 48,
              height: 48,
              borderRadius: 24,
              overflow: "hidden",
              backgroundColor: colors.card2,
              borderWidth: 1,
              borderColor: colors.border,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {uri ? (
              <Image source={{ uri }} style={{ width: 48, height: 48 }} resizeMode="cover" />
            ) : (
              <Text style={{ color: colors.text, fontWeight: "900" }}>{initials(name)}</Text>
            )}
          </View>

          <View style={{ flex: 1, gap: 4 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              {item?.lineupSlot != null ? (
                <LineupBadge
                  slot={item.lineupSlot}
                  colors={colors}
                  provisional={lineupsProvisional}
                />
              ) : null}

              <Text style={{ fontWeight: "900", color: colors.text, flex: 1, fontSize: 15 }} numberOfLines={1}>
                {name}
              </Text>

              {injuryInfo?.showIcon ? (
                <Ionicons
                  name="medkit"
                  size={14}
                  color={
                    injuryInfo.tone === "danger"
                      ? colors.danger || "#E53935"
                      : colors.warning || "#FB8C00"
                  }
                />
              ) : null}

              {isPending ? (
                <Ionicons name="hourglass-outline" size={18} color={colors.warning || "#FB8C00"} />
              ) : isPicked ? (
                <Ionicons name="checkmark-circle" size={18} color={colors.primary} />
              ) : null}
            </View>

            {isPending ? (
              <Text style={{ color: colors.warning || "#FB8C00", fontSize: 12, fontWeight: "800" }}>
                {i18n.t("firstGoal.pick.saving", { defaultValue: "Enregistrement en cours…" })}
              </Text>
            ) : roleLabel ? (
              <Text style={{ color: colors.subtext, fontSize: 12, fontWeight: "800" }}>{roleLabel}</Text>
            ) : isPicked ? (
              <Text
                style={{
                  color: colors.danger || "#E53935",
                  fontSize: 12,
                  fontWeight: "800",
                }}
              >
                {i18n.t("firstGoal.pick.mySelection", { defaultValue: "Ma sélection" })}
              </Text>
            ) : null}

            {injuryInfo ? (
              <Text
                style={{
                  color:
                    injuryInfo.tone === "danger"
                      ? colors.danger || "#E53935"
                      : colors.warning || "#FB8C00",
                  fontSize: 11,
                  fontWeight: "700",
                }}
                numberOfLines={2}
              >
                {injuryInfo.label}
                {injuryInfo.short ? ` · ${injuryInfo.short}` : ""}
              </Text>
            ) : null}
          </View>

          {locked || isPicked || isPending ? null : (
            <Ionicons name="chevron-forward" size={18} color={colors.subtext} style={{ marginTop: 4 }} />
          )}
        </View>

        {statChips.length ? (
          <View style={{ flexDirection: "row", gap: 8 }}>
            {statChips.map((chip) => (
              <StatChip key={chip.key} chip={chip} colors={colors} />
            ))}
          </View>
        ) : null}

        {previousSeason ? (
          <Text style={{ color: colors.subtext, fontSize: 11, fontWeight: "600" }}>
            {previousSeason.label} · {previousSeason.line}
          </Text>
        ) : null}

        {league === "MLB" && shouldShowMlbBvpLine(item?.bvpVsOpposingStarter) ? (
          <MlbBvpLine
            bvp={item.bvpVsOpposingStarter}
            pitcher={item?.opposingPitcherForBvp}
            colors={colors}
          />
        ) : null}
      </TouchableOpacity>

      {showNovaButton ? (
        <TouchableOpacity
          onPress={() => onNovaPress?.(item)}
          disabled={disabled}
          activeOpacity={0.85}
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            paddingVertical: 9,
            paddingHorizontal: 12,
            borderTopWidth: 1,
            borderTopColor: colors.border,
            backgroundColor: colors.card,
          }}
        >
          <Ionicons name="sparkles-outline" size={15} color={colors.primary} />
          <Text style={{ color: colors.primary, fontWeight: "800", fontSize: 12 }}>
            {i18n.t("novaCoach.playerAdviceButton", { defaultValue: "Avis de Nova" })}
          </Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
});

export default FgcPlayerPickCard;
