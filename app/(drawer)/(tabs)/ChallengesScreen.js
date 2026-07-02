// app/(drawer)/(tabs)/ChallengesScreen.js
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useIsFocused } from "@react-navigation/native";
import firestore from "@react-native-firebase/firestore";

import i18n from "@src/i18n/i18n";
import { useAuth } from "@src/auth/SafeAuthProvider";
import { useTheme } from "@src/theme/ThemeProvider";
import { ChallengeItemCard } from "@src/defis/list/ChallengeDayCard";
import GroupsToggleRow from "@src/home/components/GroupsToggleRow";
import HomeDefisToggle from "@src/home/components/HomeDefisToggle";
import ResultsDayPicker from "@src/defis/results/ResultsDayPicker";
import {
  getTpBundleFirstDeadline,
  mergeTpItemsByDate,
  shouldShowPastDayResultItem,
} from "@src/defis/results/challengeResultsModel";
import {
  getProphetikBusinessDate,
  getProphetikBusinessYmd,
} from "@src/lib/prophetikBusinessDate";
import FgcChallengeModal from "@src/defis/results/FgcChallengeModal";
import TpMyPicksModal from "@src/defis/results/TpMyPicksModal";
import { getFgcTitle } from "@src/firstGoal/fgcChallengeUtils";
import useMlbScheduleGames from "@src/mlb/useMlbScheduleGames";
import { useMyGroups } from "@src/groups/MyGroupsProvider";
import { useSelectedGroup } from "@src/groups/SelectedGroupProvider";
import { useAppVisibilitySafe } from "@src/providers/AppVisibilityProvider";
import { isSignupDeadlinePassed } from "@src/home/homeUtils";
import { buildTpBundleTabProgress } from "@src/defis/tpTabProgress";
import {
  RESULTS_ACCENT,
  RESULTS_ACCENT_MUTED,
} from "@src/defis/results/resultsTheme";

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

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function buildResultsDayOptions() {
  const base = getProphetikBusinessDate();
  return Array.from({ length: 8 }, (_, i) => {
    const d = addDays(base, -i);
    const ymd = ymdLocal(d);
    return {
      ymd,
      compact: compactYmd(d),
      label: prettyDateLabel(ymd),
    };
  });
}

function cardShadow() {
  return {
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  };
}

function leftAccentCardStyle(colors, accent = RESULTS_ACCENT) {
  return {
    backgroundColor: colors.card,
    borderRadius: 16,
    overflow: "hidden",
    padding: 12,
    borderLeftWidth: 4,
    borderLeftColor: accent,
  };
}

function withTabExpiry(progress, deadline) {
  if (!progress?.total || progress.done >= progress.total) return progress;
  if (progress.enrolled) return progress;
  if (isSignupDeadlinePassed(deadline)) {
    return { ...progress, expired: true };
  }
  return progress;
}

function prettyDateLabel(ymd) {
  const today = getProphetikBusinessYmd();
  const yesterday = ymdLocal(addDays(getProphetikBusinessDate(), -1));

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
  const dateKey =
    normalizeYmdString(d?.gameDate) ||
    normalizeYmdString(
      typeof d?.gameDate?.toDate === "function"
        ? d.gameDate.toDate().toISOString().slice(0, 10)
        : ""
    );

  return {
    id: doc.id,
    kind: "ts",
    groupId: String(d?.groupId || ""),
    dateKey,
    title: i18n.t("home.todayChallenge", { defaultValue: "Le trio du jour" }),
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
    title: getFgcTitle(d, i18n.t.bind(i18n)),
    status: normalizeStatus(d?.status),
    createdAt: d?.createdAt || null,
    signupDeadline: computedDeadline,
    firstGameUTC: d?.gameStartTimeUTC || null,
    raw: { id: doc.id, ...d },
  };
}

