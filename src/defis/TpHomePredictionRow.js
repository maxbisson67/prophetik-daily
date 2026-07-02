import React from "react";
import { View, Text } from "react-native";
import i18n from "@src/i18n/i18n";
import TeamLogoBadge from "@src/sports/TeamLogoBadge";
import { lookupTeamByAbbr } from "@src/groups/data/fallbackTeams";
import { fmtTimeShort } from "@src/defis/tpDeadlineHelpers";

export const TP_HOME_SCORE_COL_WIDTH = 60;
export const TP_HOME_LOGO_SIZE = 24;
const TP_HOME_SCORE_BOX_HEIGHT = 32;

function safeAbbr(v) {
  return String(v || "").trim().toUpperCase();
}

export function isCompleteTpPick(pick) {
  if (!pick || typeof pick !== "object") return false;
  const away = pick.predictedAwayScore;
  const home = pick.predictedHomeScore;
  return away != null && home != null && away !== "" && home !== "";
}

function formatPickScore(value) {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? String(n) : String(value);
}

function ScoreFrame({ value, colors, empty = false }) {
  return (
    <View
      style={{
        width: TP_HOME_SCORE_COL_WIDTH,
        minHeight: TP_HOME_SCORE_BOX_HEIGHT,
        borderRadius: 8,
        borderWidth: 1.5,
        borderColor: colors.border,
        backgroundColor: colors.card2,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text
        style={{
          color: empty ? colors.subtext : colors.text,
          fontWeight: "900",
          fontSize: 15,
          fontVariant: ["tabular-nums"],
        }}
      >
        {value ?? "—"}
      </Text>
    </View>
  );
}

function TeamPickColumn({ team, score, colors }) {
  const displayScore = formatPickScore(score);

  return (
    <View style={{ width: TP_HOME_SCORE_COL_WIDTH, alignItems: "center" }}>
      <TeamLogoBadge team={team} size={TP_HOME_LOGO_SIZE} colors={colors} />
      <View style={{ height: 4 }} />
      <ScoreFrame value={displayScore} colors={colors} empty={!displayScore} />
    </View>
  );
}

function TpHomeScoreGridRow({ pick, awayAbbr, homeAbbr, league, lockDeadline, colors, style }) {
  const away = safeAbbr(awayAbbr);
  const home = safeAbbr(homeAbbr);
  const awayTeam = lookupTeamByAbbr(league, away);
  const homeTeam = lookupTeamByAbbr(league, home);
  const complete = isCompleteTpPick(pick);
  const lockTime = fmtTimeShort(lockDeadline);

  return (
    <View style={[{ alignItems: "center" }, style]}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "flex-end",
          justifyContent: "center",
        }}
      >
        <TeamPickColumn
          team={awayTeam}
          score={complete ? pick?.predictedAwayScore : null}
          colors={colors}
        />
        <Text
          style={{
            width: 24,
            textAlign: "center",
            paddingBottom: (TP_HOME_SCORE_BOX_HEIGHT - 13) / 2,
            color: colors.subtext,
            fontWeight: "900",
            fontSize: 13,
          }}
        >
          @
        </Text>
        <TeamPickColumn
          team={homeTeam}
          score={complete ? pick?.predictedHomeScore : null}
          colors={colors}
        />
      </View>

      {!complete ? (
        <Text
          style={{
            marginTop: 4,
            color: colors.subtext,
            fontSize: 10,
            fontWeight: "700",
            textAlign: "center",
          }}
        >
          {lockTime
            ? i18n.t("tp.home.predictionTodoBefore", {
                defaultValue: "À faire avant {{time}}",
                time: lockTime,
              })
            : i18n.t("tp.home.predictionTodo", { defaultValue: "À faire" })}
        </Text>
      ) : null}
    </View>
  );
}

function resolveWinnerPick(pick, awayAbbr, homeAbbr) {
  const away = Number(pick.predictedAwayScore);
  const home = Number(pick.predictedHomeScore);
  let winnerAbbr = safeAbbr(pick?.winnerAbbr);

  if (Number.isFinite(away) && Number.isFinite(home)) {
    if (away > home) winnerAbbr = awayAbbr;
    else if (home > away) winnerAbbr = homeAbbr;
  }

  if (!winnerAbbr) return null;

  const winnerScore = winnerAbbr === awayAbbr ? away : home;
  const loserScore = winnerAbbr === awayAbbr ? home : away;

  return { winnerAbbr, winnerScore, loserScore };
}

export default function TpHomePredictionRow({
  pick,
  awayAbbr,
  homeAbbr,
  league = "NHL",
  lockDeadline = null,
  colors,
  style = null,
  variant = "inline",
}) {
  if (variant === "scoreGrid") {
    return (
      <TpHomeScoreGridRow
        pick={pick}
        awayAbbr={awayAbbr}
        homeAbbr={homeAbbr}
        league={league}
        lockDeadline={lockDeadline}
        colors={colors}
        style={style}
      />
    );
  }

  const away = safeAbbr(awayAbbr);
  const home = safeAbbr(homeAbbr);
  const resolved = isCompleteTpPick(pick) ? resolveWinnerPick(pick, away, home) : null;

  const labelStyle = { color: colors.subtext, fontSize: 12 };
  const valueStyle = { color: colors.text, fontWeight: "900", fontSize: 12 };

  if (!resolved) {
    const lockTime = fmtTimeShort(lockDeadline);

    return (
      <View
        style={[
          {
            marginTop: 6,
            flexDirection: "row",
            flexWrap: "wrap",
            alignItems: "center",
          },
          style,
        ]}
      >
        <Text style={labelStyle}>
          {i18n.t("tp.home.myPrediction", { defaultValue: "Ma prédiction" })}
          {": "}
          <Text style={valueStyle}>
            {lockTime
              ? i18n.t("tp.home.predictionTodoBefore", {
                  defaultValue: "À faire avant {{time}}",
                  time: lockTime,
                })
              : i18n.t("tp.home.predictionTodo", { defaultValue: "À faire" })}
          </Text>
        </Text>
      </View>
    );
  }

  const { winnerAbbr, winnerScore, loserScore } = resolved;
  const winnerTeam = lookupTeamByAbbr(league, winnerAbbr);

  return (
    <View
      style={[
        {
          marginTop: 6,
          flexDirection: "row",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 4,
        },
        style,
      ]}
    >
      <Text style={labelStyle}>
        {i18n.t("tp.home.myPrediction", { defaultValue: "Ma prédiction" })}:
      </Text>
      <Text style={{ color: colors.text, fontWeight: "800", fontSize: 12 }}>
        {i18n.t("tp.home.predictionWinBy", { defaultValue: "Victoire de" })}
      </Text>
      <TeamLogoBadge team={winnerTeam} size={16} colors={colors} />
      <Text style={valueStyle}>
        {winnerScore}-{loserScore}
      </Text>
    </View>
  );
}
