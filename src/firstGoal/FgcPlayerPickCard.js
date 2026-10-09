import React from "react";
import { View, Text, TouchableOpacity, Image } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import i18n from "@src/i18n/i18n";
import { MlbBvpLine, shouldShowMlbBvpLine } from "@src/mlb/MlbDefiPlayerMeta";
import { getInjuryDisplay } from "@src/players/injuryDisplayHelpers";
import {
  getFgcPlayerStatChips,
  getNhlGoalsPerGameFromStats,
  getSeasonStats,
} from "@src/players/seasonStatsHelpers";
import { getFgcPlayerSortTag } from "@src/firstGoal/fgcPlayerSortSeason";

function initials(name) {
  const s = String(name || "").trim();
  if (!s) return "?";
  const parts = s.split(/\s+/).filter(Boolean);
  const a = parts[0]?.[0] || "";
  const b = parts.length > 1 ? parts[parts.length - 1]?.[0] : "";
  return (a + b).toUpperCase();
}

function StatChip({ chip, colors, muted = false }) {
  const emphasized = chip.emphasize === true;
  return (
    <View
      style={{
        flex: 1,
        minWidth: 56,
        paddingVertical: 8,
        paddingHorizontal: 6,
        borderRadius: 10,
        backgroundColor: muted ? colors.card : colors.card2,
        borderWidth: emphasized ? 2 : 1,
        borderColor: emphasized ? colors.primary : colors.border,
        alignItems: "center",
        opacity: muted ? 0.92 : 1,
      }}
    >
      <Text
        style={{
          color: colors.text,
          fontWeight: emphasized ? "900" : "800",
          fontSize: emphasized ? 18 : 15,
          lineHeight: emphasized ? 22 : 19,
        }}
      >
        {chip.value}
      </Text>
      <Text
        style={{
          color: emphasized ? colors.primary : colors.subtext,
          fontWeight: "800",
          fontSize: 10,
          marginTop: 2,
        }}
      >
        {chip.label}
      </Text>
    </View>
  );
}

function SortPointsTag({ tag, colors, showLabel = true }) {
  if (!tag) return null;

  return (
    <View
      style={{
        position: "absolute",
        top: 10,
        right: 10,
        zIndex: 2,
        paddingVertical: 5,
        paddingHorizontal: 9,
        borderRadius: 999,
        backgroundColor: colors.primary,
        borderWidth: 1,
        borderColor: colors.primary,
        alignItems: "center",
        minWidth: 52,
      }}
    >
      <Text style={{ color: "#fff", fontWeight: "900", fontSize: 15, lineHeight: 18 }}>
        {tag.value}
      </Text>
      {showLabel && tag.label ? (
        <Text style={{ color: "rgba(255,255,255,0.92)", fontWeight: "800", fontSize: 9, marginTop: 1 }}>
          {tag.label}
        </Text>
      ) : null}
    </View>
  );
}

function nhlGoalsAndGp(item, seasonId) {
  const stats = getSeasonStats(item?.statsBySeason, seasonId);
  if (!stats || typeof stats !== "object") {
    return { goals: 0, gp: 0 };
  }
  return {
    goals: Number(stats.goals) || 0,
    gp: Number(stats.gamesPlayed) || 0,
  };
}

const NHL_GOALS_LABEL_WIDTH = 100;

/** B / G (buts) et MJ / GP (matchs) selon la langue. */
function nhlGoalsUnitLabel() {
  return i18n.language?.startsWith("fr") ? "B" : "G";
}

function nhlGamesPlayedUnitLabel() {
  return i18n.language?.startsWith("fr") ? "MJ" : "GP";
}

function formatNhlGoalsPerGame(rate) {
  if (rate == null || !Number.isFinite(rate)) return "—";
  return rate.toFixed(2);
}

