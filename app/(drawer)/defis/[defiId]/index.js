// app/defis/[defiId]/index.js
// Écran de participation à un défi NHL (RNFirebase)

import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  Alert,
  Image,
} from "react-native";

import { DrawerToggleButton } from "@react-navigation/drawer";
import { HeaderBackButton } from "@react-navigation/elements";
import { useLocalSearchParams, Stack, useRouter } from "expo-router";

import firestore from "@react-native-firebase/firestore";
import isEqual from "lodash.isequal";

import { joinDefi } from "@src/defis/api";
import { useAuth } from "@src/auth/SafeAuthProvider";
import { useTheme } from "@src/theme/ThemeProvider";
import i18n from "@src/i18n/i18n";

import useEntitlement from "../../subscriptions/useEntitlement";
import { getDefiRules, validatePicks } from "@src/defis/tiersRules";

import PlayerSelectModal from "./components/PlayerSelectModal";
import PlayerPickerRow from "./components/PlayerPickerRow";
import MatchupRow from "./components/MatchupRow";
import DefiHeroCard from "./components/DefiHeroCard";
import SectionCard from "./components/SectionCard";

import {
  toYMD,
  ymdCompact,
  fmtTSLocalHM,
  isPast,
  ymdTorontoFromUTC,
  fmtStartLocalHMFromUTCString,
} from "./utils/defiFormatters";

/* ---------------- Logos NHL (local) ---------------- */
const LOGO_MAP = {
  ANA: require("../../../../assets/nhl-logos/ANA.png"),
  ARI: require("../../../../assets/nhl-logos/ARI.png"),
  BOS: require("../../../../assets/nhl-logos/BOS.png"),
  BUF: require("../../../../assets/nhl-logos/BUF.png"),
  CAR: require("../../../../assets/nhl-logos/CAR.png"),
  CBJ: require("../../../../assets/nhl-logos/CBJ.png"),
  CGY: require("../../../../assets/nhl-logos/CGY.png"),
  CHI: require("../../../../assets/nhl-logos/CHI.png"),
  COL: require("../../../../assets/nhl-logos/COL.png"),
  DAL: require("../../../../assets/nhl-logos/DAL.png"),
  DET: require("../../../../assets/nhl-logos/DET.png"),
  EDM: require("../../../../assets/nhl-logos/EDM.png"),
  FLA: require("../../../../assets/nhl-logos/FLA.png"),
  LAK: require("../../../../assets/nhl-logos/LAK.png"),
  MIN: require("../../../../assets/nhl-logos/MIN.png"),
  MTL: require("../../../../assets/nhl-logos/MTL.png"),
  NJD: require("../../../../assets/nhl-logos/NJD.png"),
  NSH: require("../../../../assets/nhl-logos/NSH.png"),
  NYI: require("../../../../assets/nhl-logos/NYI.png"),
  NYR: require("../../../../assets/nhl-logos/NYR.png"),
  OTT: require("../../../../assets/nhl-logos/OTT.png"),
  PHI: require("../../../../assets/nhl-logos/PHI.png"),
  PIT: require("../../../../assets/nhl-logos/PIT.png"),
  SEA: require("../../../../assets/nhl-logos/SEA.png"),
  SJS: require("../../../../assets/nhl-logos/SJS.png"),
  STL: require("../../../../assets/nhl-logos/STL.png"),
  TBL: require("../../../../assets/nhl-logos/TBL.png"),
  TOR: require("../../../../assets/nhl-logos/TOR.png"),
  UTA: require("../../../../assets/nhl-logos/UTA.png"),
  VAN: require("../../../../assets/nhl-logos/VAN.png"),
  VGK: require("../../../../assets/nhl-logos/VGK.png"),
  WPG: require("../../../../assets/nhl-logos/WPG.png"),
  WSH: require("../../../../assets/nhl-logos/WSH.png"),
};

function teamLogo(abbr) {
  return LOGO_MAP[String(abbr || "").toUpperCase()];
}

function headshotUrl(abbr, playerId) {
  return abbr && playerId
    ? `https://assets.nhle.com/mugs/nhl/20252026/${String(abbr).toUpperCase()}/${playerId}.png`
    : null;
}

