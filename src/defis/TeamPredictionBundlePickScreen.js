// src/defis/TeamPredictionBundlePickScreen.js

import React, { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { snapshotExists, snapshotData, snapshotId } from "@src/lib/safeSnapshot";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  StyleSheet,
  Platform,
  Keyboard,
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
import { fmtTimeShort, getSlotLockedAt, isSlotLocked } from "@src/defis/tpDeadlineHelpers";
import {
  isBundleDecided,
  isSlotDecided,
} from "@src/defis/tpBundleDisplayHelpers";
import { isMlbGamePostponed } from "@src/mlb/mlbGameStatusUtils";
import useMlbScheduleGames from "@src/mlb/useMlbScheduleGames";
import NovaCoachMatchModal from "@src/nova/NovaCoachMatchModal";

const RED = "#b91c1c";

const TP_STATS_EMPTY = "—";
const TP_PICK_COL_INSET = 10;
const TP_PICK_COL_LABEL = { flex: 1.15, minWidth: 0 };
const TP_PICK_COL_TEAM = { flex: 1, minWidth: 0, alignItems: "center", justifyContent: "center" };

function tpStatsCell(value) {
  return value != null && String(value).trim() !== "" ? String(value) : TP_STATS_EMPTY;
}

/** Grille 3 colonnes identique : libellé | visiteur | local. */
function TpPickAlignedRow({ label = null, away, home, colors, style, alignItems = "center" }) {
  const labelNode =
    label == null || label === "" ? null : typeof label === "string" ? (
      <Text
        style={{
          color: colors.subtext,
          fontSize: 10,
          fontWeight: "700",
          lineHeight: 13,
        }}
        numberOfLines={2}
      >
        {label}
      </Text>
    ) : (
      label
    );

  return (
    <View
      style={[
        {
          flexDirection: "row",
          alignItems,
          alignSelf: "stretch",
          gap: 4,
          paddingHorizontal: TP_PICK_COL_INSET,
        },
        style,
      ]}
    >
      <View style={{ ...TP_PICK_COL_LABEL, justifyContent: "center" }}>{labelNode}</View>
      <View style={TP_PICK_COL_TEAM}>{away}</View>
      <View style={TP_PICK_COL_TEAM}>{home}</View>
    </View>
  );
}

function TpPickStatValue({ children, colors }) {
  return (
    <Text
      style={{
        alignSelf: "stretch",
        width: "100%",
        color: colors.text,
        fontSize: 12,
        fontWeight: "900",
        fontVariant: ["tabular-nums"],
        textAlign: "center",
      }}
    >
      {children}
    </Text>
  );
}

function tpFormHasStats(form) {
  if (!form) return false;
  return !!(
    form.recordWlt ||
    form.splitWlt ||
    form.lastTenWlt ||
    form.goalsForPerGame ||
    form.goalsAgainstPerGame
  );
}

function TpMatchStatsGrid({ awayForm, homeForm, league, colors }) {
  if (!tpFormHasStats(awayForm) && !tpFormHasStats(homeForm)) return null;

  const isMlb = String(league || "").toUpperCase() === "MLB";

  const rows = [
    {
      key: "record",
      label: i18n.t("tp.pick.teamFormRecord", { defaultValue: "Fiche" }),
      away: tpStatsCell(awayForm?.recordWlt),
      home: tpStatsCell(homeForm?.recordWlt),
    },
    {
      key: "awaySplit",
      label: i18n.t("tp.pick.teamFormAway", { defaultValue: "Extérieur" }),
      away: tpStatsCell(awayForm?.splitWlt),
      home: TP_STATS_EMPTY,
    },
    {
      key: "homeSplit",
      label: i18n.t("tp.pick.teamFormHome", { defaultValue: "Domicile" }),
      away: TP_STATS_EMPTY,
      home: tpStatsCell(homeForm?.splitWlt),
    },
    {
      key: "l10",
      label: i18n.t("tp.pick.teamFormLastTen", { defaultValue: "10 derniers" }),
      away: tpStatsCell(awayForm?.lastTenWlt),
      home: tpStatsCell(homeForm?.lastTenWlt),
    },
    {
      key: "gf",
      label: isMlb
        ? i18n.t("tp.pick.teamFormRunsFor", { defaultValue: "Marques / match" })
        : i18n.t("tp.pick.teamFormGoalsFor", { defaultValue: "BP / Match" }),
      away: tpStatsCell(awayForm?.goalsForPerGame),
      home: tpStatsCell(homeForm?.goalsForPerGame),
    },
    {
      key: "ga",
      label: isMlb
        ? i18n.t("tp.pick.teamFormRunsAgainst", { defaultValue: "Encaissées / match" })
        : i18n.t("tp.pick.teamFormGoalsAgainst", { defaultValue: "BC / Match" }),
      away: tpStatsCell(awayForm?.goalsAgainstPerGame),
      home: tpStatsCell(homeForm?.goalsAgainstPerGame),
    },
  ];

  return (
    <View
      style={{
        alignSelf: "stretch",
        width: "100%",
        marginTop: 6,
        marginBottom: 8,
      }}
    >
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 0,
          bottom: 0,
          borderRadius: 12,
          backgroundColor: colors.card2,
          borderWidth: 1,
          borderColor: colors.border,
        }}
      />
      <View style={{ paddingVertical: 10, gap: 6 }}>
        <View
          style={{
            height: 1,
            backgroundColor: colors.border,
            marginHorizontal: TP_PICK_COL_INSET,
            marginBottom: 2,
          }}
        />
        {rows.map((row) => (
          <TpPickAlignedRow
            key={row.key}
            label={row.label}
            colors={colors}
            away={<TpPickStatValue colors={colors}>{row.away}</TpPickStatValue>}
            home={<TpPickStatValue colors={colors}>{row.home}</TpPickStatValue>}
          />
        ))}
      </View>
    </View>
  );
}

