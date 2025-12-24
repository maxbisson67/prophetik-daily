import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  ActivityIndicator,
  Alert,
  Platform,
  Vibration,
  Animated,
  Easing,
} from "react-native";
import { Accelerometer, Gyroscope } from "expo-sensors";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTheme } from "@src/theme/ThemeProvider";
import i18n from "@src/i18n/i18n";
import { app } from "@src/lib/firebase";

/* -------------------- CONFIG -------------------- */
const UPDATE_MS = 80;
const ACC_THRESHOLD = 2.2;
const GYRO_THRESHOLD = 3.0;
const COOLDOWN_MS = 2500;

// ✅ Plus long
const ORBIT_DURATION = 1800;

// ✅ Vibration plus “longue” (pattern)
const VIBE_PATTERN_IOS = [0, 25, 40, 25, 40, 25];
const VIBE_PATTERN_ANDROID = [0, 35, 50, 35, 50, 35];

/* -------------------- API -------------------- */
async function callDailyShotBonus(payload) {
  if (Platform.OS === "web") {
    const { getFunctions, httpsCallable } = await import("firebase/functions");
    const f = getFunctions(app, "us-central1");
    const fn = httpsCallable(f, "dailyShotBonus");
    const res = await fn(payload);
    return res?.data;
  } else {
    const functions = (await import("@react-native-firebase/functions")).default;
    const fn = functions().httpsCallable("dailyShotBonus");
    const res = await fn(payload);
    return res?.data;
  }
}

/* -------------------- UTILS -------------------- */
function mag3({ x = 0, y = 0, z = 0 }) {
  return Math.sqrt(x * x + y * y + z * z);
}

function hapticShot() {
  // Pattern = plus long + plus “premium”
  const pattern = Platform.OS === "ios" ? VIBE_PATTERN_IOS : VIBE_PATTERN_ANDROID;

  // Sur certains Android, le pattern peut être ignoré; fallback en durée.
  try {
    Vibration.vibrate(pattern);
  } catch {
    Vibration.vibrate(Platform.OS === "ios" ? 60 : 90);
  }
}

