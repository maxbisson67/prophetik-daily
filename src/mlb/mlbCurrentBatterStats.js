import React from "react";
import { Text, View } from "react-native";
import i18n from "@src/i18n/i18n";
import { formatMlbOps, formatMlbRate } from "@src/defis/mlbTsScoring";

function safeNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function findBoxscorePlayerNode(teams = {}, batterId) {
  const id = String(batterId || "").trim();
  if (!id) return null;

  for (const side of ["away", "home"]) {
    const players = teams?.[side]?.players || {};
    const direct = players?.[`ID${id}`] || players?.[id];
    if (direct) return direct;
    for (const node of Object.values(players)) {
      if (String(node?.person?.id || "") === id) return node;
    }
  }

  return null;
}

function battingSideFromFeed(liveFeed = {}) {
  const half = String(liveFeed?.liveData?.linescore?.inningHalf || "").toLowerCase();
  if (half === "top") return "away";
  if (half === "bottom") return "home";
  return null;
}

function statsFromPlayerNode(node) {
  if (!node) return null;

  const gameBat = node?.stats?.batting || null;
  const seasonBat = node?.seasonStats?.batting || null;

  const season =
    seasonBat &&
    (seasonBat.avg != null ||
      seasonBat.homeRuns != null ||
      seasonBat.rbi != null ||
      seasonBat.ops != null)
      ? {
          avg: seasonBat.avg ?? null,
          hr: safeNum(seasonBat.homeRuns),
          rbi: safeNum(seasonBat.rbi),
          ops: seasonBat.ops ?? null,
        }
      : null;

  const game =
    gameBat &&
    (gameBat.atBats != null ||
      gameBat.hits != null ||
      gameBat.homeRuns != null ||
      gameBat.rbi != null)
      ? {
          hits: safeNum(gameBat.hits) ?? 0,
          atBats: safeNum(gameBat.atBats) ?? 0,
          hr: safeNum(gameBat.homeRuns) ?? 0,
          rbi: safeNum(gameBat.rbi) ?? 0,
        }
      : null;

  if (!season && !game) return null;
  return { season, game };
}

function pitchCountFromPlayerNode(node) {
  const pitching = node?.stats?.pitching;
  if (!pitching) return null;
  const count = Number(pitching.numberOfPitches ?? pitching.pitchesThrown);
  return Number.isFinite(count) && count >= 0 ? count : null;
}

/** Nombre de lancers du lanceur en cours (depuis le boxscore live). */
export function extractCurrentPitcherPitchCountFromFeed(liveFeed = {}, pitcherId) {
  const id = String(pitcherId || "").trim();
  if (!id) return null;

  const teams = liveFeed?.liveData?.boxscore?.teams || {};
  const node = findBoxscorePlayerNode(teams, id);
  return pitchCountFromPlayerNode(node);
}

export function currentPitcherPitchCountFromGame(game = {}) {
  const count = Number(game?.currentPitcherPitchCount);
  return Number.isFinite(count) && count >= 0 ? count : null;
}

/** Extrait AVG / HR / RBI / OPS (saison) + ligne match depuis le feed live MLB. */
export function extractCurrentBatterStatsFromFeed(liveFeed = {}, batterId) {
  const id = String(batterId || "").trim();
  if (!id) return null;

  const teams = liveFeed?.liveData?.boxscore?.teams || {};
  const side = battingSideFromFeed(liveFeed);
  let node = side ? findBoxscorePlayerNode({ [side]: teams?.[side] }, id) : null;
  if (!node) node = findBoxscorePlayerNode(teams, id);

  return statsFromPlayerNode(node);
}

export function currentBatterStatsFromGame(game = {}) {
  const stats = game?.currentBatterStats;
  if (!stats || typeof stats !== "object") return null;
  if (!stats.season && !stats.game) return null;
  return stats;
}

export function hasBatterStatsDisplay(stats) {
  return !!(stats?.season || stats?.game);
}

export function formatSeasonStatsLine(season = {}) {
  if (!season) return null;

  const parts = [];
  if (season.avg != null && season.avg !== "") parts.push(formatMlbRate(season.avg));
  if (season.hr != null) parts.push(`${season.hr} HR`);
  if (season.rbi != null) parts.push(`${season.rbi} RBI`);
  if (season.ops != null && season.ops !== "") parts.push(`${formatMlbOps(season.ops)} OPS`);

  return parts.length ? parts.join(" · ") : null;
}

export function formatGameStatsLine(game = {}) {
  if (!game) return null;

  const hits = game.hits ?? 0;
  const atBats = game.atBats ?? 0;
  const extras = [];
  if (game.hr > 0) extras.push(`${game.hr} HR`);
  if (game.rbi > 0) extras.push(`${game.rbi} RBI`);

  const line = extras.length ? `${hits}/${atBats} · ${extras.join(" · ")}` : `${hits}/${atBats}`;
  return i18n.t("live.mlb.batterGameStats", {
    defaultValue: "Dans le match : {{line}}",
    line,
  });
}

export function MlbCurrentBatterStatLines({ stats, colors, fontSize = 11, marginTop = 4 }) {
  if (!hasBatterStatsDisplay(stats)) return null;

  const seasonLine = formatSeasonStatsLine(stats?.season);
  const gameLine = formatGameStatsLine(stats?.game);

  return (
    <View style={{ marginTop }}>
      {seasonLine ? (
        <Text
          style={{ color: colors.subtext, fontSize, fontWeight: "600", fontVariant: ["tabular-nums"] }}
          numberOfLines={1}
        >
          {seasonLine}
        </Text>
      ) : null}
      {gameLine ? (
        <Text
          style={{
            color: colors.text,
            fontSize,
            fontWeight: "700",
            marginTop: seasonLine ? 2 : 0,
            fontVariant: ["tabular-nums"],
          }}
          numberOfLines={1}
        >
          {gameLine}
        </Text>
      ) : null}
    </View>
  );
}