/** Logos, stats et scores partagent exactement la même grille. */
function TpMatchPickTeamGrid({
  colors,
  awayTeam,
  homeTeam,
  awayAbbr,
  homeAbbr,
  awayForm,
  homeForm,
  league,
  isMlb,
  awayPitcher,
  homePitcher,
  draft,
  locked,
  awayInputRef,
  homeInputRef,
  fieldKeyAway,
  fieldKeyHome,
  focusedFieldKey,
  onChangeDraft,
  onScoreFocus,
  onAdvanceFromAway,
  onAdvanceFromHome,
}) {
  return (
    <View style={{ alignSelf: "stretch", width: "100%" }}>
      <TpPickAlignedRow
        colors={colors}
        style={{ marginTop: 4, marginBottom: 2 }}
        away={
          <View style={{ alignItems: "center", gap: 4 }}>
            <TeamLogoBadge team={awayTeam} size={40} colors={colors} />
            <Text style={{ color: colors.text, fontWeight: "900", fontSize: 13 }}>{awayAbbr}</Text>
          </View>
        }
        home={
          <View style={{ alignItems: "center", gap: 4 }}>
            <TeamLogoBadge team={homeTeam} size={40} colors={colors} />
            <Text style={{ color: colors.text, fontWeight: "900", fontSize: 13 }}>{homeAbbr}</Text>
          </View>
        }
      />

      <TpMatchStatsGrid awayForm={awayForm} homeForm={homeForm} league={league} colors={colors} />

      {isMlb ? (
        <TpPickAlignedRow
          colors={colors}
          alignItems="flex-start"
          style={{ marginBottom: 8 }}
          away={<PitcherBlock pitcher={awayPitcher} colors={colors} />}
          home={<PitcherBlock pitcher={homePitcher} colors={colors} />}
        />
      ) : null}

      <TpPickAlignedRow
        colors={colors}
        style={{ marginTop: 2, marginBottom: 4 }}
        away={
          <ScoreInputBox
            inputRef={awayInputRef}
            value={draft.away}
            onChangeText={(txt) => onChangeDraft({ ...draft, away: txt })}
            editable={!locked}
            colors={colors}
            isFocused={focusedFieldKey === fieldKeyAway}
            onFocus={() => onScoreFocus?.(awayInputRef?.current, fieldKeyAway)}
            onAdvance={onAdvanceFromAway}
          />
        }
        home={
          <ScoreInputBox
            inputRef={homeInputRef}
            value={draft.home}
            onChangeText={(txt) => onChangeDraft({ ...draft, home: txt })}
            editable={!locked}
            colors={colors}
            isFocused={focusedFieldKey === fieldKeyHome}
            onFocus={() => onScoreFocus?.(homeInputRef?.current, fieldKeyHome)}
            onAdvance={onAdvanceFromHome}
          />
        }
      />
    </View>
  );
}