/* -------------------- COMPONENT -------------------- */
export default function DailyShotCard({ monthlyCap = 10, variant = "card", onGranted }) {
  const { colors } = useTheme();

  const [listening, setListening] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showFx, setShowFx] = useState(false);

  const [acc, setAcc] = useState({ x: 0, y: 0, z: 0 });
  const [gyro, setGyro] = useState({ x: 0, y: 0, z: 0 });

  const [progress, setProgress] = useState({
    creditsGranted: 0,
    monthlyCap,
    status: "idle",
  });

  const lastTriggerAtRef = useRef(0);

  // ✅ Animation orbit + petite opacité pour fade-out
  const orbitAnim = useRef(new Animated.Value(0)).current;
  const fxOpacity = useRef(new Animated.Value(0)).current;

  const accMag = useMemo(() => mag3(acc), [acc]);
  const gyroMag = useMemo(() => mag3(gyro), [gyro]);

  /* ---------- START sensors ---------- */
  useEffect(() => {
    let subA, subG;
    try {
      Accelerometer.setUpdateInterval(UPDATE_MS);
      Gyroscope.setUpdateInterval(UPDATE_MS);

      subA = Accelerometer.addListener((d) => setAcc(d || {}));
      subG = Gyroscope.addListener((d) => setGyro(d || {}));
      setListening(true);
    } catch {
      setListening(false);
    }
    return () => {
      subA?.remove?.();
      subG?.remove?.();
    };
  }, []);

  /* ---------- FX animation ---------- */
  function playFx() {
    setShowFx(true);

    orbitAnim.setValue(0);
    fxOpacity.setValue(0);

    // ✅ On “fade in”, puis rotation, puis “fade out”
    Animated.sequence([
      Animated.timing(fxOpacity, {
        toValue: 1,
        duration: 120,
        useNativeDriver: true,
      }),
      Animated.timing(orbitAnim, {
        toValue: 1,
        duration: ORBIT_DURATION,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(fxOpacity, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start(() => setShowFx(false));
  }

  /* ---------- Detect shot ---------- */
  useEffect(() => {
    if (!listening || busy) return;

    const now = Date.now();
    if (now - lastTriggerAtRef.current < COOLDOWN_MS) return;

    const hit = accMag > ACC_THRESHOLD && gyroMag > GYRO_THRESHOLD;
    if (!hit) return;

    lastTriggerAtRef.current = now;

    hapticShot();
    playFx();
    attemptGrant();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accMag, gyroMag, listening, busy]);

  useEffect(() => {
  let alive = true;

  (async () => {
    try {
      const data = await callDailyShotBonus({ monthlyCap, mode: "status" });
      if (!alive) return;

      setProgress((p) => ({
        ...p,
        creditsGranted: Number(data?.creditsGranted ?? 0),
        monthlyCap: Number(data?.monthlyCap ?? monthlyCap),
        status: data?.status || "idle",
      }));
    } catch (e) {
      console.log("[DailyShot] status load failed", e?.message || e);
    }
  })();

  return () => { alive = false; };
}, [monthlyCap]);

  /* ---------- Grant ---------- */
  async function attemptGrant() {
    try {
      setBusy(true);
      const data = await callDailyShotBonus({ monthlyCap });

      setProgress({
        creditsGranted: data?.creditsGranted ?? progress.creditsGranted,
        monthlyCap: data?.monthlyCap ?? monthlyCap,
        status: "ok",
      });

      onGranted?.(data);

      Alert.alert(
        i18n.t("credits.wallet.bonusSuccessTitle", "🎉 Bonus credited"),
        i18n.t("credits.wallet.bonusSuccessBody", {
          defaultValue: "You just received +{{amount}} credits.",
          amount: Number(data?.amount || 1),
        })
      );
    } catch (e) {
      const msg = e?.message || "";
      if (msg === "ALREADY_TAKEN_TODAY") {
        setProgress((p) => ({ ...p, status: "already_today" }));
        return;
      }
      if (msg === "MONTHLY_CAP_REACHED") {
        setProgress((p) => ({ ...p, status: "cap_reached" }));
        return;
      }
      Alert.alert(i18n.t("common.unknownError", "Unknown error"), msg);
    } finally {
      setBusy(false);
    }
  }

  /* ---------- UI ---------- */
  const granted = progress.creditsGranted;
  const cap = progress.monthlyCap;
  const pct = cap > 0 ? Math.min(100, Math.round((granted / cap) * 100)) : 0;

  const spin = orbitAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "540deg"], // ✅ un peu plus “wow” (1.5 tours)
  });

  return (
    <View
      style={{
        position: "relative",
        padding: variant === "compact" ? 12 : 14,
        borderWidth: 1,
        borderRadius: 12,
        backgroundColor: colors.card,
        borderColor: colors.border,
        overflow: "hidden",
      }}
    >
      {/* FX ORBIT */}
      {showFx && (
        <Animated.View
          pointerEvents="none"
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            width: 120,
            height: 120,
            marginLeft: -60,
            marginTop: -60,
            transform: [{ rotate: spin }],
            opacity: fxOpacity, // ✅ fade-in/out
          }}
        >
          {[
            { icon: "hockey-puck", x: 0, y: -48 },
            { icon: "baseball", x: 48, y: 0 },
            { icon: "basketball", x: 0, y: 48 },
            { icon: "football", x: -48, y: 0 },
          ].map((s, i) => (
            <View
              key={i}
              style={{
                position: "absolute",
                left: 60 + s.x - 14,
                top: 60 + s.y - 14,
              }}
            >
              <MaterialCommunityIcons name={s.icon} size={28} color={colors.primary} />
            </View>
          ))}
        </Animated.View>
      )}

      {/* HEADER */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <MaterialCommunityIcons name="gesture-swipe" size={22} color={colors.text} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontWeight: "900", color: colors.text }}>
            {i18n.t("home.dailyShotTitle", "Daily shot bonus")}
          </Text>
          <Text style={{ color: colors.subtext, fontSize: 12 }}>
            {i18n.t("home.dailyShotMonthlyCap", { current: granted, max: cap })}
          </Text>
        </View>
        {busy && <ActivityIndicator />}
      </View>

      {/* PROGRESS */}
      <View
        style={{
          height: 8,
          borderRadius: 99,
          backgroundColor: "#e5e7eb",
          marginTop: 10,
          overflow: "hidden",
        }}
      >
        <View style={{ width: `${pct}%`, height: 8, backgroundColor: "#ef4444" }} />
      </View>

      <Text style={{ color: colors.subtext, fontSize: 12, marginTop: 8 }}>
        {progress.status === "already_today"
          ? i18n.t("home.dailyShotAlreadyTaken")
          : progress.status === "cap_reached"
          ? i18n.t("home.dailyShotCapReached")
          : listening
          ? i18n.t("home.dailyShotHint")
          : i18n.t("home.dailyShotLoading")}
      </Text>
    </View>
  );
}