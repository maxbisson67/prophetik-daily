// src/defis/TeamPredictionBundleHomeCard.js

import React, { useMemo } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import i18n from "@src/i18n/i18n";
import TeamLogoBadge from "@src/sports/TeamLogoBadge";
import { lookupTeamByAbbr } from "@src/groups/data/fallbackTeams";
import TpHomeDeadlineBlock from "@src/defis/TpHomeDeadlineBlock";
import { getEarliestOpenSlot, isSlotLocked } from "@src/defis/tpDeadlineHelpers";
import {
  formatPickPoints,
  formatResultWinnerLine,
  formatTpPickLine,
  isBundleDecided,
  isSlotDecided,
} from "@src/defis/tpBundleDisplayHelpers";

function safeAbbr(v) {
  return String(v || "").trim().toUpperCase();
}

function BundleMatchRow({ slot, slotIndex, league, pick, pickResult, colors }) {
  const awayAbbr = safeAbbr(slot?.awayAbbr);
  const homeAbbr = safeAbbr(slot?.homeAbbr);
  const awayTeam = lookupTeamByAbbr(league, awayAbbr);
  const homeTeam = lookupTeamByAbbr(league, homeAbbr);
  const pickLine = formatTpPickLine(pick, league);
  const slotDecided = isSlotDecided(slot);
  const slotLocked = !slotDecided && isSlotLocked(slot);
  const officialLine = slotDecided ? formatResultWinnerLine(slot, league) : null;
  const pointsLine = slotDecided ? formatPickPoints(pickResult) : null;
  const slotLabel = Number(slot?.slot) > 0 ? Number(slot.slot) : slotIndex;

  return (
    <View
      style={{
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <Text
          style={{
            marginRight: 6,
            color: colors.subtext,
            fontWeight: "900",
            fontSize: 12,
            width: 14,
            textAlign: "center",
          }}
        >
          {slotLabel}
        </Text>

        <TeamLogoBadge team={awayTeam} size={18} colors={colors} />
        <Text style={{ color: colors.text, fontWeight: "900", marginHorizontal: 6, fontSize: 13 }}>
          {awayAbbr}
        </Text>
        <Text style={{ color: colors.subtext, fontWeight: "900" }}>@</Text>
        <Text style={{ color: colors.text, fontWeight: "900", marginHorizontal: 6, fontSize: 13 }}>
          {homeAbbr}
        </Text>
        <TeamLogoBadge team={homeTeam} size={18} colors={colors} />

        <View style={{ flex: 1 }} />

        {slotDecided && officialLine ? (
          <View style={{ alignItems: "flex-end" }}>
            <Text style={{ color: colors.text, fontWeight: "900", fontSize: 12 }}>{officialLine}</Text>
            {pickLine ? (
              <Text style={{ color: colors.subtext, fontSize: 11, marginTop: 2 }}>
                {i18n.t("tp.home.myPickShort", { defaultValue: "Toi" })}: {pickLine}
                {pointsLine ? ` · ${pointsLine}` : ""}
              </Text>
            ) : null}
          </View>
        ) : pickLine ? (
          <Text style={{ color: colors.text, fontWeight: "900", fontSize: 12 }}>{pickLine}</Text>
        ) : (
          <Text style={{ color: colors.subtext, fontSize: 12 }}>
            {slotLocked
              ? i18n.t("tp.home.predictionsClosed", { defaultValue: "Prédictions fermées" })
              : "—"}
          </Text>
        )}
      </View>
    </View>
  );
}

function isBundleLocked(bundle, games, isSlotLocked) {
  const status = String(bundle?.status || "open").toLowerCase();
  if (["decided", "closed"].includes(status)) return true;

  const slots = Array.isArray(games) ? games : [];
  if (!slots.length) return status === "locked";

  return slots.every((g) => isSlotLocked(g));
}

export default function TeamPredictionBundleHomeCard({
  bundle,
  entry,
  league,
  colors,
  onPressSecondary,
}) {
  const router = useRouter();
  const games = Array.isArray(bundle?.games) ? bundle.games : [];
  const gameCount = Number(bundle?.gameCount || games.length || 0);
  const picks = entry?.picks || {};
  const pickResults = entry?.pickResults || {};
  const picksCompletedCount = Number(entry?.picksCompletedCount || 0);
  const totalPoints = Number(entry?.totalPoints ?? 0);
  const participants = Number(bundle?.participantsCount ?? 0);
  const bundleDecided = isBundleDecided(bundle);

  const locked = useMemo(
    () => isBundleLocked(bundle, games, isSlotLocked),
    [bundle, games]
  );

  const { lockedAt: deadline, slot: nextSlot } = useMemo(
    () => getEarliestOpenSlot(games),
    [games]
  );

  const allPicksComplete = gameCount > 0 && picksCompletedCount >= gameCount;

  const ctaLabel = bundleDecided || locked
    ? i18n.t("tp.home.seeResults", { defaultValue: "Voir le résultat" })
    : allPicksComplete
    ? i18n.t("tp.home.modifyTeams", { defaultValue: "Modifier mes équipes" })
    : i18n.t("common.participate", { defaultValue: "Participer" });

  const statusLower = String(bundle?.status || "open").toLowerCase();
  const showSecondaryCta = !bundleDecided && statusLower !== "open";
  const secondaryCtaLabel = i18n.t("tp.home.viewPredictions", {
    defaultValue: "Voir les prédictions",
  });

  return (
    <View
      style={{
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.card,
      }}
    >
      <Text style={{ color: colors.text, fontWeight: "900", fontSize: 14, marginBottom: 8 }}>
        {i18n.t("tp.home.bundleTitle", {
          defaultValue: "{{count}} match(s) à prédire",
          count: gameCount,
        })}
      </Text>

      {games.map((slot, index) => (
        <BundleMatchRow
          key={String(slot.gameId)}
          slot={slot}
          slotIndex={index + 1}
          league={league}
          pick={picks[String(slot.gameId)]}
          pickResult={pickResults[String(slot.gameId)]}
          colors={colors}
        />
      ))}

      {bundleDecided ? (
        <Text style={{ color: colors.text, marginTop: 10, fontSize: 13, fontWeight: "900" }}>
          {entry
            ? i18n.t("tp.home.myTotalPoints", {
                defaultValue: "Ton total : {{points}} pt(s)",
                points: totalPoints,
              })
            : i18n.t("tp.home.resultsAvailable", {
                defaultValue: "Résultats disponibles",
              })}
        </Text>
      ) : (
        <TpHomeDeadlineBlock
          locked={locked}
          deadline={deadline}
          nextSlot={nextSlot}
          colors={colors}
        />
      )}

      {picksCompletedCount > 0 ? (
        <Text style={{ color: colors.subtext, marginTop: 8, fontSize: 13 }}>
          {i18n.t("tp.home.bundleProgress", {
            defaultValue: "{{done}}/{{total}} prédictions complétées",
            done: picksCompletedCount,
            total: gameCount,
          })}
        </Text>
      ) : null}

      <View style={{ flexDirection: "row", alignItems: "center", marginTop: 8 }}>
        <MaterialCommunityIcons name="account-group" size={16} color={colors.subtext} />
        <Text style={{ color: colors.subtext, marginLeft: 6, fontSize: 13 }}>
          {participants}{" "}
          {i18n.t("common.participants", { defaultValue: "participant(s)" })}
        </Text>
      </View>

      <View style={{ marginTop: 12, gap: 10 }}>
        <TouchableOpacity
          onPress={() =>
            router.push({
              pathname: "/(drawer)/(team-prediction)/pick/[challengeId]",
              params: { challengeId: bundle.id },
            })
          }
          activeOpacity={0.9}
          style={{
            width: "100%",
            paddingVertical: 10,
            borderRadius: 12,
            alignItems: "center",
            backgroundColor: "#b91c1c",
          }}
        >
          <Text style={{ color: "#fff", fontWeight: "900" }}>{ctaLabel}</Text>
        </TouchableOpacity>

        {showSecondaryCta ? (
          <TouchableOpacity
            onPress={onPressSecondary}
            activeOpacity={0.9}
            style={{
              width: "100%",
              paddingVertical: 10,
              borderRadius: 12,
              alignItems: "center",
              backgroundColor: colors.card,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Text style={{ color: colors.text, fontWeight: "900" }}>{secondaryCtaLabel}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

export { isBundleLocked, isSlotLocked };