function ScoreInputBox({
  inputRef,
  value,
  onChangeText,
  editable,
  colors,
  onFocus,
  isFocused = false,
  onAdvance,
}) {
  const active = editable;

  return (
    <View
      style={[
        styles.scoreInputBox,
        {
          borderColor: isFocused
            ? RED
            : active
            ? "rgba(239,68,68,0.55)"
            : colors.border,
          backgroundColor: colors.background,
        },
      ]}
    >
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={(txt) => {
          const prevLen = String(value || "").length;
          const normalized = normalizeScoreInput(txt);
          onChangeText(normalized);
          if (!editable || !onAdvance) return;
          if ((prevLen === 0 && normalized.length >= 1) || normalized.length >= 2) {
            setTimeout(() => onAdvance(), 0);
          }
        }}
        onFocus={onFocus}
        editable={editable}
        keyboardType="number-pad"
        maxLength={2}
        style={[
          styles.scoreInput,
          {
            color: colors.text,
            borderColor: isFocused ? RED : colors.border,
            backgroundColor: colors.card2,
          },
        ]}
        placeholder="0"
        placeholderTextColor={colors.subtext}
      />
    </View>
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
  return { away: "", home: "" };
}

function draftFromSavedPick(pick) {
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
  };
}

function canSaveDraft(draft) {
  if (!draft || typeof draft !== "object") return false;
  if (draft.away === "" || draft.home === "") return false;
  if (Number(draft.away) === Number(draft.home)) return false;
  return true;
}

function draftMatchesSaved(draft, savedPick) {
  if (!draft || !savedPick || !canSaveDraft(draft)) return false;
  if (Number(draft.away) !== Number(savedPick.predictedAwayScore)) return false;
  if (Number(draft.home) !== Number(savedPick.predictedHomeScore)) return false;
  return true;
}

function pickPayloadFromDraft(draft) {
  return {
    predictedAwayScore: Number(draft.away),
    predictedHomeScore: Number(draft.home),
    predictedOutcome: "FINAL",
  };
}

