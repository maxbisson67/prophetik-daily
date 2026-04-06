import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  ActivityIndicator,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  Image,
} from "react-native";
import { SvgUri } from "react-native-svg";
import { Stack } from "expo-router";
import { useTheme } from "@src/theme/ThemeProvider";
import firestore from "@react-native-firebase/firestore";
import functions from "@react-native-firebase/functions";
import i18n from "@src/i18n/i18n";

const AL_ID = "103";
const NL_ID = "104";

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

function Pill({ active, label, onPress, colors }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        paddingVertical: 9,
        paddingHorizontal: 14,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: active ? colors.primary : colors.border,
        backgroundColor: active ? colors.primary : colors.card,
        minWidth: 112,
        alignItems: "center",
      }}
    >
      <Text style={{ color: active ? "#fff" : colors.text, fontWeight: "800" }}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function PillsRow({ children }) {
  return (
    <View
      style={{
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 10,
        justifyContent: "center",
      }}
    >
      {children}
    </View>
  );
}

function TeamLogoMlb({ logo, abbr, colors, size = 28 }) {
  return (
    <View
      style={{
        width: 40,
        height: 40,
        borderRadius: 10,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#fff",
        borderWidth: 1,
        borderColor: colors.border,
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
        <Text style={{ color: colors.subtext, fontWeight: "900" }}>
          {abbr || "—"}
        </Text>
      )}
    </View>
  );
}

function TeamRow({ item, colors, mode }) {
  const team = item?.team || {};
  const logo = pickStr(team?.logo, "");
  const abbr = pickStr(team?.abbreviation, "");
  const name = pickStr(team?.name, "—");

  const wins = pickNumber(item?.wins, 0);
  const losses = pickNumber(item?.losses, 0);
  const gb = pickStr(item?.divisionGamesBack, "-");
  const pct = pickStr(item?.winningPercentage, ".000");

  const wcRank = pickStr(item?.wildCardRank, "");
  const wcGb = pickStr(item?.wildCardGamesBack, "");

  const rightSubLabel =
    mode === "wildcard" && wcRank
      ? `WC #${wcRank} • ${wcGb || "-"}`
      : i18n.t("mlb.standings.gb", {
          defaultValue: "GB: {{gb}}",
          gb,
        });

  return (
    <View
      style={{
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.card,
        marginBottom: 10,
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
      }}
    >
      <TeamLogoMlb logo={logo} abbr={abbr} colors={colors} size={28} />

      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.text, fontWeight: "900", fontSize: 15 }}>
          {abbr || name}
        </Text>

        {!!abbr && name && name !== abbr ? (
          <Text style={{ color: colors.subtext, marginTop: 2, fontSize: 12 }}>
            {name}
          </Text>
        ) : null}

        <Text style={{ color: colors.subtext, marginTop: 4, fontSize: 12 }}>
          {i18n.t("mlb.standings.record", {
            defaultValue: "Fiche: {{w}}-{{l}}",
            w: wins,
            l: losses,
          })}
        </Text>
      </View>

      <View style={{ alignItems: "flex-end" }}>
        <Text style={{ color: colors.text, fontWeight: "900", fontSize: 15 }}>
          {pct}
        </Text>
        <Text style={{ color: colors.subtext, marginTop: 4, fontSize: 12 }}>
          {rightSubLabel}
        </Text>
      </View>
    </View>
  );
}

