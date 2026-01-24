import React, { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, TouchableOpacity, Animated, Easing } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import ProphetikIcons from "@src/ui/ProphetikIcons";
import PointsDetailsSheet from "./PointsDetailsSheet";

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function clampInt(v, lo, hi) {
  const x = Math.floor(num(v));
  return Math.max(lo, Math.min(hi, x));
}

/**
 * Écusson premium (rouge/noir) avec points AU CENTRE en blanc.
 */
function RecordBadge({ title, points, colors, icon = "star-four-points" }) {
  const p = clampInt(points, 0, 99999);

  const red = "#e11d48";
  const deep = "#0b0f1a";
  const edge = "rgba(255,255,255,0.10)";

  return (
    <View
      style={{
        flex: 1,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: edge,
        overflow: "hidden",
        backgroundColor: deep,
        padding: 12,
        minHeight: 92,
      }}
    >
      <View
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: "rgba(225,29,72,0.35)",
        }}
      />

      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <MaterialCommunityIcons name={icon} size={16} color={red} />
        <Text numberOfLines={1} style={{ color: "rgba(255,255,255,0.82)", fontWeight: "900", fontSize: 12 }}>
          {title}
        </Text>
      </View>

{/* points + logo */}
<View
  style={{
    flex: 1,
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  }}
>
  {/* Colonne 1 : points */}
  <Text
    style={{
      color: "#fff",
      fontWeight: "900",
      fontSize: 28,
      lineHeight: 30,
      fontVariant: ["tabular-nums"],
      marginRight: 10,
      textShadowColor: "rgba(0,0,0,0.35)",
      textShadowOffset: { width: 0, height: 2 },
      textShadowRadius: 8,
    }}
  >
    {p}
  </Text>

  {/* Colonne 2 : logo P + PTS */}
  <View style={{ alignItems: "center" }}>
    <ProphetikIcons
    mode="points"
    size="xs"
    iconOnly
    showIcon
    forceTone="dark" // ✅ force le logo BLANC même en thème clair
    />    
    <Text
      style={{
        marginTop: 2,
        color: "rgba(255,255,255,0.70)",
        fontWeight: "900",
        fontSize: 11,
        letterSpacing: 0.6,
      }}
    >
      PTS
    </Text>
  </View>
</View>

    </View>
  );
}

/**
 * Carte Points – premium
 *
 * loop:
 * - si total=0 et loop=true => animation “loading” (boucle courte)
 * - si total>0 => on monte jusqu'au total et on STOP (pas de reset)
 */
