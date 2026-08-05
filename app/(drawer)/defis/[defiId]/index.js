// app/(drawer)/defis/[defiId]/index.js
// Écran de participation à un défi NHL (RNFirebase)

import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { snapshotExists, snapshotData, snapshotId } from "@src/lib/safeSnapshot";
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
import DefiHeroCard from "./components/DefiHeroCard";
import SectionCard from "./components/SectionCard";

import {
  toYMD,
  fmtTSLocalHM,
  isPast,
  ymdTorontoFromUTC,
} from "./utils/defiFormatters";

import Analytics from "@src/services/analytics";
import { resolveDefiHeadshotUrl } from "@src/mlb/mlbPlayerAssets";
import { useTeamStandingsLookup } from "@src/sports/useTeamStandingsLookup";
import { enrichMlbPoolPlayers, poolHasEmbeddedMlbStats } from "@src/mlb/enrichMlbPoolPlayers";
import NovaCoachPlayerModal from "@src/nova/NovaCoachPlayerModal";
import { navigateToAccueilChallenge } from "@src/defis/results/navigateToMesResultats";

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

function headshotUrlForSport(sport, abbr, playerId) {
  return resolveDefiHeadshotUrl(sport, abbr, playerId);
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

  // playerPool figé
  const [players, setPlayers] = useState([]);
  const [loadingPool, setLoadingPool] = useState(true);

  const [selected, setSelected] = useState([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerIndex, setPickerIndex] = useState(0);
  const [pickerTier, setPickerTier] = useState(null); // ✅ "T1" | "T2" | "T3" | null

  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  const savedPicksRef = useRef(null);
  const [hasSavedOnce, setHasSavedOnce] = useState(false);
  const [participationLoaded, setParticipationLoaded] = useState(false);
  const [saveStatus, setSaveStatus] = useState("idle"); // idle | saving | saved | error

  const { tier: userTier, active: tierActive } = useEntitlement(user?.uid);

  const tierLower = useMemo(() => {
    const t = String(userTier || "free").toLowerCase();
    return tierActive ? t : "free";
  }, [userTier, tierActive]);

  const leaveDefiPicker = useCallback(() => {
    if (router.canGoBack?.()) {
      router.back();
      return;
    }
    navigateToAccueilChallenge(router, {
      challengeId: String(defiId || ""),
      kind: "ts",
    });
  }, [router, defiId]);

  const [novaPlayer, setNovaPlayer] = useState(null);

  const novaProbablePitchers = useMemo(() => {
    if (!novaPlayer) return null;
    const opp = novaPlayer.opponentProbablePitcher;
    const isHome = novaPlayer.isHome === true;
    return {
      home: isHome ? null : opp,
      away: isHome ? opp : null,
    };
  }, [novaPlayer]);

  // Charger défi
  useEffect(() => {
    if (!defiId) return;
    setLoadingDefi(true);

    const ref = firestore().doc(`defis/${String(defiId)}`);
    let lastDefi = null;

    const unsub = ref.onSnapshot(
      (snap) => {
        const next = snapshotExists(snap) ? { id: snapshotId(snap), ...snapshotData(snap) } : null;
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

  const defiSport = useMemo(
    () => String(defi?.sport || defi?.poolSport || "NHL").toUpperCase(),
    [defi?.sport, defi?.poolSport]
  );

  const showNovaCoach = defiSport === "MLB" || defiSport === "NHL";

  const { formatLine: formatStandingsLine } = useTeamStandingsLookup(
    defiSport === "MLB" ? "MLB" : null
  );

  const headshotUrl = useCallback(
    (abbr, playerId) => headshotUrlForSport(defiSport, abbr, playerId),
    [defiSport]
  );

  useEffect(() => {
    setSelected((prev) => Array.from({ length: maxChoices }, (_, i) => prev?.[i] ?? null));
  }, [maxChoices]);

  useEffect(() => {
    setParticipationLoaded(false);
    setSaveStatus("idle");
  }, [defi?.id, user?.uid]);

  // Participation existante
  useEffect(() => {
    (async () => {
      if (!defi?.id || !user?.uid) return;
      try {
        const ref = firestore().doc(`defis/${String(defi.id)}/participations/${user.uid}`);
        const snap = await ref.get();

        if (snapshotExists(snap)) {
          const p = snapshotData(snap) || {};
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
      } finally {
        setParticipationLoaded(true);
      }
    })();
  }, [defi?.id, user?.uid, maxChoices]);

  // playerPool
  useEffect(() => {
    if (!defi?.id) return;

    let cancelled = false;
    let enrichGen = 0;
    setLoadingPool(true);

    const unsub = firestore()
      .collection(`defis/${defi.id}/playerPool`)
      .orderBy("rank")
      .onSnapshot(
        async (snap) => {
          const list = [];
          snap.forEach((d) => list.push(d.data()));

          if (defiSport !== "MLB") {
            if (!cancelled) {
              setPlayers((prev) => (isEqual(prev, list) ? prev : list));
              setLoadingPool(false);
            }
            return;
          }

          const seasonId = defi?.poolSeasonId;
          const myGen = ++enrichGen;
          const hasEmbeddedStats = poolHasEmbeddedMlbStats(list);

          if (!cancelled) {
            setPlayers((prev) => (isEqual(prev, list) ? prev : list));
            setLoadingPool(false);
          }

          if (hasEmbeddedStats || !seasonId) {
            return;
          }

          try {
            const enriched = await enrichMlbPoolPlayers(list, seasonId);
            if (cancelled || myGen !== enrichGen) return;
            setPlayers((prev) => (isEqual(prev, enriched) ? prev : enriched));
          } catch (e) {
            if (!cancelled && myGen === enrichGen) {
              setError(e);
            }
          }
        },
        (e) => {
          setError(e);
          setLoadingPool(false);
        }
      );

    return () => {
      cancelled = true;
      unsub();
    };
  }, [defi?.id, defi?.poolSeasonId, defiSport]);

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

  const headerTitle = useMemo(
    () => i18n.t("defi.header.trioTitle", { defaultValue: "Défi Trio du jour" }),
    []
  );

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

        if (next.filter(Boolean).length === maxChoices) {
          setPickerOpen(false);
          setPickerTier(null);
        }

        return next;
      });
    },
    [pickerIndex, defi?.type, playerById, maxChoices]
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

  const save = useCallback(
    async ({ auto = false } = {}) => {
      if (!user?.uid || !defi?.id) return false;

      if (locked) {
        if (!auto) {
          Alert.alert(i18n.t("defi.alerts.lockedTitle"), i18n.t("defi.alerts.lockedMessage"));
        }
        return false;
      }
      if (!allChosen) {
        if (!auto) {
          Alert.alert(
            i18n.t("defi.alerts.incompleteTitle"),
            i18n.t("defi.alerts.incompleteMessage", { count: maxChoices })
          );
        }
        return false;
      }
      if (savingRef.current) return false;

      const savedIds = Array.isArray(savedPicksRef.current)
        ? savedPicksRef.current.map((x) => String(x.playerId ?? ""))
        : null;
      const currentIds = normalizeCurrentPickIds(selected);
      if (savedIds && sameIds(savedIds, currentIds)) return true;

      savingRef.current = true;
      setSaving(true);
      setSaveStatus("saving");

      const wasFirstSave = !hasSavedOnce;

      try {
        const _isEditAfterFirstSave =
          hasSavedOnce &&
          savedIds &&
          savedIds.length === currentIds.length &&
          !sameIds(savedIds, currentIds);

        const clientMutationId = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
        const payloadPicks = toCallablePicks(selected);
        const rulesNow = getDefiRules(defi?.type);
        const chosenHydrated = selectedHydrated.filter(Boolean);

        const err = validatePicks(chosenHydrated, rulesNow, i18n);
        if (err) {
          Alert.alert(i18n.t("defi.rules.title", { defaultValue: "Règles de tiers" }), err, [
            { text: i18n.t("common.ok") },
          ]);
          setSaveStatus("error");
          return false;
        }

        const res = await joinDefi(defi.id, { picks: payloadPicks, clientMutationId });

        if (res?.ok === true) {
          setHasSavedOnce(true);
          savedPicksRef.current = selected.map((p) => ({ playerId: String(p?.playerId ?? "") }));
          setSaveStatus("saved");

          Analytics.submitPick({
            challengeType: "standard",
            challengeId: String(defi.id),
            format: `${defi?.type}x${defi?.type}`,
            picksCount: payloadPicks.length,
            isEdit: !!_isEditAfterFirstSave,
          });

          const showSavedChoiceAlert = () => {
            Alert.alert(
              i18n.t("defi.alerts.successTitle"),
              i18n.t("defi.alerts.savedChoiceMessage", {
                defaultValue: "Tes sélections sont enregistrées. Que veux-tu faire?",
              }),
              [
                {
                  text: i18n.t("defi.actions.modifyAnotherPick", {
                    defaultValue: "Modifier un joueur",
                  }),
                  style: "cancel",
                },
                {
                  text: i18n.t("defi.actions.backToHome", {
                    defaultValue: "Retour à Aujourd'hui",
                  }),
                  onPress: () => router.replace("/(drawer)/(tabs)/AccueilScreen"),
                },
              ]
            );
          };

          if ((auto && wasFirstSave) || !auto) {
            showSavedChoiceAlert();
          }

          return true;
        }

        const reason = res?.error?.reason;
        let msg = i18n.t("common.genericError");
        if (reason === "PLAN_NOT_ALLOWED") msg = i18n.t("defi.errors.planNotAllowed");
        else if (reason === "JOIN_LIMIT_REACHED")
          msg = i18n.t("defi.errors.joinLimitReached", { max: res?.error?.max });
        else if (reason === "SUBSCRIPTION_INACTIVE")
          msg = i18n.t("defi.errors.subscriptionInactive", { defaultValue: "Abonnement inactif." });
        else if (reason === "DEFI_NOT_OPEN")
          msg = i18n.t("defi.alerts.lockedMessage", { defaultValue: "Défi verrouillé." });
        throw new Error(msg);
      } catch (e) {
        setSaveStatus("error");
        Alert.alert(i18n.t("defi.alerts.genericErrorTitle"), String(e?.message || e));
        return false;
      } finally {
        setSaving(false);
        savingRef.current = false;
      }
    },
    [user?.uid, defi?.id, defi?.type, selected, maxChoices, locked, allChosen, router, hasSavedOnce, selectedHydrated]
  );

  useEffect(() => {
    if (!participationLoaded || !allChosen || locked) return;
    save({ auto: true });
  }, [participationLoaded, allChosen, locked, selected, save]);

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
                onPress={leaveDefiPicker}
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
          <DefiHeroCard
            title={i18n.t("defi.infoCard.trioTitle", { defaultValue: "Trio du jour" })}
            gameDayStr={gameDayStr || "—"}
            pot={defi.pot ?? 0}
          />

          <SectionCard title={null}>
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
                  sport={defiSport}
                  formatStandingsLine={defiSport === "MLB" ? formatStandingsLine : null}
                  showNovaButton={showNovaCoach}
                  onNovaPress={setNovaPlayer}
                />
              ))}
            </View>

            <Text style={{ marginTop: 10, color: colors.subtext }}>
              {i18n.t("defi.pickersCard.summary", {
                current: selected.filter(Boolean).length,
                max: maxChoices,
              })}
            </Text>

            {saveStatus === "saving" ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10 }}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={{ color: colors.primary, fontWeight: "700", fontSize: 13 }}>
                  {i18n.t("defi.actions.autoSaving", { defaultValue: "Enregistrement…" })}
                </Text>
              </View>
            ) : null}

            {saveStatus === "saved" && hasSavedOnce ? (
              <Text style={{ marginTop: 10, color: "#16a34a", fontWeight: "700", fontSize: 13 }}>
                {i18n.t("defi.actions.autoSaved", { defaultValue: "Participation enregistrée" })}
              </Text>
            ) : null}

            {!locked && allChosen && saveStatus === "idle" && !hasSavedOnce ? (
              <Text style={{ marginTop: 10, color: colors.subtext, fontSize: 12, fontWeight: "600" }}>
                {i18n.t("defi.actions.autoSaveHint", {
                  defaultValue: "Ta participation sera enregistrée automatiquement.",
                })}
              </Text>
            ) : null}
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
            <TouchableOpacity
              onPress={leaveDefiPicker}
              disabled={saving}
              style={{
                padding: 14,
                borderRadius: 10,
                borderWidth: 1,
                alignItems: "center",
                backgroundColor: colors.background,
                borderColor: colors.border,
                opacity: saving ? 0.7 : 1,
              }}
            >
              <Text style={{ color: colors.text, fontWeight: "700" }}>
                {hasSavedOnce
                  ? i18n.t("common.back", { defaultValue: "Retour" })
                  : i18n.t("common.cancel")}
              </Text>
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
        pickerSlotIndex={pickerIndex}
        sport={defiSport}
        formatStandingsLine={defiSport === "MLB" ? formatStandingsLine : null}
        loading={loadingPool}
      />

      <LoadingOverlay visible={saving} text={i18n.t("defi.actions.primarySaving")} />

      <NovaCoachPlayerModal
        visible={!!novaPlayer}
        onClose={() => setNovaPlayer(null)}
        player={novaPlayer}
        challengeId={String(defiId || defi?.id || "")}
        domain="ts"
        sport={defiSport}
        gameId={novaPlayer?.gamePk ? String(novaPlayer.gamePk) : null}
        probablePitchers={novaProbablePitchers}
        homeAbbr={novaPlayer?.homeAbbr}
        awayAbbr={novaPlayer?.awayAbbr}
        disabled={locked || saving}
      />
    </>
  );
}