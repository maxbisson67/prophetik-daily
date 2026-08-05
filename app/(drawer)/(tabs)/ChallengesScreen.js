// app/(drawer)/(tabs)/ChallengesScreen.js
import React, { useEffect, useMemo, useRef, useState } from "react";
import { snapshotExists, snapshotData, snapshotId } from "@src/lib/safeSnapshot";
import {
  View,
  Text,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useIsFocused } from "@react-navigation/native";
import firestore from "@react-native-firebase/firestore";

import i18n from "@src/i18n/i18n";
import { useAuth } from "@src/auth/SafeAuthProvider";
import { useTheme } from "@src/theme/ThemeProvider";
import GroupsToggleRow from "@src/home/components/GroupsToggleRow";
import ResultsDayPicker from "@src/defis/results/ResultsDayPicker";
import {
  getTpBundleFirstDeadline,
  mergeTpItemsByDate,
  shouldShowPastDayResultItem,
} from "@src/defis/results/challengeResultsModel";
import {
  getProphetikBusinessDate,
  getProphetikBusinessYmd,
  addDaysToYmd,
} from "@src/lib/prophetikBusinessDate";
import HistoryDayDetailSections from "@src/defis/results/HistoryDayDetailSections";
import { getFgcTitle } from "@src/firstGoal/fgcChallengeUtils";
import useMlbScheduleGames from "@src/mlb/useMlbScheduleGames";
import { useMyGroups } from "@src/groups/MyGroupsProvider";
import { useSelectedGroup } from "@src/groups/SelectedGroupProvider";
import { useAppVisibilitySafe } from "@src/providers/AppVisibilityProvider";
import {
  RESULTS_ACCENT,
} from "@src/defis/results/resultsTheme";
import GroupPointsOverviewBlock from "@src/live/GroupPointsOverviewBlock";

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
    const d = addDays(base, -(i + 1));
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
  const handledOpenRef = useRef("");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [tsItems, setTsItems] = useState([]);
  const [fgcItems, setFgcItems] = useState([]);
  const [tpBundleItems, setTpBundleItems] = useState([]);
  const [tpLegacyItems, setTpLegacyItems] = useState([]);
  const [selectedYmd, setSelectedYmd] = useState(() =>
    addDaysToYmd(getProphetikBusinessYmd(), -1)
  );

  const tpItems = useMemo(
    () => mergeTpItemsByDate(tpBundleItems, tpLegacyItems),
    [tpBundleItems, tpLegacyItems]
  );

  const currentGroupUnsubsRef = useRef({
    ts: [],
    fgc: [],
    tp: [],
    tpBundle: [],
  });

  const dayKeys = useMemo(() => buildResultsDayOptions(), []);
  const dayYmdSet = useMemo(() => new Set(dayKeys.map((d) => d.ymd)), [dayKeys]);
  const dayOptions = useMemo(
    () => dayKeys.map((d) => ({ ymd: d.ymd, label: d.label })),
    [dayKeys]
  );

  const todayKey = getProphetikBusinessYmd();
  const yesterdayKey = useMemo(() => addDaysToYmd(todayKey, -1), [todayKey]);
  const isSelectedToday = selectedYmd === todayKey;

  useEffect(() => {
    if (!isFocused || paramOpenChallengeId) return;
    setSelectedYmd(yesterdayKey);
  }, [isFocused, yesterdayKey, paramOpenChallengeId]);

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

  const currentSport = useMemo(() => {
    const g = groupsMap[currentGroupId] || {};
    return String(g.sport || g.league || "NHL").toUpperCase();
  }, [groupsMap, currentGroupId]);

  const selectedDayLabel = useMemo(
    () => dayOptions.find((d) => d.ymd === selectedYmd)?.label || selectedYmd,
    [dayOptions, selectedYmd]
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
          const rows = (snap?.docs ?? [])
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
            const rows = (snap?.docs ?? []).map(normalizeFgcDoc);

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
            const rows = (snap?.docs ?? []).map(normalizeTpLegacyDoc);

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
          const rows = (snap?.docs ?? [])
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

  /* ---------------- 6) items for selected day ---------------- */

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
            const data = snapshotExists(snap) ? snapshotData(snap) || null : null;
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
            const data = snapshotExists(snap) ? snapshotData(snap) || null : null;
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
            const data = snapshotExists(snap) ? snapshotData(snap) || null : null;
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
    };
  }, []);

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

        {currentGroupId ? (
          <View style={[cardShadow(), { marginTop: 12 }]}>
            <GroupPointsOverviewBlock
              groupId={currentGroupId}
              sport={currentSport}
              gameYmd={selectedYmd}
              colors={colors}
              variant="history"
              dateLabel={selectedDayLabel}
            />
          </View>
        ) : null}

        <View style={[cardShadow(), { marginTop: 12 }]}>
          <View style={leftAccentCardStyle(colors, RESULTS_ACCENT)}>
            <Text style={{ fontSize: 18, fontWeight: "900", color: colors.text, marginBottom: 4 }}>
              {i18n.t("challenges.pastDaySummary", {
                defaultValue: "Résultats des défis de cette journée",
              })}
            </Text>

            <HistoryDayDetailSections
              items={visibleItemsForDay}
              isToday={isSelectedToday}
              colors={colors}
              participationMaps={participationMaps}
              scheduleByChallengeId={fgcScheduleByChallengeId}
              scheduleByGameId={scheduleByGameId}
            />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}