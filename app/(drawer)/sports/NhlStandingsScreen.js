import React, { useEffect, useMemo, useState, useCallback ,useRef} from "react";
import {
  View,
  Text,
  ActivityIndicator,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  Image,
} from "react-native";
import { Stack } from "expo-router";
import { useTheme } from "@src/theme/ThemeProvider";
import firestore from "@react-native-firebase/firestore";
import functions from "@react-native-firebase/functions";
import i18n from "@src/i18n/i18n";
import Analytics from "@src/services/analytics";

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
  return LOGO_MAP[abbr] || null;
}

function pickNumber(v, fallback = 0) {
  return typeof v === "number" ? v : typeof v === "string" ? Number(v) : fallback;
}

function pickStr(v, fallback = "") {
  return typeof v === "string" ? v : fallback;
}

function teamName(item) {
  const abbr = item?.teamAbbrev?.default || item?.teamAbbrev || "";
  const name = item?.teamName?.default || "";
  return name ? `${abbr} • ${name}` : abbr || "—";
}

// points% simple
function pointsPct(item) {
  const pts = pickNumber(item?.points, 0);
  const gp = pickNumber(item?.gamesPlayed, 0);
  const maxPts = gp * 2;
  return maxPts > 0 ? pts / maxPts : 0;
}

function sortWildcardTeams(a, b) {
  const wa = pickNumber(a?.wildcardSequence, 9999);
  const wb = pickNumber(b?.wildcardSequence, 9999);
  if (wa !== wb) return wa - wb;

  return sortNhlTeams(a, b);
}

function sortNhlTeams(a, b) {
  // 1) points desc
  const pa = pickNumber(a?.points, 0);
  const pb = pickNumber(b?.points, 0);
  if (pb !== pa) return pb - pa;

  // 2) points% desc
  const ppa = pointsPct(a);
  const ppb = pointsPct(b);
  if (ppb !== ppa) return ppb - ppa;

  // 3) wins desc
  const wa = pickNumber(a?.wins, 0);
  const wb = pickNumber(b?.wins, 0);
  if (wb !== wa) return wb - wa;

  // 4) leagueSequence asc (si présent)
  const sa = pickNumber(a?.leagueSequence, 9999);
  const sb = pickNumber(b?.leagueSequence, 9999);
  return sa - sb;
}

function Pill({ active, label, onPress, colors }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: active ? colors.primary : colors.border,
        backgroundColor: active ? colors.primary : colors.card,
      }}
    >
      <Text style={{ color: active ? "#fff" : colors.text, fontWeight: "800" }}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

