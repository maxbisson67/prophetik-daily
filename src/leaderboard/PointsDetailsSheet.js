import React, { useMemo, useState } from "react";
import { Modal, View, Text, TouchableOpacity, ScrollView, Dimensions, Platform } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import LineChart from "@src/ui/charts/LineChart";

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Transforme un map { key: number } en rows triées.
 * - week keys: ex "20252026-W14" -> tri par semaine (et saison)
 * - month keys: ex "2025-12" -> tri lexicographique OK
 */
function mapToSortedRows(mapObj, { kind = "week", limit = 12 } = {}) {
  const m = mapObj && typeof mapObj === "object" ? mapObj : {};
  const rows = Object.entries(m)
    .map(([k, v]) => ({ key: String(k), value: num(v) }))
    .filter((r) => r.key && Number.isFinite(r.value));

  if (kind === "week") {
    rows.sort((a, b) => {
      const aKey = String(a.key);
      const bKey = String(b.key);

      const aSeason = aKey.split("-W")[0] || "";
      const bSeason = bKey.split("-W")[0] || "";
      if (aSeason !== bSeason) return aSeason.localeCompare(bSeason);

      const aw = Number(aKey.split("-W")[1] || 0);
      const bw = Number(bKey.split("-W")[1] || 0);
      return aw - bw;
    });
  } else {
    rows.sort((a, b) => a.key.localeCompare(b.key));
  }

  if (rows.length > limit) return rows.slice(rows.length - limit);
  return rows;
}

function toCumulativeSeriesFromMap(mapObj, { kind = "week", limit = 32 } = {}) {
  const rows = mapToSortedRows(mapObj, { kind, limit });
  let acc = 0;

  return rows.map((r) => {
    acc += num(r.value);

    let xLabel = r.key;
    if (kind === "week") {
      const wk = String(r.key).split("-W")[1] || r.key;
      xLabel = `W${wk}`;
    }

    return { xLabel, value: acc };
  });
}

