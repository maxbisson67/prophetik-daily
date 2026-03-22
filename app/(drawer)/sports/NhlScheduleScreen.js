import React, { useEffect, useMemo, useState, useCallback,useRef } from "react";
import { View, Text, ActivityIndicator, FlatList, RefreshControl, Image } from "react-native";
import { Stack } from "expo-router";
import { Calendar } from "react-native-calendars";
import { useTheme } from "@src/theme/ThemeProvider";
import firestore from "@react-native-firebase/firestore";
import functions from "@react-native-firebase/functions";
import i18n from "@src/i18n/i18n";
import Analytics from "@src/services/analytics";

/* ========================
   Logos
========================= */
const LOGO_MAP = {
  ANA: require("../../../assets/nhl-logos/ANA.png"),
  ARI: require("../../../assets/nhl-logos/ARI.png"),
  BOS: require("../../../assets/nhl-logos/BOS.png"),
  BUF: require("../../../assets/nhl-logos/BUF.png"),
  CAR: require("../../../assets/nhl-logos/CAR.png"),
  CBJ: require("../../../assets/nhl-logos/CBJ.png"),
  CGY: require("../../../assets/nhl-logos/CGY.png"),
  CHI: require("../../../assets/nhl-logos/CHI.png"),
  COL: require("../../../assets/nhl-logos/COL.png"),
  DAL: require("../../../assets/nhl-logos/DAL.png"),
  DET: require("../../../assets/nhl-logos/DET.png"),
  EDM: require("../../../assets/nhl-logos/EDM.png"),
  FLA: require("../../../assets/nhl-logos/FLA.png"),
  LAK: require("../../../assets/nhl-logos/LAK.png"),
  MIN: require("../../../assets/nhl-logos/MIN.png"),
  MTL: require("../../../assets/nhl-logos/MTL.png"),
  NJD: require("../../../assets/nhl-logos/NJD.png"),
  NSH: require("../../../assets/nhl-logos/NSH.png"),
  NYI: require("../../../assets/nhl-logos/NYI.png"),
  NYR: require("../../../assets/nhl-logos/NYR.png"),
  OTT: require("../../../assets/nhl-logos/OTT.png"),
  PHI: require("../../../assets/nhl-logos/PHI.png"),
  PIT: require("../../../assets/nhl-logos/PIT.png"),
  SEA: require("../../../assets/nhl-logos/SEA.png"),
  SJS: require("../../../assets/nhl-logos/SJS.png"),
  STL: require("../../../assets/nhl-logos/STL.png"),
  TBL: require("../../../assets/nhl-logos/TBL.png"),
  TOR: require("../../../assets/nhl-logos/TOR.png"),
  UTA: require("../../../assets/nhl-logos/UTA.png"),
  VAN: require("../../../assets/nhl-logos/VAN.png"),
  VGK: require("../../../assets/nhl-logos/VGK.png"),
  WPG: require("../../../assets/nhl-logos/WPG.png"),
  WSH: require("../../../assets/nhl-logos/WSH.png"),
};

function teamLogo(abbr) {
  const key = String(abbr || "").toUpperCase();
  return LOGO_MAP[key] || null;
}

