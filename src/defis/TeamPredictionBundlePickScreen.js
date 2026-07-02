// src/defis/TeamPredictionBundlePickScreen.js

import React, { useEffect, useMemo, useState, useRef, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  StyleSheet,
  Platform,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
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
  isBundleDecided,
  isSlotDecided,
} from "@src/defis/tpBundleDisplayHelpers";
import { isMlbGamePostponed } from "@src/mlb/mlbGameStatusUtils";
import useMlbScheduleGames from "@src/mlb/useMlbScheduleGames";
import NovaCoachPanel from "@src/nova/NovaCoachPanel";

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

function ScoreInputBox({ value, onChangeText, editable, colors, onFocus }) {
  const active = editable;
  const inputRef = useRef(null);

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
        ref={inputRef}
        value={value}
        onChangeText={onChangeText}
        onFocus={() => onFocus?.(inputRef.current)}
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
  if (!draft || typeof draft !== "object") return false;
  if (draft.away === "" || draft.home === "") return false;
  if (Number(draft.away) === Number(draft.home)) return false;
  if (!isMlb && !draft.outcome) return false;
  return true;
}

function draftMatchesSaved(draft, savedPick, isMlb) {
  if (!draft || !savedPick || !canSaveDraft(draft, isMlb)) return false;
  if (Number(draft.away) !== Number(savedPick.predictedAwayScore)) return false;
  if (Number(draft.home) !== Number(savedPick.predictedHomeScore)) return false;
  const outcome = isMlb ? "FINAL" : draft.outcome;
  if (!isMlb && String(savedPick.predictedOutcome || "") !== String(outcome)) return false;
  return true;
}

function pickPayloadFromDraft(draft, isMlb) {
  return {
    predictedAwayScore: Number(draft.away),
    predictedHomeScore: Number(draft.home),
    predictedOutcome: isMlb ? "FINAL" : draft.outcome,
  };
}

function getCardSaveState({ draft, savedPick, isMlb, locked, decided, saving, hasError }) {
  if (decided) return null;
  if (saving) return "saving";
  if (hasError && canSaveDraft(draft, isMlb) && !draftMatchesSaved(draft, savedPick, isMlb)) {
    return "error";
  }
  if (locked) {
    return savedPick ? "saved" : "incomplete";
  }
  if (!canSaveDraft(draft, isMlb)) return "incomplete";
  if (draftMatchesSaved(draft, savedPick, isMlb)) return "saved";
  return "pending";
}

function SaveStatusBadge({ state, colors }) {
  if (!state) return null;

  const configs = {
    incomplete: {
      label: i18n.t("tp.pick.statusIncomplete"),
      color: colors.subtext,
      icon: "○",
    },
    pending: {
      label: i18n.t("tp.pick.statusPending"),
      color: "#d97706",
      icon: "·",
    },
    saving: {
      label: i18n.t("tp.pick.statusSaving"),
      color: RED,
      icon: null,
    },
    saved: {
      label: i18n.t("tp.pick.statusSaved"),
      color: "#16a34a",
      icon: "✓",
    },
    error: {
      label: i18n.t("tp.pick.statusError"),
      color: RED,
      icon: "!",
    },
  };

  const cfg = configs[state] || configs.incomplete;

  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
      {state === "saving" ? (
        <ActivityIndicator size="small" color={cfg.color} />
      ) : cfg.icon ? (
        <Text style={{ color: cfg.color, fontWeight: "900", fontSize: 12 }}>{cfg.icon}</Text>
      ) : null}
      <Text style={{ color: cfg.color, fontWeight: "900", fontSize: 12 }}>{cfg.label}</Text>
    </View>
  );
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