export default function NhlStandingsScreen() {
  const { colors } = useTheme();

  const [busy, setBusy] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [rows, setRows] = useState([]);
  const [updatedAt, setUpdatedAt] = useState(null);

  // global | conference | division | wildcard
  const [mode, setMode] = useState("global");

  const headerTitle = i18n.t("nhl.standings.title", { defaultValue: "Classement NHL" });

  const hasLoggedStandingsViewRef = useRef(false);

  useEffect(() => {
    if (busy) return;
    if (hasLoggedStandingsViewRef.current) return;

    hasLoggedStandingsViewRef.current = true;

    Analytics.nhlStandingsView({
      mode,
      teamsCount: Array.isArray(rows) ? rows.length : 0,
    });
  }, [busy, mode, rows]);

  useEffect(() => {
    const ref = firestore().doc("nhl_standings/current");
    const unsub = ref.onSnapshot(
      (snap) => {
        const data = snap.data() || {};
        setRows(Array.isArray(data.standings) ? data.standings : []);
        setUpdatedAt(data.updatedAt?.toDate ? data.updatedAt.toDate() : null);
        setBusy(false);
      },
      (err) => {
        console.log("[NhlStandings] read error", err?.message || err);
        setBusy(false);
      }
    );
    return () => {
      try {
        unsub();
      } catch {}
    };
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const fn = functions().httpsCallable("updateNhlStandingsNow");
      await fn({});
    } catch (e) {
      console.log("[NhlStandings] refresh error", e?.message || e);
    } finally {
      setRefreshing(false);
    }
  }, []);

  // Global (liste flat)
  const globalList = useMemo(() => {
    const s = [...rows];
    s.sort(sortNhlTeams);
    return s;
  }, [rows]);

  const sections = useMemo(() => {
    const list = [...rows];

    if (mode === "global") {
      return [
        {
          key: "GLOBAL",
          title: i18n.t("nhl.standings.global", { defaultValue: "Ligue" }),
          data: globalList,
        },
      ];
    }

    if (mode === "conference") {
      const by = {};
      list.forEach((t) => {
        const c = pickStr(t?.conferenceName, "—");
        by[c] = by[c] || [];
        by[c].push(t);
      });

      return Object.keys(by)
        .sort()
        .map((c) => ({
          key: `CONF:${c}`,
          title: c,
          data: by[c].sort(sortNhlTeams),
        }));
    }

    if (mode === "division") {
      const by = {};
      list.forEach((t) => {
        const d = pickStr(t?.divisionName, "—");
        by[d] = by[d] || [];
        by[d].push(t);
      });

      return Object.keys(by)
        .sort()
        .map((d) => ({
          key: `DIV:${d}`,
          title: d,
          data: by[d].sort(sortNhlTeams),
        }));
    }

    // Wildcard / Meilleurs deuxièmes
    // ✅ Source de vérité: wildcardSequence
    // - 1 et 2 = meilleurs deuxièmes
    // - 0 = déjà qualifié séries
    // - 3+ = suivent au classement wildcard
    if (mode === "wildcard") {
      const byConf = {};
      list.forEach((t) => {
        const c = pickStr(t?.conferenceName, "—");
        byConf[c] = byConf[c] || [];
        byConf[c].push(t);
      });

      return Object.keys(byConf)
        .sort()
        .map((conf) => {
          const confTeams = [...byConf[conf]];

          const wild = confTeams
            .filter((t) => pickNumber(t?.wildcardSequence, 0) > 0)
            .sort(sortWildcardTeams);

          return {
            key: `WC:${conf}`,
            title: `${conf} • ${i18n.t("nhl.standings.wildcard", {
              defaultValue: "Meilleurs deuxièmes",
            })}`,
            data: wild,
          };
        });
    }

    return [];
  }, [rows, globalList, mode]);

  
    const flatData = useMemo(() => {
    const out = [];

    sections.forEach((s) => {
      out.push({ __type: "header", key: `H:${s.key}`, title: s.title });

      s.data.forEach((item, idx) => {
        out.push({ __type: "row", key: `R:${s.key}:${idx}`, item });

        const wildcardSeq = pickNumber(item?.wildcardSequence, 0);

        if (mode === "wildcard" && wildcardSeq === 2) {
          out.push({
            __type: "cutline",
            key: `CUT:${s.key}:${idx}`,
            title: i18n.t("nhl.standings.cutlineTitle", {
              defaultValue: "Ligne de qualification",
            }),
            note: i18n.t("nhl.standings.cutlineNote", {
              defaultValue: "Les équipes suivantes sont actuellement exclues des séries.",
            }),
          });
        }
      });
    });

    return out;
  }, [sections, mode]);