export default function PointsCard({
  pointsTotal = 0,
  bestWeekPoints = 0,
  bestMonthPoints = 0,
  pointsByWeek = {},       
  pointsByMonth = {},
  colors,
  loop = true,
}) {
  const total = clampInt(pointsTotal, 0, 999999);

  const anim = useRef(new Animated.Value(0)).current;
  const [display, setDisplay] = useState(0);

  const pulse = useRef(new Animated.Value(0)).current;

  const [open, setOpen] = useState(false);

  const durationMs = useMemo(() => {
    if (total <= 100) return 1200;
    if (total <= 1000) return 1600;
    return 2000;
  }, [total]);

  useEffect(() => {
    const id = anim.addListener(({ value }) => setDisplay(Math.round(value)));
    return () => anim.removeListener(id);
  }, [anim]);

  const runPulse = () =>
    new Promise((resolve) => {
      pulse.setValue(0);
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 160, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 240, useNativeDriver: true }),
      ]).start(() => resolve());
    });

  const runCountTo = (toValue, ms) =>
    new Promise((resolve) => {
      Animated.timing(anim, {
        toValue,
        duration: ms,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start(() => resolve());
    });

  useEffect(() => {
    let cancelled = false;

    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

    async function run() {
      anim.stopAnimation();
      pulse.stopAnimation();

      // ✅ Point de départ : valeur affichée actuelle (évite les sauts)
      const startAt = clampInt(display, 0, 999999);
      anim.setValue(startAt);
      pulse.setValue(0);

      // ✅ MODE "loading" : total inconnu (0) et loop=true -> petite boucle courte
      if (loop && total === 0) {
        while (!cancelled) {
          // 0→99→0, juste pour donner vie (tu peux ajuster)
          anim.setValue(0);
          await runCountTo(99, 700);
          if (cancelled) return;
          await runPulse();
          if (cancelled) return;
          await sleep(500);
        }
        return;
      }

      // ✅ MODE normal: total connu -> une seule montée et STOP
      if (cancelled) return;

      // si on est déjà au bon chiffre, juste pulse et fini
      if (startAt >= total) {
        anim.setValue(total);
        await runPulse();
        return;
      }

      await runCountTo(total, durationMs);
      if (cancelled) return;
      await runPulse();

      // ✅ STOP ici (aucun reset, aucune boucle)
    }

    run();

    return () => {
      cancelled = true;
      anim.stopAnimation();
      pulse.stopAnimation();
    };
    // ⚠️ display volontairement exclu pour éviter relance à chaque tick
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [total, durationMs, loop, anim, pulse]);

  const scale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.035],
  });

  const primary = colors?.primary ?? "#3b82f6";
  const cardBg = colors?.card ?? "#111827";
  const border = colors?.border ?? "rgba(255,255,255,0.12)";
  const text = colors?.text ?? "#fff";
  const sub = colors?.subtext ?? "rgba(255,255,255,0.70)";
  const background = colors?.background ?? "#0b1220";

  return (
    <View
      style={{
        borderWidth: 1,
        borderColor: border,
        borderRadius: 18,
        backgroundColor: cardBg,
        padding: 14,
        shadowColor: "#000",
        shadowOpacity: 0.08,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 6 },
        elevation: 2,
      }}
    >
      {/* header */}
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>


          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            {/* Bloc “tableau” */}
            <View style={{ flexDirection: "row", alignItems: "center" }}>
                {/* Colonne 1 (2 lignes) : points animés */}
                <Animated.Text
                style={{
                    color: text,
                    fontWeight: "900",
                    fontSize: 34,
                    lineHeight: 36,
                    fontVariant: ["tabular-nums"],
                    transform: [{ scale }],
                }}
                >
                {display}
                </Animated.Text>

                {/* Colonne 2 (2 lignes) : P + PTS */}
                <View style={{ marginLeft: 10, alignItems: "center", justifyContent: "center" }}>
                {/* Ligne 1 : logo P */}
                <View style={{ marginBottom: 2 }}>
                    <ProphetikIcons
                        mode="points"
                        size="md"
                        iconOnly
                        showIcon
                        //forceTone="dark"
                        />
                </View>

                {/* Ligne 2 : PTS */}
                <Text style={{ color: sub, fontWeight: "900", fontSize: 11, marginTop: -2 }}>
                    PTS
                </Text>
                </View>
            </View>
            </View>
        </View>

        <TouchableOpacity onPress={() => setOpen(true)} hitSlop={{top:10,bottom:10,left:10,right:10}}>
        <MaterialCommunityIcons name="chevron-up" size={18} color={colors.text} />
        </TouchableOpacity>
      </View>

      {/* badges */}
      <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
        <RecordBadge title="Record semaine" points={bestWeekPoints} colors={colors} icon="calendar-week" />
        <RecordBadge title="Record mois" points={bestMonthPoints} colors={colors} icon="calendar-month" />
      </View>

      {/* footer hint */}
      <View style={{ marginTop: 10, flexDirection: "row", alignItems: "center", gap: 8, opacity: 0.9 }}>
        <MaterialCommunityIcons name="shield-star" size={14} color={primary} />
        <Text style={{ color: sub, fontSize: 12, fontWeight: "700" }}>
          Tes meilleurs records personnels (semaine / mois)
        </Text>
      </View>
        <PointsDetailsSheet
        visible={open}
        onClose={() => setOpen(false)}
        colors={colors}
        pointsTotal={pointsTotal}
        pointsByWeek={pointsByWeek}
        pointsByMonth={pointsByMonth}
        />
    </View>
    
  );
}