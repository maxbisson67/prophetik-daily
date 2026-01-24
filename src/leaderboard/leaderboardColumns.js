// src/leaderboard/leaderboardColumns.js
import React from "react";
import { Text } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import ProphetikIcons from "@src/ui/ProphetikIcons";
import WinRateIcon from "@src/ui/WinRateIcon";

export function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function pct0(v) {
  const x = Number(v);
  if (!Number.isFinite(x)) return "—";
  return `${Math.round(x * 100)}%`;
}

export function winRate(row) {
  const p = num(row?.participations ?? row?.plays);
  const w = num(row?.wins);
  return p > 0 ? w / p : 0;
}

export function nhlPPG(row) {
  const direct = Number(row?.nhlPPG);
  if (Number.isFinite(direct)) return direct;

  const pts = num(row?.nhlPointsTotal);
  const games = num(row?.nhlGamesTotal);
  return games > 0 ? pts / games : 0;
}

function fmtDec2(n) {
  const x = num(n);
  return x.toFixed(2);
}

function pointsPill(amount, { size = "sm", rounded = true } = {}) {
  const n = num(amount);
  const display = rounded ? Math.round(n) : n;
  return <ProphetikIcons mode="points" amount={display} size={size} />;
}

export function getColumnsForTier(tierLower, colors) {
  const t = String(tierLower || "free").toLowerCase();
  const headerIconColor = colors?.text; // ✅ visible en clair/sombre

  const colPointsTotal = {
    key: "pointsTotal",
    headerAlign: "center",
    cellAlign: "center",
    header: (
      <ProphetikIcons
        mode="points"
        size="sm"
        showIcon={true}
        iconOnly={true}
      />
    ),
    getValue: (r) => num(r?.pointsTotal),
    render: (r) => pointsPill(r?.pointsTotal, { size: "sm", rounded: true }),
  };

  const colWinRate = {
    key: "winRate",
    headerAlign: "center",
    cellAlign: "center",

    // ✅ IMPORTANT: forcer une couleur lisible (à adapter selon ton composant)
    header: <WinRateIcon size={18} color={headerIconColor} />,

    getValue: (r) => winRate(r),
    render: (r) => (
      <Text style={{ fontWeight: "800", color: colors.text }}>
        {pct0(winRate(r))}
      </Text>
    ),
  };

  const colPPG = {
    key: "nhlPPG",
    headerAlign: "center",
    cellAlign: "center",

    // ✅ On remet un header icône (au lieu de iconSet/icon)
    header: (
      <MaterialCommunityIcons
        name="chart-line"
        size={18}
        color={headerIconColor}
      />
    ),

    getValue: (r) => nhlPPG(r),
    render: (r) => (
      <Text style={{ fontWeight: "900", color: colors.text }}>
        {fmtDec2(nhlPPG(r))}
      </Text>
    ),
  };

  if (t === "vip") return [colPointsTotal, colWinRate, colPPG];
  if (t === "pro") return [colPointsTotal, colWinRate];
  return [colPointsTotal];
}