function Segmented({ value, onChange, items, colors, style }) {
  return (
    <View
      style={[
        {
          flexDirection: "row",
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 999,
          overflow: "hidden",
          backgroundColor: colors.card,
          alignSelf: "flex-start",
        },
        style,
      ]}
    >
      {items.map((it) => {
        const active = value === it.value;
        return (
          <TouchableOpacity
            key={it.value}
            onPress={() => onChange(it.value)}
            activeOpacity={0.85}
            style={{
              paddingVertical: 8,
              paddingHorizontal: 12,
              backgroundColor: active ? colors.primary : "transparent",
            }}
          >
            <Text style={{ color: active ? "#fff" : colors.subtext, fontWeight: "900", fontSize: 12 }}>
              {it.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function PeriodBarChart({ rows, colors, unitLabel = "" }) {
  const safe = Array.isArray(rows) ? rows : [];
  if (!safe.length) {
    return (
      <View style={{ paddingVertical: 12 }}>
        <Text style={{ color: colors.subtext }}>Pas assez de données pour afficher ce graphique.</Text>
      </View>
    );
  }

  const maxV = Math.max(...safe.map((r) => num(r.value)), 1);

  const displayKey = (k) => {
    const s = String(k);
    if (s.includes("-W")) {
      const wk = s.split("-W")[1] || s;
      return `W${wk}`;
    }
    return s;
  };

  return (
    <View style={{ marginTop: 10, gap: 10 }}>
      {safe.map((r) => {
        const pct = Math.round((num(r.value) / maxV) * 100);
        return (
          <View key={r.key} style={{ gap: 6 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={{ color: colors.text, fontWeight: "800" }}>{displayKey(r.key)}</Text>
              <Text style={{ color: colors.subtext, fontSize: 12, fontWeight: "800" }}>
                {Math.round(num(r.value))}
                {unitLabel}
              </Text>
            </View>

            <View style={{ height: 12, borderRadius: 999, backgroundColor: colors.border, overflow: "hidden" }}>
              <View
                style={{
                  width: `${pct}%`,
                  height: 12,
                  backgroundColor: colors.primary,
                  opacity: 0.9,
                }}
              />
            </View>
          </View>
        );
      })}
    </View>
  );
}

const { height: SCREEN_H } = Dimensions.get("window");
const SHEET_H = Math.round(SCREEN_H * 0.72);

function sumRows(rows) {
  const safe = Array.isArray(rows) ? rows : [];
  return safe.reduce((acc, r) => acc + num(r?.value), 0);
}

export default function PointsDetailsSheet({
  visible,
  onClose,
  colors,
  pointsTotal = 0,
  pointsByWeek,
  pointsByMonth,
}) {
  const [mode, setMode] = useState("week"); // week | month

  

  const lineData = useMemo(() => {
    if (mode === "week") return toCumulativeSeriesFromMap(pointsByWeek, { kind: "week", limit: 32 });
    return toCumulativeSeriesFromMap(pointsByMonth, { kind: "month", limit: 12 });
  }, [mode, pointsByWeek, pointsByMonth]);

const periodRows = useMemo(() => {
  const rows =
    mode === "week"
      ? mapToSortedRows(pointsByWeek, { kind: "week", limit: 12 })
      : mapToSortedRows(pointsByMonth, { kind: "month", limit: 8 });

  // ✅ plus récents en premier
  return rows.slice().reverse(); // slice() évite de muter l’array original
}, [mode, pointsByWeek, pointsByMonth]);

const periodTotal = useMemo(() => sumRows(periodRows), [periodRows]);

const title = mode === "week" ? "Points (12 dernières semaines)" : "Points (8 derniers mois)";
const subtitle = "Période affichée";

  return (
    <Modal visible={!!visible} transparent animationType="slide" onRequestClose={onClose}>
      {/* overlay */}
      <TouchableOpacity activeOpacity={1} onPress={onClose} style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)" }} />

      {/* sheet */}
      <View
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          height: SHEET_H,
          backgroundColor: colors.background,
          borderTopLeftRadius: 18,
          borderTopRightRadius: 18,
          borderWidth: 1,
          borderColor: colors.border,
          overflow: "hidden",
        }}
      >
        {/* handle */}
        <View style={{ alignItems: "center", paddingTop: 10 }}>
          <View style={{ width: 44, height: 5, borderRadius: 999, backgroundColor: colors.border, opacity: 0.9 }} />
        </View>

        {/* header */}
        <View style={{ paddingHorizontal: 16, paddingTop: 10, paddingBottom: 12 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
<View style={{ flex: 1, paddingRight: 10 }}>
  <Text style={{ color: colors.subtext, fontWeight: "900", fontSize: 12 }} numberOfLines={1}>
    {title}
  </Text>

  <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 10, marginTop: 6 }}>
    <Text style={{ color: colors.text, fontWeight: "900", fontSize: 28, lineHeight: 30 }}>
      {Math.round(periodTotal)}
    </Text>

    <Text style={{ color: colors.subtext, fontWeight: "900", fontSize: 12, marginBottom: 3 }}>
      PTS
    </Text>
  </View>

  <Text style={{ color: colors.subtext, marginTop: 4, fontSize: 12 }} numberOfLines={1}>
    {subtitle}
  </Text>
</View>

            <TouchableOpacity
              onPress={onClose}
              style={{
                padding: 8,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.card,
              }}
              hitSlop={{ top: 10, left: 10, right: 10, bottom: 10 }}
            >
              <MaterialCommunityIcons name="close" size={18} color={colors.text} />
            </TouchableOpacity>
          </View>

          <Segmented
            value={mode}
            onChange={setMode}
            items={[
              { value: "week", label: "Semaines" },
              { value: "month", label: "Mois" },
            ]}
            colors={colors}
            style={{ marginTop: 12 }}
          />
        </View>

        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 18 }}>
          {/* Cumul */}
          <Text style={{ color: colors.text, fontWeight: "900", marginTop: 6 }}>
            Courbe cumulée (points)
          </Text>
          <Text style={{ color: colors.subtext, fontSize: 12, marginTop: 6 }}>
            {mode === "week" ? "Par semaine (Wxx)" : "Par mois (YYYY-MM)"}
          </Text>

          <View
            style={{
              marginTop: 10,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.card2 ?? colors.card,
              borderRadius: 16,
              padding: 10,
              alignItems: "center",
            }}
          >
            {lineData.length ? (
              <LineChart
                data={lineData}
                width={340}
                height={140}
                stroke={colors.primary}
                padding={16}
              />
            ) : (
              <Text style={{ color: colors.subtext, paddingVertical: 18 }}>
                Pas assez de données pour afficher la courbe.
              </Text>
            )}
          </View>

          {/* Points par période */}
          <Text style={{ color: colors.text, fontWeight: "900", marginTop: 16 }}>
            Points par {mode === "week" ? "semaine" : "mois"}
          </Text>

          <View
            style={{
              marginTop: 10,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.card2 ?? colors.card,
              borderRadius: 16,
              padding: 12,
            }}
          >
            <PeriodBarChart rows={periodRows} colors={colors} unitLabel="" />
          </View>

          <View style={{ height: 14 }} />
        </ScrollView>
      </View>
    </Modal>
  );
}