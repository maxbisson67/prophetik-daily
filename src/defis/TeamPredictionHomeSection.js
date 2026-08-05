// src/defis/TeamPredictionHomeSection.js

import React, { useEffect, useMemo, useState } from "react";
import { snapshotExists, snapshotData, snapshotId } from "@src/lib/safeSnapshot";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import firestore from "@react-native-firebase/firestore";
import functions from "@react-native-firebase/functions";
import { useRouter } from "expo-router";
import { useAuth } from "@src/auth/SafeAuthProvider";
import i18n from "@src/i18n/i18n";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import TeamLogoBadge from "@src/sports/TeamLogoBadge";
import { lookupTeamByAbbr } from "@src/groups/data/fallbackTeams";
import TeamPredictionBundleHomeCard from "@src/defis/TeamPredictionBundleHomeCard";
import TpHomeDeadlineBlock from "@src/defis/TpHomeDeadlineBlock";
import { listenRNFB } from "@src/home/firestoreListen";
import ResultsTabHint from "@src/home/components/ResultsTabHint";
import DefiChallengeInfoBubble from "@src/home/components/DefiChallengeInfoBubble";
import { lookupPickByGameId } from "@src/defis/tpBundleDisplayHelpers";
import { PARTICIPANT_MODIFY_CTA, PARTICIPANT_PRIMARY_CTA } from "@src/defis/participant/participantCtaStyles";
import { resolveTpSlotMatchStatus } from "@src/defis/match/matchTaskStatus";
import TpMatchMetaColumn from "@src/defis/TpMatchMetaColumn";
import { buildTpBundleTabProgress } from "@src/defis/tpTabProgress";
import TpHomePredictionRow, { isCompleteTpPick } from "@src/defis/TpHomePredictionRow";
import ParticipantPredictionFrame from "@src/defis/participant/ParticipantPredictionFrame";
import MatchTaskStatusChip from "@src/defis/match/MatchTaskStatusChip";
import {
  getChallengeAccent,
  paleChallengeBackground,
} from "@src/home/components/HomeDefisToggle";
import useMlbScheduleGames from "@src/mlb/useMlbScheduleGames";
import { isMlbGamePostponed } from "@src/mlb/mlbGameStatusUtils";
import { getSlotLockedAt } from "@src/defis/tpDeadlineHelpers";
import {
  getPreviousProphetikBusinessYmdCompact,
} from "@src/lib/prophetikBusinessDate";
import { useProphetikBusinessYmdCompact } from "@src/hooks/useProphetikBusinessDate";
import { resolveChallengeEmptyMessage } from "@src/home/components/AutopilotPendingChallengeHint";

/* ---------------- Helpers ---------------- */

function toDateAny(ts) {
  if (!ts) return null;
  try {
    if (typeof ts?.toDate === "function") return ts.toDate();
    if (ts instanceof Date) return ts;
    const d = new Date(ts);
    if (!d || Number.isNaN(d.getTime())) return null;
    return d;
  } catch {
    return null;
  }
}

