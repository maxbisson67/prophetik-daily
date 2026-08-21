import React, { useMemo } from "react";
import { View, Text, ScrollView } from "react-native";
import i18n from "@src/i18n/i18n";

const INNING_COL_W = 28;
const TOTAL_COL_W = 30;
const TEAM_COL_W = 40;

function formatCell(value) {
  if (value == null) return "—";
  return String(value);
}

function resolveLinescore(game = {}) {
  const rows = Array.isArray(game?.inningLinescore) ? game.inningLinescore : [];
  if (!rows.length) return null;

  const totals = game?.inningLinescoreTotals || {};
  const awayTotals = totals.away || {};
  const homeTotals = totals.home || {};

  return {
    rows,
    awayTotals: {
      runs: awayTotals.runs ?? game.awayScore ?? null,
      hits: awayTotals.hits ?? null,
      errors: awayTotals.errors ?? null,
    },
    homeTotals: {
      runs: homeTotals.runs ?? game.homeScore ?? null,
      hits: homeTotals.hits ?? null,
      errors: homeTotals.errors ?? null,
    },
  };
}

function cellTextStyle({ highlight, light, colors }) {
  if (highlight) {
    return { color: light ? "#fecaca" : "#dc2626", fontWeight: "900" };
  }
  return {
    color: light ? "#e2e8f0" : colors.text,
    fontWeight: "700",
  };
}

function ScoreCell({ value, highlight, light, colors, width = INNING_COL_W }) {
  return (
    <View style={{ width, alignItems: "center", justifyContent: "center" }}>
      <Text
        style={{
          fontSize: 13,
          fontVariant: ["tabular-nums"],
          ...cellTextStyle({ highlight, light, colors }),
        }}
      >
        {formatCell(value)}
      </Text>
    </View>
  );
}

export default function MlbLinescoreTable({ game, colors, light = false, style }) {
  const data = useMemo(() => resolveLinescore(game), [game]);

  if (!data?.rows?.length) return null;

  const { rows, awayTotals, homeTotals } = data;
  const headerColor = light ? "rgba(255,255,255,0.55)" : colors.subtext;
  const borderColor = light ? "rgba(255,255,255,0.12)" : colors.border;
  const bg = light ? "rgba(255,255,255,0.06)" : colors.card2 || colors.card;
  const teamColor = light ? "#f8fafc" : colors.text;

  const totalHeaders = [
    i18n.t("live.mlb.linescoreRuns", { defaultValue: "P" }),
    i18n.t("live.mlb.linescoreHits", { defaultValue: "H" }),
    i18n.t("live.mlb.linescoreErrors", { defaultValue: "E" }),
  ];

  const currentInning = Number(game?.currentInning);
  const half = String(game?.inningHalf || "").toLowerCase();
  const isLive = !!game?.isLive;

  const isHighlighted = (side, inningNum) =>
    isLive &&
    Number.isFinite(currentInning) &&
    currentInning === Number(inningNum) &&
    ((side === "away" && half === "top") || (side === "home" && half === "bottom"));

  return (
    <View
      style={[
        {
          borderRadius: 14,
          borderWidth: 1,
          borderColor,
          backgroundColor: bg,
          paddingVertical: 10,
          paddingHorizontal: 10,
          marginBottom: 14,
        },
        style,
      ]}
    >
      <Text
        style={{
          color: headerColor,
          fontWeight: "800",
          fontSize: 11,
          letterSpacing: 0.6,
          marginBottom: 8,
        }}
      >
        {i18n.t("live.mlb.linescoreTitle", { defaultValue: "TABLEAU INDICATEUR" }).toUpperCase()}
      </Text>

      <View style={{ flexDirection: "row" }}>
        <View style={{ width: TEAM_COL_W, paddingTop: 0 }}>
          <View style={{ height: 18 }} />
          <View style={{ height: 32, justifyContent: "center" }}>
            <Text style={{ color: teamColor, fontWeight: "900", fontSize: 13 }} numberOfLines={1}>
              {game?.awayAbbr || "—"}
            </Text>
          </View>
          <View style={{ height: 32, justifyContent: "center" }}>
            <Text style={{ color: teamColor, fontWeight: "900", fontSize: 13 }} numberOfLines={1}>
              {game?.homeAbbr || "—"}
            </Text>
          </View>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          nestedScrollEnabled
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingRight: 4 }}
        >
          <View>
            <View style={{ flexDirection: "row", height: 18, alignItems: "center" }}>
              {rows.map((row) => (
                <View key={`hdr-${row.n}`} style={{ width: INNING_COL_W, alignItems: "center" }}>
                  <Text
                    style={{
                      color: headerColor,
                      fontWeight: "800",
                      fontSize: 11,
                      fontVariant: ["tabular-nums"],
                    }}
                  >
                    {row.n}
                  </Text>
                </View>
              ))}
            </View>

            <View style={{ height: 1, backgroundColor: borderColor, marginVertical: 4 }} />

            <View style={{ flexDirection: "row", height: 32, alignItems: "center" }}>
              {rows.map((row) => (
                <ScoreCell
                  key={`away-${row.n}`}
                  value={row.away}
                  highlight={isHighlighted("away", row.n)}
                  light={light}
                  colors={colors}
                />
              ))}
            </View>

            <View style={{ flexDirection: "row", height: 32, alignItems: "center" }}>
              {rows.map((row) => (
                <ScoreCell
                  key={`home-${row.n}`}
                  value={row.home}
                  highlight={isHighlighted("home", row.n)}
                  light={light}
                  colors={colors}
                />
              ))}
            </View>
          </View>
        </ScrollView>

        <View style={{ paddingLeft: 4 }}>
          <View style={{ flexDirection: "row", height: 18, alignItems: "center" }}>
            {totalHeaders.map((label) => (
              <View key={label} style={{ width: TOTAL_COL_W, alignItems: "center" }}>
                <Text style={{ color: headerColor, fontWeight: "800", fontSize: 11 }}>{label}</Text>
              </View>
            ))}
          </View>

          <View style={{ height: 1, backgroundColor: borderColor, marginVertical: 4 }} />

          <View style={{ flexDirection: "row", height: 32, alignItems: "center" }}>
            <ScoreCell value={awayTotals.runs} light={light} colors={colors} width={TOTAL_COL_W} />
            <ScoreCell value={awayTotals.hits} light={light} colors={colors} width={TOTAL_COL_W} />
            <ScoreCell value={awayTotals.errors} light={light} colors={colors} width={TOTAL_COL_W} />
          </View>

          <View style={{ flexDirection: "row", height: 32, alignItems: "center" }}>
            <ScoreCell value={homeTotals.runs} light={light} colors={colors} width={TOTAL_COL_W} />
            <ScoreCell value={homeTotals.hits} light={light} colors={colors} width={TOTAL_COL_W} />
            <ScoreCell value={homeTotals.errors} light={light} colors={colors} width={TOTAL_COL_W} />
          </View>
        </View>
      </View>
    </View>
  );
}
