import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import i18n from "@src/i18n/i18n";
import { getFgcLeague } from "@src/firstGoal/fgcChallengeUtils";
import { isCompleteTpPick } from "@src/defis/TpHomePredictionRow";
import LiveChallengeKindBadge from "@src/live/LiveChallengeKindBadge";
import TeamLogoBadge from "@src/sports/TeamLogoBadge";
import {
  formatLiveTpScoreLine,
  resolveLiveFgcBravoLabel,
  resolveLiveTpBravoLabel,
} from "@src/live/liveChallengeTagUtils";
import { PickBravoBadge } from "@src/defis/results/PickResultTags";
import { useTheme } from "@src/theme/ThemeProvider";
import {
  getActiveLiveChallengeKinds,
  getLiveRowHighlightStyle,
} from "@src/live/liveChallengeHighlight";

export { getActiveLiveChallengeKinds, getLiveRowHighlightStyle };

function hasUsableTpPick(pick) {
  if (!pick || typeof pick !== "object") return false;
  if (isCompleteTpPick(pick)) return true;
  return !!String(pick.winnerAbbr || "").trim();
}

function hasFgcPick(pick) {
  if (!pick || typeof pick !== "object") return false;
  return !!(String(pick.playerId || "").trim() || String(pick.fullName || "").trim());
}

function formatShortName(fullName = "") {
  const s = String(fullName || "").trim();
  if (!s) return "—";
  const parts = s.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0];
  return `${parts[0].slice(0, 1).toUpperCase()}. ${parts[parts.length - 1]}`;
}

function playerDisplayName(fullName, league) {
  const name = String(fullName || "").trim();
  if (!name) return "—";
  return league === "MLB" ? name : formatShortName(name);
}

function resolveTeamForLogo(abbr, league, teamForAbbr) {
  const key = String(abbr || "").trim().toUpperCase();
  if (!key) return null;
  if (typeof teamForAbbr === "function") {
    const team = teamForAbbr(key);
    if (team) return team;
  }
  return { sport: league, abbreviation: key };
}

function ChallengePickRow({
  colors,
  kind,
  sport,
  title,
  pickContent,
  bravoLabel,
  isDark,
  onPress,
}) {
  return (
    <View style={{ width: "100%" }}>
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={onPress ? 0.85 : 1}
        disabled={!onPress}
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          paddingVertical: 4,
          minWidth: 0,
        }}
      >
        <LiveChallengeKindBadge kind={kind} colors={colors} sport={sport} compact />
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <Text
            style={{ color: colors.text, fontSize: 12, fontWeight: "800" }}
            numberOfLines={1}
          >
            {title}
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, minWidth: 0 }}>
            <Text style={{ color: colors.subtext, fontSize: 11, fontWeight: "700", flexShrink: 0 }}>
              {i18n.t("live.challenge.myPick", { defaultValue: "Mon choix" })}:
            </Text>
            <View style={{ flex: 1, minWidth: 0 }}>{pickContent}</View>
          </View>
        </View>
      </TouchableOpacity>
      {bravoLabel ? (
        <View style={{ marginTop: 4, marginLeft: 66, alignItems: "flex-start" }}>
          <PickBravoBadge label={bravoLabel} isDark={isDark} />
        </View>
      ) : null}
    </View>
  );
}

function FgcPickContent({ colors, league, pick, teamForAbbr }) {
  const teamAbbr = String(pick?.teamAbbr || "").trim();
  const team = resolveTeamForLogo(teamAbbr, league, teamForAbbr);

  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flex: 1, minWidth: 0 }}>
      {team ? <TeamLogoBadge team={team} size={18} colors={colors} /> : null}
      <Text
        style={{ color: colors.text, fontSize: 12, fontWeight: "700", flexShrink: 1 }}
        numberOfLines={1}
      >
        {playerDisplayName(pick?.fullName, league)}
      </Text>
    </View>
  );
}

