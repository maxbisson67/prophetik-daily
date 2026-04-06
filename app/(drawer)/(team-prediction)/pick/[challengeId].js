import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  TextInput,
  Alert,
  StyleSheet,
  Image,
} from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import firestore from "@react-native-firebase/firestore";
import functions from "@react-native-firebase/functions";
import { Ionicons } from "@expo/vector-icons";
import { SvgUri } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import i18n from "@src/i18n/i18n";
import { useTheme } from "@src/theme/ThemeProvider";
import { useAuth } from "@src/auth/SafeAuthProvider";

const RED = "#b91c1c";

function OutcomeChip({
  label,
  value,
  selectedValue,
  onPress,
  colors,
  disabled = false,
}) {
  const selected = value === selectedValue;

  return (
    <TouchableOpacity
      onPress={() => {
        if (!disabled) onPress(value);
      }}
      activeOpacity={disabled ? 1 : 0.9}
      style={{
        flex: 1,
        minHeight: 42,
        borderRadius: 12,
        borderWidth: 1.5,
        borderColor: disabled
          ? colors.border
          : selected
          ? RED
          : colors.border,
        backgroundColor: disabled
          ? colors.card2
          : selected
          ? "rgba(239,68,68,0.10)"
          : colors.card,
        alignItems: "center",
        justifyContent: "center",
        opacity: disabled ? 0.45 : 1,
      }}
    >
      <Text
        style={{
          color: disabled ? colors.subtext : selected ? RED : colors.text,
          fontWeight: "900",
        }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function InfoRow({ label, value, colors }) {
  return (
    <View style={{ gap: 3 }}>
      <Text style={{ color: colors.subtext, fontSize: 12, fontWeight: "800" }}>
        {label}
      </Text>
      <Text style={{ color: colors.text, fontWeight: "900" }}>{value}</Text>
    </View>
  );
}

function isSvg(uri) {
  return String(uri || "").toLowerCase().includes(".svg");
}

function buildNhlLogoUri(abbr, variant = "dark") {
  const code = String(abbr || "").trim().toUpperCase();
  if (!code) return null;
  return `https://assets.nhle.com/logos/nhl/svg/${code}_${variant}.svg`;
}

function TeamLogo({ uri, abbr, size = 34 }) {
  const resolvedUri =
    uri || buildNhlLogoUri(abbr, "dark") || buildNhlLogoUri(abbr, "light");

  if (!resolvedUri) {
    return (
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: "rgba(255,255,255,0.08)",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Ionicons name="shield-outline" size={size * 0.62} color="#9ca3af" />
      </View>
    );
  }

  if (isSvg(resolvedUri)) {
    return (
      <View style={{ width: size, height: size }}>
        <SvgUri uri={resolvedUri} width="100%" height="100%" />
      </View>
    );
  }

  return (
    <Image
      source={{ uri: resolvedUri }}
      style={{ width: size, height: size }}
      resizeMode="contain"
    />
  );
}

function formatDateTime(value) {
  if (!value) return "—";

  const d =
    value?.toDate?.() ? value.toDate() :
    value instanceof Date ? value :
    new Date(value);

  if (!d || Number.isNaN(d.getTime?.())) return "—";

  return d.toLocaleString("fr-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function normalizeScoreInput(v) {
  return String(v || "").replace(/[^\d]/g, "").slice(0, 2);
}

function computeDeadline(startValue) {
  if (!startValue) return null;

  const d =
    startValue?.toDate?.() ? startValue.toDate() :
    startValue instanceof Date ? startValue :
    new Date(startValue);

  if (!d || Number.isNaN(d.getTime?.())) return null;

  return new Date(d.getTime() - 5 * 60 * 1000);
}

function formatCountdown(ms) {
  if (!Number.isFinite(ms) || ms <= 0) return "00:00";
  const totalSec = Math.floor(ms / 1000);
  const hh = String(Math.floor(totalSec / 3600)).padStart(2, "0");
  const mm = String(Math.floor((totalSec % 3600) / 60)).padStart(2, "0");
  const ss = String(totalSec % 60).padStart(2, "0");
  return hh !== "00" ? `${hh}:${mm}:${ss}` : `${mm}:${ss}`;
}

function getDerivedWinnerAbbr({ awayAbbr, homeAbbr, awayScore, homeScore }) {
  if (awayScore === "" || homeScore === "") return null;

  const a = Number(awayScore);
  const h = Number(homeScore);

  if (!Number.isFinite(a) || !Number.isFinite(h)) return null;
  if (a === h) return null;

  return a > h ? awayAbbr : homeAbbr;
}

export default function TeamPredictionPickScreen() {
  const { challengeId } = useLocalSearchParams();
  const router = useRouter();
  const { colors } = useTheme();
  const { user, authReady } = useAuth();
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [challenge, setChallenge] = useState(null);
  const [entry, setEntry] = useState(null);

  const [predictedAwayScore, setPredictedAwayScore] = useState("");
  const [predictedHomeScore, setPredictedHomeScore] = useState("");
  const [predictedOutcome, setPredictedOutcome] = useState("REG");

  const [nowTick, setNowTick] = useState(Date.now());

  useEffect(() => {
    const t = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!authReady || !user?.uid || !challengeId) return;

    let cancelled = false;

    const challengeRef = firestore().doc(
      `team_prediction_challenges/${challengeId}`
    );

    const entryRef = firestore().doc(
    `team_prediction_challenges/${challengeId}/entries/${user.uid}`
    );

const unsubChallenge = challengeRef.onSnapshot(
  (snap) => {
    const data = snap?.exists ? snap.data() || null : null;
    if (cancelled) return;

    setChallenge(data);
    setLoading(false);
  },
  (err) => {
    console.log("[TP pick] challenge error", err?.message || err);
    if (!cancelled) setLoading(false);
  }
);

const unsubEntry = entryRef.onSnapshot(
  (snap) => {
    if (cancelled) return;

    const entryData = snap?.exists ? snap.data() || null : null;
    setEntry(entryData);

    if (entryData) {
      setPredictedAwayScore(
        entryData.predictedAwayScore !== undefined &&
        entryData.predictedAwayScore !== null
          ? String(entryData.predictedAwayScore)
          : ""
      );

      setPredictedHomeScore(
        entryData.predictedHomeScore !== undefined &&
        entryData.predictedHomeScore !== null
          ? String(entryData.predictedHomeScore)
          : ""
      );

      setPredictedOutcome(entryData.predictedOutcome || "REG");
    } else {
      setPredictedAwayScore("");
      setPredictedHomeScore("");
      setPredictedOutcome("REG");
    }
  },
  (err) => {
    console.log("[TP pick] entry error", err?.message || err);
    if (cancelled) return;
    setEntry(null);
  }
);

    return () => {
      cancelled = true;
      try { unsubChallenge?.(); } catch {}
    };
  }, [authReady, user?.uid, challengeId]);

  const awayAbbr = challenge?.awayAbbr || null;
  const homeAbbr = challenge?.homeAbbr || null;

  const awayLogo =
    challenge?.awayDarkLogo ||
    challenge?.awayLogo ||
    challenge?.away?.darkLogo ||
    challenge?.away?.logo ||
    buildNhlLogoUri(awayAbbr, "dark");

  const homeLogo =
    challenge?.homeDarkLogo ||
    challenge?.homeLogo ||
    challenge?.home?.darkLogo ||
    challenge?.home?.logo ||
    buildNhlLogoUri(homeAbbr, "dark");

  const startTimeUTC =
    challenge?.gameStartTimeUTC || challenge?.startTimeUTC || null;

  const deadline = useMemo(() => computeDeadline(startTimeUTC), [startTimeUTC]);

  const derivedWinnerAbbr = useMemo(() => {
    return getDerivedWinnerAbbr({
      awayAbbr,
      homeAbbr,
      awayScore: predictedAwayScore,
      homeScore: predictedHomeScore,
    });
  }, [awayAbbr, homeAbbr, predictedAwayScore, predictedHomeScore]);

  const scoreDiff = useMemo(() => {
    if (predictedAwayScore === "" || predictedHomeScore === "") return null;
    const a = Number(predictedAwayScore);
    const h = Number(predictedHomeScore);
    if (!Number.isFinite(a) || !Number.isFinite(h)) return null;
    return Math.abs(a - h);
  }, [predictedAwayScore, predictedHomeScore]);

  const otTbDisabled = scoreDiff !== null && scoreDiff > 1;

  useEffect(() => {
    if (otTbDisabled && (predictedOutcome === "OT" || predictedOutcome === "TB")) {
      setPredictedOutcome("REG");
    }
  }, [otTbDisabled, predictedOutcome]);

  const isLocked = useMemo(() => {
    const status = String(challenge?.status || "").toLowerCase();
    if (["locked", "live", "closed", "completed", "decided"].includes(status)) {
      return true;
    }
    if (!deadline) return false;
    return nowTick >= deadline.getTime();
  }, [challenge?.status, deadline, nowTick]);

  const countdownText = useMemo(() => {
    if (!deadline) return "—";
    return formatCountdown(deadline.getTime() - nowTick);
  }, [deadline, nowTick]);

  const potValue = useMemo(() => {
    const participantsCount = Number(challenge?.participantsCount ?? 0);
    const stakePoints = Number(challenge?.stakePoints ?? 2);
    const carry = Number(challenge?.jackpotCarryIn ?? 0);
    return participantsCount * stakePoints + carry;
  }, [challenge?.participantsCount, challenge?.stakePoints, challenge?.jackpotCarryIn]);

  const canSubmit = useMemo(() => {
    if (isLocked || saving) return false;
    if (predictedAwayScore === "" || predictedHomeScore === "") return false;
    if (!predictedOutcome) return false;
    if (!derivedWinnerAbbr) return false;
    return true;
  }, [
    isLocked,
    saving,
    predictedAwayScore,
    predictedHomeScore,
    predictedOutcome,
    derivedWinnerAbbr,
  ]);

  async function handleSave() {
    if (!user?.uid || !challengeId) return;
    if (!canSubmit) return;

    try {
      setSaving(true);

      const fn = functions().httpsCallable("submitTeamPredictionEntry");

      await fn({
        challengeId: String(challengeId),
        predictedAwayScore: Number(predictedAwayScore),
        predictedHomeScore: Number(predictedHomeScore),
        predictedOutcome,
      });

      Alert.alert(
        i18n.t("tp.pick.savedTitle", { defaultValue: "Prédiction enregistrée" }),
        i18n.t("tp.pick.savedBody", {
          defaultValue: "Ta prédiction a bien été sauvegardée.",
        })
      );
    } catch (e) {
      console.log("[TP pick] save error", e?.code, e?.message || e);

      Alert.alert(
        i18n.t("common.error", { defaultValue: "Erreur" }),
        String(e?.message || e)
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={{ flex: 1, backgroundColor: colors.background }}>
        {!authReady || loading ? (
          <View style={styles.center}>
            <ActivityIndicator />
            <Text style={{ marginTop: 8, color: colors.subtext }}>
              {i18n.t("common.loading", { defaultValue: "Chargement…" })}
            </Text>
          </View>
        ) : !challenge ? (
          <View style={styles.center}>
            <Text style={{ color: colors.text }}>
              {i18n.t("tp.pick.notFound", {
                defaultValue: "Défi TP introuvable.",
              })}
            </Text>
          </View>
        ) : (
          <View style={{ flex: 1 }}>
            <View
              style={{
                paddingTop: Math.max(insets.top, 12),
                paddingHorizontal: 14,
                paddingBottom: 10,
                backgroundColor: colors.background,
              }}
            >
              <View
                style={{
                  width: "100%",
                  maxWidth: 680,
                  alignSelf: "center",
                  flexDirection: "row",
                  alignItems: "center",
                }}
              >
                <Text
                  style={{
                    flex: 1,
                    color: colors.text,
                    fontSize: 20,
                    fontWeight: "900",
                  }}
                >
                  {i18n.t("tp.pick.screenTitle", { defaultValue: "Défi TP" })}
                </Text>

                <TouchableOpacity
                  onPress={() => router.back()}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 21,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: colors.card,
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}
                >
                  <Ionicons name="close" size={22} color={colors.text} />
                </TouchableOpacity>
              </View>
            </View>

            <ScrollView
              contentContainerStyle={{
                paddingHorizontal: 14,
                paddingBottom: Math.max(insets.bottom, 20) + 12,
              }}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.container}>
                {/* Header compact */}
                <View
                  style={[
                    styles.card,
                    {
                      borderColor: colors.border,
                      backgroundColor: colors.card,
                    },
                  ]}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                    <Text style={{ fontSize: 22 }}>🏆</Text>

                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.text, fontSize: 16, fontWeight: "900" }}>
                        {i18n.t("tp.pick.title", { defaultValue: "Prédire le résultat" })}
                      </Text>
                      <Text style={{ color: colors.subtext, marginTop: 2 }}>
                        {awayAbbr} @ {homeAbbr}
                      </Text>
                    </View>

                    <View
                      style={{
                        paddingVertical: 6,
                        paddingHorizontal: 10,
                        borderRadius: 999,
                        backgroundColor: isLocked ? colors.card2 : "rgba(239,68,68,0.12)",
                        borderWidth: 1,
                        borderColor: isLocked ? colors.border : "rgba(239,68,68,0.28)",
                      }}
                    >
                      <Text
                        style={{
                          color: isLocked ? colors.subtext : RED,
                          fontWeight: "900",
                          fontSize: 12,
                        }}
                      >
                        {isLocked
                          ? i18n.t("tp.pick.locked", { defaultValue: "Verrouillé" })
                          : i18n.t("tp.pick.open", { defaultValue: "Ouvert" })}
                      </Text>
                    </View>
                  </View>

                  <View style={{ gap: 8, marginTop: 12 }}>
                    <InfoRow
                      label={i18n.t("tp.pick.startLabel", { defaultValue: "Début du match" })}
                      value={formatDateTime(startTimeUTC)}
                      colors={colors}
                    />
                    <InfoRow
                      label={i18n.t("tp.pick.deadlineLabel", { defaultValue: "Verrouille dans" })}
                      value={
                        isLocked
                          ? i18n.t("tp.pick.locked", { defaultValue: "Verrouillé" })
                          : countdownText
                      }
                      colors={colors}
                    />
                    <InfoRow
                      label={i18n.t("tp.pick.potLabel", { defaultValue: "Cagnotte" })}
                      value={String(potValue)}
                      colors={colors}
                    />
                  </View>
                </View>

                {/* Score exact */}
                <View
                  style={[
                    styles.card,
                    {
                      borderColor: colors.border,
                      backgroundColor: colors.card,
                    },
                  ]}
                >
                  <Text style={{ color: colors.text, fontWeight: "900", fontSize: 16 }}>
                    {i18n.t("tp.pick.scoreTitle", { defaultValue: "Score exact" })}
                  </Text>

                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 12,
                      marginTop: 12,
                    }}
                  >
                    <View style={{ flex: 1, alignItems: "center", gap: 8 }}>
                      <TeamLogo uri={awayLogo} abbr={awayAbbr} size={40} />
                      <Text style={{ color: colors.text, fontWeight: "900" }}>
                        {awayAbbr}
                      </Text>
                      <TextInput
                        value={predictedAwayScore}
                        onChangeText={(txt) => setPredictedAwayScore(normalizeScoreInput(txt))}
                        editable={!isLocked}
                        keyboardType="number-pad"
                        maxLength={2}
                        style={[
                          styles.scoreInput,
                          {
                            color: colors.text,
                            borderColor: colors.border,
                            backgroundColor: colors.card2,
                          },
                        ]}
                        placeholder="0"
                        placeholderTextColor={colors.subtext}
                      />
                    </View>

                    <Text style={{ color: colors.subtext, fontWeight: "900", fontSize: 20 }}>
                      -
                    </Text>

                    <View style={{ flex: 1, alignItems: "center", gap: 8 }}>
                      <TeamLogo uri={homeLogo} abbr={homeAbbr} size={40} />
                      <Text style={{ color: colors.text, fontWeight: "900" }}>
                        {homeAbbr}
                      </Text>
                      <TextInput
                        value={predictedHomeScore}
                        onChangeText={(txt) => setPredictedHomeScore(normalizeScoreInput(txt))}
                        editable={!isLocked}
                        keyboardType="number-pad"
                        maxLength={2}
                        style={[
                          styles.scoreInput,
                          {
                            color: colors.text,
                            borderColor: colors.border,
                            backgroundColor: colors.card2,
                          },
                        ]}
                        placeholder="0"
                        placeholderTextColor={colors.subtext}
                      />
                    </View>
                  </View>

                  <Text style={{ color: colors.subtext, fontSize: 12, marginTop: 10 }}>
                    {i18n.t("tp.pick.scoreHint", {
                      defaultValue: "L’équipe gagnante sera déduite automatiquement du score saisi.",
                    })}
                  </Text>

                  {predictedAwayScore !== "" &&
                  predictedHomeScore !== "" &&
                  !derivedWinnerAbbr ? (
                    <Text style={{ color: RED, fontWeight: "800", marginTop: 8 }}>
                      {i18n.t("tp.pick.tieNotAllowed", {
                        defaultValue: "Le score ne peut pas être égal.",
                      })}
                    </Text>
                  ) : null}
                </View>

                {/* Outcome */}
                <View
                  style={[
                    styles.card,
                    {
                      borderColor: colors.border,
                      backgroundColor: colors.card,
                    },
                  ]}
                >
                  <Text style={{ color: colors.text, fontWeight: "900", fontSize: 16 }}>
                    {i18n.t("tp.pick.outcomeTitle", { defaultValue: "Type de victoire" })}
                  </Text>

                  <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
                    <OutcomeChip
                      label="REG"
                      value="REG"
                      selectedValue={predictedOutcome}
                      onPress={setPredictedOutcome}
                      colors={colors}
                      disabled={isLocked}
                    />
                    <OutcomeChip
                      label="OT"
                      value="OT"
                      selectedValue={predictedOutcome}
                      onPress={setPredictedOutcome}
                      colors={colors}
                      disabled={isLocked || otTbDisabled}
                    />
                    <OutcomeChip
                      label="TB"
                      value="TB"
                      selectedValue={predictedOutcome}
                      onPress={setPredictedOutcome}
                      colors={colors}
                      disabled={isLocked || otTbDisabled}
                    />
                  </View>

                  <Text style={{ color: colors.subtext, fontSize: 12, marginTop: 10 }}>
                    {i18n.t("tp.pick.outcomeHint", {
                      defaultValue: "REG = temps régulier, OT = prolongation, TB = tirs de barrage.",
                    })}
                  </Text>

                  {otTbDisabled ? (
                    <Text style={{ color: RED, fontWeight: "800", fontSize: 12, marginTop: 8 }}>
                      {i18n.t("tp.pick.otDisabledHint", {
                        defaultValue: "OT et TB sont disponibles seulement si l’écart est de 1 but.",
                      })}
                    </Text>
                  ) : null}
                </View>

                {/* Summary compact */}
                <View
                  style={[
                    styles.card,
                    {
                      borderColor: colors.border,
                      backgroundColor: colors.card,
                    },
                  ]}
                >
                  <Text style={{ color: colors.text, fontWeight: "900", fontSize: 16 }}>
                    {i18n.t("tp.pick.summaryTitle", { defaultValue: "Résumé" })}
                  </Text>

                  <View style={{ gap: 7, marginTop: 10 }}>
                    <Text style={{ color: colors.text }}>
                      {i18n.t("tp.pick.summaryWinner", { defaultValue: "Gagnant" })}:{" "}
                      <Text style={{ fontWeight: "900" }}>{derivedWinnerAbbr || "—"}</Text>
                    </Text>

                    <Text style={{ color: colors.text }}>
                      {i18n.t("tp.pick.summaryScore", { defaultValue: "Score" })}:{" "}
                      <Text style={{ fontWeight: "900" }}>
                        {predictedAwayScore === "" ? "—" : predictedAwayScore} -{" "}
                        {predictedHomeScore === "" ? "—" : predictedHomeScore}
                      </Text>
                    </Text>

                    <Text style={{ color: colors.text }}>
                      {i18n.t("tp.pick.summaryOutcome", { defaultValue: "Fin de match" })}:{" "}
                      <Text style={{ fontWeight: "900" }}>{predictedOutcome || "—"}</Text>
                    </Text>
                  </View>

                  <Text style={{ color: colors.subtext, marginTop: 10 }}>
                    {i18n.t("tp.pick.summaryHint", {
                      defaultValue: "Les gagnants exacts se partagent la cagnotte.",
                    })}
                  </Text>
                </View>

                {/* CTA */}
                <TouchableOpacity
                  onPress={handleSave}
                  disabled={!canSubmit}
                  style={{
                    backgroundColor: canSubmit ? RED : colors.subtext,
                    borderRadius: 14,
                    paddingVertical: 15,
                    alignItems: "center",
                    justifyContent: "center",
                    marginTop: 4,
                  }}
                >
                  {saving ? (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <ActivityIndicator color="#fff" size="small" />
                      <Text style={{ color: "#fff", fontWeight: "900" }}>
                        {i18n.t("tp.pick.saving", { defaultValue: "Enregistrement…" })}
                      </Text>
                    </View>
                  ) : (
                    <Text style={{ color: "#fff", fontWeight: "900", fontSize: 15 }}>
                      {entry
                        ? i18n.t("tp.pick.updateCta", { defaultValue: "Mettre à jour ma prédiction" })
                        : i18n.t("tp.pick.submitCta", { defaultValue: "Confirmer ma prédiction" })}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        )}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  container: {
    width: "100%",
    maxWidth: 680,
    alignSelf: "center",
    gap: 10,
  },
  card: {
    padding: 13,
    borderRadius: 16,
    borderWidth: 1,
  },
  scoreInput: {
    width: 72,
    height: 50,
    borderRadius: 14,
    borderWidth: 1.5,
    textAlign: "center",
    fontSize: 22,
    fontWeight: "900",
  },
});