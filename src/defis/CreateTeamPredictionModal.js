// src/defis/CreateTeamPredictionModal.js
import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  Modal,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Image,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { SvgUri } from "react-native-svg";
import firestore from "@react-native-firebase/firestore";
import functions from "@react-native-firebase/functions";
import { useTheme } from "@src/theme/ThemeProvider";
import i18n from "@src/i18n/i18n";

/* ---------------- UI ---------------- */

function StepPill({ active, done, label, colors }) {
  const bg = active ? colors.primary : done ? colors.card2 : colors.card;
  const border = active ? colors.primary : colors.border;
  const textColor = active ? "#fff" : colors.text;

  return (
    <View
      style={{
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: border,
        backgroundColor: bg,
      }}
    >
      <Text style={{ color: textColor, fontWeight: "900", fontSize: 12 }}>
        {label}
      </Text>
    </View>
  );
}

function WizardHeader({ step, colors, onClose }) {
  return (
    <View style={{ gap: 10 }}>
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <Text
          style={{
            fontSize: 18,
            fontWeight: "900",
            color: colors.text,
            flex: 1,
          }}
        >
          TP — {i18n.t("tp.create.title", { defaultValue: "Défi équipe gagnante" })}
        </Text>

        <TouchableOpacity
          onPress={onClose}
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
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

      <View style={{ flexDirection: "row", gap: 8 }}>
        <StepPill active={step === 1} done={step > 1} colors={colors} label="1. Groupe" />
        <StepPill active={step === 2} done={step > 2} colors={colors} label="2. Match" />
        <StepPill active={step === 3} done={false} colors={colors} label="3. Confirmer" />
      </View>
    </View>
  );
}

/* ---------------- Helpers ---------------- */

