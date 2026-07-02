// src/firstGoal/FirstGoalHomeSection.js
import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import firestore from "@react-native-firebase/firestore";
import { useRouter } from "expo-router";
import { useAuth } from "@src/auth/SafeAuthProvider";
import i18n from "@src/i18n/i18n";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import TeamLogoBadge from "@src/sports/TeamLogoBadge";
import { lookupTeamByAbbr } from "@src/groups/data/fallbackTeams";
import ResultsTabHint from "@src/home/components/ResultsTabHint";
import {
  getFgcTitle,
  getFgcMode,
} from "@src/firstGoal/fgcChallengeUtils";
import { isFgcChallengeParticipationOpen } from "@src/firstGoal/fgcGameScheduleUtils";
import useFgcGameSchedules from "@src/firstGoal/useFgcGameSchedules";
import ParticipantTaskStatusChip from "@src/defis/participant/ParticipantTaskStatusChip";
import MatchTaskStatusChip from "@src/defis/match/MatchTaskStatusChip";
import {
  formatParticipantCtaLabel,
  resolveParticipantTaskStatus,
} from "@src/defis/participant/participantTaskStatus";
import { PARTICIPANT_MODIFY_CTA, PARTICIPANT_PRIMARY_CTA } from "@src/defis/participant/participantCtaStyles";
import { resolveFgcMatchStatus } from "@src/defis/match/matchTaskStatus";
import {
  getProphetikBusinessYmd,
} from "@src/lib/prophetikBusinessDate";
import {
  fgcHomeYmdCandidates,
  hasFgcForBusinessToday,
  normalizeFgcGameYmd,
  shouldShowFgcOnHome,
} from "@src/firstGoal/fgcHomeVisibility";

function chunk(arr, size = 10) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

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