function normalizeTpLegacyDoc(doc) {
  const d = doc.data() || {};
  return {
    id: doc.id,
    kind: "tp",
    subtype: "legacy",
    groupId: String(d?.groupId || ""),
    dateKey: normalizeYmdString(d?.gameYmd),
    title: i18n.t("tp.home.title", { defaultValue: "Prédire l'issue des matchs" }),
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

function normalizeTpBundleDoc(doc) {
  const d = doc.data() || {};
  const bundle = { id: doc.id, ...d };

  return {
    id: doc.id,
    kind: "tp",
    subtype: "bundle",
    groupId: String(d?.groupId || ""),
    dateKey: normalizeYmdString(d?.gameYmd),
    title: i18n.t("tp.home.title", { defaultValue: "Prédire l'issue des matchs" }),
    status: normalizeStatus(d?.status),
    createdAt: d?.createdAt || null,
    signupDeadline: getTpBundleFirstDeadline(bundle),
    firstGameUTC: d?.games?.[0]?.gameStartTimeUTC || null,
    raw: bundle,
  };
}

/* ------------------------------- UI bits --------------------------------- */


/* -------------------------------- Screen --------------------------------- */

export default function ChallengesScreen() {
  const { user, authReady } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams();
  const { colors } = useTheme();
  const isFocused = useIsFocused();
  const { isActive: appActive } = useAppVisibilitySafe();
  const listenersEnabled = isFocused && appActive;
  const { selectedGroupId: currentGroupId, setSelectedGroupId } = useSelectedGroup();

  const {
    readableGroupIds: groupIds,
    groupsMeta: groupsMap,
    loading: groupsLoading,
  } = useMyGroups();

  const paramGroupId = String(params?.groupId || "").trim();
  const paramOpenChallengeId = String(params?.openChallengeId || "").trim();
  const paramKind = String(params?.kind || "").trim().toLowerCase();

  const [fgcModalItem, setFgcModalItem] = useState(null);
  const [tpModalItem, setTpModalItem] = useState(null);
  const handledOpenRef = useRef("");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [tsItems, setTsItems] = useState([]);
  const [fgcItems, setFgcItems] = useState([]);
  const [tpBundleItems, setTpBundleItems] = useState([]);
  const [tpLegacyItems, setTpLegacyItems] = useState([]);
  const [selectedYmd, setSelectedYmd] = useState(() => getProphetikBusinessYmd());
  const [selectedDefiTab, setSelectedDefiTab] = useState("fgc");

  const tpItems = useMemo(
    () => mergeTpItemsByDate(tpBundleItems, tpLegacyItems),
    [tpBundleItems, tpLegacyItems]
  );

  const [winnerInfoMap, setWinnerInfoMap] = useState({});

  const currentGroupUnsubsRef = useRef({
    ts: [],
    fgc: [],
    tp: [],
    tpBundle: [],
  });
  const winnerUnsubsRef = useRef(new Map());

  const dayKeys = useMemo(() => buildResultsDayOptions(), []);
  const dayYmdSet = useMemo(() => new Set(dayKeys.map((d) => d.ymd)), [dayKeys]);
  const dayOptions = useMemo(
    () => dayKeys.map((d) => ({ ymd: d.ymd, label: d.label })),
    [dayKeys]
  );

  const todayKey = getProphetikBusinessYmd();
  const isSelectedToday = selectedYmd === todayKey;

  const allItems = useMemo(
    () => [...fgcItems, ...tpItems, ...tsItems],
    [fgcItems, tpItems, tsItems]
  );

  const mlbScheduleTargets = useMemo(() => {
    const targets = [];
    const seen = new Set();

    const pushTarget = (gameYmd, gameId) => {
      const ymd = String(gameYmd || "").trim();
      const id = String(gameId || "").trim();
      if (!ymd || !id) return;
      const key = `${ymd}|${id}`;
      if (seen.has(key)) return;
      seen.add(key);
      targets.push({ gameYmd: ymd, gameId: id });
    };

    fgcItems
      .filter((item) => String(item?.raw?.league || "").toUpperCase() === "MLB")
      .forEach((item) => {
        pushTarget(item?.raw?.gameYmd || item?.dateKey, item?.raw?.gameId || item?.raw?.gamePk);
      });

    tpItems
      .filter(
        (item) =>
          item?.subtype === "bundle" &&
          String(item?.raw?.league || "").toUpperCase() === "MLB"
      )
      .forEach((item) => {
        const gameYmd = item?.raw?.gameYmd || item?.dateKey;
        (item?.raw?.games || []).forEach((slot) => {
          pushTarget(gameYmd, slot?.gameId);
        });
      });

    return targets;
  }, [fgcItems, tpItems]);

  const scheduleByGameId = useMlbScheduleGames(mlbScheduleTargets);

  const fgcScheduleByChallengeId = useMemo(() => {
    const out = {};

    fgcItems.forEach((item) => {
      const gameId = String(item?.raw?.gameId || item?.raw?.gamePk || "").trim();
      if (!gameId) return;
      out[item.id] = scheduleByGameId[gameId] || null;
    });

    return out;
  }, [fgcItems, scheduleByGameId]);

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

  /* ---------------- 1) groups via MyGroupsProvider ---------------- */

  useEffect(() => {
    if (!user?.uid) {
      setLoading(false);
      return;
    }
    setLoading(groupsLoading);
  }, [user?.uid, groupsLoading]);

  /* ---------------- 3) current group selection ---------------- */

  const userGroups = useMemo(
    () =>
      groupIds.map((gid) => {
        const g = groupsMap[gid] || {};
        return {
          id: gid,
          name: g.name || gid,
          avatarUrl: g.avatarUrl || null,
          sport: String(g.sport || g.league || "NHL").toUpperCase(),
        };
      }),
    [groupIds, groupsMap]
  );

  useEffect(() => {
    if (!paramGroupId || !groupIds.includes(paramGroupId)) return;
    if (String(currentGroupId) !== paramGroupId) {
      setSelectedGroupId(paramGroupId);
    }
  }, [paramGroupId, groupIds.join("|"), currentGroupId, setSelectedGroupId]);

  useEffect(() => {
    if (!paramOpenChallengeId || loading) return;
    if (handledOpenRef.current === paramOpenChallengeId) return;

    const item = allItems.find((row) => String(row.id) === paramOpenChallengeId);
    if (!item) return;
    if (paramKind && String(item.kind || "").toLowerCase() !== paramKind) return;

    handledOpenRef.current = paramOpenChallengeId;

    if (item.dateKey) {
      setSelectedYmd(item.dateKey);
    }
    if (item.kind === "fgc" || item.kind === "tp" || item.kind === "ts") {
      setSelectedDefiTab(item.kind);
    }

    if (item.kind === "fgc") {
      setFgcModalItem(item);
      return;
    }

    if (item.kind === "tp" && item.subtype === "bundle") {
      setTpModalItem(item);
    }
  }, [paramOpenChallengeId, paramKind, allItems, loading]);

  /* ---------------- 4) current group challenge listeners ---------------- */

  useEffect(() => {
    setTsItems([]);
    setFgcItems([]);
    setTpBundleItems([]);
    setTpLegacyItems([]);

    const cleanup = () => {
      ["ts", "fgc", "tp", "tpBundle"].forEach((k) => {
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

    if (!listenersEnabled || !currentGroupId) return;

    const gid = String(currentGroupId);
    const groupMeta = groupsMap[gid] || {};
    const groupLeague =
      String(groupMeta.sport || groupMeta.league || "NHL").toUpperCase() === "MLB"
        ? "MLB"
        : "NHL";

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
        .where("league", "==", groupLeague)
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
            const rows = snap.docs.map(normalizeTpLegacyDoc);

            setTpLegacyItems((prev) => {
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

    const tpBundleUn = firestore()
      .collection("team_prediction_bundles")
      .where("groupId", "==", gid)
      .onSnapshot(
        (snap) => {
          const rows = snap.docs
            .map(normalizeTpBundleDoc)
            .filter((x) => dayYmdSet.has(x.dateKey))
            .filter(
              (x) =>
                String(x?.raw?.league || groupLeague).toUpperCase() === groupLeague
            )
            .sort((a, b) => challengeSortValue(a) - challengeSortValue(b));

          setTpBundleItems(rows);
        },
        (e) => setError(e)
      );

    currentGroupUnsubsRef.current.tpBundle.push(tpBundleUn);

    return cleanup;
  }, [listenersEnabled, currentGroupId, dayKeys, dayYmdSet, groupsMap]);

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

  /* ---------------- 6) items for selected day + tab ---------------- */

  const visibleItemsForDay = useMemo(() => {
    return [...fgcItems, ...tpItems, ...tsItems]
      .filter((item) => item?.dateKey === selectedYmd)
      .filter((item) => {
        if (selectedYmd === todayKey) return true;

        const scheduleStatus =
          item.kind === "fgc" ? fgcScheduleByChallengeId?.[item.id]?.status : undefined;

        return shouldShowPastDayResultItem(item, { scheduleStatus });
      })
      .sort((a, b) => {
        const ta = typeOrder(a.kind);
        const tb = typeOrder(b.kind);
        if (ta !== tb) return ta - tb;
        return challengeSortValue(a) - challengeSortValue(b);
      });
  }, [fgcItems, tpItems, tsItems, selectedYmd, todayKey, fgcScheduleByChallengeId]);

  const defiCompletionByTab = useMemo(() => {
    const fgcItemsForDay = visibleItemsForDay.filter((item) => item.kind === "fgc");
    const fgcHasChallenge = fgcItemsForDay.length > 0;
    const fgcDone = fgcItemsForDay.some((item) => fgcParticipationMap[item.id]?.hasPick);
    const fgc = fgcHasChallenge
      ? withTabExpiry(
          { done: fgcDone ? 1 : 0, total: 1 },
          fgcItemsForDay[0]?.signupDeadline
        )
      : { done: 0, total: 0 };

    const tpItem = visibleItemsForDay.find((item) => item.kind === "tp");
    let tp = { done: 0, total: 0 };

    if (tpItem) {
      const entry = tpParticipationMap[tpItem.id];

      if (tpItem.subtype === "bundle") {
        const games = Array.isArray(tpItem.raw?.games) ? tpItem.raw.games : [];
        tp = buildTpBundleTabProgress({
          games,
          picks: entry?.picks || {},
          picksCompletedCount: entry?.picksCompletedCount,
          scheduleByGameId,
        });
      } else {
        tp = withTabExpiry(
          { done: entry ? 1 : 0, total: 1 },
          tpItem.signupDeadline
        );
      }
    }

    const tsItemsForDay = visibleItemsForDay.filter((item) => item.kind === "ts");
    const tsHasChallenge = tsItemsForDay.length > 0;
    const tsDone = tsItemsForDay.some((item) => !!tsParticipationMap[item.id]);
    const ts = tsHasChallenge
      ? withTabExpiry(
          { done: tsDone ? 1 : 0, total: 1 },
          tsItemsForDay[0]?.signupDeadline
        )
      : { done: 0, total: 0 };

    return { fgc, tp, ts };
  }, [visibleItemsForDay, fgcParticipationMap, tpParticipationMap, tsParticipationMap, scheduleByGameId]);

  /* ---------------- 6b) participation listeners ---------------- */

  useEffect(() => {
    if (!user?.uid) {
      setFgcParticipationMap({});
      setTpParticipationMap({});
      setTsParticipationMap({});
      return;
    }

    const allFgc = fgcItems;
    const allTp = tpItems;
    const allTs = tsItems;

    const unsubs = [];

    allFgc.forEach((item) => {
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

    allTp.forEach((item) => {
      const collectionName =
        item.subtype === "bundle" ? "team_prediction_bundles" : "team_prediction_challenges";

      const un = firestore()
        .collection(collectionName)
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

    allTs.forEach((item) => {
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
  }, [fgcItems, tpItems, tsItems, user?.uid]);

  /* ---------------- 7) cleanup global ---------------- */

  useEffect(() => {
    return () => {
      ["ts", "fgc", "tp", "tpBundle"].forEach((k) => {
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
    (item, _isToday, _participantTask = null, options = {}) => {
      if (item.kind === "ts") {
        router.push(`/(drawer)/defis/${item.id}/results`);
        return;
      }

      if (item.kind === "fgc") {
        setFgcModalItem(item);
        return;
      }

      if (item.kind === "tp" && item.subtype === "bundle") {
        setTpModalItem(item);
      }
    },
    [router]
  );

  const renderDefiTabContent = useCallback(
    (tab) => {
      const items = visibleItemsForDay.filter((item) => item.kind === tab);

      if (!items.length) {
        return (
          <Text
            style={{
              color: colors.subtext,
              marginTop: 8,
              textAlign: "center",
              lineHeight: 20,
            }}
          >
            {i18n.t("challenges.noDefiForSelectedDay", {
              defaultValue: "Aucun défi pour cette journée.",
            })}
          </Text>
        );
      }

      return items.map((item, index) => (
        <View key={`${item.kind}-${item.id}`}>
          {index > 0 ? (
            <View
              style={{
                height: 4,
                backgroundColor: RESULTS_ACCENT_MUTED,
                marginTop: 10,
                marginBottom: 8,
                marginHorizontal: 2,
              }}
            />
          ) : null}

          <ChallengeItemCard
            item={item}
            isToday={isSelectedToday}
            colors={colors}
            winnerInfoMap={winnerInfoMap}
            participationMaps={participationMaps}
            scheduleByChallengeId={fgcScheduleByChallengeId}
            scheduleByGameId={scheduleByGameId}
            onOpen={openChallenge}
          />
        </View>
      ));
    },
    [
      visibleItemsForDay,
      isSelectedToday,
      colors,
      winnerInfoMap,
      participationMaps,
      fgcScheduleByChallengeId,
      scheduleByGameId,
      openChallenge,
    ]
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
      <FgcChallengeModal
        visible={!!fgcModalItem}
        item={fgcModalItem}
        colors={colors}
        onClose={() => setFgcModalItem(null)}
      />

      <TpMyPicksModal
        visible={!!tpModalItem}
        item={tpModalItem}
        myEntry={tpModalItem ? tpParticipationMap[String(tpModalItem.id)] : null}
        colors={colors}
        scheduleByGameId={scheduleByGameId}
        onClose={() => setTpModalItem(null)}
      />

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 24 }}
        keyboardShouldPersistTaps="handled"
      >
        <GroupsToggleRow
          colors={colors}
          groups={userGroups}
          value={currentGroupId}
          onChange={(gid) => setSelectedGroupId(String(gid))}
        />

        <ResultsDayPicker
          colors={colors}
          days={dayOptions}
          value={selectedYmd}
          onChange={setSelectedYmd}
        />

        <View style={[cardShadow(), { marginTop: 12 }]}>
          <View style={leftAccentCardStyle(colors, RESULTS_ACCENT)}>
            <HomeDefisToggle
              accentColor={RESULTS_ACCENT}
              value={selectedDefiTab}
              onChange={setSelectedDefiTab}
              colors={colors}
              completedByTab={defiCompletionByTab}
            />

            <View style={selectedDefiTab === "fgc" ? undefined : { display: "none" }}>
              {renderDefiTabContent("fgc")}
            </View>

            <View style={selectedDefiTab === "tp" ? undefined : { display: "none" }}>
              {renderDefiTabContent("tp")}
            </View>

            <View style={selectedDefiTab === "ts" ? undefined : { display: "none" }}>
              {renderDefiTabContent("ts")}
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}