function NhlGoalsRateRow({ label, goals, gp, colors, emphasized = false }) {
  const games = Number(gp) || 0;
  const rate = games > 0 ? getNhlGoalsPerGameFromStats({ goals, gamesPlayed: gp }) : null;
  const rateStr = formatNhlGoalsPerGame(rate);
  const goalsUnit = nhlGoalsUnitLabel();
  const gpUnit = nhlGamesPlayedUnitLabel();
  const gpgUnit = i18n.t("firstGoal.pick.goalsPerGameUnit", {
    defaultValue: i18n.language?.startsWith("fr") ? "B/MJ" : "G/GP",
  });

  const numStyle = {
    fontVariant: ["tabular-nums"],
    fontWeight: "900",
    fontSize: emphasized ? 17 : 14,
    lineHeight: emphasized ? 20 : 17,
    color: emphasized ? colors.primary : colors.text,
  };
  const unitStyle = {
    fontSize: 9,
    fontWeight: "800",
    color: emphasized ? colors.primary : colors.subtext,
  };

  return (
    <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 6 }}>
      <Text
        style={{
          minWidth: NHL_GOALS_LABEL_WIDTH,
          flexShrink: 0,
          color: colors.subtext,
          fontSize: 10,
          fontWeight: emphasized ? "800" : "700",
          lineHeight: 14,
          paddingTop: emphasized ? 4 : 2,
        }}
      >
        {label}
      </Text>
      <View style={{ alignItems: "center", gap: 2, flexShrink: 1, maxWidth: "100%" }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "baseline",
            gap: 6,
            paddingHorizontal: emphasized ? 8 : 5,
            paddingVertical: emphasized ? 3 : 2,
            borderRadius: 7,
            backgroundColor: emphasized ? `${colors.primary}20` : colors.card2,
            borderWidth: emphasized ? 1 : 0,
            borderColor: emphasized ? `${colors.primary}40` : "transparent",
          }}
        >
          <Text style={{ ...numStyle, paddingRight: 2 }} numberOfLines={1}>
            {goals}
          </Text>
          <Text style={unitStyle}>{goalsUnit}</Text>
          <Text style={{ color: colors.subtext, fontSize: 10, fontWeight: "700" }}>
            ·
          </Text>
          <Text style={{ ...numStyle, paddingRight: 2 }} numberOfLines={1}>
            {gp}
          </Text>
          <Text style={unitStyle}>{gpUnit}</Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "baseline", gap: 3 }}>
          <Text
            style={{
              fontVariant: ["tabular-nums"],
              fontWeight: "700",
              fontSize: 9,
              lineHeight: 12,
              color: colors.subtext,
            }}
          >
            {rateStr}
          </Text>
          <Text style={{ fontSize: 9, fontWeight: "700", color: colors.subtext }}>{gpgUnit}</Text>
        </View>
      </View>
    </View>
  );
}

function NhlGoalsUnderName({ item, seasonPair, colors }) {
  const currentId = seasonPair?.current;
  if (!currentId) return null;

  const current = nhlGoalsAndGp(item, currentId);
  const previousId = seasonPair?.previous;
  const previous = previousId ? nhlGoalsAndGp(item, previousId) : null;

  return (
    <View style={{ gap: 4, marginTop: 2, alignSelf: "stretch" }}>
      <NhlGoalsRateRow
        label={i18n.t("firstGoal.pick.goalsThisYear", { defaultValue: "Cette saison :" })}
        goals={current.goals}
        gp={current.gp}
        colors={colors}
        emphasized
      />
      {previousId ? (
        <NhlGoalsRateRow
          label={i18n.t("firstGoal.pick.goalsLastYear", { defaultValue: "L'an passé :" })}
          goals={previous?.goals ?? 0}
          gp={previous?.gp ?? 0}
          colors={colors}
        />
      ) : null}
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

  return null;
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
  sortSeasonId = null,
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

  const isNhl = String(league || "").toUpperCase() === "NHL";
  const currentChips = !isNhl ? getFgcPlayerStatChips(item, league, seasonPair?.current) : [];
  const previousChips =
    !isNhl && seasonPair?.previous
      ? getFgcPlayerStatChips(item, league, seasonPair.previous)
      : [];
  const sortTagSeasonId = sortSeasonId || seasonPair?.current;
  const sortTag = !isNhl ? getFgcPlayerSortTag(item, league, sortTagSeasonId) : null;
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
      {sortTag ? <SortPointsTag tag={sortTag} colors={colors} /> : null}
      <TouchableOpacity
        onPress={() => onPick(item)}
        disabled={disabled}
        activeOpacity={0.85}
        style={{ padding: 12, paddingTop: sortTag ? 36 : 12, gap: 10 }}
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
            ) : roleLabel ? (
              <Text style={{ color: colors.subtext, fontSize: 12, fontWeight: "800" }}>{roleLabel}</Text>
            ) : null}

            {isNhl && !isPending ? (
              <NhlGoalsUnderName item={item} seasonPair={seasonPair} colors={colors} />
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

        {!isNhl && currentChips.length ? (
          <View style={{ flexDirection: "row", gap: 8 }}>
            {currentChips.map((chip) => (
              <StatChip key={`cur-${chip.key}`} chip={chip} colors={colors} />
            ))}
          </View>
        ) : null}

        {!isNhl && previousChips.length ? (
          <View style={{ flexDirection: "row", gap: 8 }}>
            {previousChips.map((chip) => (
              <StatChip key={`prev-${chip.key}`} chip={chip} colors={colors} muted />
            ))}
          </View>
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
