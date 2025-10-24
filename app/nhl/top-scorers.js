// app/nhl/top-scorers.js
import React, { useEffect, useMemo, useState } from "react";
import { View, Text, FlatList, ActivityIndicator, RefreshControl, Image, TouchableOpacity } from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";

/* ------------------ Helpers ------------------ */
function currentSeasonCode(d = new Date()) {
  const y = d.getFullYear();
  const m = d.getMonth(); // 0..11
  const start = m >= 6 ? y : y - 1; // saison commence à partir de juillet
  const end = start + 1;
  return `${start}${end}`; // ex: 20252026
}
function toYMD(d) {
  const x = d instanceof Date ? d : new Date(d);
  const y = x.getFullYear();
  const m = String(x.getMonth() + 1).padStart(2, "0");
  const da = String(x.getDate()).padStart(2, "0");
  return `${y}-${m}-${da}`;
}
function upper(v, fallback = "—") {
  if (typeof v === "string") return v.toUpperCase();
  if (v && typeof v === "object" && typeof v.default === "string") return v.default.toUpperCase();
  if (v == null) return fallback;
  try { return String(v).toUpperCase(); } catch { return fallback; }
}
// URL mugs NHL (headshots)
function headshotUrl(seasonCode, teamAbbr, playerId) {
  if (!seasonCode || !teamAbbr || !playerId) return null;
  return `https://assets.nhle.com/mugs/nhl/${seasonCode}/${upper(teamAbbr)}/${playerId}.png`;
}