function getPickPrefix() {
  const lang = String(i18n.locale || "").toLowerCase();
  return lang.startsWith("fr") ? "T" : "T";
}

function fmtTierRequirements(rules) {
  const prefix = getPickPrefix();
  const parts = [
    rules?.T1 ? `${rules.T1} ${prefix}1` : null,
    rules?.T2 ? `${rules.T2} ${prefix}2` : null,
    rules?.T3 ? `${rules.T3} ${prefix}3` : null,
  ].filter(Boolean);
  return parts.join(", ");
}

function LoadingOverlay({ visible, text }) {
  const { colors } = useTheme();
  if (!visible) return null;

  return (
    <View
      pointerEvents="auto"
      style={{
        position: "absolute",
        inset: 0,
        backgroundColor: "rgba(0,0,0,0.35)",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 999,
      }}
    >
      <View
        style={{
          paddingVertical: 16,
          paddingHorizontal: 18,
          borderRadius: 12,
          backgroundColor: colors.card,
          minWidth: 220,
          alignItems: "center",
          gap: 10,
          borderWidth: 1,
          borderColor: colors.border,
        }}
      >
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={{ fontSize: 15, fontWeight: "600", color: colors.text }}>
          {text || i18n.t("defi.loading.generic")}
        </Text>
        <Text style={{ fontSize: 12, color: colors.subtext, textAlign: "center" }}>
          {i18n.t("defi.loading.overlayHint")}
        </Text>
      </View>
    </View>
  );
}

function groupMatchupsByLocalTime(matchups = []) {
  const groups = new Map();

  for (const g of matchups) {
    const t = fmtStartLocalHMFromUTCString(g.startTimeUTC) || "—";
    if (!groups.has(t)) groups.set(t, []);
    groups.get(t).push(g);
  }

  // retourne [{ time, games }]
  return Array.from(groups.entries())
    .map(([time, games]) => ({ time, games }))
    .sort((a, b) => String(a.time).localeCompare(String(b.time)));
}

function tierKeyOfPlayer(p) {
  return String(p?.tier || "").toUpperCase(); // "T1" | "T2" | "T3"
}

// ✅ Ne bloque pas tant qu'il manque des picks.
// Bloque seulement si on dépasse une limite de tier.
function validatePicksPartial(chosen = [], rules, i18n) {
  if (!rules) return null;

  const maxT1 = Number(rules?.T1 ?? 0);
  const maxT2 = Number(rules?.T2 ?? 0);
  const maxT3 = Number(rules?.T3 ?? 0);

  const counts = { T1: 0, T2: 0, T3: 0 };
  for (const p of chosen) {
    const k = tierKeyOfPlayer(p);
    if (k === "T1" || k === "T2" || k === "T3") counts[k]++;
  }

  if (maxT1 && counts.T1 > maxT1) {
    return i18n.t("defi.rules.tierTooMany", {
      defaultValue: "Trop de choix {{tierLabel}} (max {{max}}).",
      tierLabel: "T1",
      max: maxT1,
    });
  }
  if (maxT2 && counts.T2 > maxT2) {
    return i18n.t("defi.rules.tierTooMany", {
      defaultValue: "Trop de choix {{tierLabel}} (max {{max}}).",
      tier: "T2",
      max: maxT2,
    });
  }
  if (maxT3 && counts.T3 > maxT3) {
    return i18n.t("defi.rules.tierTooMany", {
      defaultValue: "Trop de choix {{tierLabel}} (max {{max}}).",
      tier: "T3",
      max: maxT3,
    });
  }

  return null;
}
function tierForSlotIndex(slotIndex, defiType) {
  const rules = getDefiRules(defiType);

  const t1 = Number(rules?.T1 ?? 0);
  const t2 = Number(rules?.T2 ?? 0);
  const t3 = Number(rules?.T3 ?? 0);

  if (slotIndex < t1) return "T1";
  if (slotIndex < t1 + t2) return "T2";
  if (slotIndex < t1 + t2 + t3) return "T3";

  return "T3";
}