function fmtTimeShort(ts) {
  const d = toDateAny(ts);
  if (!d) return null;
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

function getSignupDeadline(ch) {
  const explicit =
    ch?.signupDeadline ??
    ch?.signupDeadlineUTC ??
    ch?.signupDeadlineAt ??
    ch?.signupDeadlineAtUTC ??
    ch?.lockAtUTC ??
    ch?.lockAt;

  const d1 = toDateAny(explicit);
  if (d1) return d1;

  const start = toDateAny(ch?.gameStartTimeUTC);
  if (!start) return null;

  return new Date(start.getTime() - 5 * 60 * 1000);
}

function safeAbbr(v) {
  return String(v || "").trim().toUpperCase();
}

function listenMyPickForChallenge({ challengeId, uid, onData, onError }) {
  if (!challengeId || !uid) return () => {};

  const ref = firestore()
    .collection("first_goal_challenges")
    .doc(String(challengeId))
    .collection("entries")
    .doc(String(uid));

  return ref.onSnapshot(
    (snap) => {
      const data = snap?.exists ? snap.data() || null : null;
      const hasPick = !!String(data?.playerId || "").trim();

      onData?.({
        exists: !!snap?.exists,
        hasPick,
        data,
      });
    },
    (err) => {
      onError?.(err);
    }
  );
}

/* ------------------------------ UI subcomponents --------------------------- */

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

/* -------------------------------- Component -------------------------------- */

export default function FirstGoalHomeSection({
  groups = [],
  colors,
  currentGroupId = null,
  currentSport = "NHL",
  listenersEnabled = true,
  hintChallengeId = null,
  onHasChallengeChange,
  onUserParticipatedChange,
}) {
  const router = useRouter();
  const { user } = useAuth();

  const sportLeague = String(currentSport || "NHL").toUpperCase() === "MLB" ? "MLB" : "NHL";

  const groupIds = useMemo(() => {
    return (groups || [])
      .filter(
        (g) => String(g?.sport || g?.league || "NHL").toUpperCase() === sportLeague
      )
      .map((g) => String(g?.id || ""))
      .filter(Boolean);
  }, [groups, sportLeague]);

  const [allChallenges, setAllChallenges] = useState([]);
  const [loading, setLoading] = useState(false);
  const [myPickByChallengeId, setMyPickByChallengeId] = useState({});

  const prophetikDay = getProphetikBusinessYmd();
  const ymdCandidates = useMemo(() => fgcHomeYmdCandidates(), [prophetikDay]);
  const ymdCandidateSet = useMemo(() => new Set(ymdCandidates), [ymdCandidates]);

  const items = useMemo(() => {
    const list = (allChallenges || []).filter((ch) =>
      shouldShowFgcOnHome(ch, prophetikDay, ymdCandidateSet)
    );
    const hintId = String(hintChallengeId || "").trim();

    const weight = (st) =>
      st === "open"
        ? 0
        : st === "locked"
          ? 1
          : st === "pending"
            ? 2
            : st === "decided"
              ? 3
              : 4;

    list.sort((a, b) => {
      if (hintId) {
        const aHint = String(a?.id || "") === hintId;
        const bHint = String(b?.id || "") === hintId;
        if (aHint !== bHint) return aHint ? -1 : 1;
      }

      const wa = weight(String(a.status || "").toLowerCase());
      const wb = weight(String(b.status || "").toLowerCase());
      if (wa !== wb) return wa - wb;

      const ta = a.gameStartTimeUTC?.toDate?.()
        ? a.gameStartTimeUTC.toDate().getTime()
        : 0;
      const tb = b.gameStartTimeUTC?.toDate?.()
        ? b.gameStartTimeUTC.toDate().getTime()
        : 0;
      return ta - tb;
    });

    return list;
  }, [allChallenges, prophetikDay, ymdCandidateSet, hintChallengeId]);

  const gameSchedulesByChallengeId = useFgcGameSchedules(items.slice(0, 6));

  useEffect(() => {
    if (typeof onHasChallengeChange !== "function") return;

    const hasTodayChallenge = (allChallenges || []).some((ch) =>
      hasFgcForBusinessToday(ch, prophetikDay, ymdCandidateSet, sportLeague)
    );

    onHasChallengeChange(hasTodayChallenge);
  }, [allChallenges, onHasChallengeChange, prophetikDay, sportLeague, ymdCandidateSet]);

  const fgcTabProgress = useMemo(() => {
    const todayChallenges = (allChallenges || []).filter((ch) =>
      hasFgcForBusinessToday(ch, prophetikDay, ymdCandidateSet, sportLeague)
    );

    if (!todayChallenges.length) return { done: 0, total: 0 };

    const done = todayChallenges.some((ch) => {
      const challengeId = String(ch?.id || "").trim();
      return !!myPickByChallengeId?.[challengeId]?.hasPick;
    })
      ? 1
      : 0;

    const expired =
      done < 1 &&
      todayChallenges.every((ch) => {
        const deadline = getSignupDeadline(ch);
        return deadline ? Date.now() >= deadline.getTime() : false;
      });

    return { done, total: 1, ...(expired ? { expired: true } : {}) };
  }, [allChallenges, myPickByChallengeId, prophetikDay, sportLeague, ymdCandidateSet]);

  useEffect(() => {
    if (typeof onUserParticipatedChange !== "function") return;
    onUserParticipatedChange(fgcTabProgress);
  }, [fgcTabProgress, onUserParticipatedChange]);

  useEffect(() => {
    const gid = String(currentGroupId || "").trim();
    const targetGroupIds = gid ? [gid] : groupIds;

    if (!listenersEnabled || !targetGroupIds.length) {
      if (!listenersEnabled) return;
      setAllChallenges([]);
      setLoading(false);
      return;
    }

    setAllChallenges([]);
    setLoading(true);

    const unsubs = [];
    const mapById = new Map();
    const listenerKeys = new Map();

    const syncChallenges = () => {
      setAllChallenges(Array.from(mapById.values()));
      setLoading(false);
    };

    const idsChunks = gid ? [targetGroupIds] : chunk(targetGroupIds, 10);

    idsChunks.forEach((ids) => {
      ymdCandidates.forEach((gameYmd) => {
        const listenerKey = `${ids.join(",")}|${gameYmd}`;
        const base = firestore()
          .collection("first_goal_challenges")
          .where("groupId", ids.length === 1 ? "==" : "in", ids.length === 1 ? String(ids[0]) : ids)
          .where("gameYmd", "==", gameYmd)
          .where("league", "==", sportLeague)
          .where("type", "==", "first_goal");

        const unsub = base.onSnapshot(
          (snap) => {
            const nextIds = new Set(snap.docs.map((d) => d.id));
            const prevIds = listenerKeys.get(listenerKey) || new Set();

            prevIds.forEach((docId) => {
              if (!nextIds.has(docId)) mapById.delete(docId);
            });

            snap.docs.forEach((d) => {
              mapById.set(d.id, { id: d.id, ...(d.data() || {}) });
            });

            listenerKeys.set(listenerKey, nextIds);
            syncChallenges();
          },
          (err) => {
            console.log(
              "[FirstGoalHomeSection] error",
              String(err?.code || ""),
              err?.message || String(err)
            );
            setLoading(false);
          }
        );

        unsubs.push(unsub);
      });
    });

    return () => {
      unsubs.forEach((u) => {
        try {
          u();
        } catch {}
      });
    };
  }, [listenersEnabled, groupIds.join("|"), currentGroupId, sportLeague, ymdCandidates.join("|")]);

  useEffect(() => {
    const challengeIds = (allChallenges || [])
      .map((ch) => String(ch?.id || "").trim())
      .filter(Boolean);

    if (!listenersEnabled || !user?.uid || !challengeIds.length) {
      if (!listenersEnabled) return;
      setMyPickByChallengeId({});
      return;
    }

    const unsubs = [];

    challengeIds.forEach((challengeId) => {
      const unsub = listenMyPickForChallenge({
        challengeId,
        uid: String(user.uid),
        onData: ({ hasPick, data }) => {
          setMyPickByChallengeId((prev) => ({
            ...prev,
            [challengeId]: {
              hasPick,
              data: data || null,
            },
          }));
        },
        onError: (err) => {
          console.log(
            "[FirstGoalHomeSection] my pick error",
            challengeId,
            err?.message || err
          );

          setMyPickByChallengeId((prev) => ({
            ...prev,
            [challengeId]: {
              hasPick: false,
              data: null,
            },
          }));
        },
      });

      unsubs.push(unsub);
    });

    return () => {
      unsubs.forEach((u) => {
        try {
          u();
        } catch {}
      });
    };
  }, [listenersEnabled, allChallenges, user?.uid]);

  return (
    <>
      <View style={{ marginBottom: 14 }}>
        {loading ? (
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
            <ActivityIndicator size="small" color={colors.subtext} />
          </View>
        ) : null}

        {items.length === 0 ? (
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
              {i18n.t("firstGoal.home.empty", {
                defaultValue: "Aucun défi 'premier but' aujourd’hui dans tes groupes.",
              })}
            </Text>
          </View>
        ) : (
          <View style={{ gap: 10 }}>
            {items.slice(0, 6).map((ch) => {
              const awayAbbr = safeAbbr(ch?.awayAbbr);
              const homeAbbr = safeAbbr(ch?.homeAbbr);
              const challengeLeague =
                String(ch?.league || sportLeague).toUpperCase() === "MLB" ? "MLB" : "NHL";

              const participants =
                Number(ch.participantsCount ?? 0) ||
                (Array.isArray(ch.participantUids) ? ch.participantUids.length : 0);

              const deadline = getSignupDeadline(ch);
              const deadlineHM = fmtTimeShort(deadline);
              const deadlinePassed = deadline ? Date.now() >= deadline.getTime() : false;

              const challengeId = String(ch?.id || "").trim();
              const isHintedChallenge =
                !!hintChallengeId && challengeId === String(hintChallengeId).trim();
              const myPick = myPickByChallengeId?.[challengeId]?.data || null;
              const hasMyPick = !!myPickByChallengeId?.[challengeId]?.hasPick;

              const scheduleInfo = gameSchedulesByChallengeId?.[challengeId] || null;
              const participation = isFgcChallengeParticipationOpen({
                challengeStatus: ch?.status,
                scheduleStatus: scheduleInfo?.status,
                hasMyPick,
                deadlinePassed,
              });

              const st = String(ch.status || "").toLowerCase();
              const isLocked = st !== "open" && !participation.showPostponed;
              const shouldShowParticipate = participation.canParticipate;
              const shouldShowEdit = participation.canEdit;
              const showParticipateCta = shouldShowParticipate || shouldShowEdit;

              if (__DEV__) {
                console.log("[FGC HOME DEBUG]", {
                  currentSport: sportLeague,
                  challengeId: ch?.id,
                  league: ch?.league,
                  type: ch?.type,
                  fgcMode: getFgcMode(ch),
                  status: ch?.status,
                  gameId: ch?.gameId,
                  gameStartTimeUTC: ch?.gameStartTimeUTC,
                  hasEntry: hasMyPick,
                  isLocked,
                  shouldShowParticipate,
                  shouldShowEdit,
                });
              }

              const isDecided =
                (st === "decided" || st === "closed") && !participation.showPostponed;

              const participantTask = resolveParticipantTaskStatus(
                {
                  kind: "fgc",
                  id: challengeId,
                  status: ch?.status,
                  raw: ch,
                },
                {
                  isToday: !isDecided,
                  scheduleStatus: scheduleInfo?.status,
                  participation: { hasPick: hasMyPick, data: myPick },
                  hasPick: hasMyPick,
                }
              );

              const matchTask = resolveFgcMatchStatus(ch, {
                scheduleStatus: scheduleInfo?.status,
              });

              const pickedPlayerName =
                myPick?.playerName ||
                myPick?.selectedPlayerName ||
                myPick?.pickPlayerName ||
                "—";

              const pickedTeamAbbr = safeAbbr(
                myPick?.teamAbbr ||
                  myPick?.playerTeamAbbr ||
                  myPick?.selectedTeamAbbr
              );

              const ctaLabel =
                formatParticipantCtaLabel(
                  participantTask.showPrimaryCta
                    ? participantTask.ctaKey
                    : participantTask.showModifyCta
                    ? "modify"
                    : null
                ) ||
                (hasMyPick
                  ? i18n.t("firstGoal.cta.modifyPick", { defaultValue: "Modifier mon joueur" })
                  : i18n.t("firstGoal.live.join", { defaultValue: "Participer" }));

              const showPrimaryCta = participantTask.showPrimaryCta && showParticipateCta;
              const showModifyCta = participantTask.showModifyCta && showParticipateCta && !showPrimaryCta;

              const onPressCta = () => {
                if (!challengeId) return;
                router.push(`/(first-goal)/pick/${challengeId}`);
              };

              return (
                <View
                  key={String(ch.id)}
                  style={{
                    padding: 12,
                    borderRadius: 12,
                    borderWidth: isHintedChallenge ? 2 : 1,
                    borderColor: isHintedChallenge ? "#b91c1c" : colors.border,
                    backgroundColor: colors.card,
                  }}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "flex-start",
                      justifyContent: "space-between",
                      gap: 10,
                      marginBottom: 8,
                    }}
                  >
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <MatchupRow
                        awayAbbr={awayAbbr}
                        homeAbbr={homeAbbr}
                        sport={challengeLeague}
                        colors={colors}
                        prominent
                      />
                    </View>

                    <MatchTaskStatusChip task={matchTask} colors={colors} compact />
                  </View>

                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "flex-start",
                      justifyContent: "space-between",
                      gap: 10,
                      marginBottom: 8,
                    }}
                  >
                    <Text
                      style={{ color: colors.text, fontWeight: "900", fontSize: 17, flex: 1 }}
                      numberOfLines={2}
                    >
                      {getFgcTitle(ch, i18n.t.bind(i18n))}
                    </Text>

                    {!isDecided ? (
                      <ParticipantTaskStatusChip
                        task={participantTask}
                        colors={colors}
                        compact
                      />
                    ) : null}
                  </View>

                  {!(deadlinePassed || isDecided) && !participation.showPostponed ? (
                    <View style={{ marginTop: 12, gap: 8 }}>
                      {showPrimaryCta ? (
                        <TouchableOpacity
                          onPress={onPressCta}
                          activeOpacity={0.9}
                          style={PARTICIPANT_PRIMARY_CTA.button}
                        >
                          <Text style={PARTICIPANT_PRIMARY_CTA.text}>{ctaLabel}</Text>
                        </TouchableOpacity>
                      ) : null}

                      {showModifyCta ? (
                        <TouchableOpacity
                          onPress={onPressCta}
                          activeOpacity={0.9}
                          style={PARTICIPANT_MODIFY_CTA.button}
                        >
                          <Text style={PARTICIPANT_MODIFY_CTA.text}>{ctaLabel}</Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  ) : null}

                  <Text style={{ color: colors.subtext, marginTop: 8, fontSize: 12 }}>
                    {participation.showPostponed ? (
                      <>
                        {i18n.t("firstGoal.home.gameStatus", {
                          defaultValue: "Statut du match",
                        })}
                        {": "}
                        <Text style={{ color: "#d97706", fontWeight: "900" }}>
                          {i18n.t("firstGoal.home.postponed", { defaultValue: "Reporté" })}
                        </Text>
                      </>
                    ) : (
                      <>
                        {i18n.t("firstGoal.home.signupDeadline", {
                          defaultValue: "Heure limite d'inscription",
                        })}
                        {": "}
                        {deadlinePassed ? (
                          <Text style={{ color: colors.text, fontWeight: "900" }}>
                            {i18n.t("firstGoal.home.signupClosed", { defaultValue: "Fermé" })}
                          </Text>
                        ) : (
                          <Text style={{ color: colors.text, fontWeight: "900" }}>
                            {deadlineHM || "—"}
                          </Text>
                        )}
                      </>
                    )}
                  </Text>

                  <View style={{ flexDirection: "row", alignItems: "center", marginTop: 8 }}>
                    <MaterialCommunityIcons name="account-group" size={16} color={colors.subtext} />
                    <Text style={{ color: colors.subtext, marginLeft: 6, fontSize: 13 }}>
                      {participants}{" "}
                      {i18n.t("common.participants", { defaultValue: "participant(s)" })}
                    </Text>
                  </View>

                  {hasMyPick ? (
                    <View
                      style={{
                        marginTop: 8,
                        flexDirection: "row",
                        alignItems: "center",
                        flexWrap: "wrap",
                      }}
                    >
                      <Text style={{ color: colors.subtext, fontSize: 13 }}>
                        {i18n.t("firstGoal.home.myPrediction", { defaultValue: "Ma prédiction" })}
                        {": "}
                      </Text>

                      {pickedTeamAbbr ? (
                        <TeamLogoBadge
                          team={lookupTeamByAbbr(challengeLeague, pickedTeamAbbr)}
                          size={18}
                          colors={colors}
                        />
                      ) : null}

                      <Text
                        style={{
                          color: colors.text,
                          fontWeight: "900",
                          fontSize: 13,
                          marginLeft: pickedTeamAbbr ? 6 : 0,
                        }}
                      >
                        {pickedPlayerName}
                      </Text>
                    </View>
                  ) : null}

                  <View style={{ marginTop: 8, gap: 8 }}>
                    {!participation.showPostponed ? (
                      <ResultsTabHint colors={colors} groupId={currentGroupId} />
                    ) : null}
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </View>
    </>
  );
}