/** ---------- Dates Toronto helpers ---------- */
function ymdToronto(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (t) => parts.find((p) => p.type === t)?.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function ymdCompact(ymd) {
  return String(ymd || "").replaceAll("-", "");
}

function monthStartYmd(ymd) {
  const [y, m] = String(ymd).split("-");
  return `${y}-${m}-01`;
}

function monthEndYmd(ymd) {
  const [yy, mm] = String(ymd).split("-");
  const y = Number(yy);
  const m = Number(mm);
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${yy}-${mm}-${String(lastDay).padStart(2, "0")}`;
}

/** ---------- Formatting ---------- */
function fmtTimeToronto(utcOrTs) {
  if (!utcOrTs) return "—";
  let dt;
  try {
    dt = utcOrTs?.toDate ? utcOrTs.toDate() : new Date(utcOrTs);
  } catch {
    return "—";
  }
  if (!dt || Number.isNaN(dt.getTime())) return "—";

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(dt);

  const hh = parts.find((p) => p.type === "hour")?.value ?? "00";
  const mm = parts.find((p) => p.type === "minute")?.value ?? "00";
  return `${hh}:${mm}`;
}

function safeAbbr(team) {
  return (
    team?.abbr ||
    team?.teamAbbrev?.default ||
    team?.teamAbbrev ||
    team?.abbrev ||
    ""
  );
}

function pickScore(v, fallback = null) {
  if (typeof v === "number") return v;
  if (typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v))) return Number(v);
  return fallback;
}

function pickNumber(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function gameStateKind(item) {
  const state = String(item?.gameState || "").toUpperCase();
  const sched = String(item?.gameScheduleState || "").toUpperCase();
  const lastPeriodType = String(item?.gameOutcome?.lastPeriodType || "").toUpperCase();

  if (
    state.includes("FINAL") ||
    sched.includes("FINAL") ||
    state === "OFF" ||
    sched === "OFF"
  ) {
    return "FINAL";
  }

  if (
    state.includes("LIVE") ||
    state.includes("CRIT") ||
    sched.includes("LIVE") ||
    sched.includes("CRIT")
  ) {
    return "LIVE";
  }

  if (lastPeriodType === "OT" || lastPeriodType === "SO") {
    return "FINAL";
  }

  return "FUTURE";
}

function liveMeta(item) {
  const period = pickNumber(item?.period, 0);
  const periodType = String(item?.periodType || "").toUpperCase();
  const clock = String(item?.clock || "").trim();

  if (periodType === "OT") return clock ? `OT ${clock}` : "OT";
  if (periodType === "SO") return "SO";
  if (period > 0) return clock ? `P${period} ${clock}` : `P${period}`;
  return "";
}

function scoreText(item) {
  const awayScore = pickScore(item?.awayScore);
  const homeScore = pickScore(item?.homeScore);
  if (awayScore === null || homeScore === null) return null;
  return `${awayScore} - ${homeScore}`;
}

export default function NhlScheduleScreen() {
  const { colors } = useTheme();

  const today = useMemo(() => ymdToronto(new Date()), []);
  const [selectedYmd, setSelectedYmd] = useState(today);
  const [visibleMonthYmd, setVisibleMonthYmd] = useState(today);

  const [busy, setBusy] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [monthDayIds, setMonthDayIds] = useState([]);
  const [games, setGames] = useState([]);

  const headerTitle = i18n.t("nhl.schedule.title", { defaultValue: "Calendrier NHL" });

  const hasLoggedScheduleViewRef = useRef(false);
  const lastLoggedDateRef = useRef(null);
  const lastLoggedMonthRef = useRef(null);

  useEffect(() => {
    setBusy(true);

    const start = ymdCompact(monthStartYmd(visibleMonthYmd));
    const end = ymdCompact(monthEndYmd(visibleMonthYmd));

    const ref = firestore()
      .collection("nhl_schedule_daily")
      .orderBy(firestore.FieldPath.documentId())
      .startAt(start)
      .endAt(end);

    const unsub = ref.onSnapshot(
      (snap) => {
        const ids = snap.docs.map((d) => d.id);
        setMonthDayIds(ids);
        setBusy(false);
      },
      (err) => {
        console.log("[NhlSchedule] month days read error", err?.message || err);
        setMonthDayIds([]);
        setBusy(false);
      }
    );

    return () => {
      try {
        unsub();
      } catch {}
    };
  }, [visibleMonthYmd]);

  useEffect(() => {
    const dayId = ymdCompact(selectedYmd);

    const ref = firestore()
      .collection("nhl_schedule_daily")
      .doc(dayId)
      .collection("games");

    const unsub = ref.onSnapshot(
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        list.sort((a, b) => {
          const ta = a.startTimeUTC?.toDate
            ? a.startTimeUTC.toDate().getTime()
            : new Date(a.startTimeUTC || 0).getTime();
          const tb = b.startTimeUTC?.toDate
            ? b.startTimeUTC.toDate().getTime()
            : new Date(b.startTimeUTC || 0).getTime();
          return ta - tb;
        });
        setGames(list);
      },
      (err) => {
        console.log("[NhlSchedule] day games read error", err?.message || err);
        setGames([]);
      }
    );

    return () => {
      try {
        unsub();
      } catch {}
    };
  }, [selectedYmd]);

  const markedDates = useMemo(() => {
    const marks = {};

    for (const dayId of monthDayIds) {
      const ymd = `${dayId.slice(0, 4)}-${dayId.slice(4, 6)}-${dayId.slice(6, 8)}`;
      marks[ymd] = {
        marked: true,
        dotColor: colors.primary,
      };
    }

    marks[selectedYmd] = {
      ...(marks[selectedYmd] || {}),
      selected: true,
      selectedColor: colors.primary,
    };

    return marks;
  }, [monthDayIds, selectedYmd, colors.primary]);

  function finalMeta(item, t) {
    const periodType = String(
      item?.gameOutcome?.lastPeriodType || item?.periodType || ""
    ).toUpperCase();

    if (periodType === "OT") {
      return t("nhl.schedule.finalOt", { defaultValue: "Final • Prol." });
    }

    if (periodType === "SO") {
      return t("nhl.schedule.finalSo", { defaultValue: "Final • TDB" });
    }

    return t("nhl.schedule.final", { defaultValue: "Final" });
  }

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      // Optionnel si tu crées un callable plus tard
      // const fn = functions().httpsCallable("updateNhlScheduleWindowNow");
      // await fn({ month: visibleMonthYmd });
    } catch (e) {
      console.log("[NhlSchedule] refresh error", e?.message || e);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (busy) return;
    if (hasLoggedScheduleViewRef.current) return;

    hasLoggedScheduleViewRef.current = true;

    Analytics.nhlScheduleView({
      selectedDate: selectedYmd || null,
      visibleMonth: visibleMonthYmd || null,
      gamesCount: Array.isArray(games) ? games.length : 0,
    });
  }, [busy, selectedYmd, visibleMonthYmd, games]);

  useEffect(() => {
    if (busy) return;
    if (!selectedYmd) return;
    if (lastLoggedDateRef.current === selectedYmd) return;

    lastLoggedDateRef.current = selectedYmd;

    Analytics.nhlScheduleDateChanged({
      selectedDate: selectedYmd,
      gamesCount: Array.isArray(games) ? games.length : 0,
    });
  }, [busy, selectedYmd, games]);

  useEffect(() => {
    if (busy) return;
    if (!visibleMonthYmd) return;
    if (lastLoggedMonthRef.current === visibleMonthYmd) return;

    lastLoggedMonthRef.current = visibleMonthYmd;

    Analytics.nhlScheduleMonthChanged({
      visibleMonth: visibleMonthYmd,
      markedDaysCount: Array.isArray(monthDayIds) ? monthDayIds.length : 0,
    });
  }, [busy, visibleMonthYmd, monthDayIds]);

  const renderRow = ({ item }) => {
    const away = safeAbbr(item.away) || item.awayAbbr || "AWY";
    const home = safeAbbr(item.home) || item.homeAbbr || "HOM";

    const awayLogo = teamLogo(away);
    const homeLogo = teamLogo(home);

    const score = scoreText(item);
    const kind = gameStateKind(item);
    const isLive = kind === "LIVE";
    const isFinal = kind === "FINAL";

    return (
      <View
        style={{
          padding: 12,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.card,
          marginBottom: 10,
        }}
      >
        {/* Ligne équipes + score */}
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          {/* Away */}
          <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
            <View
              style={{
                width: 34,
                height: 34,
                borderRadius: 10,
                backgroundColor: colors.background,
                borderWidth: 1,
                borderColor: colors.border,
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
                marginRight: 10,
              }}
            >
              {awayLogo ? (
                <Image source={awayLogo} style={{ width: 28, height: 28 }} resizeMode="contain" />
              ) : (
                <Text style={{ color: colors.subtext, fontWeight: "900" }}>{away}</Text>
              )}
            </View>

            <Text style={{ color: colors.text, fontWeight: "900" }}>{away}</Text>
          </View>

          {/* Centre */}
          <View style={{ minWidth: 88, alignItems: "center", justifyContent: "center" }}>
            {score ? (
              <Text style={{ color: colors.text, fontWeight: "900", fontSize: 16 }}>
                {score}
              </Text>
            ) : (
              <Text style={{ color: colors.subtext, fontWeight: "800" }}>@</Text>
            )}
          </View>

          {/* Home */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              flex: 1,
              justifyContent: "flex-end",
            }}
          >
            <Text style={{ color: colors.text, fontWeight: "900", marginRight: 10 }}>{home}</Text>

            <View
              style={{
                width: 34,
                height: 34,
                borderRadius: 10,
                backgroundColor: colors.background,
                borderWidth: 1,
                borderColor: colors.border,
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
              }}
            >
              {homeLogo ? (
                <Image source={homeLogo} style={{ width: 28, height: 28 }} resizeMode="contain" />
              ) : (
                <Text style={{ color: colors.subtext, fontWeight: "900" }}>{home}</Text>
              )}
            </View>
          </View>
        </View>

        {/* Ligne statut */}
        <View
          style={{
            marginTop: 8,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {isFinal ? (
            <View
              style={{
                paddingVertical: 4,
                paddingHorizontal: 10,
                borderRadius: 999,
                backgroundColor: colors.background,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <Text style={{ color: colors.subtext, fontWeight: "900", fontSize: 11 }}>
                {finalMeta(item, i18n.t.bind(i18n))}
              </Text>
            </View>
          ) : isLive ? (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
              }}
            >
              <Text style={{ color: colors.subtext }}>
                {i18n.t("nhl.schedule.liveWithPeriod", {
                  defaultValue: "En cours • {{meta}}",
                  meta: liveMeta(item) || "LIVE",
                })}
              </Text>

              <View
                style={{
                  paddingVertical: 4,
                  paddingHorizontal: 8,
                  borderRadius: 999,
                  backgroundColor: "rgba(239,68,68,0.12)",
                  borderWidth: 1,
                  borderColor: "rgba(239,68,68,0.25)",
                }}
              >
                <Text style={{ color: "#ef4444", fontWeight: "900", fontSize: 11 }}>
                  LIVE
                </Text>
              </View>
            </View>
          ) : (
            <Text style={{ color: colors.subtext }}>
              {i18n.t("nhl.schedule.startAt", {
                defaultValue: "Début: {{t}}",
                t: fmtTimeToronto(item.startTimeUTC),
              })}
            </Text>
          )}
        </View>
      </View>
    );
  };

  return (
    <>
      <Stack.Screen options={{ title: headerTitle }} />

      <View style={{ flex: 1, backgroundColor: colors.background }}>
        {busy ? (
          <View style={{ padding: 16 }}>
            <ActivityIndicator color={colors.primary} />
            <Text style={{ marginTop: 8, color: colors.subtext }}>
              {i18n.t("nhl.schedule.loadingMonth", { defaultValue: "Chargement du mois…" })}
            </Text>
          </View>
        ) : null}

        <View style={{ paddingHorizontal: 12, paddingTop: 8 }}>
          <Calendar
            current={selectedYmd}
            onDayPress={(day) => setSelectedYmd(day.dateString)}
            onMonthChange={(m) => {
              setVisibleMonthYmd(m.dateString);
            }}
            markedDates={markedDates}
            theme={{
              backgroundColor: colors.background,
              calendarBackground: colors.background,
              dayTextColor: colors.text,
              monthTextColor: colors.text,
              textDisabledColor: colors.subtext,
              arrowColor: colors.text,
              selectedDayBackgroundColor: colors.primary,
              selectedDayTextColor: "#fff",
              todayTextColor: colors.primary,
            }}
          />
        </View>

        <FlatList
          data={games}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          }
          ListHeaderComponent={() => (
            <View style={{ marginBottom: 12 }}>
              <Text style={{ color: colors.subtext }}>
                {i18n.t("nhl.schedule.header", {
                  defaultValue: "Matchs du {{day}}",
                  day: selectedYmd,
                })}
              </Text>
            </View>
          )}
          ListEmptyComponent={() => (
            <View style={{ marginTop: 16, alignItems: "center" }}>
              <Text style={{ color: colors.subtext }}>
                {i18n.t("nhl.schedule.emptyForDay", {
                  defaultValue: "Aucun match pour cette journée.",
                })}
              </Text>
            </View>
          )}
          renderItem={renderRow}
        />
      </View>
    </>
  );
}