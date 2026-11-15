import React from "react";
import { View, Text, TouchableOpacity, Image, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import i18n from "@src/i18n/i18n";
import { MlbBvpLine, shouldShowMlbBvpLine } from "@src/mlb/MlbDefiPlayerMeta";
import { getInjuryDisplay } from "@src/players/injuryDisplayHelpers";
import { getFgcPlayerStatChips } from "@src/players/seasonStatsHelpers";
import { getFgcPlayerSortTag } from "@src/firstGoal/fgcPlayerSortSeason";
import { formatSeasonLabel } from "@src/players/seasonStatsHelpers";
import {
  formatNhlPickGoalsPerGame,
  getNhlPickDetailStats,
  getNhlPickFirstGoalsCount,
  getNhlPickSeasonId,
  getNhlPlayerFirstName,
} from "@src/firstGoal/fgcNhlPlayerPickStats";

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
        borderRadius: 12,
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
        top: 12,
        right: 12,
        zIndex: 2,
        paddingVertical: 4,
        paddingHorizontal: 8,
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

function NhlDetailStatRow({ label, value, colors }) {
  return (
    <View style={{ flex: 1, minWidth: "45%", gap: 2 }}>
      <Text style={{ color: colors.subtext, fontSize: 11, fontWeight: "700" }}>{label}</Text>
      <Text
        style={{
          color: colors.text,
          fontSize: 16,
          fontWeight: "900",
          fontVariant: ["tabular-nums"],
        }}
      >
        {value}
      </Text>
    </View>
  );
}

function NhlSeasonStatsBlock({ title, detail, colors }) {
  return (
    <View style={{ gap: 8 }}>
      <Text style={{ color: colors.text, fontSize: 12, fontWeight: "900" }}>{title}</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
        <NhlDetailStatRow
          label={i18n.t("firstGoal.pick.detailGoals", { defaultValue: "Buts" })}
          value={detail.goals}
          colors={colors}
        />
        <NhlDetailStatRow
          label={i18n.t("firstGoal.pick.detailGoalsPerGame", { defaultValue: "Buts / match" })}
          value={detail.goalsPerGame}
          colors={colors}
        />
        <NhlDetailStatRow
          label={i18n.t("firstGoal.pick.detailToi", { defaultValue: "Temps de glace moy." })}
          value={detail.timeOnIce}
          colors={colors}
        />
        <NhlDetailStatRow
          label={i18n.t("firstGoal.pick.detailShotsPerGame", { defaultValue: "Tirs / match" })}
          value={detail.shotsPerGame}
          colors={colors}
        />
        <NhlDetailStatRow
          label={i18n.t("firstGoal.pick.detailPpGoals", { defaultValue: "Buts en avantage num." })}
          value={detail.ppGoals}
          colors={colors}
        />
      </View>
    </View>
  );
}

function NhlPickChooseButton({ disabled, locked, isPicked, isPending, onPick, item, colors }) {
  if (locked && !isPicked && !isPending) return null;

  const canPick = !disabled && !isPending;

  if (isPending) {
    return (
      <View
        style={{
          minWidth: 44,
          minHeight: 44,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Ionicons name="hourglass-outline" size={22} color={colors.warning || "#FB8C00"} />
      </View>
    );
  }

  if (isPicked) {
    return (
      <View
        style={{
          minWidth: 44,
          minHeight: 44,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Ionicons name="checkmark-circle" size={28} color={colors.primary} />
      </View>
    );
  }

  return (
    <Pressable
      onPress={() => onPick?.(item)}
      disabled={!canPick}
      accessibilityRole="button"
      accessibilityLabel={i18n.t("firstGoal.pick.choosePlayer", { defaultValue: "Choisir ce joueur" })}
      style={({ pressed }) => ({
        minHeight: 44,
        minWidth: 44,
        paddingHorizontal: 12,
        borderRadius: 12,
        backgroundColor: pressed ? `${colors.primary}dd` : colors.primary,
        alignItems: "center",
        justifyContent: "center",
        opacity: canPick ? 1 : 0.45,
      })}
    >
      <Text style={{ color: "#fff", fontWeight: "900", fontSize: 12 }}>
        {i18n.t("firstGoal.pick.chooseShort", { defaultValue: "Choisir" })}
      </Text>
    </Pressable>
  );
}

function NhlPlayerPickCard({
  item,
  disabled,
  locked,
  onPick,
  colors,
  selectedPlayerId,
  pendingPlayerId,
  seasonPair,
  expanded,
  onToggleExpand,
  lineupsProvisional,
}) {
  const uri = item.headshotUrl || item.headshot || null;
  const name = item.fullName || item.name || item.id;
  const injuryInfo = getInjuryDisplay(item?.injury);
  const seasonId = getNhlPickSeasonId(seasonPair);
  const previousSeasonId =
    seasonPair?.previous && String(seasonPair.previous) !== String(seasonId)
      ? String(seasonPair.previous)
      : "";
  const gpg = formatNhlPickGoalsPerGame(item, seasonId);
  const detailCurrent = getNhlPickDetailStats(item, seasonId);
  const detailPrevious = previousSeasonId ? getNhlPickDetailStats(item, previousSeasonId) : null;
  const firstGoalsCount = getNhlPickFirstGoalsCount(item, seasonId);
  const firstName =
    getNhlPlayerFirstName(item) ||
    i18n.t("firstGoal.pick.playerFirstNameFallback", { defaultValue: "Ce joueur" });
  const gpgUnit = i18n.t("firstGoal.pick.goalsPerGameUnit", {
    defaultValue: i18n.language?.startsWith("fr") ? "B/MJ" : "G/GP",
  });
  const goalsTotalLabel =
    detailCurrent.goals === "—"
      ? "—"
      : i18n.t("firstGoal.pick.seasonGoalsTotalShort", {
          goals: detailCurrent.goals,
          defaultValue: `${detailCurrent.goals} B`,
        });

  const isPicked = !!(
    selectedPlayerId &&
    (String(selectedPlayerId) === String(item?.id) || String(selectedPlayerId) === String(item?.playerId))
  );
  const isPending = !!(
    pendingPlayerId &&
    (String(pendingPlayerId) === String(item?.id) || String(pendingPlayerId) === String(item?.playerId))
  );

  return (
    <View
      style={{
        borderRadius: 16,
        borderWidth: 2,
        borderColor: isPending ? colors.warning || "#FB8C00" : isPicked ? colors.primary : colors.border,
        backgroundColor: isPicked ? colors.card2 : colors.card,
        opacity: disabled && !isPending ? 0.55 : 1,
        overflow: "hidden",
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "stretch", paddingLeft: 12, paddingVertical: 8, gap: 8 }}>
        <Pressable
          onPress={() => onToggleExpand?.(item)}
          disabled={disabled && !expanded}
          style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 12, minHeight: 44 }}
          accessibilityRole="button"
          accessibilityState={{ expanded: !!expanded }}
          accessibilityLabel={i18n.t("firstGoal.pick.toggleStats", {
            defaultValue: "Afficher les stats de {{name}}",
            name,
          })}
        >
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              overflow: "hidden",
              backgroundColor: colors.card2,
              borderWidth: 1,
              borderColor: colors.border,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {uri ? (
              <Image source={{ uri }} style={{ width: 40, height: 40 }} resizeMode="cover" />
            ) : (
              <Text style={{ color: colors.text, fontWeight: "900", fontSize: 13 }}>{initials(name)}</Text>
            )}
          </View>

          <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              {item?.lineupSlot != null ? (
                <LineupBadge slot={item.lineupSlot} colors={colors} provisional={lineupsProvisional} />
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
            </View>

            <View style={{ flexDirection: "row", alignItems: "baseline", flexWrap: "wrap", gap: 8 }}>
              <Text style={{ color: colors.text, fontWeight: "900", fontSize: 14, fontVariant: ["tabular-nums"] }}>
                {gpg}
                <Text style={{ color: colors.subtext, fontWeight: "800", fontSize: 11 }}> {gpgUnit}</Text>
              </Text>
              <Text
                style={{
                  color: colors.subtext,
                  fontWeight: "800",
                  fontSize: 12,
                  fontVariant: ["tabular-nums"],
                }}
              >
                {goalsTotalLabel}
              </Text>
            </View>

            {isPending ? (
              <Text style={{ color: colors.warning || "#FB8C00", fontSize: 12, fontWeight: "800" }}>
                {i18n.t("firstGoal.pick.saving", { defaultValue: "Enregistrement en cours…" })}
              </Text>
            ) : isPicked ? (
              <Text style={{ color: colors.primary, fontSize: 12, fontWeight: "800" }}>
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
                numberOfLines={expanded ? 3 : 1}
              >
                {injuryInfo.label}
                {injuryInfo.short ? ` · ${injuryInfo.short}` : ""}
              </Text>
            ) : null}
          </View>

          <Ionicons
            name={expanded ? "chevron-up" : "chevron-down"}
            size={20}
            color={colors.subtext}
            style={{ marginRight: 4 }}
          />
        </Pressable>

        <View style={{ justifyContent: "center", paddingRight: 12 }}>
          <NhlPickChooseButton
            disabled={disabled}
            locked={locked}
            isPicked={isPicked}
            isPending={isPending}
            onPick={onPick}
            item={item}
            colors={colors}
          />
        </View>
      </View>

      {expanded ? (
        <View
          style={{
            paddingHorizontal: 12,
            paddingBottom: 12,
            paddingTop: 8,
            borderTopWidth: 1,
            borderTopColor: colors.border,
            backgroundColor: colors.card2,
            gap: 16,
          }}
        >
          <Text style={{ color: colors.text, fontSize: 13, fontWeight: "700", lineHeight: 18 }}>
            {firstGoalsCount > 0
              ? i18n.t("firstGoal.pick.firstGoalsPersonal", {
                  defaultValue: "{{name}} a compté {{count}} fois le premier but cette année.",
                  name: firstName,
                  count: firstGoalsCount,
                })
              : i18n.t("firstGoal.pick.firstGoalsPersonalNone", {
                  defaultValue: "{{name}} n'a pas encore marqué le premier but cette année.",
                  name: firstName,
                })}
          </Text>

          {seasonId ? (
            <NhlSeasonStatsBlock
              title={i18n.t("firstGoal.pick.seasonStatsBlock", {
                defaultValue: "Saison {{season}}",
                season: formatSeasonLabel("NHL", seasonId),
              })}
              detail={detailCurrent}
              colors={colors}
            />
          ) : null}

          {previousSeasonId && detailPrevious ? (
            <NhlSeasonStatsBlock
              title={i18n.t("firstGoal.pick.seasonStatsBlockPrevious", {
                defaultValue: "Saison précédente · {{season}}",
                season: formatSeasonLabel("NHL", previousSeasonId),
              })}
              detail={detailPrevious}
              colors={colors}
            />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const FgcPlayerPickCard = React.memo(function FgcPlayerPickCard({
  item,
  disabled,
  locked,
  onPick,
  onNovaPress,
  showNovaButton = false,
  colors,
  selectedPlayerId,
  pendingPlayerId = null,
  league,
  seasonPair,
  sortSeasonId = null,
  lineupsAvailable = false,
  lineupSideAvailable = false,
  lineupsProvisional = false,
  expanded = false,
  onToggleExpand = null,
}) {
  const isNhl = String(league || "").toUpperCase() === "NHL";

  if (isNhl) {
    return (
      <NhlPlayerPickCard
        item={item}
        disabled={disabled}
        locked={locked}
        onPick={onPick}
        colors={colors}
        selectedPlayerId={selectedPlayerId}
        pendingPlayerId={pendingPlayerId}
        seasonPair={seasonPair}
        expanded={expanded}
        onToggleExpand={onToggleExpand}
        lineupsProvisional={lineupsProvisional}
      />
    );
  }

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

  const currentChips = getFgcPlayerStatChips(item, league, seasonPair?.current);
  const previousChips = seasonPair?.previous
    ? getFgcPlayerStatChips(item, league, seasonPair.previous)
    : [];
  const sortTagSeasonId = sortSeasonId || seasonPair?.current;
  const sortTag = getFgcPlayerSortTag(item, league, sortTagSeasonId);
  const roleLabel = resolveRoleLabel({
    league,
    item,
    lineupSlot: item?.lineupSlot,
    lineupSideAvailable,
  });

  return (
    <View
      style={{
        borderRadius: 16,
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
        style={{ padding: 12, paddingTop: sortTag ? 36 : 12, gap: 12 }}
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

        {currentChips.length ? (
          <View style={{ flexDirection: "row", gap: 8 }}>
            {currentChips.map((chip) => (
              <StatChip key={`cur-${chip.key}`} chip={chip} colors={colors} />
            ))}
          </View>
        ) : null}

        {previousChips.length ? (
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
