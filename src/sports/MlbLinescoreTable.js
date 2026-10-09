import React, { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, ScrollView } from "react-native";
import i18n from "@src/i18n/i18n";

const MIN_INNING_COL_W = 28;
const TOTAL_COL_W = 32;
const TEAM_COL_W = 44;
const VISIBLE_INNING_COLS = 5;
const HEADER_H = 18;
const ROW_H = 32;
const DIVIDER_V = 4;

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

function LinescoreDivider({ borderColor }) {
  return (
    <View
      style={{
        height: 1,
        backgroundColor: borderColor,
        marginVertical: DIVIDER_V,
      }}
    />
  );
}

function ScoreCell({ value, highlight, light, colors, width }) {
  return (
    <View style={{ width, height: ROW_H, alignItems: "center", justifyContent: "center" }}>
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

function TeamLabel({ abbr, teamColor }) {
  return (
    <View style={{ height: ROW_H, justifyContent: "center" }}>
      <Text style={{ color: teamColor, fontWeight: "900", fontSize: 13 }} numberOfLines={1}>
        {abbr || "—"}
      </Text>
    </View>
  );
}

export default function MlbLinescoreTable({ game, colors, light = false, style }) {
  const data = useMemo(() => resolveLinescore(game), [game]);
  const rows = data?.rows || [];
  const awayTotals = data?.awayTotals || {};
  const homeTotals = data?.homeTotals || {};

  const [inningViewportW, setInningViewportW] = useState(0);

  const currentInning = Number(game?.currentInning);
  const half = String(game?.inningHalf || "").toLowerCase();
  const isLive = !!game?.isLive;
  const scrollRef = useRef(null);
  const scrollKey = `${rows.length}:${game?.inningLinescoreSig || ""}:${currentInning}:${half}`;

  const slotsInView = Math.min(rows.length, VISIBLE_INNING_COLS);
  const inningColW =
    inningViewportW > 0
      ? Math.max(MIN_INNING_COL_W, Math.floor(inningViewportW / Math.max(slotsInView, 1)))
      : MIN_INNING_COL_W;

  useEffect(() => {
    const node = scrollRef.current;
    if (!node || rows.length <= VISIBLE_INNING_COLS) return undefined;

    const frame = requestAnimationFrame(() => {
      node.scrollToEnd({ animated: false });
    });

    return () => cancelAnimationFrame(frame);
  }, [scrollKey, rows.length]);

  if (!rows.length) return null;

  const headerColor = light ? "rgba(255,255,255,0.55)" : colors.subtext;
  const borderColor = light ? "rgba(255,255,255,0.12)" : colors.border;
  const bg = light ? "rgba(255,255,255,0.06)" : colors.card2 || colors.card;
  const teamColor = light ? "#f8fafc" : colors.text;

  const totalHeaders = [
    i18n.t("live.mlb.linescoreRuns", { defaultValue: "P" }),
    i18n.t("live.mlb.linescoreHits", { defaultValue: "H" }),
    i18n.t("live.mlb.linescoreErrors", { defaultValue: "E" }),
  ];

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

      <View style={{ flexDirection: "row", alignItems: "stretch" }}>
        <View style={{ width: TEAM_COL_W, marginRight: 4 }}>
          <View style={{ height: HEADER_H }} />
          <LinescoreDivider borderColor={borderColor} />
          <TeamLabel abbr={game?.awayAbbr} teamColor={teamColor} />
          <TeamLabel abbr={game?.homeAbbr} teamColor={teamColor} />
        </View>

        <View
          style={{ flex: 1, minWidth: 0 }}
          onLayout={(e) => {
            const w = Math.floor(e.nativeEvent.layout.width);
            if (w > 0 && w !== inningViewportW) setInningViewportW(w);
          }}
        >
          <ScrollView
            ref={scrollRef}
            horizontal
            showsHorizontalScrollIndicator={rows.length > VISIBLE_INNING_COLS}
            nestedScrollEnabled
            style={{ flexGrow: 0 }}
            contentContainerStyle={{ paddingRight: 2 }}
          >
            <View>
              <View style={{ flexDirection: "row", height: HEADER_H, alignItems: "center" }}>
                {rows.map((row) => (
                  <View key={`hdr-${row.n}`} style={{ width: inningColW, alignItems: "center" }}>
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

              <LinescoreDivider borderColor={borderColor} />

              <View style={{ flexDirection: "row" }}>
                {rows.map((row) => (
                  <ScoreCell
                    key={`away-${row.n}`}
                    value={row.away}
                    highlight={isHighlighted("away", row.n)}
                    light={light}
                    colors={colors}
                    width={inningColW}
                  />
                ))}
              </View>

              <View style={{ flexDirection: "row" }}>
                {rows.map((row) => (
                  <ScoreCell
                    key={`home-${row.n}`}
                    value={row.home}
                    highlight={isHighlighted("home", row.n)}
                    light={light}
                    colors={colors}
                    width={inningColW}
                  />
                ))}
              </View>
            </View>
          </ScrollView>
        </View>

        <View style={{ paddingLeft: 6, flexShrink: 0 }}>
          <View style={{ flexDirection: "row", height: HEADER_H, alignItems: "center" }}>
            {totalHeaders.map((label) => (
              <View key={label} style={{ width: TOTAL_COL_W, alignItems: "center" }}>
                <Text style={{ color: headerColor, fontWeight: "800", fontSize: 11 }}>{label}</Text>
              </View>
            ))}
          </View>

          <LinescoreDivider borderColor={borderColor} />

          <View style={{ flexDirection: "row" }}>
            <ScoreCell value={awayTotals.runs} light={light} colors={colors} width={TOTAL_COL_W} />
            <ScoreCell value={awayTotals.hits} light={light} colors={colors} width={TOTAL_COL_W} />
            <ScoreCell value={awayTotals.errors} light={light} colors={colors} width={TOTAL_COL_W} />
          </View>

          <View style={{ flexDirection: "row" }}>
            <ScoreCell value={homeTotals.runs} light={light} colors={colors} width={TOTAL_COL_W} />
            <ScoreCell value={homeTotals.hits} light={light} colors={colors} width={TOTAL_COL_W} />
            <ScoreCell value={homeTotals.errors} light={light} colors={colors} width={TOTAL_COL_W} />
          </View>
        </View>
      </View>
    </View>
  );
}
