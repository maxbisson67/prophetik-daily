import React, { useEffect, useMemo, useState, useCallback } from "react";
import { View, Text, ActivityIndicator, FlatList, RefreshControl, Image } from "react-native";
import { Stack } from "expo-router";
import { Calendar } from "react-native-calendars";
import { useTheme } from "@src/theme/ThemeProvider";
import firestore from "@react-native-firebase/firestore";
import functions from "@react-native-firebase/functions";
import i18n from "@src/i18n/i18n";


/* ========================
   Logos (reprend ton mapping NHL)
   ⚠️ Ajuste le path si nécessaire selon ton fichier
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
  return `${get("year")}-${get("month")}-${get("day")}`; // YYYY-MM-DD
}

function ymdCompact(ymd) {
  return String(ymd || "").replaceAll("-", ""); // YYYYMMDD
}

function monthStartYmd(ymd) {
  const [y, m] = String(ymd).split("-");
  return `${y}-${m}-01`;
}

function monthEndYmd(ymd) {
  const [yy, mm] = String(ymd).split("-");
  const y = Number(yy);
  const m = Number(mm);
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate(); // 0 => dernier jour du mois précédent
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

  // Heure locale du device (souvent ok), sinon forcer Toronto :
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
  // selon ton normalizeSchedule, tu as home/away : { abbr, name... }
  return (
    team?.abbr ||
    team?.teamAbbrev?.default ||
    team?.teamAbbrev ||
    team?.abbrev ||
    ""
  );
}

export default function NhlScheduleScreen() {
  const { colors } = useTheme();

  // Date sélectionnée pour la liste (YYYY-MM-DD)
  const today = useMemo(() => ymdToronto(new Date()), []);
  const [selectedYmd, setSelectedYmd] = useState(today);

  // Mois affiché dans le calendrier (on garde un “anchor” YYYY-MM-DD)
  const [visibleMonthYmd, setVisibleMonthYmd] = useState(today);

  const [busy, setBusy] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [monthDayIds, setMonthDayIds] = useState([]); // ["20260103","20260104",...]
  const [games, setGames] = useState([]);

  const headerTitle = i18n.t("nhl.schedule.title", { defaultValue: "Calendrier NHL" });

  /** ---------- 1) Charger les jours du mois qui ont un doc nhl_schedule_daily/{yyyymmdd} ---------- */
  useEffect(() => {
    setBusy(true);

    const start = ymdCompact(monthStartYmd(visibleMonthYmd));
    const end = ymdCompact(monthEndYmd(visibleMonthYmd));

    // onSnapshot sur la collection des jours (docs) du mois
    const ref = firestore()
      .collection("nhl_schedule_daily")
      .orderBy(firestore.FieldPath.documentId())
      .startAt(start)
      .endAt(end);

    const unsub = ref.onSnapshot(
      (snap) => {
        const ids = snap.docs.map((d) => d.id); // yyyymmdd
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
      try { unsub(); } catch {}
    };
  }, [visibleMonthYmd]);

  /** ---------- 2) Charger les matchs de la journée sélectionnée ---------- */
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
          const ta = a.startTimeUTC?.toDate ? a.startTimeUTC.toDate().getTime() : new Date(a.startTimeUTC || 0).getTime();
          const tb = b.startTimeUTC?.toDate ? b.startTimeUTC.toDate().getTime() : new Date(b.startTimeUTC || 0).getTime();
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
      try { unsub(); } catch {}
    };
  }, [selectedYmd]);

  /** ---------- Marquage du calendrier ---------- */
  const markedDates = useMemo(() => {
    const marks = {};

    // jours avec matchs (point)
    for (const dayId of monthDayIds) {
      const ymd = `${dayId.slice(0, 4)}-${dayId.slice(4, 6)}-${dayId.slice(6, 8)}`;
      marks[ymd] = {
        marked: true,
        dotColor: colors.primary,
      };
    }

    // jour sélectionné (surbrillance)
    marks[selectedYmd] = {
      ...(marks[selectedYmd] || {}),
      selected: true,
      selectedColor: colors.primary,
    };

    return marks;
  }, [monthDayIds, selectedYmd, colors.primary]);

  /** ---------- Refresh manuel (optionnel) ---------- */
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      // Option A: tu n’as rien à faire si le cron remplit déjà la fenêtre.
      // Option B: si tu crées un callable "updateNhlScheduleWindowNow", appelle-le ici.
      // const fn = functions().httpsCallable("updateNhlScheduleWindowNow");
      // await fn({ month: visibleMonthYmd });

      // Fallback: noop
    } catch (e) {
      console.log("[NhlSchedule] refresh error", e?.message || e);
    } finally {
      setRefreshing(false);
    }
  }, [visibleMonthYmd]);

const renderRow = ({ item }) => {
  const away = safeAbbr(item.away) || item.awayAbbr || "AWY";
  const home = safeAbbr(item.home) || item.homeAbbr || "HOM";

  const awayLogo = teamLogo(away);
  const homeLogo = teamLogo(home);

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
      {/* Ligne équipes */}
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

        <Text style={{ color: colors.subtext, fontWeight: "800", marginHorizontal: 10 }}>@</Text>

        {/* Home */}
        <View style={{ flexDirection: "row", alignItems: "center", flex: 1, justifyContent: "flex-end" }}>
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

      {/* Heure */}
      <Text style={{ color: colors.subtext, marginTop: 8 }}>
        {i18n.t("nhl.schedule.startAt", {
          defaultValue: "Début: {{t}}",
          t: fmtTimeToronto(item.startTimeUTC),
        })}
      </Text>
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

        {/* Calendrier */}
        <View style={{ paddingHorizontal: 12, paddingTop: 8 }}>
          <Calendar
            current={selectedYmd}
            onDayPress={(day) => setSelectedYmd(day.dateString)}
            onMonthChange={(m) => {
              // m.dateString = YYYY-MM-DD (1er du mois en général)
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

        {/* Liste des matchs du jour */}
        <FlatList
          data={games}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
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
                {i18n.t("nhl.schedule.emptyForDay", { defaultValue: "Aucun match pour cette journée." })}
              </Text>
            </View>
          )}
          renderItem={renderRow}
        />
      </View>
    </>
  );
}