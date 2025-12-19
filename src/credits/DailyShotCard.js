import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  ActivityIndicator,
  Alert,
  Platform,
  Vibration
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
  if (Platform.OS === "ios") {
    Vibration.vibrate(20);
  } else {
    Vibration.vibrate(30);
  }
}
/* -------------------- COMPONENT -------------------- */
export default function DailyShotCard({
  monthlyCap = 10,
  variant = "card",
  onGranted,
}) {
  const { colors } = useTheme();

  const [listening, setListening] = useState(false);
  const [busy, setBusy] = useState(false);

  const [acc, setAcc] = useState({ x: 0, y: 0, z: 0 });
  const [gyro, setGyro] = useState({ x: 0, y: 0, z: 0 });

  const [progress, setProgress] = useState({
    creditsGranted: 0,
    monthlyCap,
    periodKey: null,
    nextAvailableDay: null,
    status: "idle", // idle | already_today | cap_reached | ok
  });

  const lastTriggerAtRef = useRef(0);

  const accMag = useMemo(() => mag3(acc), [acc]);
  const gyroMag = useMemo(() => mag3(gyro), [gyro]);

  /* ---------- START sensors on mount ---------- */
  useEffect(() => {
    let subA = null;
    let subG = null;

    async function start() {
      try {
        Accelerometer.setUpdateInterval(UPDATE_MS);
        Gyroscope.setUpdateInterval(UPDATE_MS);

        subA = Accelerometer.addListener((d) => setAcc(d || {}));
        subG = Gyroscope.addListener((d) => setGyro(d || {}));

        setListening(true);
      } catch {
        setListening(false);
      }
    }

    function stop() {
      try { subA?.remove?.(); } catch {}
      try { subG?.remove?.(); } catch {}
      setListening(false);
    }

    start();
    return () => stop();
  }, []);

  /* ---------- Detect shot ---------- */
  useEffect(() => {
    if (!listening || busy) return;

    const now = Date.now();
    if (now - lastTriggerAtRef.current < COOLDOWN_MS) return;

    const hit = accMag > ACC_THRESHOLD && gyroMag > GYRO_THRESHOLD;
    if (!hit) return;

    lastTriggerAtRef.current = now;

    // 🔔 VIBRATION COURTE AU TRIGGER
    hapticShot();

    attemptGrant();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accMag, gyroMag, listening, busy]);

  /* ---------- Grant logic ---------- */
  async function attemptGrant() {
    try {
      setBusy(true);

      const data = await callDailyShotBonus({ monthlyCap });

      setProgress({
        creditsGranted: data?.creditsGranted ?? progress.creditsGranted,
        monthlyCap: data?.monthlyCap ?? monthlyCap,
        periodKey: data?.periodKey ?? null,
        nextAvailableDay: data?.nextAvailableDay ?? null,
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
      const code = e?.code || "";
      const msg = e?.message || "";
      const details = e?.details || {};

      if (code === "failed-precondition" && msg === "ALREADY_TAKEN_TODAY") {
        setProgress((p) => ({
          ...p,
          ...details,
          status: "already_today",
        }));
        return;
      }

      if (code === "failed-precondition" && msg === "MONTHLY_CAP_REACHED") {
        setProgress((p) => ({
          ...p,
          ...details,
          status: "cap_reached",
        }));
        return;
      }

      Alert.alert(i18n.t("common.unknownError", "Unknown error"), msg);
    } finally {
      setBusy(false);
    }
  }

  /* ---------- UI ---------- */
  const title = i18n.t("home.dailyShotTitle", "Daily shot bonus");

  const granted = Number(progress.creditsGranted || 0);
  const cap = Number(progress.monthlyCap || monthlyCap);
  const pct = cap > 0 ? Math.min(100, Math.round((granted / cap) * 100)) : 0;

  return (
    <View
      style={{
        padding: variant === "compact" ? 12 : 14,
        borderWidth: 1,
        borderRadius: 12,
        backgroundColor: colors.card,
        borderColor: colors.border,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <View
          style={{
            width: 38,
            height: 38,
            borderRadius: 10,
            backgroundColor: colors.card2,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <MaterialCommunityIcons
            name="hockey-sticks"
            size={20}
            color={colors.text}
          />
        </View>

        <View style={{ flex: 1 }}>
          <Text style={{ fontWeight: "900", color: colors.text }}>
            {title}
          </Text>
          <Text style={{ color: colors.subtext, fontSize: 12 }}>
            {granted}/{cap} • {i18n.t("home.dailyShotMonthlyCap", "Monthly limit")}
          </Text>
        </View>

        {busy && <ActivityIndicator />}
      </View>

      {/* Progress bar */}
      <View
        style={{
          height: 8,
          borderRadius: 99,
          backgroundColor: "#f3f4f6",
          marginTop: 10,
          overflow: "hidden",
        }}
      >
        <View
          style={{
            width: `${pct}%`,
            height: 8,
            borderRadius: 99,
            backgroundColor: "#ef4444",
          }}
        />
      </View>

      <Text style={{ color: colors.subtext, fontSize: 12, marginTop: 8 }}>
        {progress.status === "already_today"
          ? i18n.t(
              "home.dailyShotAlreadyTaken",
              "Already claimed today. Come back tomorrow."
            )
          : progress.status === "cap_reached"
          ? i18n.t(
              "home.dailyShotCapReached",
              "Monthly limit reached. Come back next month."
            )
          : listening
          ? i18n.t(
              "home.dailyShotHint",
              "Shake your phone like a shot to earn +1 credit."
            )
          : i18n.t("home.dailyShotLoading", "Sensors loading…")}
      </Text>
    </View>
  );
}