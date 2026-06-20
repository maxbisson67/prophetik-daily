// src/defis/TeamPredictionBundlePickScreen.js

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
} from "react-native";
import { Stack, useRouter } from "expo-router";
import firestore from "@react-native-firebase/firestore";
import functions from "@react-native-firebase/functions";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import i18n from "@src/i18n/i18n";
import { useTheme } from "@src/theme/ThemeProvider";
import { useAuth } from "@src/auth/SafeAuthProvider";
import TeamLogoBadge from "@src/sports/TeamLogoBadge";
import { lookupTeamByAbbr } from "@src/groups/data/fallbackTeams";
import {
  formatMlbPitcherFallbackLabel,
  formatMlbPitcherEraLine,
  formatMlbPitcherNameAndRecord,
} from "@src/mlb/mlbPitcherDisplayHelpers";
import { useTpBundleTeamRecords } from "@src/sports/useTeamStandingsLookup";
import {
  formatCountdown,
  fmtTimeShort,
  getSlotLockedAt,
  isSlotLocked,
} from "@src/defis/tpDeadlineHelpers";
import {
  formatPickPoints,
  formatResultWinnerLine,
  isBundleDecided,
  isSlotDecided,
} from "@src/defis/tpBundleDisplayHelpers";

const RED = "#b91c1c";

function TeamStandingsLine({ line, colors }) {
  if (!line) return null;

  return (
    <Text
      style={{
        color: colors.text,
        fontSize: 12,
        fontWeight: "800",
        textAlign: "center",
        opacity: 0.82,
      }}
      numberOfLines={2}
    >
      {line}
    </Text>
  );
}

function ScoreInputBox({ value, onChangeText, editable, colors }) {
  const active = editable;

  return (
    <View
      style={[
        styles.scoreInputBox,
        {
          borderColor: active ? "rgba(239,68,68,0.55)" : colors.border,
          backgroundColor: colors.background,
        },
      ]}
    >
      <TextInput
        value={value}
        onChangeText={onChangeText}
        editable={editable}
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
  );
}

