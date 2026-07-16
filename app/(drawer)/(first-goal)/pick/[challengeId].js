// app/(drawer)/(first-goal)/pick/[challengeId].js
import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { snapshotExists, snapshotData, snapshotId } from "@src/lib/safeSnapshot";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  FlatList,
} from "react-native";
import { useLocalSearchParams, Stack, useRouter } from "expo-router";
import firestore from "@react-native-firebase/firestore";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@src/auth/SafeAuthProvider";
import { useTheme } from "@src/theme/ThemeProvider";
import i18n from "@src/i18n/i18n";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import functions from "@react-native-firebase/functions";
import { useLanguage } from "@src/i18n/LanguageProvider";
import Analytics from "@src/services/analytics";
import { getFgcLeague } from "@src/firstGoal/fgcChallengeUtils";
import FgcMatchupHeader from "@src/firstGoal/FgcMatchupHeader";
import useFgcProbablePitchers from "@src/firstGoal/useFgcProbablePitchers";
import useFgcGameSchedules from "@src/firstGoal/useFgcGameSchedules";
import { isMlbGamePostponed } from "@src/firstGoal/fgcGameScheduleUtils";
import { loadFgcPlayersProgressive } from "@src/players/loadFgcPlayersWithSeasonStats";
import { enrichPlayersWithMlbBvp, normalizeMlbPitcherId } from "@src/mlb/loadMlbBvpForPlayers";
import { resolveFgcProbablePitchersForBvp } from "@src/mlb/fgcBvpUtils";
import {
  enrichPlayersWithMlbLineups,
  hasUsableMlbLineups,
  hasLineupDataForTeam,
  isOfficialMlbLineup,
  isProvisionalMlbLineup,
  lineupSlotForPlayer,
  loadMlbGameLineups,
} from "@src/mlb/loadMlbGameLineups";
import FgcPlayerPickCard from "@src/firstGoal/FgcPlayerPickCard";
import { shouldShowMlbBvpLine } from "@src/mlb/MlbDefiPlayerMeta";
import { isPlayerUnavailable } from "@src/players/injuryDisplayHelpers";
import { getPlayerSortValue } from "@src/players/seasonStatsHelpers";
import NovaCoachPlayerModal from "@src/nova/NovaCoachPlayerModal";

/* ---------------- helpers ---------------- */