function formatTime(utc) {
  if (!utc) return "—";
  return new Date(utc).toLocaleTimeString("fr-CA", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function ymdCompactToday() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

function isSvg(uri) {
  return String(uri || "").toLowerCase().includes(".svg");
}

function TeamLogo({ uri, size = 28 }) {
  if (!uri) {
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
        <Ionicons name="shield-outline" size={size * 0.65} color="#9ca3af" />
      </View>
    );
  }

  if (isSvg(uri)) {
    return (
      <View style={{ width: size, height: size }}>
        <SvgUri uri={uri} width="100%" height="100%" />
      </View>
    );
  }

  return (
    <Image
      source={{ uri }}
      style={{ width: size, height: size }}
      resizeMode="contain"
    />
  );
}

/* ---------------- Component ---------------- */

export default function CreateTeamPredictionModal({
  visible,
  onClose,
  groups = [],
  initialGroupId = null,
  onCreated,
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const [step, setStep] = useState(1);
  const [selectedGroupId, setSelectedGroupId] = useState(initialGroupId);
  const [games, setGames] = useState([]);
  const [loadingGames, setLoadingGames] = useState(false);
  const [selectedGameId, setSelectedGameId] = useState(null);
  const [creating, setCreating] = useState(false);

  const selectedGame = useMemo(
    () => games.find((g) => g.gameId === selectedGameId) || null,
    [games, selectedGameId]
  );

  useEffect(() => {
    if (!visible) return;
    setStep(1);
    setSelectedGameId(null);
    setSelectedGroupId(initialGroupId || groups?.[0]?.id || null);
  }, [visible, initialGroupId, groups]);

  /* ---------------- Load games ---------------- */

  useEffect(() => {
    if (!visible || step !== 2) return;

    let cancelled = false;

    async function load() {
      try {
        setLoadingGames(true);

        const ymd = ymdCompactToday();

        console.log("[TP modal] ymd =", ymd);
        console.log("[TP modal] path =", `nhl_schedule_daily/${ymd}/games`);

        const snap = await firestore()
          .collection(`nhl_schedule_daily/${ymd}/games`)
          .get();

        const rows = snap.docs
          .map((d) => {
            const data = d.data() || {};
            return {
              gameId: data.gameId,
              startTimeUTC: data.startTimeUTC,
              gameState: data.gameState,
              away: data.away,
              home: data.home,
            };
          })
          .filter((g) => !!g.gameId && g.gameState !== "OFF")
          .sort((a, b) => new Date(a.startTimeUTC) - new Date(b.startTimeUTC));

        console.log("[TP modal] games found =", rows.length);

        if (!cancelled) setGames(rows);
      } catch (e) {
        console.log("[TP modal] load error", e?.message || e);
        if (!cancelled) setGames([]);
      } finally {
        if (!cancelled) setLoadingGames(false);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [visible, step]);

  /* ---------------- Actions ---------------- */

  async function handleCreate() {
    if (!selectedGroupId || !selectedGame) return;

    try {
      setCreating(true);

      const fn = functions().httpsCallable("createTeamPredictionChallenge");

      const res = await fn({
        groupId: selectedGroupId,
        gameId: selectedGame.gameId,
      });

      onCreated?.(res?.data || null);
      onClose?.();
    } catch (e) {
      Alert.alert(
        i18n.t("common.error", { defaultValue: "Erreur" }),
        String(e?.message || e)
      );
    } finally {
      setCreating(false);
    }
  }

  /* ---------------- Steps ---------------- */

  const renderStep1 = () => (
    <View style={{ gap: 10 }}>
      {groups.map((g) => {
        const active = g.id === selectedGroupId;

        return (
          <TouchableOpacity
            key={g.id}
            onPress={() => setSelectedGroupId(g.id)}
            style={{
              padding: 12,
              borderRadius: 12,
              borderWidth: 2,
              borderColor: active ? colors.primary : colors.border,
              backgroundColor: active ? colors.card2 : colors.card,
            }}
          >
            <Text style={{ color: colors.text, fontWeight: "900" }}>
              {g.name || g.id}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  const renderStep2 = () => (
    <View style={{ gap: 10 }}>
      {loadingGames ? (
        <View style={{ alignItems: "center", paddingVertical: 12 }}>
          <ActivityIndicator />
        </View>
      ) : games.length === 0 ? (
        <Text style={{ color: colors.subtext }}>
          {i18n.t("tp.create.noGames", {
            defaultValue: "Aucun match trouvé aujourd’hui.",
          })}
        </Text>
      ) : (
        games.map((g) => {
          const active = g.gameId === selectedGameId;

          return (
            <TouchableOpacity
              key={g.gameId}
              onPress={() => setSelectedGameId(g.gameId)}
              style={{
                padding: 12,
                borderRadius: 12,
                borderWidth: 2,
                borderColor: active ? colors.primary : colors.border,
                backgroundColor: active ? colors.card2 : colors.card,
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <View
                  style={{
                    flex: 1,
                    flexDirection: "row",
                    alignItems: "center",
                  }}
                >
                  <TeamLogo uri={g.away?.darkLogo || g.away?.logo} size={30} />
                  <Text
                    style={{
                      marginLeft: 8,
                      color: colors.text,
                      fontWeight: "900",
                    }}
                  >
                    {g.away?.abbr || "AWAY"}
                  </Text>
                </View>

                <Text
                  style={{
                    color: colors.subtext,
                    fontWeight: "900",
                    marginHorizontal: 10,
                  }}
                >
                  @
                </Text>

                <View
                  style={{
                    flex: 1,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "flex-end",
                  }}
                >
                  <Text
                    style={{
                      marginRight: 8,
                      color: colors.text,
                      fontWeight: "900",
                    }}
                  >
                    {g.home?.abbr || "HOME"}
                  </Text>
                  <TeamLogo uri={g.home?.darkLogo || g.home?.logo} size={30} />
                </View>
              </View>

              <Text
                style={{
                  color: colors.subtext,
                  marginTop: 8,
                  textAlign: "center",
                }}
              >
                {formatTime(g.startTimeUTC)}
              </Text>
            </TouchableOpacity>
          );
        })
      )}
    </View>
  );

  const renderStep3 = () => (
    <View style={{ gap: 12 }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <View style={{ flex: 1, flexDirection: "row", alignItems: "center" }}>
          <TeamLogo
            uri={selectedGame?.away?.darkLogo || selectedGame?.away?.logo}
            size={34}
          />
          <Text
            style={{
              marginLeft: 8,
              fontWeight: "900",
              color: colors.text,
            }}
          >
            {selectedGame?.away?.abbr || "AWAY"}
          </Text>
        </View>

        <Text style={{ color: colors.subtext, fontWeight: "900" }}>@</Text>

        <View
          style={{
            flex: 1,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "flex-end",
          }}
        >
          <Text
            style={{
              marginRight: 8,
              fontWeight: "900",
              color: colors.text,
            }}
          >
            {selectedGame?.home?.abbr || "HOME"}
          </Text>
          <TeamLogo
            uri={selectedGame?.home?.darkLogo || selectedGame?.home?.logo}
            size={34}
          />
        </View>
      </View>

      <Text style={{ color: colors.subtext }}>
        {i18n.t("tp.create.startAt", {
          defaultValue: "Début: {{time}}",
          time: formatTime(selectedGame?.startTimeUTC),
        })}
      </Text>

      <Text style={{ color: colors.subtext, marginTop: 8 }}>
        🧠 {i18n.t("tp.create.youWillPredict", { defaultValue: "Tu devras prédire :" })}
      </Text>

      <Text style={{ color: colors.text }}>• {i18n.t("tp.create.ruleWinner", { defaultValue: "Équipe gagnante" })}</Text>
      <Text style={{ color: colors.text }}>• {i18n.t("tp.create.ruleScore", { defaultValue: "Score exact" })}</Text>
      <Text style={{ color: colors.text }}>• {i18n.t("tp.create.ruleOutcome", { defaultValue: "Régulier / OT / TB" })}</Text>

      <Text style={{ color: colors.subtext, marginTop: 10 }}>
        🎯 {i18n.t("tp.create.sharePot", {
          defaultValue: "Les gagnants se partagent la cagnotte",
        })}
      </Text>

      <Text style={{ color: colors.subtext }}>
        💰 {i18n.t("tp.create.rollover", {
          defaultValue: "Aucun gagnant → cagnotte reportée",
        })}
      </Text>
    </View>
  );

  const nextDisabled =
    creating ||
    (step === 1 && !selectedGroupId) ||
    (step === 2 && !selectedGameId);

if (!visible) return null;

return (
  <Modal visible animationType="slide" transparent onRequestClose={onClose}>
    <View
      style={{
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.45)",
        justifyContent: "flex-end",
      }}
    >
      <View
        style={{
          maxHeight: "84%",
          backgroundColor: colors.background,
          borderTopLeftRadius: 22,
          borderTopRightRadius: 22,
          paddingTop: 12,
          paddingHorizontal: 16,
          paddingBottom: 16 + insets.bottom,
        }}
      >
        <View style={{ alignItems: "center", marginBottom: 10 }}>
          <View
            style={{
              width: 42,
              height: 4,
              borderRadius: 999,
              backgroundColor: colors.border,
            }}
          />
        </View>

        <ScrollView
          contentContainerStyle={{
            gap: 16,
            paddingBottom: 8,
          }}
          showsVerticalScrollIndicator={false}
        >
          <WizardHeader step={step} colors={colors} onClose={onClose} />

          <View
            style={{
              padding: 14,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.card,
            }}
          >
            {step === 1 && renderStep1()}
            {step === 2 && renderStep2()}
            {step === 3 && renderStep3()}
          </View>

          <View style={{ flexDirection: "row", gap: 10 }}>
            <TouchableOpacity
              onPress={step === 1 ? onClose : () => setStep((s) => Math.max(1, s - 1))}
              style={{
                flex: 1,
                padding: 12,
                borderWidth: 1,
                borderRadius: 12,
                borderColor: colors.border,
                backgroundColor: colors.card,
              }}
            >
              <Text style={{ textAlign: "center", color: colors.text, fontWeight: "800" }}>
                {step === 1
                  ? i18n.t("common.cancel", { defaultValue: "Annuler" })
                  : i18n.t("common.back", { defaultValue: "Retour" })}
              </Text>
            </TouchableOpacity>

            {step < 3 ? (
              <TouchableOpacity
                onPress={() => setStep((s) => s + 1)}
                disabled={nextDisabled}
                style={{
                  flex: 1,
                  padding: 12,
                  backgroundColor: nextDisabled ? colors.subtext : "#111",
                  borderRadius: 12,
                }}
              >
                <Text style={{ color: "#fff", textAlign: "center", fontWeight: "900" }}>
                  {i18n.t("common.next", { defaultValue: "Suivant" })}
                </Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                onPress={handleCreate}
                disabled={creating || !selectedGame || !selectedGroupId}
                style={{
                  flex: 1,
                  padding: 12,
                  backgroundColor:
                    creating || !selectedGame || !selectedGroupId ? colors.subtext : "#111",
                  borderRadius: 12,
                }}
              >
                <Text style={{ color: "#fff", textAlign: "center", fontWeight: "900" }}>
                  {creating
                    ? i18n.t("tp.create.creating", { defaultValue: "Création…" })
                    : i18n.t("common.create", { defaultValue: "Créer" })}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      </View>
    </View>
  </Modal>
);
}