const renderItem = ({ item }) => {

    if (item.__type === "cutline") {
    return (
      <View style={{ marginTop: 4, marginBottom: 12 }}>
        <View
          style={{
            height: 2,
            backgroundColor: colors.primary,
            borderRadius: 999,
            opacity: 0.9,
          }}
        />

        <Text
          style={{
            color: colors.primary,
            fontWeight: "900",
            fontSize: 12,
            marginTop: 6,
          }}
        >
          {item.title}
        </Text>

        <Text
          style={{
            color: colors.subtext,
            fontSize: 12,
            marginTop: 2,
          }}
        >
          {item.note}
        </Text>
      </View>
    );
  }

  if (item.__type === "header") {
    return (
      <View style={{ marginTop: 14, marginBottom: 8 }}>
        <Text style={{ color: colors.text, fontWeight: "900", fontSize: 16 }}>
          {item.title}
        </Text>
      </View>
    );
  }

  const t = item.item;
  const abbr = t?.teamAbbrev?.default || t?.teamAbbrev || "";
  const pts = pickNumber(t?.points);
  const gp = pickNumber(t?.gamesPlayed);
  const w = pickNumber(t?.wins);
  const l = pickNumber(t?.losses);
  const ot = pickNumber(t?.otLosses);
  const pct = pointsPct(t);

  // ✅ Position selon le mode (on préfère divisionSequence si en divisions, sinon conferenceSequence, sinon leagueSequence)
  const pos =
    mode === "division"
      ? pickNumber(t?.divisionSequence, pickNumber(t?.divisionRank, pickNumber(t?.leagueSequence, 0)))
      : mode === "conference" || mode === "wildcard"
      ? pickNumber(t?.conferenceSequence, pickNumber(t?.conferenceRank, pickNumber(t?.leagueSequence, 0)))
      : pickNumber(t?.leagueSequence, 0);

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
      {/* ✅ Badge position */}
      <View
        style={{
          width: 46,
          height: 46,
          borderRadius: 14,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.background,
          borderWidth: 1,
          borderColor: colors.border,
        }}
      >
        <Text style={{ color: colors.text, fontWeight: "900", fontSize: 16 }}>
          #{pos || "—"}
        </Text>
      </View>

      {/* Logo */}
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 12,
          backgroundColor: colors.background,
          borderWidth: 1,
          borderColor: colors.border,
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
        }}
      >
        {teamLogo(abbr) ? (
          <Image source={teamLogo(abbr)} style={{ width: 34, height: 34 }} resizeMode="contain" />
        ) : (
          <Text style={{ color: colors.subtext, fontWeight: "900" }}>{abbr || "—"}</Text>
        )}
      </View>

      {/* Texte */}
      <View style={{ flex: 1 }}>
        {/* GP sur sa propre ligne */}
        <Text style={{ color: colors.subtext, marginTop: 2 }}>
          {i18n.t("nhl.standings.gp", {
            defaultValue: "GP: {{gp}}",
            gp,
          })}
        </Text>

        {/* W-L-OT sur une autre ligne */}
        <Text style={{ color: colors.subtext }}>
          {i18n.t("nhl.standings.record", {
            defaultValue: "W-L-OT: {{w}}-{{l}}-{{ot}}",
            w,
            l,
            ot,
          })}
        </Text>
      </View>

      {/* ✅ Badge points (très visible) */}
      <View style={{ alignItems: "flex-end" }}>
        <View
          style={{
            paddingVertical: 6,
            paddingHorizontal: 10,
            borderRadius: 999,
            backgroundColor: colors.primary,
          }}
        >
          <Text style={{ color: "#fff", fontWeight: "900" }}>{pts} PTS</Text>
        </View>
      </View>
    </View>
  );
};

  return (
    <>
      <Stack.Screen options={{ title: headerTitle }} />

      <View style={{ flex: 1, backgroundColor: colors.background }}>
        {busy ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <ActivityIndicator color={colors.primary} />
            <Text style={{ marginTop: 8, color: colors.subtext }}>
              {i18n.t("nhl.standings.loading", { defaultValue: "Chargement du classement…" })}
            </Text>
          </View>
        ) : (
          <FlatList
            data={flatData}
            keyExtractor={(x) => x.key}
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
                {/* UpdatedAt */}
                <Text style={{ color: colors.subtext, fontSize: 12 }}>
                  {updatedAt
                    ? i18n.t("nhl.standings.updatedAt", {
                        defaultValue: "Mis à jour: {{t}}",
                        t: updatedAt.toLocaleString(),
                      })
                    : ""}
                </Text>

                {/* Toggles */}
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
                  <Pill
                    colors={colors}
                    active={mode === "global"}
                    label={i18n.t("nhl.standings.tab.global", { defaultValue: "Global" })}
                    onPress={() => setMode("global")}
                  />
                  <Pill
                    colors={colors}
                    active={mode === "conference"}
                    label={i18n.t("nhl.standings.tab.conference", { defaultValue: "Conférences" })}
                    onPress={() => setMode("conference")}
                  />
                  <Pill
                    colors={colors}
                    active={mode === "division"}
                    label={i18n.t("nhl.standings.tab.division", { defaultValue: "Divisions" })}
                    onPress={() => setMode("division")}
                  />
                  <Pill
                    colors={colors}
                    active={mode === "wildcard"}
                    label={i18n.t("nhl.standings.tab.wildcard", { defaultValue: "Meilleurs deuxièmes" })}
                    onPress={() => setMode("wildcard")}
                  />
                </View>
              </View>
            )}
            ListEmptyComponent={() => (
              <View style={{ marginTop: 40, alignItems: "center" }}>
                <Text style={{ color: colors.subtext }}>
                  {i18n.t("nhl.standings.empty", { defaultValue: "Aucune donnée." })}
                </Text>
              </View>
            )}
            renderItem={renderItem}
          />
        )}
      </View>
    </>
  );
}