function BundleMatchPickSection({
  slot,
  league,
  draft,
  onChangeDraft,
  saveState = null,
  colors,
  formatTeamLine,
  nowTick,
  scheduleInfo = null,
  onScoreFocus = null,
}) {
  const isMlb = league === "MLB";
  const gameId = String(slot?.gameId || "");
  const decided = isSlotDecided(slot);
  const postponed = isMlb && isMlbGamePostponed(scheduleInfo?.status);
  const locked =
    decided || isSlotLocked(slot, nowTick, { scheduleStatus: scheduleInfo?.status });
  const awayAbbr = String(slot?.awayAbbr || "");
  const homeAbbr = String(slot?.homeAbbr || "");
  const awayTeam = lookupTeamByAbbr(league, awayAbbr);
  const homeTeam = lookupTeamByAbbr(league, homeAbbr);
  const scoreDiff =
    draft.away !== "" && draft.home !== "" ? Math.abs(Number(draft.away) - Number(draft.home)) : null;
  const otTbDisabled = scoreDiff !== null && scoreDiff > 1;

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
            {i18n.t("tp.pick.decided")}
          </Text>
        ) : postponed ? (
          <Text style={{ color: "#d97706", fontWeight: "900", fontSize: 12 }}>
            {i18n.t("tp.home.postponed", { defaultValue: "Reporté" })}
          </Text>
        ) : locked ? (
          <Text style={{ color: colors.subtext, fontWeight: "900", fontSize: 12 }}>
            {i18n.t("tp.pick.locked")}
          </Text>
        ) : saveState ? (
          <SaveStatusBadge state={saveState} colors={colors} />
        ) : null}
      </View>

      {decided ? (
        <>
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
            </View>

            <Text style={{ color: colors.subtext, fontWeight: "900", fontSize: 20 }}>-</Text>

            <View style={{ flex: 1, alignItems: "center", gap: 8 }}>
              <TeamLogoBadge team={homeTeam} size={40} colors={colors} />
              <Text style={{ color: colors.text, fontWeight: "900" }}>{homeAbbr}</Text>
              <Text style={{ color: colors.text, fontWeight: "900", fontSize: 28 }}>
                {slot?.officialResult?.homeScore ?? "—"}
              </Text>
            </View>
          </View>
        </>
      ) : (
        <>
      {postponed ? (
        <Text style={{ color: "#d97706", fontSize: 12, marginBottom: 8, fontWeight: "800" }}>
          {i18n.t("tp.pick.postponedHint", {
            defaultValue: "Match reporté — prédiction ouverte",
          })}
        </Text>
      ) : (
        <MatchLockInfo
          slot={slot}
          locked={locked}
          nowTick={nowTick}
          colors={colors}
        />
      )}

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
            onFocus={onScoreFocus}
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
            onFocus={onScoreFocus}
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
  const [saveStatus, setSaveStatus] = useState("idle");
  const [savingGameIds, setSavingGameIds] = useState([]);
  const [saveError, setSaveError] = useState(null);
  const [nowTick, setNowTick] = useState(Date.now());
  const saveTimerRef = useRef(null);
  const saveInFlightRef = useRef(false);
  const pendingAfterFlightRef = useRef(false);
  const scrollRef = useRef(null);

  const scrollToScoreInput = useCallback((inputRef) => {
    if (!inputRef || !scrollRef.current?.scrollToFocusedInput) return;

    requestAnimationFrame(() => {
      try {
        scrollRef.current.scrollToFocusedInput(inputRef, Platform.OS === "ios" ? 120 : 160);
      } catch {
        scrollRef.current?.scrollToEnd?.({ animated: true });
      }
    });
  }, []);

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

  const mlbScheduleTargets = useMemo(
    () =>
      isMlb
        ? games.map((slot) => ({
            gameYmd: bundle?.gameYmd,
            gameId: slot?.gameId,
          }))
        : [],
    [isMlb, games, bundle?.gameYmd]
  );

  const scheduleByGameId = useMlbScheduleGames(mlbScheduleTargets);

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
          const fromSaved = draftFromSavedPick(saved[gameId], isMlb);
          const current = next[gameId];
          const userIsEditing =
            current &&
            canSaveDraft(current, isMlb) &&
            !draftMatchesSaved(current, saved[gameId], isMlb);

          if (!userIsEditing) {
            next[gameId] = fromSaved;
          }
        } else if (!next[gameId]) {
          next[gameId] = emptyDraftPick();
        }
      }

      return next;
    });
  }, [games, entry?.picks, isMlb]);

  const showResults = useMemo(() => isBundleDecided(bundle), [bundle]);

  const isSlotEditable = useCallback(
    (slot) => {
      if (isSlotDecided(slot)) return false;
      const gameId = String(slot?.gameId || "");
      const scheduleInfo = scheduleByGameId[gameId] || null;
      const postponed = isMlb && isMlbGamePostponed(scheduleInfo?.status);
      if (postponed) return true;
      return !isSlotLocked(slot, nowTick, { scheduleStatus: scheduleInfo?.status });
    },
    [isMlb, nowTick, scheduleByGameId]
  );

  const buildDirtyPicksPayload = useCallback(() => {
    const payload = {};

    for (const slot of games) {
      const gameId = String(slot.gameId);
      if (!isSlotEditable(slot)) continue;

      const draft = draftByGameId[gameId] || emptyDraftPick();
      if (!canSaveDraft(draft, isMlb)) continue;

      const savedPick = entry?.picks?.[gameId];
      if (draftMatchesSaved(draft, savedPick, isMlb)) continue;

      payload[gameId] = pickPayloadFromDraft(draft, isMlb);
    }

    return payload;
  }, [games, draftByGameId, entry?.picks, isMlb, isSlotEditable]);

  const flushSave = useCallback(
    async (picksPayload) => {
      const gameIds = Object.keys(picksPayload || {});
      if (!gameIds.length || !bundleId) return;

      if (saveInFlightRef.current) {
        pendingAfterFlightRef.current = true;
        return;
      }

      saveInFlightRef.current = true;
      setSaveStatus("saving");
      setSavingGameIds(gameIds);
      setSaveError(null);

      try {
        const fn = functions().httpsCallable("submitTeamPredictionBundleEntry");
        await fn({
          bundleId: String(bundleId),
          picks: picksPayload,
        });
        setSaveStatus("saved");
      } catch (e) {
        setSaveStatus("error");
        setSaveError(String(e?.message || e));
      } finally {
        saveInFlightRef.current = false;
        setSavingGameIds([]);
        if (pendingAfterFlightRef.current) {
          pendingAfterFlightRef.current = false;
          const nextPayload = buildDirtyPicksPayload();
          if (Object.keys(nextPayload).length) {
            await flushSave(nextPayload);
          }
        }
      }
    },
    [bundleId, buildDirtyPicksPayload]
  );

  useEffect(() => {
    if (showResults || loading || !games.length) return undefined;

    const payload = buildDirtyPicksPayload();
    if (!Object.keys(payload).length) return undefined;

    saveTimerRef.current = setTimeout(() => {
      flushSave(buildDirtyPicksPayload());
    }, 600);

    return () => {
      clearTimeout(saveTimerRef.current);
    };
  }, [draftByGameId, entry?.picks, games, loading, showResults, buildDirtyPicksPayload, flushSave]);

  useEffect(
    () => () => {
      clearTimeout(saveTimerRef.current);
    },
    []
  );

  const progress = useMemo(() => {
    const editableGames = games.filter((slot) => isSlotEditable(slot));
    const total = editableGames.length;
    let saved = 0;

    for (const slot of editableGames) {
      const gameId = String(slot.gameId);
      const draft = draftByGameId[gameId] || emptyDraftPick();
      if (draftMatchesSaved(draft, entry?.picks?.[gameId], isMlb)) {
        saved += 1;
      }
    }

    const dirtyCount = Object.keys(buildDirtyPicksPayload()).length;
    const saving = saveStatus === "saving" || savingGameIds.length > 0;

    return { total, saved, dirtyCount, saving };
  }, [
    games,
    draftByGameId,
    entry?.picks,
    isMlb,
    isSlotEditable,
    buildDirtyPicksPayload,
    saveStatus,
    savingGameIds,
  ]);

  const handleRetrySave = useCallback(() => {
    flushSave(buildDirtyPicksPayload());
  }, [buildDirtyPicksPayload, flushSave]);

  const bottomBarMessage = useMemo(() => {
    if (saveStatus === "error") {
      return i18n.t("tp.pick.saveFailed");
    }
    if (progress.saving) {
      return i18n.t("tp.pick.savingAll");
    }
    if (progress.dirtyCount > 0) {
      return i18n.t("tp.pick.pendingSave");
    }
    if (progress.total > 0 && progress.saved === progress.total) {
      return i18n.t("tp.pick.allSaved");
    }
    return i18n.t("tp.pick.progressSaved", {
      saved: progress.saved,
      total: progress.total,
    });
  }, [saveStatus, progress]);

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
                        defaultValue: "Prédire l'issue du match",
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
            </View>

            {league === "MLB" && !showResults ? (
              <NovaCoachPanel
                key={`nova-tp-${bundleId}`}
                challengeId={String(bundleId)}
                domain="tp"
                sport="MLB"
                disabled={false}
              />
            ) : null}

            <KeyboardAwareScrollView
              ref={scrollRef}
              style={{ flex: 1 }}
              enableOnAndroid
              enableAutomaticScroll
              extraScrollHeight={Platform.OS === "ios" ? 120 : 160}
              extraHeight={Platform.OS === "ios" ? 120 : 160}
              keyboardOpeningTime={0}
              keyboardShouldPersistTaps="handled"
              enableResetScrollToCoords={false}
              contentContainerStyle={{
                paddingHorizontal: 14,
                paddingBottom: Math.max(insets.bottom, 20) + (showResults ? 12 : 120),
                gap: 12,
              }}
            >
              {games.map((slot) => {
                const gameId = String(slot.gameId);
                const draft = draftByGameId[gameId] || emptyDraftPick();
                const decided = isSlotDecided(slot);
                const editable = isSlotEditable(slot);
                const locked = !decided && !editable;
                const cardSaveState = getCardSaveState({
                  draft,
                  savedPick: entry?.picks?.[gameId],
                  isMlb,
                  locked,
                  decided,
                  saving: savingGameIds.includes(gameId),
                  hasError: saveStatus === "error",
                });

                return (
                  <BundleMatchPickSection
                    key={gameId}
                    slot={slot}
                    league={league}
                    draft={draft}
                    formatTeamLine={formatTeamLine}
                    nowTick={nowTick}
                    onChangeDraft={(nextDraft) =>
                      setDraftByGameId((prev) => ({ ...prev, [gameId]: nextDraft }))
                    }
                    saveState={cardSaveState}
                    colors={colors}
                    scheduleInfo={scheduleByGameId[gameId] || null}
                    onScoreFocus={scrollToScoreInput}
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
            </KeyboardAwareScrollView>

            {!showResults ? (
              <View
                style={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  bottom: 0,
                  paddingHorizontal: 14,
                  paddingTop: 10,
                  paddingBottom: Math.max(insets.bottom, 12),
                  borderTopWidth: 1,
                  borderTopColor: colors.border,
                  backgroundColor: colors.background,
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                  }}
                >
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={{ color: colors.text, fontWeight: "900", fontSize: 14 }}>
                      {bottomBarMessage}
                    </Text>
                    {saveStatus === "error" && saveError ? (
                      <Text style={{ color: RED, fontSize: 12, fontWeight: "700" }} numberOfLines={2}>
                        {saveError}
                      </Text>
                    ) : null}
                  </View>

                  {saveStatus === "error" ? (
                    <TouchableOpacity
                      onPress={handleRetrySave}
                      style={{
                        paddingHorizontal: 14,
                        paddingVertical: 10,
                        borderRadius: 12,
                        backgroundColor: RED,
                      }}
                    >
                      <Text style={{ color: "#fff", fontWeight: "900" }}>
                        {i18n.t("common.retry", { defaultValue: "Réessayer" })}
                      </Text>
                    </TouchableOpacity>
                  ) : progress.saving ? (
                    <ActivityIndicator color={RED} />
                  ) : progress.total > 0 && progress.saved === progress.total ? (
                    <Text style={{ color: "#16a34a", fontWeight: "900", fontSize: 18 }}>✓</Text>
                  ) : null}
                </View>
              </View>
            ) : null}
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