function toYmdCompact(date = new Date()) {
  return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(
    date.getDate()
  ).padStart(2, "0")}`;
}

function getDeadline(ch) {
  const explicit =
    ch?.signupDeadline ??
    ch?.signupDeadlineUTC ??
    ch?.signupDeadlineAt ??
    ch?.signupDeadlineAtUTC ??
    ch?.lockedAt ??
    ch?.lockAt ??
    null;

  const d1 = toDateAny(explicit);
  if (d1) return d1;

  const start = toDateAny(ch?.gameStartTimeUTC);
  if (!start || Number.isNaN(start.getTime?.())) return null;
  return new Date(start.getTime() - 5 * 60 * 1000);
}

function safeAbbr(v) {
  return String(v || "").trim().toUpperCase();
}

function isChallengeStillActive(status) {
  const st = String(status || "").toLowerCase();
  return ["open", "locked", "live", "pending", "awaiting_result"].includes(st);
}

function isRecentlyFinished(challenge, delayHours = 4) {
  const ts =
    challenge?.decidedAt ??
    challenge?.closedAt ??
    challenge?.finalizedAt ??
    challenge?.updatedAt ??
    null;

  const d = toDateAny(ts);
  if (!d) return false;

  return Date.now() - d.getTime() <= delayHours * 60 * 60 * 1000;
}

function shouldKeepVisible(challenge, businessYmdCompact) {
  const challengeYmd = String(challenge?.gameYmd || "").trim();

  if (challengeYmd === businessYmdCompact) return true;
  if (isChallengeStillActive(challenge?.status)) return true;
  if (isRecentlyFinished(challenge, 4)) return true;

  return false;
}

/* ---------------- UI subcomponents ---------------- */

function TpMyChoicesDrawerFooter({
  bundle,
  bundleEntry,
  legacyItems = [],
  myEntries = {},
  sportLeague,
  colors,
}) {
  const rows = [];

  if (bundle?.games?.length) {
    const picks = bundleEntry?.picks || {};
    for (const slot of bundle.games) {
      const gameId = String(slot?.gameId || "").trim();
      if (!gameId) continue;
      const pick = lookupPickByGameId(picks, gameId);
      if (!isCompleteTpPick(pick)) continue;
      rows.push({
        key: gameId,
        awayAbbr: slot?.awayAbbr,
        homeAbbr: slot?.homeAbbr,
        pick,
      });
    }
  } else {
    for (const ch of legacyItems) {
      const entry = myEntries[ch.id];
      if (!isCompleteTpPick(entry)) continue;
      rows.push({
        key: ch.id,
        awayAbbr: ch?.awayAbbr,
        homeAbbr: ch?.homeAbbr,
        pick: entry,
      });
    }
  }

  if (!rows.length) return null;

  return (
    <>
      <Text style={{ color: colors.text, fontWeight: "900", marginBottom: 8 }}>
        {i18n.t("tp.home.myChoices", { defaultValue: "Mes choix" })}
      </Text>
      <View style={{ gap: 8 }}>
        {rows.map((row) => (
          <View key={row.key}>
            <MatchupRow
              awayAbbr={row.awayAbbr}
              homeAbbr={row.homeAbbr}
              sport={sportLeague}
              colors={colors}
            />
            <TpHomePredictionRow
              pick={row.pick}
              awayAbbr={row.awayAbbr}
              homeAbbr={row.homeAbbr}
              league={sportLeague}
              colors={colors}
            />
          </View>
        ))}
      </View>
    </>
  );
}

function MatchupRow({ awayAbbr, homeAbbr, sport = "NHL", colors, prominent = false }) {
  const away = safeAbbr(awayAbbr);
  const home = safeAbbr(homeAbbr);
  const league = String(sport || "NHL").toUpperCase() === "MLB" ? "MLB" : "NHL";
  const awayTeam = lookupTeamByAbbr(league, away);
  const homeTeam = lookupTeamByAbbr(league, home);
  const logoSize = prominent ? 28 : 22;
  const abbrSize = prominent ? 16 : undefined;

  return (
    <View style={{ flexDirection: "row", alignItems: "center" }}>
      <TeamLogoBadge team={awayTeam} size={logoSize} colors={colors} />
      <Text
        style={{
          color: colors.text,
          fontWeight: "900",
          marginLeft: 8,
          fontSize: abbrSize,
        }}
      >
        {away || "—"}
      </Text>

      <Text
        style={{
          color: colors.subtext,
          marginHorizontal: 10,
          fontWeight: "900",
          fontSize: abbrSize,
        }}
      >
        @
      </Text>

      <Text
        style={{
          color: colors.text,
          fontWeight: "900",
          marginRight: 8,
          fontSize: abbrSize,
        }}
      >
        {home || "—"}
      </Text>
      <TeamLogoBadge team={homeTeam} size={logoSize} colors={colors} />
    </View>
  );
}

function isTodayTpBundleForHome(bundle, businessYmdCompact) {
  return String(bundle?.gameYmd || "").trim() === String(businessYmdCompact || "").trim();
}

function compareTpBundles(a, b) {
  const statusPriority = {
    open: 0,
    partial: 1,
    locked: 2,
    pending: 3,
    decided: 4,
    closed: 5,
  };

  const aPri = statusPriority[String(a?.status || "").toLowerCase()] ?? 9;
  const bPri = statusPriority[String(b?.status || "").toLowerCase()] ?? 9;
  if (aPri !== bPri) return aPri - bPri;

  return String(b?.gameYmd || "").localeCompare(String(a?.gameYmd || ""));
}

function pickTodayHomeBundle(rows, businessYmdCompact) {
  return (
    rows
      .filter((b) => isTodayTpBundleForHome(b, businessYmdCompact))
      .sort((a, b) => compareTpBundles(a, b))[0] || null
  );
}

function isLegacyChallenge(ch) {
  return !String(ch?.id || "").startsWith("tpb_");
}

function buildTpBundleDocId({ league, groupId, gameYmd }) {
  const lg = String(league || "NHL").toUpperCase() === "MLB" ? "mlb" : "nhl";
  return `tpb_${lg}_${groupId}_${gameYmd}`;
}

/* ---------------- Component ---------------- */

export default function TeamPredictionHomeSection({
  groups = [],
  colors,
  currentGroupId = null,
  currentSport = "NHL",
  hintBundleId = null,
  listenersEnabled = true,
  autopilotEnabled = false,
  onHasChallengeChange,
  onCanCreateBundleChange,
  onUserParticipatedChange,
}) {
  const router = useRouter();
  const { user, authReady } = useAuth();

  const sportLeague = String(currentSport || "NHL").toUpperCase() === "MLB" ? "MLB" : "NHL";
  const businessYmdCompact = useProphetikBusinessYmdCompact();

  const [bundle, setBundle] = useState(null);
  const [bundleEntry, setBundleEntry] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [myEntries, setMyEntries] = useState({});

  const legacyItems = useMemo(
    () =>
      items.filter(
        (ch) =>
          isLegacyChallenge(ch) &&
          String(ch?.league || sportLeague).toUpperCase() === sportLeague
      ),
    [items, sportLeague]
  );

  const mlbScheduleTargets = useMemo(() => {
    if (sportLeague !== "MLB") return [];

    const targets = [];

    if (bundle?.games?.length) {
      const gameYmd = String(bundle?.gameYmd || "").trim();
      bundle.games.forEach((slot) => {
        const gameId = String(slot?.gameId || "").trim();
        if (gameYmd && gameId) targets.push({ gameYmd, gameId });
      });
    }

    legacyItems.forEach((ch) => {
      const gameYmd = String(ch?.gameYmd || "").trim();
      const gameId = String(ch?.gameId || ch?.gamePk || "").trim();
      if (gameYmd && gameId) targets.push({ gameYmd, gameId });
    });

    return targets;
  }, [sportLeague, bundle?.gameYmd, bundle?.games, legacyItems]);

  const scheduleByGameId = useMlbScheduleGames(mlbScheduleTargets);

  const hasAnyTpContent = !!bundle || legacyItems.length > 0;

  const tpProgress = useMemo(() => {
    if (bundle) {
      const games = Array.isArray(bundle.games) ? bundle.games : [];
      return buildTpBundleTabProgress({
        games,
        picks: bundleEntry?.picks || {},
        picksCompletedCount: bundleEntry?.picksCompletedCount,
        scheduleByGameId,
      });
    }

    const total = legacyItems.length;
    if (!total) return { done: 0, total: 0 };

    const done = legacyItems.filter((ch) => !!myEntries[ch.id]).length;
    let progress = { done, total };

    if (progress.total <= 0 || progress.done >= progress.total) {
      return progress;
    }

    const allLegacyExpired = legacyItems.every((ch) => {
      const deadline = getDeadline(ch);
      return deadline ? Date.now() >= deadline.getTime() : false;
    });

    if (allLegacyExpired) {
      return { ...progress, expired: true };
    }

    return progress;
  }, [bundle, bundleEntry, legacyItems, myEntries, scheduleByGameId]);

  const tpChoicesFooter = useMemo(
    () => (
      <TpMyChoicesDrawerFooter
        bundle={bundle}
        bundleEntry={bundleEntry}
        legacyItems={legacyItems}
        myEntries={myEntries}
        sportLeague={sportLeague}
        colors={colors}
      />
    ),
    [bundle, bundleEntry, legacyItems, myEntries, sportLeague, colors]
  );

  useEffect(() => {
    if (typeof onUserParticipatedChange !== "function") return;
    onUserParticipatedChange(tpProgress);
  }, [tpProgress, onUserParticipatedChange, currentGroupId, sportLeague]);

  useEffect(() => {
    if (typeof onHasChallengeChange === "function") {
      onHasChallengeChange(hasAnyTpContent);
    }
  }, [hasAnyTpContent, onHasChallengeChange, currentGroupId, sportLeague]);

  useEffect(() => {
    if (typeof onCanCreateBundleChange === "function") {
      onCanCreateBundleChange(!bundle);
    }
  }, [bundle, onCanCreateBundleChange, currentGroupId, sportLeague]);

  /* ---------------- Bundles ---------------- */

  useEffect(() => {
    const gid = String(currentGroupId || "").trim();
    const uid = String(user?.uid || "").trim();

    if (!listenersEnabled || !authReady || !gid || !uid) {
      if (authReady && !uid) {
        setBundle(null);
        setBundleEntry(null);
      }
      return;
    }

    setBundle(null);
    setBundleEntry(null);

    let cancelled = false;

    async function loadViaCallable() {
      try {
        const fn = functions().httpsCallable("getTeamPredictionBundleForHome");
        const res = await fn({
          groupId: gid,
          league: sportLeague,
          hintBundleId: String(hintBundleId || "").trim() || null,
        });

        if (cancelled) return;

        const nextBundle = res?.data?.bundle || null;
        if (nextBundle && isTodayTpBundleForHome(nextBundle, businessYmdCompact)) {
          setBundle(nextBundle);
          setBundleEntry(res?.data?.entry ?? null);
        } else {
          setBundle(null);
          setBundleEntry(null);
        }

        console.log("[TeamPredictionHomeSection] callable bundle", {
          groupId: gid,
          sportLeague,
          businessYmdCompact,
          selectedId: nextBundle?.id || null,
        });
      } catch (err) {
        console.log("[TeamPredictionHomeSection] callable error", err?.message || err);
      }
    }

    loadViaCallable();

    const unsubs = [];

    const applyBundleDoc = (bundleId, snap) => {
      if (cancelled) return;

      const exists = snapshotExists(snap);

      setBundle((prev) => {
        const candidates = [];
        if (exists) {
          const data = { id: bundleId, ...(snap?.data?.() || snap?.data || {}) };
          if (isTodayTpBundleForHome(data, businessYmdCompact)) candidates.push(data);
        }
        if (
          prev?.id &&
          prev.id !== bundleId &&
          isTodayTpBundleForHome(prev, businessYmdCompact)
        ) {
          candidates.push(prev);
        }
        return pickTodayHomeBundle(candidates, businessYmdCompact);
      });

      if (exists) {
        const data = { id: bundleId, ...(snap?.data?.() || snap?.data || {}) };
        if (isTodayTpBundleForHome(data, businessYmdCompact)) {
          console.log("[TeamPredictionHomeSection] firestore bundle", {
            groupId: gid,
            businessYmdCompact,
            selectedId: bundleId,
          });
        }
      }
    };

    const todayBundleId = buildTpBundleDocId({
      league: sportLeague,
      groupId: gid,
      gameYmd: businessYmdCompact,
    });

    const ref = firestore().doc(`team_prediction_bundles/${todayBundleId}`);
    const unsub = listenRNFB(
      ref,
      (snap) => applyBundleDoc(todayBundleId, snap),
      `tpb:live:${todayBundleId}`,
      (err) => {
        console.log("[TeamPredictionHomeSection] bundle live error", todayBundleId, err?.message || err);
      }
    );

    unsubs.push(unsub);

    const hintId = String(hintBundleId || "").trim();
    if (hintId.startsWith("tpb_")) {
      const hintRef = firestore().doc(`team_prediction_bundles/${hintId}`);
      const unsubHint = listenRNFB(
        hintRef,
        (snap) => applyBundleDoc(hintId, snap),
        `tpb:hint:${hintId}`,
        (err) => {
          console.log("[TeamPredictionHomeSection] bundle hint error", hintId, err?.message || err);
        },
        { screen: "AccueilScreen" }
      );
      unsubs.push(unsubHint);
    }

    return () => {
      cancelled = true;
      unsubs.forEach((unsub) => {
        try {
          unsub?.();
        } catch {}
      });
    };
  }, [
    listenersEnabled,
    authReady,
    user?.uid,
    currentGroupId,
    sportLeague,
    hintBundleId,
    businessYmdCompact,
  ]);

  useEffect(() => {
    if (!user?.uid || !bundle?.id) {
      return;
    }

    const ref = firestore()
      .collection("team_prediction_bundles")
      .doc(String(bundle.id))
      .collection("entries")
      .doc(String(user.uid));

    const unsub = ref.onSnapshot(
      (snap) => setBundleEntry(snapshotExists(snap) ? snapshotData(snap) || null : null),
      (err) => {
        const msg = String(err?.code || err?.message || "");
        if (!msg.includes("permission-denied")) {
          console.log("[TeamPredictionHomeSection] entry error", bundle.id, msg);
        }
      }
    );

    return () => {
      try {
        unsub?.();
      } catch {}
    };
  }, [bundle?.id, user?.uid]);

  /* ---------------- Legacy challenges ---------------- */

  useEffect(() => {
    const gid = String(currentGroupId || "").trim();

    if (!gid) {
      setItems([]);
      setLoading(false);
      return;
    }

    const businessYesterday = getPreviousProphetikBusinessYmdCompact();

    setLoading(true);

    const mapById = new Map();

    const applyMerged = () => {
      const merged = Array.from(mapById.values())
        .filter((ch) => shouldKeepVisible(ch, businessYmdCompact))
        .sort((a, b) => {
          const ta = toDateAny(a?.gameStartTimeUTC)?.getTime?.() || 0;
          const tb = toDateAny(b?.gameStartTimeUTC)?.getTime?.() || 0;
          return ta - tb;
        });

      setItems(merged);
      setLoading(false);
    };

    const attachListenerForYmd = (ymd) =>
      firestore()
        .collection("team_prediction_challenges")
        .where("groupId", "==", gid)
        .where("gameYmd", "==", ymd)
        .onSnapshot(
          (snap) => {
            const nextIds = new Set();

            (snap?.docs ?? []).forEach((d) => {
              nextIds.add(d.id);
              mapById.set(d.id, {
                id: d.id,
                ...d.data(),
              });
            });

            for (const [id, doc] of mapById.entries()) {
              if (String(doc?.groupId || "") !== gid) continue;
              if (String(doc?.gameYmd || "") !== ymd) continue;
              if (!nextIds.has(id)) {
                mapById.delete(id);
              }
            }

            applyMerged();
          },
          (err) => {
            console.log("[TeamPredictionHomeSection] challenges error", err?.message || err);
            setLoading(false);
          }
        );

    const unsubToday = attachListenerForYmd(businessYmdCompact);
    const unsubYesterday =
      businessYmdCompact === businessYesterday ? null : attachListenerForYmd(businessYesterday);

    return () => {
      try {
        unsubToday?.();
      } catch {}
      try {
        unsubYesterday?.();
      } catch {}
    };
  }, [currentGroupId, businessYmdCompact]);

  /* ---------------- Entries (user picks) ---------------- */

  useEffect(() => {
    if (!user?.uid || !items.length) {
      setMyEntries({});
      return;
    }

    setMyEntries({});

    const unsubs = [];

    items.forEach((ch) => {
      const challengeId = String(ch?.id || "").trim();
      if (!challengeId) return;

      const ref = firestore()
        .collection("team_prediction_challenges")
        .doc(String(challengeId))
        .collection("entries")
        .doc(String(user.uid));

      const unsub = ref.onSnapshot(
        (snap) => {
          const data = snap && snapshotExists(snap) ? snapshotData(snap) || null : null;

          setMyEntries((prev) => ({
            ...prev,
            [challengeId]: data,
          }));
        },
        (err) => {
          console.log(
            "[TeamPredictionHomeSection] entry error",
            challengeId,
            err?.message || err
          );

          setMyEntries((prev) => ({
            ...prev,
            [challengeId]: null,
          }));
        }
      );

      unsubs.push(unsub);
    });

    return () => {
      unsubs.forEach((u) => {
        try {
          u?.();
        } catch {}
      });
    };
  }, [items, user?.uid]);

  /* ---------------- UI ---------------- */

  if (loading && !bundle && legacyItems.length === 0) {
    return (
      <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
        <ActivityIndicator size="small" color={colors.subtext} />
      </View>
    );
  }

  if (!hasAnyTpContent) {
    return (
      <>
        <DefiChallengeInfoBubble kind="tp" colors={colors} inIntroBand />
        <View style={{ marginBottom: 14 }}>
          <View
            style={{
              padding: 12,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.card,
            }}
          >
            <Text style={{ color: colors.subtext, fontSize: 13 }}>
              {resolveChallengeEmptyMessage({
                autopilotEnabled,
                fallbackKey: "tp.home.empty",
                fallbackDefault:
                  "Aucune prédiction de matchs disponible aujourd’hui dans tes groupes.",
              })}
            </Text>
          </View>
        </View>
      </>
    );
  }

  return (
    <>
      <DefiChallengeInfoBubble
        kind="tp"
        colors={colors}
        inIntroBand
        footerContent={tpChoicesFooter}
      />
      <View style={{ marginBottom: 14 }}>
        <View style={{ gap: 10 }}>
          {bundle ? (
            <TeamPredictionBundleHomeCard
              bundle={bundle}
              entry={bundleEntry}
              league={sportLeague}
              colors={colors}
              groupId={currentGroupId}
              scheduleByGameId={scheduleByGameId}
            />
          ) : null}

          {legacyItems.map((ch) => {
            const awayAbbr = safeAbbr(ch?.awayAbbr);
            const homeAbbr = safeAbbr(ch?.homeAbbr);
            const challengeLeague =
              String(ch?.league || sportLeague).toUpperCase() === "MLB" ? "MLB" : "NHL";

            const entry = myEntries[ch.id];
            const hasEntry = !!entry;

            const deadline = getDeadline(ch);

            const participants =
              Number(ch?.participantsCount ?? 0) ||
              (Array.isArray(ch?.participantUids) ? ch.participantUids.length : 0);

            const statusLower = String(ch.status || "").toLowerCase();
            const gameId = String(ch?.gameId || ch?.gamePk || "").trim();
            const scheduleInfo = scheduleByGameId[gameId] || null;
            const postponed =
              challengeLeague === "MLB" && isMlbGamePostponed(scheduleInfo?.status);

            const locked =
              !postponed &&
              (statusLower === "locked" ||
                statusLower === "live" ||
                statusLower === "pending" ||
                statusLower === "decided" ||
                statusLower === "closed" ||
                (deadline ? Date.now() >= deadline.getTime() : false));

            const ctaLabel = hasEntry
              ? i18n.t("tp.home.modifyTeam", { defaultValue: "Modifier mon équipe" })
              : i18n.t("common.participate", { defaultValue: "Participer" });

            const onPressPrimary = () => {
              router.push({
                pathname: "/(drawer)/(team-prediction)/pick/[challengeId]",
                params: { challengeId: ch.id },
              });
            };

            const matchTask = resolveTpSlotMatchStatus(ch, {
              scheduleStatus: scheduleInfo?.status,
            });

            return (
              <View
                key={ch.id}
                style={{
                  padding: 12,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.card,
                }}
              >
                <View style={{ marginBottom: 8 }}>
                  <MatchupRow
                    awayAbbr={awayAbbr}
                    homeAbbr={homeAbbr}
                    sport={challengeLeague}
                    colors={colors}
                    prominent
                  />
                </View>

                <ParticipantPredictionFrame
                  colors={colors}
                  accentColor={getChallengeAccent("tp")}
                  backgroundColor={paleChallengeBackground("tp")}
                  statusChip={<MatchTaskStatusChip task={matchTask} colors={colors} compact />}
                  style={{ marginBottom: 8 }}
                >
                  <TpHomePredictionRow
                    variant="scoreGrid"
                    pick={entry}
                    awayAbbr={awayAbbr}
                    homeAbbr={homeAbbr}
                    league={challengeLeague}
                    lockDeadline={getSlotLockedAt(ch) || deadline}
                    colors={colors}
                    style={{ marginTop: 0 }}
                  />
                </ParticipantPredictionFrame>

                <TpHomeDeadlineBlock
                  locked={locked}
                  deadline={deadline}
                  postponed={postponed}
                  colors={colors}
                />

                <View style={{ flexDirection: "row", alignItems: "center", marginTop: 8 }}>
                  <MaterialCommunityIcons name="account-group" size={16} color={colors.subtext} />
                  <Text style={{ color: colors.subtext, marginLeft: 6, fontSize: 13 }}>
                    {participants}{" "}
                    {i18n.t("common.participants", { defaultValue: "participant(s)" })}
                  </Text>
                </View>

                <View style={{ marginTop: 12, gap: 10 }}>
                  <ResultsTabHint colors={colors} groupId={currentGroupId} />

                  {!locked ? (
                    <TouchableOpacity
                      onPress={onPressPrimary}
                      activeOpacity={0.9}
                      style={
                        hasEntry ? PARTICIPANT_MODIFY_CTA.button : PARTICIPANT_PRIMARY_CTA.button
                      }
                    >
                      <Text
                        style={
                          hasEntry ? PARTICIPANT_MODIFY_CTA.text : PARTICIPANT_PRIMARY_CTA.text
                        }
                      >
                        {ctaLabel}
                      </Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>
            );
          })}
        </View>
      </View>
    </>
  );
}