export default function DefiParticipationScreen() {
  const { defiId } = useLocalSearchParams();
  const { user } = useAuth();
  const router = useRouter();
  const { colors } = useTheme();

  const [defi, setDefi] = useState(null);
  const [error, setError] = useState(null);
  const [loadingDefi, setLoadingDefi] = useState(true);

  // Matchups enrichis (Firestore)
  const [matchups, setMatchups] = useState([]);

  // playerPool figé
  const [players, setPlayers] = useState([]);

  const [selected, setSelected] = useState([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerIndex, setPickerIndex] = useState(0);
  const [pickerTier, setPickerTier] = useState(null); // ✅ "T1" | "T2" | "T3" | null

  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  const savedPicksRef = useRef(null);
  const [hasSavedOnce, setHasSavedOnce] = useState(false);

  const { tier: userTier, active: tierActive } = useEntitlement(user?.uid);

  const tierLower = useMemo(() => {
    const t = String(userTier || "free").toLowerCase();
    return tierActive ? t : "free";
  }, [userTier, tierActive]);

  // ✅ flags abonnement (pour CTA upgrade)
  const tier = String(tierLower || "free").toLowerCase();
  const isFree = tier === "free";

  // Charger défi
  useEffect(() => {
    if (!defiId) return;
    setLoadingDefi(true);

    const ref = firestore().doc(`defis/${String(defiId)}`);
    let lastDefi = null;

    const unsub = ref.onSnapshot(
      (snap) => {
        const next = snap.exists ? { id: snap.id, ...snap.data() } : null;
        if (!isEqual(next, lastDefi)) {
          lastDefi = next;
          setDefi(next);
        }
        setLoadingDefi(false);
      },
      (e) => {
        setError(e);
        setLoadingDefi(false);
      }
    );

    return () => unsub();
  }, [defiId]);

  const maxChoices = useMemo(() => {
    const t = Number(defi?.type || 0);
    return Number.isFinite(t) && t > 0 ? t : 1;
  }, [defi?.type]);

  const rules = useMemo(() => getDefiRules(defi?.type), [defi?.type]);

  const requirementsText = useMemo(() => (rules ? fmtTierRequirements(rules) : null), [rules]);

  useEffect(() => {
    setSelected((prev) => Array.from({ length: maxChoices }, (_, i) => prev?.[i] ?? null));
  }, [maxChoices]);

  useEffect(() => {
  if (!gameYMD) return;
  const yyyymmdd = ymdCompact(gameYMD);
  console.log("[matchups] gameYMD=", gameYMD, "yyyymmdd=", yyyymmdd);
  
}, [gameYMD]);

  // Participation existante
  useEffect(() => {
    (async () => {
      if (!defi?.id || !user?.uid) return;
      try {
        const ref = firestore().doc(`defis/${String(defi.id)}/participations/${user.uid}`);
        const snap = await ref.get();

        if (snap.exists) {
          const p = snap.data() || {};
          const picks = Array.isArray(p.picks) ? p.picks : [];

          setHasSavedOnce(picks.length > 0);
          savedPicksRef.current = picks.map((x) => ({ playerId: String(x?.playerId ?? "") }));

          setSelected((prev) =>
            Array.from({ length: maxChoices }, (_, i) => {
              const x = picks[i];
              return x ? { playerId: x.playerId, fullName: x.fullName, teamAbbr: x.teamAbbr } : prev?.[i] ?? null;
            })
          );
        } else {
          setHasSavedOnce(false);
          savedPicksRef.current = null;
        }
      } catch (e) {
        setError(e);
      }
    })();
  }, [defi?.id, user?.uid, maxChoices]);

  const gameYMD = useMemo(() => toYMD(defi?.gameDate), [defi?.gameDate]);

  // Matchups (Firestore daily)
  useEffect(() => {
    if (!gameYMD) return;

    const yyyymmdd = ymdCompact(gameYMD);
  

    const unsub = firestore()
      .collection(`nhl_matchups_daily/${yyyymmdd}/games`)
      .onSnapshot(
        (snap) => {
          const list = [];
          snap.forEach((d) => list.push({ id: d.id, ...d.data() }));

          // ✅ Filtre: garder seulement les matchs de la journée du défi (Toronto)
          const filtered = list.filter((g) => g.startYmdToronto === gameYMD);

          filtered.sort((a, b) => String(a.startTimeUTC || "").localeCompare(String(b.startTimeUTC || "")));

          setMatchups((prev) => (isEqual(prev, filtered) ? prev : filtered));
        },
        (e) => setError(e)
      );

    return () => unsub();
  }, [gameYMD]);

  const matchupGroups = useMemo(() => groupMatchupsByLocalTime(matchups), [matchups]);

  const rangePct = useMemo(() => {
    const vals = (matchups || [])
      .flatMap((g) => [g?.context?.awayCoeff, g?.context?.homeCoeff])
      .map((c) => Math.abs(((Number(c) || 1) - 1) * 100))
      .filter((x) => Number.isFinite(x));

    const maxAbs = vals.length ? Math.max(...vals) : 6;

    // clamp 4..10 (ajuste si tu veux)
    const clamped = Math.max(4, Math.min(10, maxAbs));

    // arrondi au 0.5 pour stabilité visuelle
    return Math.round(clamped * 2) / 2;
  }, [matchups]);

  // playerPool
  useEffect(() => {
    if (!defi?.id) return;

    const unsub = firestore()
      .collection(`defis/${defi.id}/playerPool`)
      .orderBy("rank")
      .onSnapshot(
        (snap) => {
          const list = [];
          snap.forEach((d) => list.push(d.data()));
          setPlayers((prev) => (isEqual(prev, list) ? prev : list));
        },
        (e) => setError(e)
      );

    return () => unsub();
  }, [defi?.id]);

  const playersSorted = useMemo(() => {
    const arr = Array.isArray(players) ? players.slice() : [];
    arr.sort((a, b) => Number(a.rank ?? 999999) - Number(b.rank ?? 999999));
    return arr;
  }, [players]);

  const playerById = useMemo(() => {
    const m = {};
    for (const p of playersSorted) if (p?.playerId) m[String(p.playerId)] = p;
    return m;
  }, [playersSorted]);

  // hydrate picks depuis playerPool
  const selectedHydrated = useMemo(() => {
    return (selected || []).map((p) => (!p?.playerId ? p : playerById[String(p.playerId)] || p));
  }, [selected, playerById]);

  // ids déjà choisis
  const alreadyChosenIds = useMemo(
    () => (selected || []).filter(Boolean).map((p) => String(p.playerId)),
    [selected]
  );

  // resync selected -> hydrated
  useEffect(() => {
    if (!selected?.length) return;
    if (!playerById || Object.keys(playerById).length === 0) return;

    setSelected((prev) =>
      (prev || []).map((pl) => {
        if (!pl?.playerId) return pl;
        return playerById[String(pl.playerId)] || pl;
      })
    );
  }, [playerById]);

  const locked = useMemo(() => {
    if (!defi) return true;
    const statusKey = String(defi.status || "").toLowerCase();
    if (statusKey !== "open") return true;
    if (!defi.signupDeadline) return false;
    return isPast(defi.signupDeadline);
  }, [defi]);

  const headerTitle = useMemo(() => {
    return (
      defi?.title ||
      (defi?.type ? `${i18n.t("home.challenge")} ${defi.type}x${defi.type}` : i18n.t("defi.header.defaultTitle"))
    );
  }, [defi]);

  const openPicker = useCallback(
  (index) => {
    const forcedTier = tierForSlotIndex(index, defi?.type);
    setPickerIndex(index);
    setPickerTier(forcedTier);
    setPickerOpen(true);
    Keyboard.dismiss();
  },
  [defi?.type]
  );

  const handlePick = useCallback(
    (p) => {
      const rulesNow = getDefiRules(defi?.type);

      setSelected((prev) => {
        const alreadyUsed = prev.some((pl, idx) => pl?.playerId === p.playerId && idx !== pickerIndex);
        if (alreadyUsed) {
          Alert.alert(
            i18n.t("defi.alerts.playerDuplicateTitle"),
            i18n.t("defi.alerts.playerDuplicateMessage", { name: p.fullName }),
            [{ text: i18n.t("common.ok") }]
          );
          return prev;
        }

        const next = [...prev];
        next[pickerIndex] = p;

        const chosenHydrated = next.filter(Boolean).map((pl) => playerById[String(pl.playerId)] || pl);
        const err = validatePicksPartial(chosenHydrated, rulesNow, i18n);
        if (err) {
          Alert.alert(i18n.t("defi.rules.title", { defaultValue: "Règles de tiers" }), err, [{ text: i18n.t("common.ok") }]);
          return prev;
        }

        return next;
      });
    },
    [pickerIndex, defi?.type, playerById]
  );

  const allChosen = useMemo(() => selected.filter(Boolean).length === maxChoices, [selected, maxChoices]);

  function normalizeCurrentPickIds(selectedArr) {
    return (selectedArr || []).map((p) => String(p?.playerId ?? ""));
  }
  function sameIds(a = [], b = []) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (String(a[i]) !== String(b[i])) return false;
    return true;
  }
  function toCallablePicks(selectedArr) {
    return (selectedArr || [])
      .filter(Boolean)
      .map((p) => ({
        playerId: String(p.playerId ?? ""),
        fullName: String(p.fullName ?? ""),
        teamAbbr: String(p.teamAbbr ?? "").toUpperCase(),
      }));
  }

  const save = useCallback(async () => {
    if (!user?.uid || !defi?.id) return;

    if (locked) {
      Alert.alert(i18n.t("defi.alerts.lockedTitle"), i18n.t("defi.alerts.lockedMessage"));
      return;
    }
    if (!allChosen) {
      Alert.alert(i18n.t("defi.alerts.incompleteTitle"), i18n.t("defi.alerts.incompleteMessage", { count: maxChoices }));
      return;
    }
    if (savingRef.current) return;

    savingRef.current = true;
    setSaving(true);

    try {
      const savedIds = Array.isArray(savedPicksRef.current)
        ? savedPicksRef.current.map((x) => String(x.playerId ?? ""))
        : null;

      const currentIds = normalizeCurrentPickIds(selected);

      const _isEditAfterFirstSave =
        hasSavedOnce && savedIds && savedIds.length === currentIds.length && !sameIds(savedIds, currentIds);

      const clientMutationId = `${Date.now()}_${Math.random().toString(16).slice(2)}`;

      const payloadPicks = toCallablePicks(selected);
      const rulesNow = getDefiRules(defi?.type);
      const chosenHydrated = selectedHydrated.filter(Boolean);

      const err = validatePicks(chosenHydrated, rulesNow, i18n);
      if (err) {
        Alert.alert(i18n.t("defi.rules.title", { defaultValue: "Règles de tiers" }), err, [{ text: i18n.t("common.ok") }]);
        return;
      }

      const res = await joinDefi(defi.id, { picks: payloadPicks, clientMutationId });

      if (res?.ok === true) {
        setHasSavedOnce(true);
        savedPicksRef.current = selected.map((p) => ({ playerId: String(p?.playerId ?? "") }));

        Alert.alert(
          i18n.t("defi.alerts.successTitle"),
          i18n.t("defi.alerts.successMessage", { potMessage: i18n.t("defi.alerts.successPotMessageSimple") }),
          [{ text: i18n.t("common.ok"), onPress: () => router.replace("/(drawer)/(tabs)/ChallengesScreen") }]
        );
      } else {
        const reason = res?.error?.reason;
        let msg = i18n.t("common.genericError");
        if (reason === "PLAN_NOT_ALLOWED") msg = i18n.t("defi.errors.planNotAllowed");
        else if (reason === "JOIN_LIMIT_REACHED") msg = i18n.t("defi.errors.joinLimitReached", { max: res?.error?.max });
        else if (reason === "SUBSCRIPTION_INACTIVE")
          msg = i18n.t("defi.errors.subscriptionInactive", { defaultValue: "Abonnement inactif." });
        else if (reason === "DEFI_NOT_OPEN")
          msg = i18n.t("defi.alerts.lockedMessage", { defaultValue: "Défi verrouillé." });
        throw new Error(msg);
      }
    } catch (e) {
      Alert.alert(i18n.t("defi.alerts.genericErrorTitle"), String(e?.message || e));
    } finally {
      setSaving(false);
      savingRef.current = false;
    }
  }, [user?.uid, defi?.id, selected, maxChoices, locked, allChosen, router, hasSavedOnce, selectedHydrated]);

  // ----- states -----
  if (loadingDefi) {
    return (
      <>
        <Stack.Screen
          options={{
            title: i18n.t("defi.loading.title"),
            headerStyle: { backgroundColor: colors.card },
            headerTitleStyle: { color: colors.text },
            headerTintColor: colors.text,
          }}
        />
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background }}>
          <ActivityIndicator color={colors.primary} />
          <Text style={{ marginTop: 8, color: colors.subtext }}>{i18n.t("defi.loading.generic")}</Text>
        </View>
      </>
    );
  }

  if (error) {
    return (
      <>
        <Stack.Screen
          options={{
            title: i18n.t("defi.header.errorTitle"),
            headerStyle: { backgroundColor: colors.card },
            headerTitleStyle: { color: colors.text },
            headerTintColor: colors.text,
          }}
        />
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 16, backgroundColor: colors.background }}>
          <Text style={{ color: colors.text }}>
            {i18n.t("common.errorLabel")} {String(error?.message || error)}
          </Text>
        </View>
      </>
    );
  }

  if (!defi) {
    return (
      <>
        <Stack.Screen
          options={{
            title: i18n.t("defi.header.notFoundTitle"),
            headerStyle: { backgroundColor: colors.card },
            headerTitleStyle: { color: colors.text },
            headerTintColor: colors.text,
          }}
        />
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 16, backgroundColor: colors.background }}>
          <Text style={{ color: colors.text }}>{i18n.t("defi.errors.notFoundMessage")}</Text>
        </View>
      </>
    );
  }

  const gameDayStr = typeof defi.gameDate === "string" ? defi.gameDate : toYMD(defi.gameDate);

  return (
    <>
      <Stack.Screen
        options={{
          title: headerTitle || i18n.t("defi.header.defaultTitle"),
          headerStyle: { backgroundColor: colors.card },
          headerTitleStyle: { color: colors.text },
          headerTintColor: colors.text,
          headerLeft: ({ tintColor }) => (
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <HeaderBackButton
                tintColor={tintColor ?? colors.text}
                onPress={() => router.replace("/(drawer)/(tabs)/ChallengesScreen")}
              />
              <DrawerToggleButton tintColor={tintColor ?? colors.text} />
            </View>
          ),
        }}
      />

      <KeyboardAvoidingView
        behavior={Platform.select({ ios: "padding", android: undefined })}
        style={{ flex: 1, backgroundColor: colors.background }}
        keyboardVerticalOffset={Platform.OS === "ios" ? 64 : 0}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 40, backgroundColor: colors.background }}
        >
          {/* Infos défi */}
          <View
            style={{
              padding: 12,
              borderWidth: 1,
              borderRadius: 12,
              backgroundColor: colors.card,
              borderColor: colors.border,
            }}
          >
            <DefiHeroCard
              title={defi?.title}
              type={defi?.type}
              gameDayStr={gameDayStr || "—"}
              signupDeadlineStr={defi.signupDeadline ? fmtTSLocalHM(defi.signupDeadline) : null}
              picksCount={maxChoices}
              status={defi.status || "—"}
              locked={locked}
              pot={defi.pot ?? 0}
              requirementsText={requirementsText}
              tiersLegendText={i18n.t("defi.tiers.legend")}
            />
          </View>

          {/* Matchs du jour */}
          <SectionCard title={i18n.t("defi.gamesCard.title")}>
            {matchups.length === 0 ? (
              <Text style={{ color: colors.subtext, textAlign: "center" }}>{i18n.t("defi.gamesCard.none")}</Text>
            ) : (
              <View style={{ gap: 10 }}>
                {matchupGroups.map(({ time, games }) => (
                  <View key={time} style={{ gap: 8 }}>
                    <View
                      style={{
                        paddingVertical: 6,
                        paddingHorizontal: 10,
                        borderRadius: 10,
                        borderWidth: 1,
                        borderColor: colors.border,
                        backgroundColor: colors.background,
                        alignSelf: "flex-start",
                      }}
                    >
                      <Text style={{ color: colors.text, fontWeight: "900" }}>{time}</Text>
                    </View>

                    <View style={{ gap: 10 }}>
                      {games.map((g, idx) => (
                        <MatchupRow
                          key={g.gameId || g.id || `${time}-${idx}`}
                          g={g}
                          tierLower={tierLower}
                          teamLogo={teamLogo}
                          showTime={false}
                        />
                      ))}
                    </View>
                  </View>
                ))}
              </View>
            )}
          </SectionCard>

          {/* Pickers */}
          <SectionCard title={i18n.t("defi.pickersCard.title")}>
            {!!requirementsText ? (
              <Text style={{ textAlign: "center", color: colors.text, fontWeight: "800", marginBottom: 8 }}>
                {i18n.t("defi.pickersCard.requirementsPrefix")} {requirementsText}.
              </Text>
            ) : null}

            <Text style={{ textAlign: "center", color: colors.subtext, fontSize: 12, marginBottom: 10 }}>
              {i18n.t("defi.tiers.legend")}
            </Text>

            <View style={{ gap: 10 }}>
              {Array.from({ length: maxChoices }).map((_, i) => (
                <PlayerPickerRow
                  key={`choice-${i}`}
                  label={i18n.t("defi.pickersCard.choiceLabel", { index: i + 1 })}
                  value={selectedHydrated[i]}
                  onEdit={() => openPicker(i)}
                  locked={locked}
                  tierLower={tierLower}
                  headshotUrl={headshotUrl}
                  teamLogo={teamLogo}
                />
              ))}
            </View>

            <Text style={{ marginTop: 10, color: colors.subtext }}>
              {i18n.t("defi.pickersCard.summary", {
                current: selected.filter(Boolean).length,
                max: maxChoices,
              })}
            </Text>
          </SectionCard>

          {/* Actions */}
          <View
            style={{
              padding: 12,
              borderWidth: 1,
              borderRadius: 12,
              backgroundColor: colors.card,
              gap: 8,
              borderColor: colors.border,
            }}
          >
            {/* ✅ CTA Abonnement (FREE seulement) */}
            {isFree ? (
              <TouchableOpacity
                activeOpacity={0.9}
                onPress={() => router.push("../../subscriptions")} // <-- ajuste ta route
                style={{
                  padding: 12,
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: "rgba(127,29,29,0.35)",
                  backgroundColor: "rgba(127,29,29,0.10)",
                  alignItems: "center",
                }}
              >
              <Text style={{ color: colors.text, fontWeight: "900", textAlign: "center" }}>
                {i18n.t("defi.paywall.ctaTitle")}
              </Text>
              <Text style={{ color: colors.subtext, fontWeight: "700", textAlign: "center", marginTop: 2, fontSize: 12 }}>
                {i18n.t("defi.paywall.ctaBody")}
              </Text>
              </TouchableOpacity>
            ) : null}

            {/* ✅ Bouton Save original */}
            <TouchableOpacity
              disabled={locked || !selected.every(Boolean) || saving}
              onPress={save}
              style={{
                padding: 14,
                borderRadius: 10,
                alignItems: "center",
                backgroundColor: locked || !selected.every(Boolean) || saving ? colors.subtext : colors.primary,
              }}
            >
              {saving ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <ActivityIndicator size="small" color="#fff" />
                  <Text style={{ color: "#fff", fontWeight: "700" }}>{i18n.t("defi.actions.primarySaving")}</Text>
                </View>
              ) : (
                <Text style={{ color: "#fff", fontWeight: "700" }}>
                  {locked ? i18n.t("defi.actions.primaryLocked") : i18n.t("defi.actions.primaryDefault")}
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => router.back()}
              style={{
                padding: 12,
                borderRadius: 10,
                borderWidth: 1,
                alignItems: "center",
                backgroundColor: colors.background,
                borderColor: colors.border,
              }}
            >
              <Text style={{ color: colors.text }}>{i18n.t("common.cancel")}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Modal */}
      <PlayerSelectModal
        visible={pickerOpen}
        onClose={() => {
          setPickerOpen(false);
          setPickerTier(null);
        }}
        options={playersSorted}
        onPick={handlePick}
        alreadyChosenIds={alreadyChosenIds}
        tierLower={tierLower}
        teamLogo={teamLogo}
        headshotUrl={headshotUrl}
        forcedTier={pickerTier}

      />

      <LoadingOverlay visible={saving} text={i18n.t("defi.actions.primarySaving")} />
    </>
  );
}