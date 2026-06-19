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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { SvgUri } from "react-native-svg";
import firestore from "@react-native-firebase/firestore";
import functions from "@react-native-firebase/functions";
import { useTheme } from "@src/theme/ThemeProvider";
import i18n from "@src/i18n/i18n";
import TeamLogoBadge from "@src/sports/TeamLogoBadge";
import { lookupTeamByAbbr } from "@src/groups/data/fallbackTeams";
import {
  formatMlbPitcherFallbackLabel,
  formatMlbPitcherSummary,
} from "@src/mlb/mlbPitcherDisplayHelpers";

const TP_LOCK_BEFORE_MS = 5 * 60 * 1000;

/* ---------------- UI ---------------- */

function PreviewMatchupRow({ game, sportLeague, colors }) {
  const league = String(sportLeague || "NHL").toUpperCase() === "MLB" ? "MLB" : "NHL";
  const awayAbbr = String(game?.awayAbbr || "").trim().toUpperCase();
  const homeAbbr = String(game?.homeAbbr || "").trim().toUpperCase();
  const awayTeam = lookupTeamByAbbr(league, awayAbbr);
  const homeTeam = lookupTeamByAbbr(league, homeAbbr);

  return (
    <View
      style={{
        padding: 10,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.card2,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        {game?.isFavoriteGame ? (
          <Text style={{ marginRight: 6, fontSize: 13 }}>★</Text>
        ) : null}

        <TeamLogoBadge team={awayTeam} size={22} colors={colors} />
        <Text style={{ color: colors.text, fontWeight: "900", marginLeft: 8 }}>
          {awayAbbr || "—"}
        </Text>

        <Text style={{ color: colors.subtext, marginHorizontal: 10, fontWeight: "900" }}>
          @
        </Text>

        <Text style={{ color: colors.text, fontWeight: "900", marginRight: 8 }}>
          {homeAbbr || "—"}
        </Text>
        <TeamLogoBadge team={homeTeam} size={22} colors={colors} />
      </View>

      <Text style={{ color: colors.subtext, marginTop: 6, fontSize: 12 }}>
        {i18n.t("tp.create.startAt", {
          defaultValue: "Début: {{time}}",
          time: game.startTimeISO ? formatTime(game.startTimeISO) : "—",
        })}
      </Text>
    </View>
  );
}

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

function WizardHeader({ step, colors, sportLeague, onClose }) {
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
          TP — {i18n.t("tp.create.title", { defaultValue: "Prédire l'issue des matchs" })}
        </Text>

        <View
          style={{
            marginRight: 8,
            paddingHorizontal: 10,
            paddingVertical: 4,
            borderRadius: 999,
            backgroundColor: colors.card,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <Text style={{ color: colors.text, fontWeight: "900", fontSize: 12 }}>
            {sportLeague}
          </Text>
        </View>

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
        <StepPill active={step === 2} done={false} colors={colors} label="2. Confirmer" />
      </View>
    </View>
  );
}

/* ---------------- Helpers ---------------- */

function toJsDate(v) {
  if (!v) return null;
  if (v?.toDate && typeof v.toDate === "function") return v.toDate();
  if (v instanceof Date) return v;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function safeAbbr(v) {
  return String(v || "").trim().toUpperCase();
}

function ymdCompactToday() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

function formatTime(utc) {
  const d = toJsDate(utc);
  if (!d) return "—";
  return d.toLocaleTimeString("fr-CA", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function isSvg(uri) {
  return String(uri || "").toLowerCase().includes(".svg");
}

function normalizeNhlScheduleGame(data = {}) {
  return {
    gameId: String(data.gameId || ""),
    league: "NHL",
    startTimeUTC: data.startTimeUTC,
    gameState: data.gameState,
    away: data.away || {},
    home: data.home || {},
  };
}

function normalizeMlbScheduleGame(data = {}, docId = "") {
  const gameId = String(data.gamePk || docId || "");
  return {
    gameId,
    league: "MLB",
    startTimeUTC: data.startTimeUTC || data.gameDateRaw || null,
    status: data.status || null,
    away: {
      abbr: safeAbbr(data?.awayTeam?.abbreviation),
      logo: data?.awayTeam?.logo || null,
    },
    home: {
      abbr: safeAbbr(data?.homeTeam?.abbreviation),
      logo: data?.homeTeam?.logo || null,
    },
    awayProbablePitcher: data.awayProbablePitcher || null,
    homeProbablePitcher: data.homeProbablePitcher || null,
  };
}

function isUpcomingTpGame(game, league, nowMs) {
  const dt = toJsDate(game.startTimeUTC);
  if (!dt) return false;

  if (dt.getTime() <= nowMs) return false;
  if (dt.getTime() - nowMs < TP_LOCK_BEFORE_MS) return false;

  if (league === "MLB") {
    const abstract = String(game.status?.abstractGameState || "").toLowerCase();
    return abstract !== "final" && !!game.gameId;
  }

  return safeAbbr(game.gameState) !== "OFF" && !!game.gameId;
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

function PitcherSubline({ pitcher, colors }) {
  const summary = formatMlbPitcherSummary(pitcher);
  return (
    <Text
      style={{
        color: colors.subtext,
        fontSize: 12,
        fontWeight: "700",
        marginTop: 2,
      }}
      numberOfLines={1}
    >
      {summary || formatMlbPitcherFallbackLabel(i18n.t.bind(i18n))}
    </Text>
  );
}

function GameMatchupRow({ game, active, colors, sportLeague, onPress }) {
  const awayLogo = game.away?.darkLogo || game.away?.logo;
  const homeLogo = game.home?.darkLogo || game.home?.logo;
  const showPitchers = sportLeague === "MLB";

  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        padding: 12,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: active ? colors.primary : colors.border,
        backgroundColor: active ? colors.card2 : colors.card,
      }}
    >
      {showPitchers ? (
        <View style={{ gap: 10 }}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <TeamLogo uri={awayLogo} size={30} />
            <View style={{ marginLeft: 8, flex: 1 }}>
              <Text style={{ color: colors.text, fontWeight: "900" }}>
                {game.away?.abbr || "AWAY"}
              </Text>
              <PitcherSubline pitcher={game.awayProbablePitcher} colors={colors} />
            </View>
          </View>

          <Text style={{ color: colors.subtext, fontWeight: "900", textAlign: "center" }}>
            vs
          </Text>

          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <TeamLogo uri={homeLogo} size={30} />
            <View style={{ marginLeft: 8, flex: 1 }}>
              <Text style={{ color: colors.text, fontWeight: "900" }}>
                {game.home?.abbr || "HOME"}
              </Text>
              <PitcherSubline pitcher={game.homeProbablePitcher} colors={colors} />
            </View>
          </View>
        </View>
      ) : (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <View style={{ flex: 1, flexDirection: "row", alignItems: "center" }}>
            <TeamLogo uri={awayLogo} size={30} />
            <Text
              style={{
                marginLeft: 8,
                color: colors.text,
                fontWeight: "900",
              }}
            >
              {game.away?.abbr || "AWAY"}
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
              {game.home?.abbr || "HOME"}
            </Text>
            <TeamLogo uri={homeLogo} size={30} />
          </View>
        </View>
      )}

      <Text
        style={{
          color: colors.subtext,
          marginTop: 8,
          textAlign: "center",
        }}
      >
        {formatTime(game.startTimeUTC)}
      </Text>
    </TouchableOpacity>
  );
}

/* ---------------- Component ---------------- */

export default function CreateTeamPredictionModal({
  visible,
  onClose,
  groups = [],
  initialGroupId = null,
  league = "NHL",
  initialSport = null,
  onCreated,
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const sportLeague = String(league || initialSport || "NHL").toUpperCase();

  const eligibleGroups = useMemo(
    () =>
      (groups || []).filter(
        (g) => String(g.sport || g.league || "NHL").toUpperCase() === sportLeague
      ),
    [groups, sportLeague]
  );

  const [step, setStep] = useState(1);
  const [selectedGroupId, setSelectedGroupId] = useState(initialGroupId);
  const [preview, setPreview] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setStep(1);
    setPreview(null);

    const fallbackGroupId =
      initialGroupId && eligibleGroups.some((g) => g.id === initialGroupId)
        ? initialGroupId
        : eligibleGroups[0]?.id || null;

    setSelectedGroupId(fallbackGroupId);
  }, [visible, initialGroupId, eligibleGroups, sportLeague]);

  useEffect(() => {
    if (!visible || step !== 2 || !selectedGroupId) return;

    let cancelled = false;

    async function loadPreview() {
      setLoadingPreview(true);
      setPreview(null);

      try {
        const fn = functions().httpsCallable("createTeamPredictionBundle");
        const res = await fn({
          groupId: selectedGroupId,
          league: sportLeague,
          previewOnly: true,
        });

        if (!cancelled) {
          setPreview(res?.data || null);
        }
      } catch (e) {
        console.log("[TP modal] preview error", e?.message || e);
        if (!cancelled) setPreview({ gameCount: 0, games: [] });
      } finally {
        if (!cancelled) setLoadingPreview(false);
      }
    }

    loadPreview();

    return () => {
      cancelled = true;
    };
  }, [visible, step, selectedGroupId, sportLeague]);

  /* ---------------- Actions ---------------- */

  async function handleCreate() {
    if (!selectedGroupId || !preview?.gameCount) return;

    try {
      setCreating(true);

      const fn = functions().httpsCallable("createTeamPredictionBundle");

      const res = await fn({
        groupId: selectedGroupId,
        league: sportLeague,
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

  const renderStep1 = () => {
    if (eligibleGroups.length === 0) {
      return (
        <Text style={{ color: colors.subtext }}>
          {i18n.t("tp.create.noGroupsForSport", {
            defaultValue: "Aucun groupe {{sport}} disponible.",
            sport: sportLeague,
          })}
        </Text>
      );
    }

    return (
      <View style={{ gap: 10 }}>
        {eligibleGroups.map((g) => {
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
  };

  const renderStep2 = () => (
    <View style={{ gap: 12 }}>
      {loadingPreview ? (
        <View style={{ alignItems: "center", paddingVertical: 12 }}>
          <ActivityIndicator />
        </View>
      ) : !preview?.gameCount ? (
        <Text style={{ color: colors.subtext }}>
          {i18n.t("tp.create.noGames", {
            defaultValue: "Aucun match {{sport}} disponible aujourd'hui.",
            sport: sportLeague,
          })}
        </Text>
      ) : (
        <>
          <Text style={{ color: colors.text, fontWeight: "900" }}>
            {i18n.t("tp.create.bundlePreviewTitle", {
              defaultValue: "{{count}} match(s) sélectionné(s)",
              count: preview.gameCount,
            })}
          </Text>

          {(preview.games || []).map((g) => (
            <PreviewMatchupRow
              key={g.gameId}
              game={g}
              sportLeague={sportLeague}
              colors={colors}
            />
          ))}
        </>
      )}

      <Text style={{ color: colors.subtext, marginTop: 8 }}>
        🧠 {i18n.t("tp.create.youWillPredict", { defaultValue: "Tu devras prédire :" })}
      </Text>

      <Text style={{ color: colors.text }}>
        • {i18n.t("tp.create.ruleWinner", { defaultValue: "Équipe gagnante" })}
      </Text>
      <Text style={{ color: colors.text }}>
        • {i18n.t("tp.create.ruleScore", { defaultValue: "Score exact" })}
      </Text>

      {sportLeague === "NHL" ? (
        <Text style={{ color: colors.text }}>
          • {i18n.t("tp.create.ruleOutcome", { defaultValue: "Régulier / OT / TB" })}
        </Text>
      ) : null}

      <Text style={{ color: colors.subtext, marginTop: 10 }}>
        🎯{" "}
        {i18n.t("tp.create.scoringWinner", {
          defaultValue: "Bonne équipe gagnante = 3 points",
        })}
      </Text>

      <Text style={{ color: colors.subtext }}>
        ⭐{" "}
        {i18n.t("tp.create.scoringExact", {
          defaultValue: "Score exact en plus = +3 points (total 6)",
        })}
      </Text>
    </View>
  );

  const nextDisabled =
    creating || (step === 1 && !selectedGroupId) || (step === 2 && !preview?.gameCount);

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
            <WizardHeader
              step={step}
              colors={colors}
              sportLeague={sportLeague}
              onClose={onClose}
            />

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

              {step < 2 ? (
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
                  disabled={creating || !preview?.gameCount || !selectedGroupId}
                  style={{
                    flex: 1,
                    padding: 12,
                    backgroundColor:
                      creating || !preview?.gameCount || !selectedGroupId
                        ? colors.subtext
                        : "#111",
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
