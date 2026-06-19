// src/defis/TeamPredictionBundleHomeCard.js

import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import i18n from "@src/i18n/i18n";
import TeamLogoBadge from "@src/sports/TeamLogoBadge";
import { lookupTeamByAbbr } from "@src/groups/data/fallbackTeams";

function toDateAny(ts) {
  if (!ts) return null;
  try {
    if (typeof ts?.toDate === "function") return ts.toDate();
    if (ts instanceof Date) return ts;
    const d = new Date(ts);
    if (!d || Number.isNaN(d.getTime())) return null;
    return d;
  } catch {
    return null;
  }
}

function fmtTimeShort(ts) {
  const d = toDateAny(ts);
  if (!d || Number.isNaN(d.getTime?.())) return null;
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function safeAbbr(v) {
  return String(v || "").trim().toUpperCase();
}

function formatTpPickLine(pick, league = "NHL") {
  if (!pick) return null;
  const away = pick.predictedAwayScore;
  const home = pick.predictedHomeScore;
  const score = `${away}-${home}`;
  const outcome = safeAbbr(pick.predictedOutcome);
  const lg = String(league || "NHL").toUpperCase();

  if (lg === "MLB" || outcome === "FINAL") return score;
  if (outcome === "REG" || outcome === "OT" || outcome === "TB") {
    return `${score} (${outcome})`;
  }
  return score;
}

function isSlotLocked(slot) {
  const status = String(slot?.status || "open").toLowerCase();
  if (status !== "open") return true;

  const lockedAt = toDateAny(slot?.lockedAt);
  if (lockedAt && Date.now() >= lockedAt.getTime()) return true;

  return false;
}

function isBundleLocked(bundle) {
  const status = String(bundle?.status || "open").toLowerCase();
  if (["decided", "closed"].includes(status)) return true;

  const games = Array.isArray(bundle?.games) ? bundle.games : [];
  if (!games.length) return status === "locked";

  return games.every((g) => isSlotLocked(g));
}

function getEarliestOpenDeadline(bundle) {
  const games = Array.isArray(bundle?.games) ? bundle.games : [];
  let earliest = null;

  for (const slot of games) {
    if (isSlotLocked(slot)) continue;
    const lockedAt = toDateAny(slot?.lockedAt);
    if (!lockedAt) continue;
    if (!earliest || lockedAt.getTime() < earliest.getTime()) {
      earliest = lockedAt;
    }
  }

  return earliest;
}

function BundleMatchRow({ slot, league, pick, colors }) {
  const awayAbbr = safeAbbr(slot?.awayAbbr);
  const homeAbbr = safeAbbr(slot?.homeAbbr);
  const awayTeam = lookupTeamByAbbr(league, awayAbbr);
  const homeTeam = lookupTeamByAbbr(league, homeAbbr);
  const pickLine = formatTpPickLine(pick, league);
  const slotLocked = isSlotLocked(slot);

  return (
    <View
      style={{
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        {slot?.isFavoriteGame ? (
          <Text style={{ marginRight: 6, fontSize: 12 }}>★</Text>
        ) : (
          <Text style={{ marginRight: 6, color: colors.subtext, fontWeight: "900", fontSize: 12 }}>
            {slot?.slot || "·"}
          </Text>
        )}

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

        {pickLine ? (
          <Text style={{ color: colors.text, fontWeight: "900", fontSize: 12 }}>{pickLine}</Text>
        ) : (
          <Text style={{ color: colors.subtext, fontSize: 12 }}>
            {slotLocked
              ? i18n.t("tp.home.signupClosed", { defaultValue: "Fermé" })
              : "—"}
          </Text>
        )}
      </View>
    </View>
  );
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
  const picksCompletedCount = Number(entry?.picksCompletedCount || 0);
  const participants = Number(bundle?.participantsCount ?? 0);
  const locked = isBundleLocked(bundle);
  const deadline = getEarliestOpenDeadline(bundle);
  const deadlineHM = fmtTimeShort(deadline);

  const allPicksComplete = gameCount > 0 && picksCompletedCount >= gameCount;

  const ctaLabel = locked
    ? i18n.t("tp.home.seeResults", { defaultValue: "Voir le résultat" })
    : allPicksComplete
    ? i18n.t("tp.home.modifyTeams", { defaultValue: "Modifier mes équipes" })
    : i18n.t("common.participate", { defaultValue: "Participer" });

  const statusLower = String(bundle?.status || "open").toLowerCase();
  const showSecondaryCta = statusLower !== "open";
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

      {games.map((slot) => (
        <BundleMatchRow
          key={String(slot.gameId)}
          slot={slot}
          league={league}
          pick={picks[String(slot.gameId)]}
          colors={colors}
        />
      ))}

      <Text style={{ color: colors.subtext, marginTop: 10, fontSize: 13 }}>
        {i18n.t("tp.home.signupDeadline", {
          defaultValue: "Heure limite d'inscription",
        })}
        {": "}
        {locked ? (
          <Text style={{ color: colors.text, fontWeight: "900" }}>
            {i18n.t("tp.home.signupClosed", { defaultValue: "Fermé" })}
          </Text>
        ) : (
          <Text style={{ color: colors.text, fontWeight: "900" }}>
            {deadlineHM || "—"}
          </Text>
        )}
      </Text>

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
