// app/defis/[defiId]/components/TeamMetaBadge.js
import React from "react";
import { View, Text } from "react-native";
import { useTheme } from "@src/theme/ThemeProvider";
import i18n from "@src/i18n/i18n";
import {
  formatTeamGoalsAgainstPerGame,
  resolveTeamGoalsAgainstPerGame,
} from "@src/nhl/nhlTeamGoalsAgainstDisplay";

function isFrench() {
  return String(i18n.locale || "").toLowerCase().startsWith("fr");
}

function ordinalFr(n) {
  const x = Number(n);
  if (!Number.isFinite(x) || x <= 0) return "—";
  return x === 1 ? "1er" : `${x}e`;
}

function ordinalEn(n) {
  const x = Number(n);
  if (!Number.isFinite(x) || x <= 0) return "—";
  const j = x % 10;
  const k = x % 100;
  if (j === 1 && k !== 11) return `${x}st`;
  if (j === 2 && k !== 12) return `${x}nd`;
  if (j === 3 && k !== 13) return `${x}rd`;
  return `${x}th`;
}

function fmtRank(n) {
  return isFrench() ? ordinalFr(n) : ordinalEn(n);
}

function numOrNull(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export { resolveTeamGoalsAgainstPerGame } from "@src/nhl/nhlTeamGoalsAgainstDisplay";

export default function TeamMetaBadge({
  rankOverall,
  goalsAgainstPerGame = null,
  gaPerGame = null,
  teamOrMatchup = null,
  standingsTeamAbbr = null,
  getStandingsRecord = null,
  compact = true, // conservé pour compat
}) {
  const { colors } = useTheme();

  const rank = numOrNull(rankOverall);
  const standingsRecord =
    typeof getStandingsRecord === "function" && standingsTeamAbbr
      ? getStandingsRecord(standingsTeamAbbr)
      : null;

  const gaPg =
    resolveTeamGoalsAgainstPerGame({
      goalsAgainstPerGame,
      gaPerGame,
      ...(teamOrMatchup || {}),
    }) ?? resolveTeamGoalsAgainstPerGame(standingsRecord);

  const labelRank = i18n.t("defi.matchup.rankShort", { defaultValue: "Rank" });
  const labelBc = i18n.t("defi.matchup.goalsAgainstShort", { defaultValue: "GA" });

  return (
    <View style={{ flexDirection: "row", alignItems: "center" }}>
      <Text
        style={{
          color: colors.subtext,
          fontSize: 12,
          fontWeight: "900",
          flexShrink: 1,
        }}
        numberOfLines={1}
      >
        {labelRank}: {rank == null ? "—" : fmtRank(rank)}, {labelBc}:{" "}
        {gaPg == null ? "—" : formatTeamGoalsAgainstPerGame(gaPg)}
      </Text>
    </View>
  );
}