function getCardSaveState({ draft, savedPick, isMlb, locked, decided, saving, hasError }) {
  if (decided) return null;
  if (saving) return "saving";
  if (hasError && canSaveDraft(draft) && !draftMatchesSaved(draft, savedPick)) {
    return "error";
  }
  if (locked) {
    return savedPick ? "saved" : "incomplete";
  }
  if (!canSaveDraft(draft)) return "incomplete";
  if (draftMatchesSaved(draft, savedPick)) return "saved";
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

  return (
    <Text style={{ color: colors.subtext, fontSize: 12, marginBottom: 8 }}>
      {i18n.t("tp.pick.lockAt", {
        defaultValue: "Verrouillage : {{time}}",
        time: lockHM || "—",
      })}
    </Text>
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
  formatTeamSplitLine,
  getTeamForm,
  nowTick,
  scheduleInfo = null,
  onScoreFocus = null,
  focusedFieldKey = null,
  fieldKeyAway = "",
  fieldKeyHome = "",
  awayInputRef = null,
  homeInputRef = null,
  onAdvanceFromAway = null,
  onAdvanceFromHome = null,
  showNovaButton = false,
  onNovaPress = null,
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
      <TpMatchPickTeamGrid
        colors={colors}
        awayTeam={awayTeam}
        homeTeam={homeTeam}
        awayAbbr={awayAbbr}
        homeAbbr={homeAbbr}
        awayForm={getTeamForm?.(gameId, "away", awayAbbr)}
        homeForm={getTeamForm?.(gameId, "home", homeAbbr)}
        league={league}
        isMlb={isMlb}
        awayPitcher={slot?.awayProbablePitcher}
        homePitcher={slot?.homeProbablePitcher}
        draft={draft}
        locked={locked}
        awayInputRef={awayInputRef}
        homeInputRef={homeInputRef}
        fieldKeyAway={fieldKeyAway}
        fieldKeyHome={fieldKeyHome}
        focusedFieldKey={focusedFieldKey}
        onChangeDraft={onChangeDraft}
        onScoreFocus={onScoreFocus}
        onAdvanceFromAway={onAdvanceFromAway}
        onAdvanceFromHome={onAdvanceFromHome}
      />

      {draft.away !== "" && draft.home !== "" && Number(draft.away) === Number(draft.home) ? (
        <Text style={{ color: RED, fontWeight: "800", marginTop: 8 }}>
          {i18n.t("tp.pick.tieNotAllowed", {
            defaultValue: "Le score ne peut pas être égal.",
          })}
        </Text>
      ) : null}

      {showNovaButton && !decided ? (
        <TouchableOpacity
          onPress={() => onNovaPress?.(slot)}
          disabled={locked}
          activeOpacity={0.85}
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            marginTop: 12,
            paddingVertical: 9,
            paddingHorizontal: 12,
            borderTopWidth: 1,
            borderTopColor: colors.border,
            backgroundColor: colors.card,
          }}
        >
          <Ionicons name="sparkles-outline" size={15} color={colors.primary} />
          <Text style={{ color: colors.primary, fontWeight: "800", fontSize: 12 }}>
            {i18n.t("novaCoach.matchAdviceButton", { defaultValue: "Avis de Nova" })}
          </Text>
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
  const [saveStatus, setSaveStatus] = useState("idle");
  const [savingGameIds, setSavingGameIds] = useState([]);
  const [saveError, setSaveError] = useState(null);
  const [nowTick, setNowTick] = useState(Date.now());
  const [novaMatch, setNovaMatch] = useState(null);
  const saveTimerRef = useRef(null);
  const saveInFlightRef = useRef(false);
  const pendingAfterFlightRef = useRef(false);
  const scrollRef = useRef(null);
  const scoreInputRefs = useRef({});
  const initialFocusDoneRef = useRef(false);
  const [focusedScoreKey, setFocusedScoreKey] = useState(null);

  const getScoreInputRef = useCallback((key) => {
    if (!scoreInputRefs.current[key]) {
      scoreInputRefs.current[key] = React.createRef();
    }
    return scoreInputRefs.current[key];
  }, []);

  const focusScoreField = useCallback((key) => {
    const ref = scoreInputRefs.current[key];
    if (!ref?.current) return;
    ref.current.focus();
    setFocusedScoreKey(key);
    requestAnimationFrame(() => {
      try {
        scrollRef.current?.scrollToFocusedInput?.(
          ref.current,
          Platform.OS === "ios" ? 120 : 160
        );
      } catch {
        scrollRef.current?.scrollToEnd?.({ animated: true });
      }
    });
  }, []);

  const scrollToScoreInput = useCallback((inputRef, fieldKey) => {
    if (fieldKey) setFocusedScoreKey(fieldKey);

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
  const {
    formatLine: formatTeamLine,
    formatSplitLine: formatTeamSplitLine,
    getTeamForm,
  } = useTpBundleTeamRecords({ bundle, games, league });

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
        setBundle(snapshotExists(snap) ? { id: snapshotId(snap), ...snapshotData(snap) } : null);
        setLoading(false);
      },
      () => {
        if (!cancelled) setLoading(false);
      }
    );

    const unsubEntry = entryRef.onSnapshot(
      (snap) => {
        if (cancelled) return;
        setEntry(snapshotExists(snap) ? snapshotData(snap) || null : null);
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
    setDraftByGameId({});
    setEntry(null);
    setBundle(null);
    setLoading(true);
    setSaveStatus("idle");
    setSaveError(null);
  }, [bundleId]);

  useEffect(() => {
    if (!games.length) {
      setDraftByGameId({});
      return;
    }

    const saved = entry?.picks || {};

    setDraftByGameId((prev) => {
      const next = {};

      for (const slot of games) {
        const gameId = String(slot.gameId);
        if (saved[gameId]) {
          const fromSaved = draftFromSavedPick(saved[gameId]);
          const current = prev[gameId];
          const userIsEditing =
            current &&
            canSaveDraft(current) &&
            !draftMatchesSaved(current, saved[gameId]);

          next[gameId] = userIsEditing ? current : fromSaved;
        } else {
          next[gameId] = prev[gameId] || emptyDraftPick();
        }
      }

      return next;
    });
  }, [bundleId, games, entry?.picks, isMlb]);

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

  useEffect(() => {
    initialFocusDoneRef.current = false;
  }, [bundleId]);

  useEffect(() => {
    if (initialFocusDoneRef.current || loading || showResults || !games.length) return undefined;

    const firstEditable = games.find((slot) => isSlotEditable(slot));
    if (!firstEditable?.gameId) return undefined;

    const awayKey = `${String(firstEditable.gameId)}:away`;
    getScoreInputRef(awayKey);

    const timer = setTimeout(() => {
      focusScoreField(awayKey);
      initialFocusDoneRef.current = true;
    }, 400);

    return () => clearTimeout(timer);
  }, [loading, showResults, games, isSlotEditable, getScoreInputRef, focusScoreField, bundleId]);

  const buildDirtyPicksPayload = useCallback(() => {
    const payload = {};

    for (const slot of games) {
      const gameId = String(slot.gameId);
      if (!isSlotEditable(slot)) continue;

      const draft = draftByGameId[gameId] || emptyDraftPick();
      if (!canSaveDraft(draft)) continue;

      const savedPick = entry?.picks?.[gameId];
      if (draftMatchesSaved(draft, savedPick)) continue;

      payload[gameId] = pickPayloadFromDraft(draft);
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
      if (draftMatchesSaved(draft, entry?.picks?.[gameId])) {
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
              {games.map((slot, gameIndex) => {
                const gameId = String(slot.gameId);
                const awayKey = `${gameId}:away`;
                const homeKey = `${gameId}:home`;
                const nextGame = games[gameIndex + 1];
                const nextAwayKey = nextGame ? `${String(nextGame.gameId)}:away` : null;
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
                    formatTeamSplitLine={formatTeamSplitLine}
                    getTeamForm={getTeamForm}
                    nowTick={nowTick}
                    onChangeDraft={(nextDraft) =>
                      setDraftByGameId((prev) => ({ ...prev, [gameId]: nextDraft }))
                    }
                    saveState={cardSaveState}
                    colors={colors}
                    scheduleInfo={scheduleByGameId[gameId] || null}
                    onScoreFocus={scrollToScoreInput}
                    focusedFieldKey={focusedScoreKey}
                    fieldKeyAway={awayKey}
                    fieldKeyHome={homeKey}
                    awayInputRef={getScoreInputRef(awayKey)}
                    homeInputRef={getScoreInputRef(homeKey)}
                    onAdvanceFromAway={() => focusScoreField(homeKey)}
                    onAdvanceFromHome={() => {
                      if (nextAwayKey) focusScoreField(nextAwayKey);
                      else Keyboard.dismiss();
                    }}
                    showNovaButton={isMlb && !showResults}
                    onNovaPress={setNovaMatch}
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
                    defaultValue: "5 pts pour la bonne équipe, +5 pts pour le score exact (10 max).",
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

            <NovaCoachMatchModal
              visible={!!novaMatch}
              onClose={() => setNovaMatch(null)}
              challengeId={String(bundleId)}
              gameId={novaMatch?.gameId}
              slot={novaMatch?.slot}
              homeAbbr={novaMatch?.homeAbbr}
              awayAbbr={novaMatch?.awayAbbr}
              sport="MLB"
              domain="tp"
            />
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
