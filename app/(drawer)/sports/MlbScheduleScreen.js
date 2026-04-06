import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  ActivityIndicator,
  FlatList,
  RefreshControl,
  Image,
} from "react-native";
import { Stack } from "expo-router";
import { Calendar } from "react-native-calendars";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { SvgUri } from "react-native-svg";
import { useTheme } from "@src/theme/ThemeProvider";
import firestore from "@react-native-firebase/firestore";
import functions from "@react-native-firebase/functions";
import i18n from "@src/i18n/i18n";
// import Analytics from "@src/services/analytics";

/* ========================
   Helpers dates
========================= */
function pad2(n) {
  return String(n).padStart(2, "0");
}

function todayYmd() {
  const d = new Date();
  const y = d.getFullYear();
  const m = pad2(d.getMonth() + 1);
  const day = pad2(d.getDate());
  return `${y}-${m}-${day}`;
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
  const lastDay = new Date(y, m, 0).getDate();
  return `${yy}-${mm}-${String(lastDay).padStart(2, "0")}`;
}

/* ========================
   Helpers data
========================= */
function pickNumber(v, fallback = 0) {
  if (typeof v === "number") return Number.isFinite(v) ? v : fallback;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  }
  return fallback;
}

function pickStr(v, fallback = "") {
  return typeof v === "string" ? v : fallback;
}

function toDateAny(v) {
  if (!v) return null;
  if (typeof v?.toDate === "function") return v.toDate();
  if (v instanceof Date) return v;
  const d = new Date(v);
  return Number.isFinite(d?.getTime?.()) ? d : null;
}

function fmtLocalHM(v) {
  const d = toDateAny(v);
  if (!d) return "—";
  const hh = pad2(d.getHours());
  const mm = pad2(d.getMinutes());
  return `${hh}:${mm}`;
}

function safeTeam(item, side) {
  return item?.[side] || item?.[`${side}Team`] || {};
}

function teamAbbr(team) {
  return pickStr(team?.abbreviation, "");
}

function teamScore(team) {
  return pickNumber(team?.score, 0);
}

function teamLogo(team) {
  return pickStr(team?.logo, "");
}

function scoreText(item) {
  const away = safeTeam(item, "away");
  const home = safeTeam(item, "home");

  const hasAway = away?.score !== undefined && away?.score !== null;
  const hasHome = home?.score !== undefined && home?.score !== null;

  if (!hasAway || !hasHome) return null;
  return `${teamScore(away)} - ${teamScore(home)}`;
}

function statusLabel(game) {
  const detailed = pickStr(game?.status?.detailedState, "");
  const abstractState = pickStr(game?.status?.abstractGameState, "").toLowerCase();

  if (detailed) return detailed;
  if (abstractState === "final") {
    return i18n.t("mlb.schedule.status.final", { defaultValue: "Final" });
  }
  if (abstractState === "live") {
    return i18n.t("mlb.schedule.status.live", { defaultValue: "Live" });
  }
  if (abstractState === "preview") {
    return i18n.t("mlb.schedule.status.preview", { defaultValue: "À venir" });
  }

  return "—";
}

function statusTone(game, colors) {
  const abstractState = pickStr(game?.status?.abstractGameState, "").toLowerCase();

  if (abstractState === "live") {
    return {
      bg: "rgba(239,68,68,0.12)",
      bd: "rgba(239,68,68,0.25)",
      fg: "#ef4444",
    };
  }

  if (abstractState === "final") {
    return {
      bg: colors.background,
      bd: colors.border,
      fg: colors.subtext,
    };
  }

  return {
    bg: colors.background,
    bd: colors.border,
    fg: colors.subtext,
  };
}

function isLiveGame(game) {
  return pickStr(game?.status?.abstractGameState, "").toLowerCase() === "live";
}

function isFinalGame(game) {
  return pickStr(game?.status?.abstractGameState, "").toLowerCase() === "final";
}

/* ========================
   UI bits
========================= */
function TeamLogoMlb({ logo, abbr, colors, size = 24 }) {
  return (
    <View
      style={{
        width: 34,
        height: 34,
        borderRadius: 10,
        backgroundColor: "#fff",
        borderWidth: 1,
        borderColor: colors.border,
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
      }}
    >
      {logo ? (
        logo.endsWith(".svg") ? (
          <SvgUri uri={logo} width={size} height={size} />
        ) : (
          <Image
            source={{ uri: logo }}
            style={{ width: size, height: size }}
            resizeMode="contain"
          />
        )
      ) : (
        <Text style={{ color: colors.subtext, fontWeight: "900", fontSize: 11 }}>
          {abbr || "—"}
        </Text>
      )}
    </View>
  );
}

function StatusChip({ game, colors }) {
  const tone = statusTone(game, colors);

  return (
    <View
      style={{
        paddingVertical: 4,
        paddingHorizontal: 10,
        borderRadius: 999,
        backgroundColor: tone.bg,
        borderWidth: 1,
        borderColor: tone.bd,
      }}
    >
      <Text style={{ color: tone.fg, fontWeight: "900", fontSize: 11 }}>
        {statusLabel(game)}
      </Text>
    </View>
  );
}

