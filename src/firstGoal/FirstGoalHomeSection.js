// src/firstGoal/FirstGoalHomeSection.js
import React, { useEffect, useMemo, useState, useCallback } from "react";
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
  getFgcResultPlayerName,
  getFgcResultTeamAbbr,
  getFgcTitle,
  getFgcResultPrefix,
  getFgcMode,
} from "@src/firstGoal/fgcChallengeUtils";

function chunk(arr, size = 10) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function todayYmdLocal() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
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
      const hasPick = !!data?.playerId;

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

function InfoBubbleFGC({ colors }) {
  const [open, setOpen] = useState(false);

  return (
    <View
      style={{
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.card2,
        marginBottom: 10,
        overflow: "hidden",
      }}
    >
      <TouchableOpacity
        onPress={() => setOpen((v) => !v)}
        activeOpacity={0.85}
        style={{
          paddingHorizontal: 12,
          paddingVertical: 10,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
          <MaterialCommunityIcons
            name="information-outline"
            size={18}
            color={colors.subtext}
            style={{ marginTop: 1 }}
          />
          <Text style={{ color: colors.text, fontWeight: "900", marginLeft: 8, flex: 1 }}>
            {i18n.t("firstGoal.home.infoTitle", { defaultValue: "C’est quoi ce défi?" })}
          </Text>
        </View>

        <MaterialCommunityIcons
          name={open ? "chevron-up" : "chevron-down"}
          size={22}
          color={colors.subtext}
        />
      </TouchableOpacity>

      {open ? (
        <View
          style={{
            paddingHorizontal: 12,
            paddingBottom: 12,
            borderTopWidth: 1,
            borderTopColor: colors.border,
          }}
        >
          <Text style={{ color: colors.subtext, marginTop: 10, lineHeight: 18 }}>
            {i18n.t("firstGoal.home.infoBody", {
              defaultValue:
                "• Choisis le joueur qui marquera le premier but ou le premier point produit du match.\n• 5 points seront alloués à celui qui a prédit le bon joueur.",
            })}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function MatchupRow({ awayAbbr, homeAbbr, sport = "NHL", colors }) {
  const away = safeAbbr(awayAbbr);
  const home = safeAbbr(homeAbbr);
  const league = String(sport || "NHL").toUpperCase() === "MLB" ? "MLB" : "NHL";
  const awayTeam = lookupTeamByAbbr(league, away);
  const homeTeam = lookupTeamByAbbr(league, home);

  return (
    <View style={{ flexDirection: "row", alignItems: "center" }}>
      <TeamLogoBadge team={awayTeam} size={22} colors={colors} />
      <Text style={{ color: colors.text, fontWeight: "900", marginLeft: 8 }}>
        {away || "—"}
      </Text>

      <Text style={{ color: colors.subtext, marginHorizontal: 10, fontWeight: "900" }}>
        @
      </Text>

      <Text style={{ color: colors.text, fontWeight: "900", marginRight: 8 }}>
        {home || "—"}
      </Text>
      <TeamLogoBadge team={homeTeam} size={22} colors={colors} />
    </View>
  );
}

/* -------------------------------- Component -------------------------------- */

export default function FirstGoalHomeSection({
  groups = [],
  colors,
  currentGroupId = null,
  currentSport = "NHL",
  onHasChallengeChange,
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

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [myPickByChallengeId, setMyPickByChallengeId] = useState({});

  const mergeAndSet = useCallback((mapById) => {
    const list = Array.from(mapById.values());

    const weight = (st) =>
      st === "open" ? 0 : st === "locked" ? 1 : st === "pending" ? 2 : st === "decided" ? 3 : 4;

    list.sort((a, b) => {
      const wa = weight(String(a.status || "").toLowerCase());
      const wb = weight(String(b.status || "").toLowerCase());
      if (wa !== wb) return wa - wb;

      const ta = a.gameStartTimeUTC?.toDate?.() ? a.gameStartTimeUTC.toDate().getTime() : 0;
      const tb = b.gameStartTimeUTC?.toDate?.() ? b.gameStartTimeUTC.toDate().getTime() : 0;
      return ta - tb;
    });

    setItems(list);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (typeof onHasChallengeChange !== "function") return;
    onHasChallengeChange(items.length > 0);
  }, [items.length, onHasChallengeChange]);

  useEffect(() => {
    const gid = String(currentGroupId || "").trim();
    const targetGroupIds = gid ? [gid] : groupIds;

    if (!targetGroupIds.length) {
      setItems([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const ymd = todayYmdLocal();

    const unsubs = [];
    const mapById = new Map();
    const chunkDocIds = new Map();

    const makeQuery = (ids) => {
      const base = firestore()
        .collection("first_goal_challenges")
        .where("league", "==", sportLeague)
        .where("type", "==", "first_goal")
        .where("gameYmd", "==", ymd);

      if (ids.length === 1) return base.where("groupId", "==", String(ids[0]));
      return base.where("groupId", "in", ids);
    };

    console.log("[HOME FGC QUERY]", {
      currentSport: sportLeague,
      gameYmd: ymd,
      targetGroupIds,
    });

    const idsChunks = gid ? [targetGroupIds] : chunk(targetGroupIds, 10);

    idsChunks.forEach((ids) => {
      const chunkKey = ids.join(",");
      const q = makeQuery(ids);

      const unsub = q.onSnapshot(
        (snap) => {
          const nextIds = new Set(snap.docs.map((d) => d.id));
          const prevIds = chunkDocIds.get(chunkKey) || new Set();

          prevIds.forEach((docId) => {
            if (!nextIds.has(docId)) mapById.delete(docId);
          });

          snap.docs.forEach((d) => {
            const data = d.data() || {};
            const league = String(data.league || sportLeague).toUpperCase();
            if (league === sportLeague) {
              mapById.set(d.id, { id: d.id, ...data });
            } else {
              mapById.delete(d.id);
            }
          });

          const merged = Array.from(mapById.values()).filter(
            (ch) => String(ch?.league || sportLeague).toUpperCase() === sportLeague
          );

          console.log(
            "[HOME FGC RAW]",
            snap.docs.map((d) => ({
              id: d.id,
              league: d.data()?.league,
              fgcMode: d.data()?.fgcMode,
              gameId: d.data()?.gameId,
              status: d.data()?.status,
            }))
          );
          console.log(
            "[HOME FGC FILTERED]",
            sportLeague,
            merged.map((ch) => ({
              id: ch.id,
              league: ch.league,
              fgcMode: getFgcMode(ch),
              gameId: ch.gameId,
              status: ch.status,
            }))
          );

          chunkDocIds.set(chunkKey, nextIds);
          mergeAndSet(mapById);
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

    return () => {
      unsubs.forEach((u) => {
        try {
          u();
        } catch {}
      });
    };
  }, [groupIds.join("|"), currentGroupId, mergeAndSet, sportLeague]);

  useEffect(() => {
    const visibleChallengeIds = items
      .slice(0, 6)
      .map((ch) => String(ch?.id || "").trim())
      .filter(Boolean);

    if (!user?.uid || !visibleChallengeIds.length) {
      setMyPickByChallengeId({});
      return;
    }

    const unsubs = [];

    visibleChallengeIds.forEach((challengeId) => {
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
  }, [items, user?.uid]);

  return (
    <>
      <View style={{ marginBottom: 14 }}>
        {loading ? (
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
            <ActivityIndicator size="small" color={colors.subtext} />
          </View>
        ) : null}

        <InfoBubbleFGC colors={colors} />

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
              const myPick = myPickByChallengeId?.[challengeId]?.data || null;
              const hasMyPick = !!myPickByChallengeId?.[challengeId]?.hasPick;

              const st = String(ch.status || "").toLowerCase();
              const isLocked = st !== "open";
              const shouldShowParticipate = st === "open" && !hasMyPick && !deadlinePassed;
              const shouldShowEdit = st === "open" && hasMyPick && !deadlinePassed;
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

              const isDecided = st === "decided" || st === "closed";
              const resultPlayerName = isDecided ? getFgcResultPlayerName(ch) : null;
              const resultTeamAbbr = isDecided ? getFgcResultTeamAbbr(ch) : "";

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

              const ctaLabel = hasMyPick
                ? i18n.t("firstGoal.cta.modifyPick", { defaultValue: "Modifier mon joueur" })
                : i18n.t("firstGoal.live.join", { defaultValue: "Participer" });

              const showSecondaryCta = st !== "open";

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
                    borderWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: colors.card,
                  }}
                >
                  <MatchupRow
                    awayAbbr={awayAbbr}
                    homeAbbr={homeAbbr}
                    sport={challengeLeague}
                    colors={colors}
                  />

                  <Text style={{ color: colors.subtext, marginTop: 10, fontSize: 13 }}>
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
                  </Text>

                  <View style={{ flexDirection: "row", alignItems: "center", marginTop: 8 }}>
                    <MaterialCommunityIcons name="account-group" size={16} color={colors.subtext} />
                    <Text style={{ color: colors.subtext, marginLeft: 6, fontSize: 13 }}>
                      {participants}{" "}
                      {i18n.t("common.participants", { defaultValue: "participant(s)" })}
                    </Text>
                  </View>

                  {isDecided ? (
                    resultPlayerName ? (
                      <Text style={{ color: colors.subtext, marginTop: 8, fontSize: 13 }}>
                        {getFgcResultPrefix(ch, i18n.t.bind(i18n))}{" "}
                        <Text style={{ color: colors.text, fontWeight: "900" }}>
                          {resultPlayerName}
                        </Text>
                        {resultTeamAbbr ? ` (${resultTeamAbbr})` : ""}
                      </Text>
                    ) : (
                      <Text style={{ color: colors.subtext, marginTop: 8, fontSize: 13 }}>
                        {i18n.t("firstGoal.home.noWinner", { defaultValue: "Aucun gagnant" })}
                      </Text>
                    )
                  ) : null}

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
                        {i18n.t("firstGoal.home.myPick", { defaultValue: "Ton choix" })}
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

                  <View style={{ marginTop: 12, gap: 10 }}>
                    {deadlinePassed ? (
                      <ResultsTabHint colors={colors} />
                    ) : (
                      <>
                        {showParticipateCta ? (
                          <TouchableOpacity
                            onPress={onPressCta}
                            activeOpacity={0.9}
                            style={{
                              width: "100%",
                              paddingVertical: 10,
                              borderRadius: 12,
                              alignItems: "center",
                              backgroundColor: "#b91c1c",
                            }}
                          >
                            <Text style={{ color: "#fff", fontWeight: "900" }}>{ctaLabel}</Text>
                          </TouchableOpacity>
                        ) : null}

                        {showSecondaryCta ? (
                          <ResultsTabHint colors={colors} />
                        ) : null}
                      </>
                    )}
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