function toDateSafe(v) {
  if (!v) return null;
  if (v?.toDate && typeof v.toDate === "function") return v.toDate();
  if (v instanceof Date) return v;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function safeAbbr(v) {
  return String(v || "").trim().toUpperCase();
}

function fmtHmLocal(date) {
  if (!date) return null;
  const d = date instanceof Date ? date : toDateSafe(date);
  if (!d) return null;
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

function lineupBeforeYmd(challenge) {
  const ymd = String(challenge?.gameYmd || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return ymd;

  const start = toDateSafe(challenge?.gameStartTimeUTC);
  if (!start) return null;

  const y = start.getUTCFullYear();
  const m = String(start.getUTCMonth() + 1).padStart(2, "0");
  const day = String(start.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function byFullName(a, b) {
  return String(a?.fullName || "").localeCompare(String(b?.fullName || ""));
}

/* ---------------- small UI ---------------- */

function TopBar({ title, subtitle, onBack, onClose, colors }) {
  return (
    <View
      style={{
        paddingTop: 6,
        paddingBottom: 10,
        paddingHorizontal: 12,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        backgroundColor: colors.background,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <TouchableOpacity
          onPress={onBack}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
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
          <Ionicons name="chevron-back" size={20} color={colors.text} />
        </TouchableOpacity>

        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={{ color: colors.text, fontWeight: "900", fontSize: 16 }} numberOfLines={1}>
            {title}
          </Text>
          {!!subtitle ? (
            <Text style={{ color: colors.subtext, fontSize: 12, marginTop: 2 }} numberOfLines={2}>
              {subtitle}
            </Text>
          ) : null}
        </View>

        <TouchableOpacity
          onPress={onClose}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
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
          <Ionicons name="close" size={20} color={colors.text} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

async function buildIdentityForEntry(user) {
  const uid = String(user?.uid || "");
  if (!uid) return { displayName: "Invité", avatarUrl: null };

  try {
    const snap = await firestore().doc(`participants/${uid}`).get();
    const p = snapshotExists(snap) ? snapshotData(snap) || {} : {};

    const displayName =
      (typeof p.displayName === "string" && p.displayName.trim()) ||
      (typeof p.name === "string" && p.name.trim()) ||
      (p.email ? String(p.email).split("@")[0] : "") ||
      (typeof user?.displayName === "string" && user.displayName.trim()) ||
      "Invité";

    const avatarUrl =
      p.jerseyFrontUrl ||
      p.avatarUrl ||
      p.photoURL ||
      p.photoUrl ||
      user?.photoURL ||
      user?.photoUrl ||
      null;

    return { displayName, avatarUrl };
  } catch {
    return {
      displayName:
        (typeof user?.displayName === "string" && user.displayName.trim()) || "Invité",
      avatarUrl: user?.photoURL || user?.photoUrl || null,
    };
  }
}

/* ---------------- component ---------------- */

export default function FirstGoalPickScreen() {
  const { challengeId } = useLocalSearchParams();
  const { user } = useAuth();
  const { lang } = useLanguage();
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [challenge, setChallenge] = useState(null);
  const [players, setPlayers] = useState([]);
  const [bvpByPlayerId, setBvpByPlayerId] = useState({});
  const [bvpPitcherByPlayerId, setBvpPitcherByPlayerId] = useState({});
  const [mlbLineups, setMlbLineups] = useState(null);
  const [entry, setEntry] = useState(null);
  const [seasonPair, setSeasonPair] = useState(null);

  const [loadingChallenge, setLoadingChallenge] = useState(true);
  const [loadingPlayers, setLoadingPlayers] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingPlayerId, setSavingPlayerId] = useState(null);
  const [novaModalPlayer, setNovaModalPlayer] = useState(null);

  const cid = String(challengeId || "");
  const [selectedTeam, setSelectedTeam] = useState("");
  const initialTeamSetRef = useRef(false);
  const bvpRunIdRef = useRef(0);

  useEffect(() => {
    setChallenge(null);
    setPlayers([]);
    setEntry(null);
    setSeasonPair(null);
    setMlbLineups(null);
    setSelectedTeam("");
    initialTeamSetRef.current = false;
    setLoadingChallenge(true);
    setLoadingPlayers(true);
  }, [cid]);

  useEffect(() => {
    if (!cid) return;

    setLoadingChallenge(true);

    const unsub = firestore()
      .collection("first_goal_challenges")
      .doc(cid)
      .onSnapshot(
        (snap) => {
          setChallenge(snapshotExists(snap) ? { id: snapshotId(snap), ...snapshotData(snap) } : null);
          setLoadingChallenge(false);
        },
        (err) => {
          console.warn("[FirstGoalPick] challenge snapshot error", err?.code, err?.message);
          setChallenge(null);
          setLoadingChallenge(false);
        }
      );

    return () => {
      try {
        unsub && unsub();
      } catch {}
    };
  }, [cid]);

  useEffect(() => {
    if (!cid || !user?.uid) return;

    const entryRef = firestore()
      .collection("first_goal_challenges")
      .doc(cid)
      .collection("entries")
      .doc(String(user.uid));

    const unsub = entryRef.onSnapshot(
      (snap) => {
        setEntry(snapshotExists(snap) ? { id: snapshotId(snap), ...snapshotData(snap) } : null);
      },
      (err) => {
        console.warn("[FirstGoalPick] entry snapshot error", err?.code, err?.message);
        setEntry(null);
      }
    );

    return () => {
      try {
        unsub && unsub();
      } catch {}
    };
  }, [cid, user?.uid]);

  useEffect(() => {
    const home = safeAbbr(challenge?.homeAbbr);
    const away = safeAbbr(challenge?.awayAbbr);
    const league = getFgcLeague(challenge);

    if (!home || !away) return;

    let cancelled = false;
    setLoadingPlayers(true);
    setPlayers([]);
    setSeasonPair(null);

    loadFgcPlayersProgressive({
      league,
      homeAbbr: home,
      awayAbbr: away,
      onRosterReady: (rows, pair) => {
        if (cancelled) return;
        rows.sort(byFullName);
        setSeasonPair(pair);
        setPlayers(rows);
        setLoadingPlayers(false);
      },
    })
      .then(({ players: rows, seasonPair: pair }) => {
        if (cancelled) return;
        rows.sort(byFullName);
        setSeasonPair(pair);
        setPlayers(rows);
      })
      .catch((e) => {
        if (cancelled) return;
        console.log("[FirstGoalPick] players error", {
          league,
          code: e?.code,
          message: e?.message || String(e),
        });
        setPlayers([]);
        setSeasonPair(null);
      })
      .finally(() => {
        if (!cancelled) setLoadingPlayers(false);
      });

    return () => {
      cancelled = true;
    };
  }, [challenge?.homeAbbr, challenge?.awayAbbr, challenge?.league, challenge?.fgcMode]);

  const probablePitchers = useFgcProbablePitchers(challenge);
  const scheduleByChallengeId = useFgcGameSchedules(challenge ? [challenge] : []);
  const scheduleInfo = challenge ? scheduleByChallengeId[String(challenge.id || "")] : null;
  const isPostponed = isMlbGamePostponed(scheduleInfo?.status);

  useEffect(() => {
    if (getFgcLeague(challenge) !== "MLB") {
      setMlbLineups(null);
      return undefined;
    }

    const gamePk = String(challenge?.gamePk || challenge?.gameId || "").trim();
    if (!gamePk) {
      setMlbLineups(null);
      return undefined;
    }

    let cancelled = false;
    let pollTimer = null;

    const refreshLineups = async () => {
      try {
        const lineups = await loadMlbGameLineups(gamePk, {
          awayAbbr: safeAbbr(challenge?.awayAbbr),
          homeAbbr: safeAbbr(challenge?.homeAbbr),
          beforeYmd: lineupBeforeYmd(challenge),
        });
        if (cancelled) return { loaded: false, official: false };
        if (hasUsableMlbLineups(lineups)) {
          setMlbLineups(lineups);
          return { loaded: true, official: isOfficialMlbLineup(lineups) };
        }
        setMlbLineups(null);
        return { loaded: false, official: false };
      } catch (e) {
        if (!cancelled) setMlbLineups(null);
        console.log("[FirstGoalPick] lineup load error", e?.message || e);
        return { loaded: false, official: false };
      }
    };

    (async () => {
      const result = await refreshLineups();
      if (cancelled || result.official) return;

      pollTimer = setInterval(async () => {
        const next = await refreshLineups();
        if (next.official && pollTimer) {
          clearInterval(pollTimer);
          pollTimer = null;
        }
      }, 90 * 1000);
    })();

    return () => {
      cancelled = true;
      if (pollTimer) clearInterval(pollTimer);
    };
  }, [
    challenge?.league,
    challenge?.gamePk,
    challenge?.gameId,
    challenge?.fgcMode,
    challenge?.awayAbbr,
    challenge?.homeAbbr,
    challenge?.gameYmd,
    challenge?.gameStartTimeUTC,
  ]);

  useEffect(() => {
    if (getFgcLeague(challenge) !== "MLB" || !players.length) {
      setBvpByPlayerId({});
      setBvpPitcherByPlayerId({});
      return undefined;
    }

    const awayAbbr = safeAbbr(challenge?.awayAbbr);
    const homeAbbr = safeAbbr(challenge?.homeAbbr);

    let cancelled = false;
    const runId = ++bvpRunIdRef.current;

    (async () => {
      try {
        const { matchups } = await resolveFgcProbablePitchersForBvp(challenge, probablePitchers);
        if (cancelled || runId !== bvpRunIdRef.current) return;

        const hasAnyPitcher = matchups.some((m) => normalizeMlbPitcherId(m.pitcher));
        if (!hasAnyPitcher) {
          if (__DEV__) {
            console.log("[FirstGoalPick] BvP skipped — no probable pitcher id", {
              matchups: matchups.map((m) => ({
                team: m.teamAbbr,
                pitcher: m.pitcher,
              })),
            });
          }
          return;
        }

        const nextBvp = {};
        const nextPitcher = {};

        for (const { teamAbbr, pitcher } of matchups) {
          const pitcherId = normalizeMlbPitcherId(pitcher);
          if (!pitcherId || !teamAbbr) continue;

          const subset = players.filter((p) => safeAbbr(p?.teamAbbr) === teamAbbr);
          if (!subset.length) continue;

          const enriched = await enrichPlayersWithMlbBvp(subset, pitcher);
          for (const p of enriched) {
            const id = String(p?.playerId ?? p?.id ?? "");
            if (!id) continue;
            nextBvp[id] = p.bvpVsOpposingStarter ?? null;
            nextPitcher[id] = pitcher;
          }
        }

        if (cancelled || runId !== bvpRunIdRef.current) return;
        const withSample = Object.values(nextBvp).filter((r) => r?.hasSample).length;
        if (__DEV__) {
          console.log("[FirstGoalPick] bvp enrich done", {
            players: Object.keys(nextBvp).length,
            withSample,
            matchups: matchups.map((m) => ({
              team: m.teamAbbr,
              pitcherId: normalizeMlbPitcherId(m.pitcher),
              pitcherName: m.pitcher?.name ?? null,
            })),
          });
        }
        setBvpByPlayerId(nextBvp);
        setBvpPitcherByPlayerId(nextPitcher);
      } catch (e) {
        console.log("[FirstGoalPick] bvp enrich error", e?.message || e);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    challenge,
    challenge?.league,
    challenge?.awayAbbr,
    challenge?.homeAbbr,
    challenge?.gameYmd,
    challenge?.gamePk,
    challenge?.gameId,
    players,
    probablePitchers?.home?.id,
    probablePitchers?.away?.id,
    probablePitchers?.home?.name,
    probablePitchers?.away?.name,
  ]);

  const derived = useMemo(() => {
    const st = String(challenge?.status || "").toLowerCase();
    const league = getFgcLeague(challenge);

    const statusBlocksPick =
      !isPostponed && (["decided", "closed"].includes(st) || st === "pending");

    const startDate = toDateSafe(challenge?.gameStartTimeUTC);
    const startMs = startDate ? startDate.getTime() : null;

    const cutoffMs = startMs != null ? startMs - 5 * 60 * 1000 : null;
    const nowMs = Date.now();

    const started = !isPostponed && startMs != null ? nowMs >= startMs : false;
    const pastCutoff = !isPostponed && cutoffMs != null ? nowMs >= cutoffMs : false;

    const hasPicked = !!(entry?.playerId && String(entry.playerId).trim().length > 0);
    const locked = isPostponed ? st === "decided" || st === "pending" : statusBlocksPick || pastCutoff || started;
    const canEditPick = hasPicked && !locked;

    const cutoffDate = cutoffMs != null ? new Date(cutoffMs) : null;
    const cutoffHm = fmtHmLocal(cutoffDate);

    const away = safeAbbr(challenge?.awayAbbr);
    const home = safeAbbr(challenge?.homeAbbr);

    const headerLine = away && home ? `${away} @ ${home}` : "—";
    const startHm = fmtHmLocal(startDate);

    const chooseOneText =
      league === "MLB"
        ? i18n.t("firstGoal.pick.chooseOneMlb", {
            defaultValue: "Choisis le joueur qui produira le premier point",
          })
        : i18n.t("firstGoal.pick.chooseOne", {
            defaultValue: "Choisis le joueur qui marquera le premier but",
          });

    const subtitle = isPostponed
      ? `📅 ${i18n.t("firstGoal.pick.postponed", { defaultValue: "Match reporté — tu peux participer" })}`
      : hasPicked
      ? locked
        ? `🎯 ${i18n.t("firstGoal.pick.alreadyPicked", {
            defaultValue: "Ton choix est verrouillé",
          })}`
        : `✏️ ${i18n.t("firstGoal.pick.editUntil", {
            defaultValue: "Tu peux modifier ton choix jusqu’à",
          })} ${cutoffHm || ""}`
      : locked
      ? `⏱️ ${i18n.t("firstGoal.pick.locked", {
          defaultValue: "Le défi est verrouillé",
        })}`
      : chooseOneText;

    return {
      league,
      status: st,
      started,
      locked,
      hasPicked,
      startDate,
      startHm,
      away,
      home,
      headerLine,
      subtitle,
      pastCutoff,
      cutoffDate,
      cutoffHm,
      canEditPick,
    };
  }, [challenge, entry, lang, isPostponed]);

  useEffect(() => {
    if (!players.length || initialTeamSetRef.current) return;

    const pickedId = entry?.playerId ? String(entry.playerId) : "";
    if (pickedId) {
      const picked = players.find(
        (p) => String(p?.id) === pickedId || String(p?.playerId) === pickedId
      );
      const pickedTeam = safeAbbr(picked?.teamAbbr);
      if (pickedTeam) {
        setSelectedTeam(pickedTeam);
        initialTeamSetRef.current = true;
        return;
      }
    }

    if (derived.away) {
      setSelectedTeam(derived.away);
      initialTeamSetRef.current = true;
    } else if (derived.home) {
      setSelectedTeam(derived.home);
      initialTeamSetRef.current = true;
    }
  }, [players, entry?.playerId, derived.away, derived.home]);

  const loading = loadingChallenge && !challenge;

  const activeSeasonPair = seasonPair || { current: "", previous: "" };
  const lineupsAvailable = derived.league === "MLB" && hasUsableMlbLineups(mlbLineups);
  const lineupsProvisional = derived.league === "MLB" && isProvisionalMlbLineup(mlbLineups);

  const displayPlayers = useMemo(() => {
    if (!lineupsAvailable || !players.length) return players;
    return enrichPlayersWithMlbLineups(
      players,
      mlbLineups,
      safeAbbr(challenge?.homeAbbr),
      safeAbbr(challenge?.awayAbbr)
    );
  }, [players, mlbLineups, lineupsAvailable, challenge?.homeAbbr, challenge?.awayAbbr]);

  const filteredPlayers = useMemo(() => {
    const t = safeAbbr(selectedTeam);
    const pickedId = entry?.playerId ? String(entry.playerId) : "";
    const league = derived.league;

    const base = t ? displayPlayers.filter((p) => safeAbbr(p?.teamAbbr) === t) : [...displayPlayers];

    base.sort((a, b) => {
      const aPicked =
        pickedId && (String(a?.id) === pickedId || String(a?.playerId) === pickedId);
      const bPicked =
        pickedId && (String(b?.id) === pickedId || String(b?.playerId) === pickedId);
      if (aPicked && !bPicked) return -1;
      if (!aPicked && bPicked) return 1;

      if (lineupsAvailable) {
        const aSlot = a?.lineupSlot != null ? Number(a.lineupSlot) : 999;
        const bSlot = b?.lineupSlot != null ? Number(b.lineupSlot) : 999;
        if (aSlot !== bSlot) return aSlot - bSlot;
      }

      const statDiff =
        getPlayerSortValue(b, league, activeSeasonPair) -
        getPlayerSortValue(a, league, activeSeasonPair);
      if (statDiff !== 0) return statDiff;

      const aUnavailable = isPlayerUnavailable(a?.injury) ? 1 : 0;
      const bUnavailable = isPlayerUnavailable(b?.injury) ? 1 : 0;
      if (aUnavailable !== bUnavailable) return aUnavailable - bUnavailable;

      return byFullName(a, b);
    });

    return base;
  }, [
    displayPlayers,
    selectedTeam,
    entry?.playerId,
    derived.league,
    activeSeasonPair,
    lineupsAvailable,
  ]);

  const selectedTeamBvpNotice = useMemo(() => {
    if (derived.league !== "MLB") return null;

    const teamAbbr = safeAbbr(selectedTeam);
    if (!teamAbbr) return null;

    const teamPlayers = players.filter((p) => safeAbbr(p?.teamAbbr) === teamAbbr);
    if (!teamPlayers.length) return null;

    let loaded = 0;
    let withSample = 0;
    let pitcherName = "";

    for (const p of teamPlayers) {
      const pid = String(p?.playerId ?? p?.id ?? "");
      if (!pid) continue;
      const bvp = bvpByPlayerId[pid];
      if (bvp == null) continue;
      loaded += 1;
      if (shouldShowMlbBvpLine(bvp)) withSample += 1;
      if (!pitcherName) {
        pitcherName =
          String(bvpPitcherByPlayerId[pid]?.name || bvp?.pitcherName || "").trim();
      }
    }

    if (loaded === 0 || withSample > 0 || !pitcherName) return null;

    return { pitcherName };
  }, [derived.league, selectedTeam, players, bvpByPlayerId, bvpPitcherByPlayerId]);

  const goBackOrHome = useCallback(() => {
    if (router.canGoBack?.()) router.back();
    else router.replace("/(drawer)/(tabs)/AccueilScreen");
  }, [router]);

  const pickPlayer = useCallback(
    async (p) => {
      if (!user?.uid) return;
      if (!cid) return;

      const playerIdRaw = p?.playerId ?? p?.id ?? p?.nhlId ?? p?.playerID;
      const playerId = String(playerIdRaw ?? "").trim();
      const playerName = String(p?.fullName ?? p?.name ?? "").trim() || null;
      const teamAbbr = p?.teamAbbr ? safeAbbr(p.teamAbbr) : null;
      const positionCode = String(p?.positionCode ?? "").trim() || null;
      const headshotUrl = String(p?.headshotUrl ?? p?.headshot ?? "").trim() || null;
      const league = getFgcLeague(challenge);

      if (!playerId) {
        Alert.alert(i18n.t("common.error", { defaultValue: "Erreur" }), "playerId invalide.");
        return;
      }

      const identity = await buildIdentityForEntry(user);

      try {
        setSaving(true);
        setSavingPlayerId(playerId);

        const call = functions().httpsCallable("fgcPick");

        const res = await call({
          challengeId: cid,
          playerId,
          playerName,
          teamAbbr,
          positionCode,
          headshotUrl,
          displayName: identity.displayName,
          avatarUrl: identity.avatarUrl,
        });

        const isFirst = !!res?.data?.isFirstParticipation;

        Analytics.submitPick({
          challengeType: "fgc",
          league,
          challengeId: String(cid),
          playerId: String(playerId),
          teamAbbr: teamAbbr || undefined,
          isFirstPick: isFirst,
        });

        Alert.alert(
          i18n.t("firstGoal.pick.successTitle", { defaultValue: "Choix enregistré" }),
          isFirst
            ? i18n.t("firstGoal.pick.successBody", {
                defaultValue: "Ton choix est enregistré. Bonne chance 🍀",
              })
            : i18n.t("firstGoal.pick.updatedBody", {
                defaultValue: "Ton choix a été mis à jour.",
              })
        );
      } catch (e) {
        console.log("[fgcPick] ERROR", e?.code, e?.message || e);

        Alert.alert(i18n.t("common.error", { defaultValue: "Erreur" }), String(e?.message || e));
      } finally {
        setSaving(false);
        setSavingPlayerId(null);
      }
    },
    [cid, user?.uid, challenge?.league]
  );

  const renderItem = useCallback(
    ({ item }) => {
      const pid = String(item?.playerId ?? item?.id ?? "");
      const showNova =
        (derived.league === "NHL" || derived.league === "MLB") && !derived.locked;

      const homeAbbr = safeAbbr(challenge?.homeAbbr);
      const awayAbbr = safeAbbr(challenge?.awayAbbr);
      const lineupSlot =
        lineupsAvailable && mlbLineups
          ? lineupSlotForPlayer(mlbLineups, item, homeAbbr, awayAbbr) ??
            item?.lineupSlot ??
            null
          : item?.lineupSlot ?? null;

      return (
        <FgcPlayerPickCard
          item={{
            ...item,
            lineupSlot,
            bvpVsOpposingStarter: bvpByPlayerId[pid] || null,
            opposingPitcherForBvp: bvpPitcherByPlayerId[pid] || null,
          }}
          disabled={derived.locked || saving}
          locked={derived.locked}
          onPick={pickPlayer}
          onNovaPress={setNovaModalPlayer}
          showNovaButton={showNova}
          colors={colors}
          selectedPlayerId={entry?.playerId}
          pendingPlayerId={savingPlayerId}
          league={derived.league}
          seasonPair={activeSeasonPair}
          lineupsAvailable={lineupsAvailable}
          lineupSideAvailable={hasLineupDataForTeam(
            mlbLineups,
            item.teamAbbr,
            challenge?.homeAbbr,
            challenge?.awayAbbr
          )}
          lineupsProvisional={lineupsProvisional}
        />
      );
    },
    [
      derived.locked,
      derived.league,
      saving,
      savingPlayerId,
      pickPlayer,
      colors,
      entry?.playerId,
      activeSeasonPair,
      bvpByPlayerId,
      bvpPitcherByPlayerId,
      lineupsAvailable,
      lineupsProvisional,
      mlbLineups,
      challenge?.homeAbbr,
      challenge?.awayAbbr,
    ]
  );

  const ItemSeparator = useCallback(() => <View style={{ height: 10 }} />, []);

  const ListHeader = useMemo(() => {
    return (
      <View
        style={{
          paddingHorizontal: 12,
          paddingTop: 10,
          paddingBottom: 8,
          backgroundColor: colors.background,
          gap: 8,
        }}
      >
        {!lineupsProvisional ? (
          <Text style={{ color: colors.subtext, fontSize: 11, fontWeight: "600" }}>
            {lineupsAvailable
              ? i18n.t("firstGoal.pick.sortedByLineup", {
                  defaultValue: "Triés par ordre de frappe",
                })
              : i18n.t("firstGoal.pick.sortedByStats", {
                  defaultValue: "Triés par stats saison en cours",
                })}
          </Text>
        ) : null}

        {lineupsProvisional ? (
          <View
            style={{
              alignSelf: "flex-start",
              paddingVertical: 6,
              paddingHorizontal: 10,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.card2,
            }}
          >
            <Text
              style={{
                color: colors.subtext,
                fontSize: 11,
                fontWeight: "700",
                lineHeight: 16,
              }}
            >
              {i18n.t("firstGoal.pick.lineupPreviousNotice", {
                defaultValue:
                  "Ordre basé sur le dernier match de chaque équipe — sera mis à jour dès publication par la MLB.",
              })}
            </Text>
          </View>
        ) : null}

        {selectedTeamBvpNotice ? (
          <Text
            style={{
              color: colors.subtext,
              fontSize: 11,
              fontWeight: "700",
              marginTop: 8,
              lineHeight: 16,
            }}
          >
            {i18n.t("mlb.bvp.teamNoSample", {
              defaultValue:
                "Aucun face-à-face en carrière MLB vs {{pitcher}} pour les frappeurs de cette équipe.",
              pitcher: selectedTeamBvpNotice.pitcherName,
            })}
          </Text>
        ) : null}
      </View>
    );
  }, [
    colors,
    derived.league,
    lineupsAvailable,
    lineupsProvisional,
    selectedTeamBvpNotice,
    lang,
  ]);

  if (loading) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
          <TopBar
            title={i18n.t("firstGoal.pick.title", { defaultValue: "First goal" })}
            subtitle={i18n.t("common.loading", { defaultValue: "Chargement…" })}
            colors={colors}
            onBack={goBackOrHome}
            onClose={goBackOrHome}
          />
          <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
            <ActivityIndicator color={colors.primary} />
          </View>
        </SafeAreaView>
      </>
    );
  }

  if (!challenge) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
          <TopBar
            title={i18n.t("firstGoal.pick.title", { defaultValue: "First goal" })}
            subtitle={i18n.t("common.error", { defaultValue: "Erreur" })}
            colors={colors}
            onBack={goBackOrHome}
            onClose={goBackOrHome}
          />
          <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 24 }}>
            <Text style={{ color: colors.subtext, textAlign: "center" }}>
              {i18n.t("firstGoal.pick.challengeMissing", {
                defaultValue: "Ce défi est introuvable.",
              })}
            </Text>
          </View>
        </SafeAreaView>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />

      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <TopBar
          title={derived.headerLine}
          subtitle={derived.subtitle}
          colors={colors}
          onBack={goBackOrHome}
          onClose={goBackOrHome}
        />

        <FgcMatchupHeader
          challenge={challenge}
          probablePitchers={probablePitchers}
          selectedTeam={selectedTeam}
          onSelectTeam={setSelectedTeam}
          colors={colors}
        />

        <FlatList
          data={filteredPlayers}
          extraData={`${entry?.playerId || ""}:${selectedTeam}:${derived.league}:${activeSeasonPair.current}`}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          ItemSeparatorComponent={ItemSeparator}
          ListHeaderComponent={ListHeader}
          contentContainerStyle={{
            paddingHorizontal: 12,
            paddingBottom: 12 + insets.bottom,
          }}
          initialNumToRender={12}
          maxToRenderPerBatch={12}
          windowSize={7}
          removeClippedSubviews
          ListEmptyComponent={
            loadingPlayers ? (
              <View style={{ paddingTop: 24, alignItems: "center" }}>
                <ActivityIndicator color={colors.primary} />
                <Text style={{ color: colors.subtext, marginTop: 10, fontSize: 13 }}>
                  {i18n.t("firstGoal.pick.loadingPlayers", {
                    defaultValue: "Chargement des joueurs…",
                  })}
                </Text>
              </View>
            ) : (
              <View style={{ paddingHorizontal: 12, paddingTop: 10 }}>
                <Text style={{ color: colors.subtext }}>
                  {i18n.t("firstGoal.pick.noResults", { defaultValue: "Aucun joueur trouvé." })}
                </Text>
              </View>
            )
          }
        />

        <NovaCoachPlayerModal
          visible={!!novaModalPlayer}
          onClose={() => setNovaModalPlayer(null)}
          player={
            novaModalPlayer
              ? {
                  ...novaModalPlayer,
                  lineupSlot:
                    lineupsAvailable && mlbLineups
                      ? lineupSlotForPlayer(
                          mlbLineups,
                          novaModalPlayer,
                          safeAbbr(challenge?.homeAbbr),
                          safeAbbr(challenge?.awayAbbr)
                        )
                      : novaModalPlayer?.lineupSlot ?? null,
                  bvpVsOpposingStarter:
                    novaModalPlayer?.bvpVsOpposingStarter ||
                    bvpByPlayerId[String(novaModalPlayer?.playerId ?? novaModalPlayer?.id ?? "")] ||
                    null,
                  opposingPitcherForBvp:
                    novaModalPlayer?.opposingPitcherForBvp ||
                    bvpPitcherByPlayerId[String(novaModalPlayer?.playerId ?? novaModalPlayer?.id ?? "")] ||
                    null,
                }
              : null
          }
          challengeId={String(challenge.id)}
          domain="fgc"
          sport={derived.league}
          gameId={challenge?.gamePk ?? challenge?.gameId ?? challenge?.mlbGameId ?? null}
          probablePitchers={probablePitchers}
          homeAbbr={challenge?.homeAbbr}
          awayAbbr={challenge?.awayAbbr}
          disabled={derived.locked || saving}
        />
      </SafeAreaView>
    </>
  );
}