/* ------------------ Screen ------------------ */
export default function TopScorers() {
  const router = useRouter();
  const { date } = useLocalSearchParams(); // ex "2025-10-03"

  const [leaders, setLeaders] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [teamsPlaying, setTeamsPlaying] = useState([]); // ["MTL","TOR",...]
  const [filterApplied, setFilterApplied] = useState(false);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const season = useMemo(() => currentSeasonCode(new Date()), []);
  const targetDate = useMemo(() => (date ? String(date) : null), [date]);

  /* ---------- Fetch schedule teams for given date (robuste) ---------- */
  async function fetchScheduleTeams(ymd) {
    if (!ymd) return [];
    const url = `https://api-web.nhle.com/v1/schedule/${encodeURIComponent(ymd)}`;
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(`Schedule HTTP ${res.status}`);
    const json = await res.json();

    let games = [];
    if (Array.isArray(json?.gameWeek)) {
      const day = json.gameWeek.find((d) => d?.date === ymd);
      games = day?.games || [];
    } else if (Array.isArray(json?.games)) {
      games = json.games;
    }

    const abbrs = new Set();
    for (const g of games) {
      const h = g?.homeTeam?.abbrev || g?.homeTeam?.abbreviation || g?.homeTeamAbbrev || g?.homeTeam?.triCode || g?.homeTeam;
      const a = g?.awayTeam?.abbrev || g?.awayTeam?.abbreviation || g?.awayTeamAbbrev || g?.awayTeam?.triCode || g?.awayTeam;
      if (h) abbrs.add(upper(h));
      if (a) abbrs.add(upper(a));
    }
    return Array.from(abbrs);
  }

  /* ---------- Fetch leaders Top 100 (points) ---------- */
  async function fetchLeadersTop100() {
    const url =
      `https://api.nhle.com/stats/rest/en/skater/summary` +
      `?cayenneExp=seasonId=20242025%20and%20gameTypeId=2` + // saison régulière
      `&sort=points&dir=DESC&start=0&limit=100`;
    console.log(url);
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(`Leaders HTTP ${res.status}`);
    const json = await res.json();
    const rows = Array.isArray(json?.data) ? json.data : [];

    const mapped = rows.map((r, idx) => {
      const teamRaw = r.teamAbbrevs;

      const team = upper(teamRaw);
      const playerId = r.playerId ?? r.skaterId ?? null;

      return {
        id: String(playerId ?? idx),
        name: String(r.skaterFullName ?? r.playerName ?? r.name ?? "—"),
        team,
        goals: Number.isFinite(Number(r.goals)) ? Number(r.goals) : Number(r.g ?? 0),
        assists: Number.isFinite(Number(r.assists)) ? Number(r.assists) : Number(r.a ?? 0),
        points: Number.isFinite(Number(r.points))
          ? Number(r.points)
          : Number(r.p ?? (Number(r.goals || 0) + Number(r.assists || 0))),
        headshot: headshotUrl(season, team, playerId), // 👈 construit depuis assets.nhle.com
      };
    });

    mapped.sort((a, b) => b.points - a.points || b.goals - a.goals);
    return mapped;
  }

  /* ---------- Load all ---------- */
  async function loadAll() {
    setLoading(true);
    setRefreshing(false);
    setError(null);
    try {
      const [teams, leaderRows] = await Promise.all([
        targetDate ? fetchScheduleTeams(targetDate) : Promise.resolve([]),
        fetchLeadersTop100(),
      ]);
      setTeamsPlaying(teams);
      setLeaders(leaderRows);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetDate, season]);

  /* ---------- Apply filter with safe fallback ---------- */
  useEffect(() => {
    if (!targetDate || teamsPlaying.length === 0) {
      setFiltered(leaders);
      setFilterApplied(false);
      return;
    }
    const playing = new Set(teamsPlaying.map((x) => upper(x)));
    const out = leaders.filter((p) => playing.has(upper(p.team)));

    if (out.length === 0) {
      // Fallback: éviter l'écran vide → montrer tous les joueurs et indiquer le fallback dans le chip
      setFiltered(leaders);
      setFilterApplied(false);
    } else {
      setFiltered(out);
      setFilterApplied(true);
    }
  }, [leaders, teamsPlaying, targetDate]);

  const onRefresh = () => {
    setRefreshing(true);
    loadAll();
  };

  const Item = ({ item, index }) => {
    const rank = index + 1;
    const img = item.headshot || null;
    return (
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingVertical: 10,
          paddingHorizontal: 12,
          borderBottomWidth: 1,
          borderColor: "#eee",
          backgroundColor: "#fff",
        }}
      >
        <Text style={{ width: 28, textAlign: "right", fontWeight: "800", marginRight: 8 }}>{rank}</Text>
        {img ? (
          <Image
            source={{ uri: img }}
            style={{ width: 36, height: 36, borderRadius: 18, marginRight: 10, backgroundColor: "#f3f4f6" }}
          />
        ) : (
          <View style={{ width: 36, height: 36, borderRadius: 18, marginRight: 10, backgroundColor: "#f3f4f6", alignItems: "center", justifyContent: "center" }}>
            <Text style={{ fontWeight: "800" }}>{item.name?.slice(0, 1) ?? "?"}</Text>
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={{ fontWeight: "700" }}>{item.name}</Text>
          <Text style={{ color: "#6b7280" }}>{item.team}</Text>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Text style={{ fontWeight: "800" }}>{item.points} pts</Text>
          <Text style={{ color: "#6b7280" }}>
            {item.goals} B • {item.assists} A
          </Text>
        </View>
      </View>
    );
  };

  const headerDate = targetDate || null;
  const chipText = headerDate
    ? (filterApplied
        ? `Filtré pour le ${headerDate} — ${teamsPlaying.length} équipe(s)`
        : `Aucune équipe correspondante le ${headerDate} — affichage complet`)
    : "Tous les joueurs (aucune date fournie)";

  if (loading) {
    return (
      <>
        <Stack.Screen options={{ title: "Top joueurs aujourd'hui" }} />
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator />
          <Text style={{ marginTop: 8 }}>Chargement des meilleurs marqueurs…</Text>
        </View>
      </>
    );
  }

  if (error) {
    return (
      <>
        <Stack.Screen options={{ title: "Top joueurs aujourd'hui" }} />
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 16 }}>
          <Text style={{ fontWeight: "700", marginBottom: 8 }}>Impossible de charger</Text>
          <Text style={{ color: "#6b7280", textAlign: "center" }}>{String(error?.message || error)}</Text>
          <TouchableOpacity
            onPress={onRefresh}
            style={{ marginTop: 12, backgroundColor: "#111827", paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10 }}
          >
            <Text style={{ color: "#fff", fontWeight: "700" }}>Réessayer</Text>
          </TouchableOpacity>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: "Top joueurs aujourd'hui" }} />
      <View style={{ flex: 1 }}>
        <View style={{ padding: 12, borderBottomWidth: 1, borderColor: "#eee", backgroundColor: "#fff" }}>
          <Text style={{ fontWeight: "800", fontSize: 18 }}>Meilleurs marqueurs — Top 100</Text>
          <Text style={{ color: "#6b7280", marginTop: 2 }}>
            Saison {season.slice(0, 4)}-{season.slice(4)} • Points (Buts + Passes)
          </Text>

          <View
            style={{
              alignSelf: "flex-start",
              marginTop: 8,
              paddingVertical: 6,
              paddingHorizontal: 10,
              borderRadius: 999,
              backgroundColor: "#eef2ff",
              borderWidth: 1,
              borderColor: "#c7d2fe",
            }}
          >
            <Text style={{ color: "#3730a3", fontWeight: "700" }}>{chipText}</Text>
          </View>
        </View>

        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={({ item, index }) => <Item item={item} index={index} />}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          contentContainerStyle={{ paddingBottom: 20 }}
          ListEmptyComponent={() => (
            <View style={{ padding: 20 }}>
              <Text style={{ textAlign: "center", color: "#6b7280" }}>
                Aucun joueur à afficher.
              </Text>
            </View>
          )}
        />
      </View>
    </>
  );
}