export default function MlbStandingsScreen() {
  const { colors } = useTheme();

  const [currentSeason, setCurrentSeason] = useState(null);
  const [season, setSeason] = useState(null);
  const [leagueId, setLeagueId] = useState(AL_ID);
  const [mode, setMode] = useState("divisions"); // divisions | wildcard

  const [leagueDoc, setLeagueDoc] = useState(null);
  const [busy, setBusy] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const headerTitle = i18n.t("mlb.standings.title", {
    defaultValue: "Classement MLB",
  });

  useEffect(() => {
    const ref = firestore().doc("mlb_standings/current");

    const unsub = ref.onSnapshot(
      (snap) => {
        const data = snap.data() || {};
        const s = String(data.season || "");

        setCurrentSeason(s || null);
        setSeason((prev) => prev || s || null);
      },
      (err) => {
        console.log("[MlbStandingsScreen] current read error", err?.message || err);
      }
    );

    return () => {
      try {
        unsub();
      } catch {}
    };
  }, []);

  useEffect(() => {
    if (!season || !leagueId) {
      setBusy(false);
      setLeagueDoc(null);
      return;
    }

    setBusy(true);

    const ref = firestore().doc(`mlb_standings/${season}/leagues/${leagueId}`);

    const unsub = ref.onSnapshot(
      (snap) => {
        setLeagueDoc(snap.data() || null);
        setBusy(false);
      },
      (err) => {
        console.log("[MlbStandingsScreen] league read error", err?.message || err);
        setLeagueDoc(null);
        setBusy(false);
      }
    );

    return () => {
      try {
        unsub();
      } catch {}
    };
  }, [season, leagueId]);

  const previousSeason = useMemo(() => {
    if (!currentSeason) return null;
    const n = Number(currentSeason);
    return Number.isFinite(n) ? String(n - 1) : null;
  }, [currentSeason]);

  const sections = useMemo(() => {
    if (!leagueDoc) return [];

    if (mode === "divisions") {
      const divisions = Array.isArray(leagueDoc?.divisions) ? leagueDoc.divisions : [];

      return divisions.map((div, index) => {
        const rows = Array.isArray(div?.teamRecords) ? [...div.teamRecords] : [];

        rows.sort((a, b) => {
          const ra = pickNumber(a?.divisionRank, 999);
          const rb = pickNumber(b?.divisionRank, 999);
          if (ra !== rb) return ra - rb;

          const wa = pickNumber(a?.wins, 0);
          const wb = pickNumber(b?.wins, 0);
          return wb - wa;
        });

        const divisionTitle =
          pickStr(div?.division?.name, "") ||
          pickStr(div?.division?.nameShort, "") ||
          pickStr(div?.division?.abbreviation, "") ||
          i18n.t("mlb.standings.divisionFallback", {
            defaultValue: "Division {{index}}",
            index: index + 1,
          });

        return {
          key: div?.key || String(div?.division?.id || index),
          title: divisionTitle,
          data: rows,
        };
      });
    }

    const rows = Array.isArray(leagueDoc?.wildcard) ? [...leagueDoc.wildcard] : [];

    rows.sort((a, b) => {
      const ra = pickNumber(a?.wildCardRank, 999);
      const rb = pickNumber(b?.wildCardRank, 999);
      if (ra !== rb) return ra - rb;

      const wa = pickNumber(a?.wins, 0);
      const wb = pickNumber(b?.wins, 0);
      return wb - wa;
    });

    return [
      {
        key: "wildcard",
        title: i18n.t("mlb.standings.wildcardTitle", {
          defaultValue: "Classement Wildcard",
        }),
        data: rows,
      },
    ];
  }, [leagueDoc, mode]);

  const flatData = useMemo(() => {
    const out = [];

    sections.forEach((section) => {
      out.push({
        __type: "header",
        key: `H:${section.key}`,
        title: section.title,
      });

      section.data.forEach((item, idx) => {
        out.push({
          __type: "row",
          key: `R:${section.key}:${idx}:${item?.team?.id || idx}`,
          item,
        });
      });
    });

    return out;
  }, [sections]);

  const onRefresh = useCallback(async () => {
    if (!season) return;

    setRefreshing(true);
    try {
      const fn = functions().httpsCallable("updateMlbStandingsNow");
      await fn({
        season,
        standingsTypes: "regularSeason",
      });
    } catch (e) {
      console.log("[MlbStandingsScreen] refresh error", e?.message || e);
    } finally {
      setRefreshing(false);
    }
  }, [season]);

  const renderItem = ({ item }) => {
    if (item.__type === "header") {
      return (
        <View style={{ marginTop: 14, marginBottom: 8 }}>
          <Text style={{ color: colors.text, fontWeight: "900", fontSize: 16 }}>
            {item.title}
          </Text>
        </View>
      );
    }

    return <TeamRow item={item.item} colors={colors} mode={mode} />;
  };

  return (
    <>
      <Stack.Screen options={{ title: headerTitle }} />

      <View style={{ flex: 1, backgroundColor: colors.background }}>
        {busy ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <ActivityIndicator color={colors.primary} />
            <Text style={{ marginTop: 8, color: colors.subtext }}>
              {i18n.t("mlb.standings.loading", {
                defaultValue: "Chargement du classement MLB…",
              })}
            </Text>
          </View>
        ) : (
          <FlatList
            data={flatData}
            keyExtractor={(item) => item.key}
            renderItem={renderItem}
            contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={colors.primary}
              />
            }
            ListHeaderComponent={() => (
              <View style={{ marginBottom: 12, gap: 10 }}>
                <PillsRow>
                  {currentSeason ? (
                    <Pill
                      colors={colors}
                      active={season === currentSeason}
                      label={currentSeason}
                      onPress={() => setSeason(currentSeason)}
                    />
                  ) : null}

                  {previousSeason ? (
                    <Pill
                      colors={colors}
                      active={season === previousSeason}
                      label={previousSeason}
                      onPress={() => setSeason(previousSeason)}
                    />
                  ) : null}
                </PillsRow>

                <PillsRow>
                  <Pill
                    colors={colors}
                    active={leagueId === AL_ID}
                    label={i18n.t("mlb.standings.al", {
                      defaultValue: "Ligue américaine",
                    })}
                    onPress={() => setLeagueId(AL_ID)}
                  />
                  <Pill
                    colors={colors}
                    active={leagueId === NL_ID}
                    label={i18n.t("mlb.standings.nl", {
                      defaultValue: "Ligue nationale",
                    })}
                    onPress={() => setLeagueId(NL_ID)}
                  />
                </PillsRow>

                <PillsRow>
                  <Pill
                    colors={colors}
                    active={mode === "divisions"}
                    label={i18n.t("mlb.standings.divisions", {
                      defaultValue: "Divisions",
                    })}
                    onPress={() => setMode("divisions")}
                  />

                  <Pill
                    colors={colors}
                    active={mode === "wildcard"}
                    label={i18n.t("mlb.standings.wildcard", {
                      defaultValue: "Wildcard",
                    })}
                    onPress={() => setMode("wildcard")}
                  />
                </PillsRow>
              </View>
            )}
            ListEmptyComponent={() => (
              <View style={{ marginTop: 40, alignItems: "center" }}>
                <Text style={{ color: colors.subtext }}>
                  {i18n.t("mlb.standings.empty", {
                    defaultValue: "Aucune donnée.",
                  })}
                </Text>
              </View>
            )}
          />
        )}
      </View>
    </>
  );
}