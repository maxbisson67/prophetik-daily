// app/defis/[defiId]/components/PlayerPickerRow.js
import React, { useMemo } from "react";
import { View, Text, TouchableOpacity, Image } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@src/theme/ThemeProvider";
import i18n from "@src/i18n/i18n";
import {
  isMlbDefiPlayer,
  MlbOpponentMatchupLine,
  MlbProbablePitcherLine,
  MlbBvpLine,
  resolveMlbOpponentAbbr,
} from "@src/mlb/MlbDefiPlayerMeta";

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function formatShortName(fullName = "") {
  const s = String(fullName || "").trim();
  if (!s) return "—";
  const parts = s.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0];
  const first = parts[0];
  const last = parts[parts.length - 1];
  return `${first.slice(0, 1).toUpperCase()}. ${last}`;
}

export default function PlayerPickerRow({
  label,
  value,
  onEdit,
  locked,
  tierLower = "free",
  headshotUrl,
  teamLogo,
  sport = "NHL",
  formatStandingsLine = null,
  showNovaButton = false,
  onNovaPress = null,
}) {
  const { colors } = useTheme();

  const tier = String(tierLower || "free").toLowerCase();
  const isVip = tier === "vip";
  const isPro = tier === "pro" || isVip;
  const isFree = !isPro;

  const picked = !!value?.playerId;
  const isMlb = picked && isMlbDefiPlayer(value, sport);

  const photoUri = useMemo(() => {
    if (!picked) return null;
    const abbr = String(value?.teamAbbr || "").toUpperCase();
    const pid = String(value?.playerId || "");
    const u = headshotUrl?.(abbr, pid);
    return u || value?.photoUrl || value?.avatarUrl || null;
  }, [picked, value?.teamAbbr, value?.playerId, value?.photoUrl, value?.avatarUrl, headshotUrl]);

  const displayName = useMemo(() => {
    if (!picked) return "—";
    if (isMlb) return String(value?.fullName || "—").trim() || "—";
    return formatShortName(value?.fullName);
  }, [picked, isMlb, value?.fullName]);

  const oppAbbr = useMemo(() => resolveMlbOpponentAbbr(value || {}), [value]);

  const g = num(value?.goals);
  const a = num(value?.assists);
  const p = num(value?.points);

  const ppg = useMemo(() => {
    const v = value?.pointsPerGame;
    if (Number.isFinite(Number(v))) return Number(v).toFixed(2);

    const gp = Number(value?.gamesPlayed);
    if (Number.isFinite(gp) && gp > 0) return (p / gp).toFixed(2);

    return null;
  }, [value?.pointsPerGame, value?.gamesPlayed, p]);

  const matchup = value?.matchup || null;
  const nhlAwayAbbr = String(matchup?.awayAbbr || "").toUpperCase();
  const nhlHomeAbbr = String(matchup?.homeAbbr || "").toUpperCase();
  const canShowNhlMatchup = !isFree && !isMlb && picked && !!teamLogo && !!nhlAwayAbbr && !!nhlHomeAbbr;

  return (
    <View
      style={{
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 12,
        backgroundColor: colors.background,
        overflow: "hidden",
      }}
    >
      <View style={{ padding: 12, gap: 10 }}>
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <Text style={{ flex: 1, color: colors.subtext, fontWeight: "900" }}>{label}</Text>

        <TouchableOpacity
          onPress={onEdit}
          disabled={locked}
          activeOpacity={0.85}
          style={{
            paddingHorizontal: 10,
            paddingVertical: 6,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: locked ? colors.border : colors.card,
            opacity: locked ? 0.6 : 1,
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
          }}
        >
          <Ionicons name={picked ? "create-outline" : "add-circle-outline"} size={16} color={colors.text} />
          <Text style={{ color: colors.text, fontWeight: "900" }}>
            {picked ? i18n.t("common.edit", { defaultValue: "Edit" }) : i18n.t("common.select", { defaultValue: "Choose" })}
          </Text>
        </TouchableOpacity>
      </View>

      {picked ? (
        <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
          <View
            style={{
              width: 42,
              height: 42,
              borderRadius: 21,
              overflow: "hidden",
              backgroundColor: colors.card,
              borderWidth: 1,
              borderColor: colors.border,
              marginRight: 10,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {photoUri ? (
              <Image source={{ uri: photoUri }} style={{ width: 42, height: 42 }} />
            ) : (
              <Ionicons name="person" size={20} color={colors.subtext} />
            )}
          </View>

          <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
            <Text numberOfLines={1} style={{ color: colors.text, fontWeight: "900", fontSize: 16, flexShrink: 1 }}>
              {displayName}
            </Text>

            {isMlb ? (
              <>
                <MlbOpponentMatchupLine
                  opponentAbbr={oppAbbr}
                  colors={colors}
                  formatStandingsLine={formatStandingsLine}
                />
                <MlbProbablePitcherLine pitcher={value?.opponentProbablePitcher} colors={colors} />
                <MlbBvpLine
                  bvp={value?.bvpVsOpposingStarter}
                  pitcher={value?.opponentProbablePitcher}
                  colors={colors}
                />
              </>
            ) : (
              <>
                <Text style={{ color: colors.subtext, fontWeight: "800" }}>
                  {g}-{a}-{p}
                  {!isFree && ppg ? ` • PPG ${ppg}` : ""}
                </Text>

                {canShowNhlMatchup ? (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Image source={teamLogo(nhlAwayAbbr)} style={{ width: 16, height: 16 }} />
                    <Text style={{ color: colors.subtext, fontWeight: "900" }}>@</Text>
                    <Image source={teamLogo(nhlHomeAbbr)} style={{ width: 16, height: 16 }} />
                  </View>
                ) : null}
              </>
            )}
          </View>
        </View>
      ) : (
        <Text style={{ color: colors.subtext, fontWeight: "700" }}>
          {i18n.t("defi.pickersCard.emptyPick", { defaultValue: "No player selected." })}
        </Text>
      )}
      </View>

      {showNovaButton && picked ? (
        <TouchableOpacity
          onPress={() => onNovaPress?.(value)}
          disabled={locked}
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
            opacity: locked ? 0.6 : 1,
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
}