function MatchRow({ item, colors }) {
  const away = safeTeam(item, "away");
  const home = safeTeam(item, "home");

  const awayAbbr = teamAbbr(away) || "AWY";
  const homeAbbr = teamAbbr(home) || "HOM";

  const awayLogo = teamLogo(away);
  const homeLogo = teamLogo(home);

  const score = scoreText(item);

  return (
    <View style={{ flexDirection: "row", alignItems: "center" }}>
      <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
        <TeamLogoMlb logo={awayLogo} abbr={awayAbbr} colors={colors} size={24} />
        <Text
          numberOfLines={1}
          style={{ marginLeft: 8, color: colors.text, fontWeight: "900" }}
        >
          {awayAbbr}
        </Text>
      </View>

      <View style={{ minWidth: 88, alignItems: "center", justifyContent: "center" }}>
        {score ? (
          <Text style={{ color: colors.text, fontWeight: "900", fontSize: 16 }}>
            {score}
          </Text>
        ) : (
          <Text style={{ color: colors.subtext, fontWeight: "800" }}>@</Text>
        )}
      </View>

      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          flex: 1,
          justifyContent: "flex-end",
        }}
      >
        <Text
          numberOfLines={1}
          style={{ marginRight: 8, color: colors.text, fontWeight: "900" }}
        >
          {homeAbbr}
        </Text>
        <TeamLogoMlb logo={homeLogo} abbr={homeAbbr} colors={colors} size={24} />
      </View>
    </View>
  );
}

function GameStatusLine({ item, colors }) {
  const inningState = pickStr(item?.inningState, "");
  const inning = pickNumber(item?.currentInning, 0);
  const inningOrdinal = pickStr(item?.currentInningOrdinal, "");
  const time = fmtLocalHM(item?.startTimeUTC);

  if (isFinalGame(item)) {
    return (
      <View
        style={{
          marginTop: 8,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <StatusChip game={item} colors={colors} />
      </View>
    );
  }

  if (isLiveGame(item)) {
    return (
      <View
        style={{
          marginTop: 8,
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          {(inningState || inning > 0 || inningOrdinal) ? (
            <Text style={{ color: colors.subtext }}>
              {[
                inningState,
                inningOrdinal || (inning > 0 ? String(inning) : ""),
              ]
                .filter(Boolean)
                .join(" ")}
            </Text>
          ) : null}

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
      </View>
    );
  }

  return (
    <View
      style={{
        marginTop: 8,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text style={{ color: colors.subtext }}>
        {i18n.t("mlb.schedule.startAt", {
          defaultValue: "Début: {{time}}",
          time,
        })}
      </Text>
    </View>
  );
}

function GameCard({ item, colors }) {
  const venue = pickStr(item?.venue?.name, "");

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
      <MatchRow item={item} colors={colors} />
      <GameStatusLine item={item} colors={colors} />

      {!!venue ? (
        <View style={{ marginTop: 8, alignItems: "center" }}>
          <Text style={{ color: colors.subtext, fontSize: 12 }} numberOfLines={1}>
            {venue}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

/* ========================
   Screen
========================= */
export default function MlbScheduleScreen() {
  const { colors } = useTheme();

  const today = useMemo(() => todayYmd(), []);
  const [selectedYmd, setSelectedYmd] = useState(today);
  const [visibleMonthYmd, setVisibleMonthYmd] = useState(today);

  const [busy, setBusy] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [monthDayIds, setMonthDayIds] = useState([]);
  const [games, setGames] = useState([]);

  const headerTitle = i18n.t("mlb.schedule.title", {
    defaultValue: "Calendrier MLB",
  });

  const hasLoggedScheduleViewRef = useRef(false);
  const lastLoggedDateRef = useRef(null);
  const lastLoggedMonthRef = useRef(null);

  useEffect(() => {
    setBusy(true);

    const start = ymdCompact(monthStartYmd(visibleMonthYmd));
    const end = ymdCompact(monthEndYmd(visibleMonthYmd));

    const ref = firestore()
      .collection("mlb_schedule_daily")
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
        console.log("[MlbSchedule] month days read error", err?.message || err);
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
      .collection("mlb_schedule_daily")
      .doc(dayId)
      .collection("games");

    const unsub = ref.onSnapshot(
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

        list.sort((a, b) => {
          const ta = toDateAny(a?.startTimeUTC)?.getTime?.() || 0;
          const tb = toDateAny(b?.startTimeUTC)?.getTime?.() || 0;
          return ta - tb;
        });

        setGames(list);
      },
      (err) => {
        console.log("[MlbSchedule] day games read error", err?.message || err);
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
      dotColor: "#fff",
    };

    return marks;
  }, [monthDayIds, selectedYmd, colors.primary]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const fn = functions().httpsCallable("updateMlbScheduleWindowNow");
      await fn({
        startYmd: monthStartYmd(visibleMonthYmd),
        endYmd: monthEndYmd(visibleMonthYmd),
      });
    } catch (e) {
      console.log("[MlbSchedule] refresh error", e?.message || e);
    } finally {
      setRefreshing(false);
    }
  }, [visibleMonthYmd]);

  return (
    <>
      <Stack.Screen options={{ title: headerTitle }} />

      <View style={{ flex: 1, backgroundColor: colors.background }}>
        {busy ? (
          <View style={{ padding: 16 }}>
            <ActivityIndicator color={colors.primary} />
            <Text style={{ marginTop: 8, color: colors.subtext }}>
              {i18n.t("mlb.schedule.loadingMonth", {
                defaultValue: "Chargement du mois…",
              })}
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
              dotColor: colors.primary,
              indicatorColor: colors.primary,
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
                {i18n.t("mlb.schedule.header", {
                  defaultValue: "Matchs du {{day}}",
                  day: selectedYmd,
                })}
              </Text>
            </View>
          )}
          ListEmptyComponent={() => (
            <View style={{ marginTop: 16, alignItems: "center" }}>
              <Text style={{ color: colors.subtext, textAlign: "center" }}>
                {i18n.t("mlb.schedule.emptyForDay", {
                  defaultValue: "Aucun match pour cette journée.",
                })}
              </Text>
            </View>
          )}
          renderItem={({ item }) => <GameCard item={item} colors={colors} />}
        />
      </View>
    </>
  );
}