function TsPickContent({ colors, league, players, teamForAbbr }) {
  return (
    <View style={{ flex: 1, gap: 4, minWidth: 0 }}>
      {players.map((player, index) => {
        const teamAbbr = String(player?.teamAbbr || "").trim();
        const team = resolveTeamForLogo(teamAbbr, league, teamForAbbr);

        return (
          <View
            key={String(player?.playerId || index)}
            style={{ flexDirection: "row", alignItems: "center", gap: 6, minWidth: 0 }}
          >
            {team ? <TeamLogoBadge team={team} size={16} colors={colors} /> : null}
            <Text
              style={{ color: colors.text, fontSize: 12, fontWeight: "700", flexShrink: 1 }}
              numberOfLines={1}
            >
              {playerDisplayName(player?.fullName, league)}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

function resolveFgcTitle(league) {
  return league === "MLB"
    ? i18n.t("live.challenge.fgcTitleMlb", { defaultValue: "Premier point produit" })
    : i18n.t("live.challenge.fgcTitleNhl", { defaultValue: "Premier but" });
}

export default function LiveGameChallengeTags({
  colors,
  sport = "NHL",
  fgcItem = null,
  fgcMyPick = null,
  tpSlot = null,
  tpMyPick = null,
  tpPickResult = null,
  teamForAbbr = null,
  tsPlayers = [],
  mutualizedGame = null,
  onPressFgc,
  onPressTp,
  onPressTs,
}) {
  const { isDark } = useTheme();
  const league = String(sport || "NHL").toUpperCase();
  const tsList = Array.isArray(tsPlayers) ? tsPlayers.filter((p) => p?.playerId) : [];
  const rows = [];

  if (fgcItem && hasFgcPick(fgcMyPick)) {
    const fgcLeague = getFgcLeague(fgcItem?.raw || {}, sport);
    const bravoLabel = resolveLiveFgcBravoLabel({
      challenge: fgcItem?.raw || {},
      pick: fgcMyPick,
      mutualizedGame,
    });

    rows.push(
      <ChallengePickRow
        key="fgc"
        colors={colors}
        kind="fgc"
        sport={sport}
        title={resolveFgcTitle(fgcLeague)}
        pickContent={
          <FgcPickContent
            colors={colors}
            league={fgcLeague}
            pick={fgcMyPick}
            teamForAbbr={teamForAbbr}
          />
        }
        bravoLabel={bravoLabel}
        isDark={isDark}
        onPress={() => onPressFgc?.(fgcItem)}
      />
    );
  }

  if (tpSlot?.item && hasUsableTpPick(tpMyPick)) {
    const scoreLine = formatLiveTpScoreLine({
      pick: tpMyPick,
      slot: tpSlot?.slot,
      league,
      teamForAbbr,
    });
    const bravoLabel = resolveLiveTpBravoLabel({
      pick: tpMyPick,
      tpSlot,
      pickResult: tpPickResult,
    });

    rows.push(
      <ChallengePickRow
        key="tp"
        colors={colors}
        kind="tp"
        sport={sport}
        title={i18n.t("live.challenge.tpTitle", { defaultValue: "Prédire le match" })}
        pickContent={
          <Text
            style={{ color: colors.text, fontSize: 12, fontWeight: "700", flexShrink: 1 }}
            numberOfLines={2}
          >
            {scoreLine || "—"}
          </Text>
        }
        bravoLabel={bravoLabel}
        isDark={isDark}
        onPress={() => onPressTp?.(tpSlot.item)}
      />
    );
  }

  if (tsList.length) {
    rows.push(
      <ChallengePickRow
        key="ts"
        colors={colors}
        kind="ts"
        sport={sport}
        title={i18n.t("live.challenge.tsTitle", { defaultValue: "Trio du jour" })}
        pickContent={
          <TsPickContent colors={colors} league={league} players={tsList} teamForAbbr={teamForAbbr} />
        }
        isDark={isDark}
        onPress={onPressTs}
      />
    );
  }

  if (!rows.length) return null;

  return (
    <View
      style={{
        marginBottom: 10,
        paddingBottom: 10,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        gap: 8,
        width: "100%",
      }}
    >
      {rows}
    </View>
  );
}
