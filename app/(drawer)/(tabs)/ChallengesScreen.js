// app/(drawer)/(tabs)/ChallengesScreen.js
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  ActivityIndicator,
  SectionList,
  TouchableOpacity,
  Image,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import firestore from "@react-native-firebase/firestore";

import i18n from "@src/i18n/i18n";
import { useAuth } from "@src/auth/SafeAuthProvider";
import { useTheme } from "@src/theme/ThemeProvider";
import ChallengeDayCard from "@src/defis/list/ChallengeDayCard";
import GroupsToggleRow from "@src/home/components/GroupsToggleRow";
import TodayChallengesList from "@src/defis/list/TodayChallengesList";

const GROUP_PLACEHOLDER = require("@src/assets/group-placeholder.png");

/* -------------------------------- Helpers -------------------------------- */

function toDateAny(v) {
  if (!v) return null;
  try {
    if (typeof v?.toDate === "function") return v.toDate();
    if (v instanceof Date) return v;
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}

function tsToMillis(v) {
  return toDateAny(v)?.getTime?.() || 0;
}

function ymdLocal(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function compactYmd(date = new Date()) {
  return ymdLocal(date).replaceAll("-", "");
}

function normalizeYmdString(v) {
  const s = String(v || "").trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  if (/^\d{8}$/.test(s)) {
    return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
  }

  return "";
}

function prophetikBusinessDate(now = new Date()) {
  const d = new Date(now);
  if (d.getHours() < 4) d.setDate(d.getDate() - 1);
  return d;
}

function prophetikBusinessYmd() {
  return ymdLocal(prophetikBusinessDate());
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function buildLast7DaysIncludingToday() {
  const base = prophetikBusinessDate();
  return Array.from({ length: 8 }, (_, i) => {
    const d = addDays(base, -i);
    return {
      ymd: ymdLocal(d),
      compact: compactYmd(d),
    };
  });
}

function prettyDateLabel(ymd) {
  const today = prophetikBusinessYmd();
  const yesterday = ymdLocal(addDays(prophetikBusinessDate(), -1));

  if (ymd === today) {
    return i18n.t("challenges.todayTitle", { defaultValue: "Aujourd’hui" });
  }
  if (ymd === yesterday) {
    return i18n.t("challenges.yesterdayTitle", { defaultValue: "Hier" });
  }
  return ymd;
}

function normalizeStatus(st) {
  return String(st || "").toLowerCase().trim();
}

function isTsType(item) {
  const t = Number(item?.type);
  return Number.isFinite(t) && t >= 1 && t <= 7;
}

function typeOrder(kind) {
  if (kind === "fgc") return 0;
  if (kind === "tp") return 1;
  if (kind === "ts") return 2;
  return 9;
}

function challengeSortValue(item) {
  return (
    tsToMillis(item?.signupDeadline) ||
    tsToMillis(item?.firstGameUTC) ||
    tsToMillis(item?.createdAt) ||
    0
  );
}

function getWinnerUids(raw) {
  if (Array.isArray(raw?.winnersPreviewUids)) return raw.winnersPreviewUids.map(String);
  if (Array.isArray(raw?.winners)) return raw.winners.map(String);
  return [];
}

/* ---------------------------- Normalization ------------------------------ */

function normalizeTsDoc(doc) {
  const d = doc.data() || {};
  return {
    id: doc.id,
    kind: "ts",
    groupId: String(d?.groupId || ""),
    dateKey: String(d?.gameDate || ""),
title: i18n.t("home.todayChallenge", { defaultValue: "Top scoreur" }),
    status: normalizeStatus(d?.status),
    createdAt: d?.createdAt || null,
    signupDeadline: d?.signupDeadline || null,
    firstGameUTC: d?.firstGameUTC || null,
    raw: { id: doc.id, ...d },
  };
}

function normalizeFgcDoc(doc) {
  const d = doc.data() || {};

  const explicitDeadline =
    d?.signupDeadline ??
    d?.signupDeadlineUTC ??
    d?.signupDeadlineAt ??
    d?.signupDeadlineAtUTC ??
    d?.lockedAt ??
    d?.lockAtUTC ??
    d?.lockAt ??
    null;

  let computedDeadline = explicitDeadline || null;

  if (!computedDeadline && d?.gameStartTimeUTC) {
    const start = toDateAny(d.gameStartTimeUTC);
    if (start) {
      computedDeadline = new Date(start.getTime() - 5 * 60 * 1000);
    }
  }

  return {
    id: doc.id,
    kind: "fgc",
    groupId: String(d?.groupId || ""),
    dateKey: normalizeYmdString(d?.gameYmd),
    title: i18n.t("firstGoal.home.title", { defaultValue: "Premier but" }),
    status: normalizeStatus(d?.status),
    createdAt: d?.createdAt || null,
    signupDeadline: computedDeadline,
    firstGameUTC: d?.gameStartTimeUTC || null,
    raw: { id: doc.id, ...d },
  };
}

function normalizeTpDoc(doc) {
  const d = doc.data() || {};
  return {
    id: doc.id,
    kind: "tp",
    groupId: String(d?.groupId || ""),
    dateKey: normalizeYmdString(d?.gameYmd),
    title: i18n.t("tp.home.title", { defaultValue: "Défi équipe gagnante" }),
    status: normalizeStatus(d?.status),
    createdAt: d?.createdAt || null,
    signupDeadline:
      d?.signupDeadline ??
      d?.signupDeadlineUTC ??
      d?.signupDeadlineAt ??
      d?.signupDeadlineAtUTC ??
      d?.lockedAt ??
      d?.lockAt ??
      null,
    firstGameUTC: d?.gameStartTimeUTC || null,
    raw: { id: doc.id, ...d },
  };
}

/* ------------------------------- UI bits --------------------------------- */


/* -------------------------------- Screen --------------------------------- */

export default function ChallengesScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const { colors } = useTheme();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [groupIds, setGroupIds] = useState([]);
  const [groupsMap, setGroupsMap] = useState({});
  const [currentGroupId, setCurrentGroupId] = useState(null);

  const [tsItems, setTsItems] = useState([]);
  const [fgcItems, setFgcItems] = useState([]);
  const [tpItems, setTpItems] = useState([]);

  const [winnerInfoMap, setWinnerInfoMap] = useState({});

  const subs = useRef({
    byUid: null,
    byPid: null,
    byOwnerCreated: null,
    byOwnerOwnerId: null,
  });

  const groupsUnsubsRef = useRef(new Map());
  const currentGroupUnsubsRef = useRef({
    ts: [],
    fgc: [],
    tp: [],
  });
  const winnerUnsubsRef = useRef(new Map());

  const dayKeys = useMemo(() => buildLast7DaysIncludingToday(), []);
  const dayYmdSet = useMemo(() => new Set(dayKeys.map((d) => d.ymd)), [dayKeys]);

  const todayKey = prophetikBusinessYmd();

  const todayItems = useMemo(() => {
    return [...fgcItems, ...tpItems, ...tsItems].filter((item) => item.dateKey === todayKey);
  }, [fgcItems, tpItems, tsItems, todayKey]);

  const [fgcParticipationMap, setFgcParticipationMap] = useState({});
  const [tpParticipationMap, setTpParticipationMap] = useState({});
  const [tsParticipationMap, setTsParticipationMap] = useState({});

  const participationMaps = useMemo(
    () => ({
      fgc: fgcParticipationMap,
      tp: tpParticipationMap,
      ts: tsParticipationMap,
    }),
    [fgcParticipationMap, tpParticipationMap, tsParticipationMap]
  );

  /* ---------------- 1) memberships + owned groups ---------------- */

  useEffect(() => {
    setError(null);
    setLoading(true);
    setGroupIds([]);
    setGroupsMap({});
    setCurrentGroupId(null);

    if (!user?.uid) {
      setLoading(false);
      return;
    }

    Object.values(subs.current).forEach((un) => {
      try {
        un?.();
      } catch {}
    });

    const qByUid = firestore().collection("group_memberships").where("uid", "==", user.uid);
    const qByPid = firestore().collection("group_memberships").where("participantId", "==", user.uid);
    const qOwnerCreated = firestore().collection("groups").where("createdBy", "==", user.uid);
    const qOwnerOwnerId = firestore().collection("groups").where("ownerId", "==", user.uid);

    let rowsByUid = [];
    let rowsByPid = [];
    let rowsOwnerCreated = [];
    let rowsOwnerOwnerId = [];

    const recompute = () => {
      const memberships = [...rowsByUid, ...rowsByPid].filter((m) => {
        const st = String(m?.status || "").toLowerCase();
        if (st) return ["open", "active", "approved"].includes(st);
        return m?.active !== false;
      });

      const gidsFromMemberships = memberships.map((m) => m.groupId).filter(Boolean);
      const gidsFromOwner = [...rowsOwnerCreated, ...rowsOwnerOwnerId].map((g) => g.id).filter(Boolean);
      const union = Array.from(new Set([...gidsFromMemberships, ...gidsFromOwner])).sort();

      setGroupIds(union);
      setLoading(false);

      setGroupsMap((prev) => {
        const next = { ...prev };
        [...rowsOwnerCreated, ...rowsOwnerOwnerId].forEach((g) => {
          if (!g?.id) return;
          next[g.id] = {
            ...(next[g.id] || {}),
            ...g,
          };
        });
        return next;
      });
    };

    subs.current.byUid = qByUid.onSnapshot(
      (snap) => {
        rowsByUid = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        recompute();
      },
      (e) => {
        setError(e);
        setLoading(false);
      }
    );

    subs.current.byPid = qByPid.onSnapshot(
      (snap) => {
        rowsByPid = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        recompute();
      },
      (e) => {
        setError(e);
        setLoading(false);
      }
    );

    subs.current.byOwnerCreated = qOwnerCreated.onSnapshot(
      (snap) => {
        rowsOwnerCreated = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        recompute();
      },
      (e) => {
        setError(e);
        setLoading(false);
      }
    );

    subs.current.byOwnerOwnerId = qOwnerOwnerId.onSnapshot(
      (snap) => {
        rowsOwnerOwnerId = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        recompute();
      },
      (e) => {
        setError(e);
        setLoading(false);
      }
    );

    return () => {
      Object.values(subs.current).forEach((un) => {
        try {
          un?.();
        } catch {}
      });
    };
  }, [user?.uid]);

  /* ---------------- 2) group meta listeners ---------------- */

  useEffect(() => {
    for (const [gid, un] of groupsUnsubsRef.current) {
      if (!groupIds.includes(gid)) {
        try {
          un?.();
        } catch {}
        groupsUnsubsRef.current.delete(gid);
      }
    }

    groupIds.forEach((gid) => {
      if (groupsUnsubsRef.current.has(gid)) return;

      const un = firestore()
        .collection("groups")
        .doc(gid)
        .onSnapshot((snap) => {
          if (!snap.exists) return;
          setGroupsMap((prev) => ({
            ...prev,
            [gid]: { id: gid, ...snap.data() },
          }));
        });

      groupsUnsubsRef.current.set(gid, un);
    });
  }, [groupIds]);

  /* ---------------- 3) current group selection ---------------- */

  const userGroups = useMemo(
    () =>
      groupIds.map((gid) => {
        const g = groupsMap[gid] || {};
        return {
          id: gid,
          name: g.name || gid,
          avatarUrl: g.avatarUrl || null,
          isFavorite: !!g.isFavorite,
        };
      }),
    [groupIds, groupsMap]
  );

  useEffect(() => {
    if (!groupIds.length) {
      setCurrentGroupId(null);
      return;
    }

    if (currentGroupId && groupIds.includes(currentGroupId)) return;

    const favorite = userGroups.find((g) => g.isFavorite);
    setCurrentGroupId(favorite?.id || groupIds[0]);
  }, [groupIds, currentGroupId, userGroups]);

  /* ---------------- 4) current group challenge listeners ---------------- */

  useEffect(() => {
    setTsItems([]);
    setFgcItems([]);
    setTpItems([]);

    const cleanup = () => {
      ["ts", "fgc", "tp"].forEach((k) => {
        const arr = currentGroupUnsubsRef.current[k] || [];
        arr.forEach((u) => {
          try {
            u?.();
          } catch {}
        });
        currentGroupUnsubsRef.current[k] = [];
      });
    };

    cleanup();

    if (!currentGroupId) return;

    const gid = String(currentGroupId);

    const tsUn = firestore()
      .collection("defis")
      .where("groupId", "==", gid)
      .onSnapshot(
        (snap) => {
          const rows = snap.docs
            .map(normalizeTsDoc)
            .filter((x) => dayYmdSet.has(x.dateKey))
            .filter((x) => isTsType(x.raw))
            .sort((a, b) => challengeSortValue(a) - challengeSortValue(b));

          setTsItems(rows);
        },
        (e) => setError(e)
      );

    currentGroupUnsubsRef.current.ts.push(tsUn);

    dayKeys.forEach((day) => {
      const un = firestore()
        .collection("first_goal_challenges")
        .where("groupId", "==", gid)
        .where("gameYmd", "==", day.ymd)
        .where("league", "==", "NHL")
        .where("type", "==", "first_goal")
        .onSnapshot(
          (snap) => {
            const rows = snap.docs.map(normalizeFgcDoc);

            setFgcItems((prev) => {
              const keep = prev.filter(
                (x) =>
                  !(
                    normalizeYmdString(x?.raw?.gameYmd) === day.ymd &&
                    String(x?.groupId || "") === gid
                  )
              );

              return [...keep, ...rows].sort(
                (a, b) => challengeSortValue(a) - challengeSortValue(b)
              );
            });
          },
          (e) => setError(e)
        );

      currentGroupUnsubsRef.current.fgc.push(un);
    });

    dayKeys.forEach((day) => {
      const un = firestore()
        .collection("team_prediction_challenges")
        .where("groupId", "==", gid)
        .where("gameYmd", "==", day.compact)
        .onSnapshot(
          (snap) => {
            const rows = snap.docs.map(normalizeTpDoc);

            setTpItems((prev) => {
              const keep = prev.filter(
                (x) =>
                  !(
                    String(x?.raw?.gameYmd || "") === day.compact &&
                    String(x?.groupId || "") === gid
                  )
              );
              return [...keep, ...rows].sort((a, b) => challengeSortValue(a) - challengeSortValue(b));
            });
          },
          (e) => setError(e)
        );

      currentGroupUnsubsRef.current.tp.push(un);
    });

    return cleanup;
  }, [currentGroupId, dayKeys, dayYmdSet]);

  /* ---------------- 5) winners info listeners ---------------- */

  useEffect(() => {
    const all = [...tsItems, ...fgcItems, ...tpItems];
    const neededUids = Array.from(
      new Set(all.flatMap((item) => getWinnerUids(item.raw)).filter(Boolean))
    );

    for (const [uid, un] of winnerUnsubsRef.current) {
      if (!neededUids.includes(uid)) {
        try {
          un?.();
        } catch {}
        winnerUnsubsRef.current.delete(uid);
      }
    }

    neededUids.forEach((uid) => {
      if (winnerUnsubsRef.current.has(uid)) return;

      const ref = firestore().collection("profiles_public").doc(uid);
      const un = ref.onSnapshot(
        (snap) => {
          if (snap.exists) {
            const v = snap.data() || {};
            setWinnerInfoMap((prev) => ({
              ...prev,
              [uid]: {
                name: v.displayName || v.name || uid,
                photoURL: v.avatarUrl || v.photoURL || null,
              },
            }));
          } else {
            setWinnerInfoMap((prev) => ({
              ...prev,
              [uid]: { name: uid, photoURL: null },
            }));
          }
        },
        () => {
          setWinnerInfoMap((prev) => ({
            ...prev,
            [uid]: { name: uid, photoURL: null },
          }));
        }
      );

      winnerUnsubsRef.current.set(uid, un);
    });
  }, [tsItems, fgcItems, tpItems]);

  /* ---------------- 6) sections by day ---------------- */

  const sections = useMemo(() => {
    const byDay = {};

    dayKeys.forEach((d) => {
      byDay[d.ymd] = {
        key: d.ymd,
        title: prettyDateLabel(d.ymd),
        data: [],
      };
    });

    [...fgcItems, ...tpItems, ...tsItems].forEach((item) => {
      if (!item?.dateKey || !byDay[item.dateKey]) return;
      byDay[item.dateKey].data.push(item);
    });

    return dayKeys
      .map((d) => {
        const section = byDay[d.ymd];

        section.data.sort((a, b) => {
          const ta = typeOrder(a.kind);
          const tb = typeOrder(b.kind);
          if (ta !== tb) return ta - tb;
          return challengeSortValue(a) - challengeSortValue(b);
        });

        return {
          key: section.key,
          title: section.title,
          data: [section],
        };
      })
      .filter((s) => s.data[0].data.length > 0);
  }, [dayKeys, fgcItems, tpItems, tsItems]);

  const historySections = useMemo(() => {
    return sections.filter((s) => s.key !== todayKey);
  }, [sections, todayKey]);

  useEffect(() => {
  if (!user?.uid) {
    setFgcParticipationMap({});
    setTpParticipationMap({});
    setTsParticipationMap({});
    return;
  }

  const todayFgc = todayItems.filter((x) => x.kind === "fgc");
  const todayTp = todayItems.filter((x) => x.kind === "tp");
  const todayTs = todayItems.filter((x) => x.kind === "ts");

  const unsubs = [];

  // FGC
  todayFgc.forEach((item) => {
    const un = firestore()
      .collection("first_goal_challenges")
      .doc(String(item.id))
      .collection("entries")
      .doc(String(user.uid))
      .onSnapshot(
        (snap) => {
          const data = snap?.exists ? snap.data() || null : null;
          setFgcParticipationMap((prev) => ({
            ...prev,
            [item.id]: {
              hasPick: !!data?.playerId,
              data,
            },
          }));
        },
        () => {
          setFgcParticipationMap((prev) => ({
            ...prev,
            [item.id]: { hasPick: false, data: null },
          }));
        }
      );

    unsubs.push(un);
  });

  // TP
  todayTp.forEach((item) => {
    const un = firestore()
      .collection("team_prediction_challenges")
      .doc(String(item.id))
      .collection("entries")
      .doc(String(user.uid))
      .onSnapshot(
        (snap) => {
          const data = snap?.exists ? snap.data() || null : null;
          setTpParticipationMap((prev) => ({
            ...prev,
            [item.id]: data,
          }));
        },
        () => {
          setTpParticipationMap((prev) => ({
            ...prev,
            [item.id]: null,
          }));
        }
      );

    unsubs.push(un);
  });

  // TS
  todayTs.forEach((item) => {
    const un = firestore()
      .collection("defis")
      .doc(String(item.id))
      .collection("participations")
      .doc(String(user.uid))
      .onSnapshot(
        (snap) => {
          const data = snap?.exists ? snap.data() || null : null;
          setTsParticipationMap((prev) => ({
            ...prev,
            [item.id]: data,
          }));
        },
        () => {
          setTsParticipationMap((prev) => ({
            ...prev,
            [item.id]: null,
          }));
        }
      );

    unsubs.push(un);
  });

  return () => {
    unsubs.forEach((u) => {
      try {
        u?.();
      } catch {}
    });
  };
}, [todayItems, user?.uid]);

  /* ---------------- 7) cleanup global ---------------- */

  useEffect(() => {
    return () => {
      Object.values(subs.current).forEach((un) => {
        try {
          un?.();
        } catch {}
      });

      for (const [, un] of groupsUnsubsRef.current) {
        try {
          un?.();
        } catch {}
      }
      groupsUnsubsRef.current.clear();

      ["ts", "fgc", "tp"].forEach((k) => {
        const arr = currentGroupUnsubsRef.current[k] || [];
        arr.forEach((u) => {
          try {
            u?.();
          } catch {}
        });
        currentGroupUnsubsRef.current[k] = [];
      });

      for (const [, un] of winnerUnsubsRef.current) {
        try {
          un?.();
        } catch {}
      }
      winnerUnsubsRef.current.clear();
    };
  }, []);

  /* ---------------- open card ---------------- */

  const openChallenge = useCallback(
    (item, isToday) => {
      if (item.kind === "ts") {
        if (isToday) {
          router.push(`/(drawer)/defis/${item.id}`);
        } else {
          router.push(`/(drawer)/defis/${item.id}/results`);
        }
        return;
      }

      if (item.kind === "fgc") {
        router.push({
          pathname: "/(drawer)/(tabs)/AccueilScreen",
          params: {
            focus: "fgc",
            challengeId: item.id,
            openState: "1",
          },
        });
        return;
      }

      if (item.kind === "tp") {
        router.push({
          pathname: "/(drawer)/(tabs)/AccueilScreen",
          params: { focus: "tp", challengeId: item.id },
        });
      }
    },
    [router]
  );

  const renderDaySection = useCallback(
    ({ item }) => (
      <ChallengeDayCard
        section={item}
        colors={colors}
        winnerInfoMap={winnerInfoMap}
        onOpen={openChallenge}
        getTodayKey={prophetikBusinessYmd}
      />
    ),
    [colors, winnerInfoMap, openChallenge]
  );

  /* ---------------- UI states ---------------- */

  if (!user) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
          backgroundColor: colors.background,
        }}
      >
        <Text style={{ color: colors.text }}>
          {i18n.t("challenges.loginToSee", { defaultValue: "Connecte-toi pour voir les défis." })}
        </Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.background,
        }}
      >
        <ActivityIndicator color={colors.primary} />
        <Text style={{ marginTop: 8, color: colors.subtext }}>
          {i18n.t("challenges.loadingChallenges", { defaultValue: "Chargement des défis..." })}
        </Text>
      </View>
    );
  }

  if (error) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          padding: 16,
          backgroundColor: colors.background,
        }}
      >
        <Text style={{ color: colors.text }}>
          {i18n.t("common.errorLabel", { defaultValue: "Erreur :" })} {String(error?.message || error)}
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>

      <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 }}>
        <GroupsToggleRow
          colors={colors}
          groups={userGroups}
          value={currentGroupId}
          onChange={(gid) => setCurrentGroupId(String(gid))}
        />
      </View>

      <SectionList
        sections={historySections}
        keyExtractor={(item) => item.key}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
        renderSectionHeader={() => null}
        renderItem={renderDaySection}
        initialNumToRender={6}
        maxToRenderPerBatch={6}
        windowSize={7}
        removeClippedSubviews={true}
        ListHeaderComponent={
          <View style={{ paddingTop: 4, paddingBottom: 8 }}>
            <TodayChallengesList
              items={todayItems}
              colors={colors}
              participationMaps={participationMaps}
              onPressGoToAccueil={() =>
                router.push("/(drawer)/(tabs)/AccueilScreen")
              }
            />
          </View>
        }
        ListEmptyComponent={() => (
          <Text
            style={{
              color: colors.subtext,
              marginTop: 24,
              textAlign: "center",
            }}
          >
            {i18n.t("challenges.noChallenges", {
              defaultValue: "Aucun défi à afficher.",
            })}
          </Text>
        )}
      />
    </View>
  );
}