function OutcomeChip({ label, value, selectedValue, onPress, colors, disabled = false }) {
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
        borderColor: disabled ? colors.border : selected ? RED : colors.border,
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

function PitcherBlock({ pitcher, colors }) {
  const nameLine = formatMlbPitcherNameAndRecord(pitcher);
  const eraLine = formatMlbPitcherEraLine(pitcher);

  if (!nameLine) {
    return (
      <Text style={{ color: colors.subtext, fontSize: 12, fontWeight: "700", marginTop: 2 }}>
        {formatMlbPitcherFallbackLabel(i18n.t.bind(i18n))}
      </Text>
    );
  }

  return (
    <View style={{ alignItems: "center", marginTop: 2, gap: 2 }}>
      <Text style={{ color: colors.subtext, fontSize: 12, fontWeight: "700", textAlign: "center" }}>
        {nameLine}
      </Text>
      {eraLine ? (
        <Text style={{ color: colors.subtext, fontSize: 12, fontWeight: "700", textAlign: "center" }}>
          {eraLine}
        </Text>
      ) : null}
    </View>
  );
}

function normalizeScoreInput(v) {
  return String(v || "").replace(/[^\d]/g, "").slice(0, 2);
}

function emptyDraftPick() {
  return { away: "", home: "", outcome: "REG" };
}

function draftFromSavedPick(pick, isMlb) {
  if (!pick) return emptyDraftPick();
  return {
    away:
      pick.predictedAwayScore !== undefined && pick.predictedAwayScore !== null
        ? String(pick.predictedAwayScore)
        : "",
    home:
      pick.predictedHomeScore !== undefined && pick.predictedHomeScore !== null
        ? String(pick.predictedHomeScore)
        : "",
    outcome: isMlb ? "FINAL" : pick.predictedOutcome || "REG",
  };
}

function canSaveDraft(draft, isMlb) {
  if (draft.away === "" || draft.home === "") return false;
  if (Number(draft.away) === Number(draft.home)) return false;
  if (!isMlb && !draft.outcome) return false;
  return true;
}

function MatchLockInfo({ slot, locked, nowTick, colors }) {
  const lockedAt = getSlotLockedAt(slot);
  const lockHM = fmtTimeShort(lockedAt);

  if (locked) {
    return (
      <Text style={{ color: colors.subtext, fontSize: 12, marginBottom: 8 }}>
        {i18n.t("tp.home.predictionsClosed", {
          defaultValue: "Prédictions fermées",
        })}
      </Text>
    );
  }

  if (!lockedAt) return null;

  const countdown = formatCountdown(lockedAt.getTime() - nowTick);

  return (
    <View style={{ marginBottom: 8, gap: 2 }}>
      <Text style={{ color: colors.subtext, fontSize: 12 }}>
        {i18n.t("tp.pick.lockAt", {
          defaultValue: "Verrouillage : {{time}}",
          time: lockHM || "—",
        })}
      </Text>
      <Text style={{ color: colors.text, fontSize: 12, fontWeight: "800" }}>
        {i18n.t("tp.pick.lockCountdown", {
          defaultValue: "Il te reste {{time}} pour enregistrer ce match",
          time: countdown,
        })}
      </Text>
    </View>
  );
}

function MatchResultBanner({ slot, league, colors }) {
  const line = formatResultWinnerLine(slot, league);
  if (!line) return null;

  return (
    <View
      style={{
        marginBottom: 10,
        padding: 10,
        borderRadius: 12,
        backgroundColor: "rgba(59,130,246,0.10)",
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <Text style={{ color: "#2563eb", fontWeight: "900", fontSize: 13 }}>
        {i18n.t("tp.pick.resultConfirmed", {
          defaultValue: "Résultat : {{line}}",
          line,
        })}
      </Text>
    </View>
  );
}

function MatchPointsLine({ pickResult, colors }) {
  const pointsLine = formatPickPoints(pickResult);
  const winnerCorrect = !!pickResult?.winnerCorrect;
  const exactScoreCorrect = !!pickResult?.exactScoreCorrect;

  if (!pickResult) {
    return (
      <Text style={{ color: colors.subtext, fontSize: 12, marginTop: 8 }}>
        {i18n.t("tp.pick.noPickForMatch", { defaultValue: "Tu n'as pas participé à ce match." })}
      </Text>
    );
  }

  return (
    <View style={{ marginTop: 10, gap: 4 }}>
      <Text style={{ color: colors.text, fontSize: 13, fontWeight: "800" }}>
        {winnerCorrect
          ? exactScoreCorrect
            ? i18n.t("tp.pick.perfectPick", { defaultValue: "Score exact!" })
            : i18n.t("tp.pick.winnerCorrect", { defaultValue: "Bon gagnant" })
          : i18n.t("tp.pick.winnerWrong", { defaultValue: "Mauvais gagnant" })}
        {pointsLine ? ` · ${pointsLine}` : ""}
      </Text>
    </View>
  );
}

function BundleMatchPickSection({
  slot,
  league,
  draft,
  savedPick,
  pickResult,
  onChangeDraft,
  onSave,
  saving,
  colors,
  formatTeamLine,
  nowTick,
}) {
  const isMlb = league === "MLB";
  const gameId = String(slot?.gameId || "");
  const decided = isSlotDecided(slot);
  const locked = decided || isSlotLocked(slot);
  const awayAbbr = String(slot?.awayAbbr || "");
  const homeAbbr = String(slot?.homeAbbr || "");
  const awayTeam = lookupTeamByAbbr(league, awayAbbr);
  const homeTeam = lookupTeamByAbbr(league, homeAbbr);
  const scoreDiff =
    draft.away !== "" && draft.home !== "" ? Math.abs(Number(draft.away) - Number(draft.home)) : null;
  const otTbDisabled = scoreDiff !== null && scoreDiff > 1;
  const saveEnabled = !locked && !saving && canSaveDraft(draft, isMlb);

  return (
    <View
      style={[
        styles.card,
        {
          borderColor: colors.border,
          backgroundColor: colors.card,
        },
      ]}
    >
      <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
        {slot?.isFavoriteGame ? (
          <Text style={{ marginRight: 6 }}>★</Text>
        ) : null}
        <Text style={{ color: colors.text, fontWeight: "900", fontSize: 16, flex: 1 }}>
          {i18n.t("tp.pick.matchSlot", {
            defaultValue: "Match {{n}}",
            n: slot?.slot || "—",
          })}
        </Text>
        {decided ? (
          <Text style={{ color: "#2563eb", fontWeight: "900", fontSize: 12 }}>
            {i18n.t("tp.pick.decided", { defaultValue: "Terminé" })}
          </Text>
        ) : locked ? (
          <Text style={{ color: colors.subtext, fontWeight: "900", fontSize: 12 }}>
            {i18n.t("tp.pick.locked", { defaultValue: "Verrouillé" })}
          </Text>
        ) : null}
      </View>

      {decided ? (
        <>
          <MatchResultBanner slot={slot} league={league} colors={colors} />
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <View style={{ flex: 1, alignItems: "center", gap: 8 }}>
              <TeamLogoBadge team={awayTeam} size={40} colors={colors} />
              <Text style={{ color: colors.text, fontWeight: "900" }}>{awayAbbr}</Text>
              <Text style={{ color: colors.text, fontWeight: "900", fontSize: 28 }}>
                {slot?.officialResult?.awayScore ?? "—"}
              </Text>
              {savedPick ? (
                <Text style={{ color: colors.subtext, fontSize: 12 }}>
                  {i18n.t("tp.pick.yourPick", { defaultValue: "Toi" })}: {draft.away || "—"}
                </Text>
              ) : null}
            </View>

            <Text style={{ color: colors.subtext, fontWeight: "900", fontSize: 20 }}>-</Text>

            <View style={{ flex: 1, alignItems: "center", gap: 8 }}>
              <TeamLogoBadge team={homeTeam} size={40} colors={colors} />
              <Text style={{ color: colors.text, fontWeight: "900" }}>{homeAbbr}</Text>
              <Text style={{ color: colors.text, fontWeight: "900", fontSize: 28 }}>
                {slot?.officialResult?.homeScore ?? "—"}
              </Text>
              {savedPick ? (
                <Text style={{ color: colors.subtext, fontSize: 12 }}>
                  {i18n.t("tp.pick.yourPick", { defaultValue: "Toi" })}: {draft.home || "—"}
                </Text>
              ) : null}
            </View>
          </View>
          <MatchPointsLine pickResult={pickResult} colors={colors} />
        </>
      ) : (
        <>
      <MatchLockInfo
        slot={slot}
        locked={locked}
        nowTick={nowTick}
        colors={colors}
      />

      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <View style={{ flex: 1, alignItems: "center", gap: 8 }}>
          <TeamLogoBadge team={awayTeam} size={40} colors={colors} />
          <Text style={{ color: colors.text, fontWeight: "900" }}>{awayAbbr}</Text>
          <TeamStandingsLine line={formatTeamLine?.(gameId, "away", awayAbbr)} colors={colors} />
          {isMlb ? <PitcherBlock pitcher={slot?.awayProbablePitcher} colors={colors} /> : null}
          <ScoreInputBox
            value={draft.away}
            onChangeText={(txt) => onChangeDraft({ ...draft, away: normalizeScoreInput(txt) })}
            editable={!locked}
            colors={colors}
          />
        </View>

        <Text style={{ color: colors.subtext, fontWeight: "900", fontSize: 20 }}>-</Text>

        <View style={{ flex: 1, alignItems: "center", gap: 8 }}>
          <TeamLogoBadge team={homeTeam} size={40} colors={colors} />
          <Text style={{ color: colors.text, fontWeight: "900" }}>{homeAbbr}</Text>
          <TeamStandingsLine line={formatTeamLine?.(gameId, "home", homeAbbr)} colors={colors} />
          {isMlb ? <PitcherBlock pitcher={slot?.homeProbablePitcher} colors={colors} /> : null}
          <ScoreInputBox
            value={draft.home}
            onChangeText={(txt) => onChangeDraft({ ...draft, home: normalizeScoreInput(txt) })}
            editable={!locked}
            colors={colors}
          />
        </View>
      </View>

      {!isMlb ? (
        <View style={{ marginTop: 12 }}>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <OutcomeChip
              label="REG"
              value="REG"
              selectedValue={draft.outcome}
              onPress={(v) => onChangeDraft({ ...draft, outcome: v })}
              colors={colors}
              disabled={locked}
            />
            <OutcomeChip
              label="OT"
              value="OT"
              selectedValue={draft.outcome}
              onPress={(v) => onChangeDraft({ ...draft, outcome: v })}
              colors={colors}
              disabled={locked || otTbDisabled}
            />
            <OutcomeChip
              label="TB"
              value="TB"
              selectedValue={draft.outcome}
              onPress={(v) => onChangeDraft({ ...draft, outcome: v })}
              colors={colors}
              disabled={locked || otTbDisabled}
            />
          </View>
        </View>
      ) : null}

      {draft.away !== "" && draft.home !== "" && Number(draft.away) === Number(draft.home) ? (
        <Text style={{ color: RED, fontWeight: "800", marginTop: 8 }}>
          {i18n.t("tp.pick.tieNotAllowed", {
            defaultValue: "Le score ne peut pas être égal.",
          })}
        </Text>
      ) : null}

      {!locked ? (
        <TouchableOpacity
          onPress={onSave}
          disabled={!saveEnabled}
          style={{
            marginTop: 12,
            backgroundColor: saveEnabled ? RED : colors.subtext,
            borderRadius: 12,
            paddingVertical: 12,
            alignItems: "center",
          }}
        >
          {saving ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={{ color: "#fff", fontWeight: "900" }}>
              {i18n.t("tp.pick.saveMatch", { defaultValue: "Enregistrer ce match" })}
            </Text>
          )}
        </TouchableOpacity>
      ) : null}
        </>
      )}
    </View>
  );
}

export default function TeamPredictionBundlePickScreen({ bundleId }) {
  const router = useRouter();
  const { colors } = useTheme();
  const { user, authReady } = useAuth();
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(true);
  const [bundle, setBundle] = useState(null);
  const [entry, setEntry] = useState(null);
  const [draftByGameId, setDraftByGameId] = useState({});
  const [savingGameId, setSavingGameId] = useState(null);
  const [nowTick, setNowTick] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const league = useMemo(() => {
    if (!bundle?.league) return null;
    return String(bundle.league).toUpperCase() === "MLB" ? "MLB" : "NHL";
  }, [bundle?.league]);

  const isMlb = league === "MLB";
  const games = useMemo(
    () => (Array.isArray(bundle?.games) ? [...bundle.games].sort((a, b) => (a.slot || 0) - (b.slot || 0)) : []),
    [bundle?.games]
  );
  const { formatLine: formatTeamLine } = useTpBundleTeamRecords({ bundle, games, league });

  useEffect(() => {
    if (!authReady || !user?.uid || !bundleId) return;

    let cancelled = false;

    const bundleRef = firestore().doc(`team_prediction_bundles/${bundleId}`);
    const entryRef = firestore().doc(
      `team_prediction_bundles/${bundleId}/entries/${user.uid}`
    );

    const unsubBundle = bundleRef.onSnapshot(
      (snap) => {
        if (cancelled) return;
        setBundle(snap?.exists ? { id: snap.id, ...snap.data() } : null);
        setLoading(false);
      },
      () => {
        if (!cancelled) setLoading(false);
      }
    );

    const unsubEntry = entryRef.onSnapshot(
      (snap) => {
        if (cancelled) return;
        setEntry(snap?.exists ? snap.data() || null : null);
      },
      () => {
        if (cancelled) return;
        setEntry(null);
      }
    );

    return () => {
      cancelled = true;
      try {
        unsubBundle?.();
      } catch {}
      try {
        unsubEntry?.();
      } catch {}
    };
  }, [authReady, user?.uid, bundleId]);

  useEffect(() => {
    if (!games.length) return;

    const saved = entry?.picks || {};

    setDraftByGameId((prev) => {
      const next = { ...prev };

      for (const slot of games) {
        const gameId = String(slot.gameId);
        if (saved[gameId]) {
          next[gameId] = draftFromSavedPick(saved[gameId], isMlb);
        } else if (!next[gameId]) {
          next[gameId] = emptyDraftPick();
        }
      }

      return next;
    });
  }, [games, entry?.picks, isMlb]);

  async function handleSaveMatch(gameId) {
    const draft = draftByGameId[gameId];
    if (!canSaveDraft(draft, isMlb)) return;

    try {
      setSavingGameId(gameId);

      const fn = functions().httpsCallable("submitTeamPredictionBundleEntry");

      await fn({
        bundleId: String(bundleId),
        picks: {
          [gameId]: {
            predictedAwayScore: Number(draft.away),
            predictedHomeScore: Number(draft.home),
            predictedOutcome: isMlb ? "FINAL" : draft.outcome,
          },
        },
      });

      Alert.alert(
        i18n.t("tp.pick.savedTitle", { defaultValue: "Prédiction enregistrée" }),
        i18n.t("tp.pick.savedMatchBody", {
          defaultValue: "Ta prédiction pour ce match a été sauvegardée.",
        })
      );
    } catch (e) {
      Alert.alert(
        i18n.t("common.error", { defaultValue: "Erreur" }),
        String(e?.message || e)
      );
    } finally {
      setSavingGameId(null);
    }
  }

  const picksCompletedCount = Number(entry?.picksCompletedCount || 0);
  const gameCount = Number(bundle?.gameCount || games.length || 0);
  const totalPoints = Number(entry?.totalPoints ?? 0);
  const showResults = isBundleDecided(bundle);
  const pickResults = entry?.pickResults || {};

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={{ flex: 1, backgroundColor: colors.background }}>
        {!authReady || loading ? (
          <View style={styles.center}>
            <ActivityIndicator />
          </View>
        ) : !bundle ? (
          <View style={styles.center}>
            <Text style={{ color: colors.text }}>
              {i18n.t("tp.pick.notFound", { defaultValue: "Défi TP introuvable." })}
            </Text>
          </View>
        ) : (
          <View style={{ flex: 1 }}>
            <View
              style={{
                paddingTop: Math.max(insets.top, 12),
                paddingHorizontal: 14,
                paddingBottom: 10,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Text style={{ flex: 1, color: colors.text, fontSize: 20, fontWeight: "900" }}>
                  {showResults
                    ? i18n.t("tp.pick.resultsTitle", { defaultValue: "Résultats du défi" })
                    : i18n.t("tp.pick.screenTitle", {
                        defaultValue: "Défi - Prédire l'issue du match",
                      })}
                </Text>
                <TouchableOpacity
                  onPress={() => router.back()}
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

              <Text style={{ color: colors.subtext, marginTop: 6 }}>
                {showResults
                  ? i18n.t("tp.pick.myTotalPoints", {
                      defaultValue: "Ton total : {{points}} pt(s)",
                      points: totalPoints,
                    })
                  : i18n.t("tp.pick.bundleProgress", {
                      defaultValue: "{{done}}/{{total}} matchs complétés",
                      done: picksCompletedCount,
                      total: gameCount,
                    })}
              </Text>
            </View>

            <ScrollView
              contentContainerStyle={{
                paddingHorizontal: 14,
                paddingBottom: Math.max(insets.bottom, 20) + 12,
                gap: 12,
              }}
            >
              {games.map((slot) => {
                const gameId = String(slot.gameId);
                const draft = draftByGameId[gameId] || emptyDraftPick();
                const savedPick = entry?.picks?.[gameId] || null;

                return (
                  <BundleMatchPickSection
                    key={gameId}
                    slot={slot}
                    league={league}
                    draft={draft}
                    savedPick={savedPick}
                    pickResult={pickResults[gameId]}
                    formatTeamLine={formatTeamLine}
                    nowTick={nowTick}
                    onChangeDraft={(nextDraft) =>
                      setDraftByGameId((prev) => ({ ...prev, [gameId]: nextDraft }))
                    }
                    onSave={() => handleSaveMatch(gameId)}
                    saving={savingGameId === gameId}
                    colors={colors}
                  />
                );
              })}

              <View
                style={[
                  styles.card,
                  { borderColor: colors.border, backgroundColor: colors.card },
                ]}
              >
                <Text style={{ color: colors.subtext, lineHeight: 20 }}>
                  {i18n.t("tp.pick.summaryHintMvp", {
                    defaultValue: "3 pts pour le bon gagnant, +3 pts pour le score exact.",
                  })}
                </Text>
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
  card: {
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  scoreInputBox: {
    width: 88,
    padding: 6,
    borderWidth: 2,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  scoreInput: {
    width: "100%",
    height: 52,
    borderWidth: 1,
    borderRadius: 12,
    textAlign: "center",
    fontSize: 24,
    fontWeight: "900",
  },
});
