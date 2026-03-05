// app/(first-goal)/pick/[challengeId].js
import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Image,
  FlatList,
} from "react-native";
import { useLocalSearchParams, Stack, useRouter } from "expo-router";
import firestore from "@react-native-firebase/firestore";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@src/auth/SafeAuthProvider";
import { useTheme } from "@src/theme/ThemeProvider";
import i18n from "@src/i18n/i18n";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { TeamLogo } from "@src/nhl/nhlAssets";
import functions from "@react-native-firebase/functions";

/* ---------------- helpers ---------------- */

// Accepte: Firestore Timestamp (RNFirebase), Date, string ISO, number(ms)
function toDateSafe(v) {
  if (!v) return null;
  if (v?.toDate && typeof v.toDate === "function") return v.toDate(); // Timestamp
  if (v instanceof Date) return v;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function safeAbbr(v) {
  return String(v || "").trim().toUpperCase();
}

function strOrNull(v) {
  const s = String(v ?? "").trim();
  return s ? s : null;
}

function initials(name) {
  const s = String(name || "").trim();
  if (!s) return "?";
  const parts = s.split(/\s+/).filter(Boolean);
  const a = parts[0]?.[0] || "";
  const b = parts.length > 1 ? parts[parts.length - 1]?.[0] : "";
  return (a + b).toUpperCase();
}

function fmtHmLocal(date) {
  if (!date) return null;
  const d = date instanceof Date ? date : toDateSafe(date);
  if (!d) return null;
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

function byFullName(a, b) {
  return String(a?.fullName || "").localeCompare(String(b?.fullName || ""));
}

/* ---------------- small UI ---------------- */

function TeamTogglePill({ abbr, selected, onPress, colors }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: selected ? colors.primary : colors.border,
        backgroundColor: selected ? colors.card : colors.background,
      }}
    >
      <TeamLogo abbr={abbr} size={20} />
      {/* ✅ PAS de Text abbr ici si tu veux éviter le doublon */}
    </TouchableOpacity>
  );
}

function TopBar({ title, subtitle, onBack, onClose, colors }) {
  return (
    <View
      style={{
        paddingTop: 6,
        paddingBottom: 10,
        paddingHorizontal: 12,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        backgroundColor: colors.background,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <TouchableOpacity
          onPress={onBack}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: colors.card,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <Ionicons name="chevron-back" size={20} color={colors.text} />
        </TouchableOpacity>

        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={{ color: colors.text, fontWeight: "900", fontSize: 16 }} numberOfLines={1}>
            {title}
          </Text>
          {!!subtitle ? (
            <Text style={{ color: colors.subtext, fontSize: 12, marginTop: 2 }} numberOfLines={2}>
              {subtitle}
            </Text>
          ) : null}
        </View>

        <TouchableOpacity
          onPress={onClose}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: colors.card,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <Ionicons name="close" size={20} color={colors.text} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

function TeamBadge({ abbr, colors }) {
  return (
    <View
      style={{
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: colors.card,
        borderWidth: 1,
        borderColor: colors.border,
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
      }}
    >
      <TeamLogo abbr={abbr} size={32} />
    </View>
  );
}

const TeamToggle = React.memo(function TeamToggle({ away, home, value, onChange, colors }) {
  return (
    <View
      style={{
        flexDirection: "row",
        gap: 6,
        paddingHorizontal: 12,
        paddingTop: 12,
        paddingBottom: 10,
        backgroundColor: colors.background,
      }}
    >
      {[away, home].filter(Boolean).map((t) => {
        const selected = value === t;

        return (
          <TouchableOpacity
            key={t}
            onPress={() => onChange(t)}
            activeOpacity={0.9}
            style={{
              flex: 1,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              paddingVertical: 10,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: selected ? colors.primary : colors.border,
              backgroundColor: selected ? colors.card : colors.card2,
            }}
          >
            <TeamBadge abbr={t} colors={colors} />
          </TouchableOpacity>
        );
      })}
    </View>
  );
});

const PlayerRow = React.memo(function PlayerRow({
  item,
  disabled,
  locked,
  onPick,
  colors,
  selectedPlayerId,
}) {
  const uri = item.headshotUrl || item.headshot || null;
  const name = item.fullName || item.name || item.id;

  const injuryStatus = String(item?.injury?.status || "").toLowerCase();
  const injurySource = String(item?.injury?.source || "").toLowerCase();
  const isOut = injuryStatus === "out" && injurySource === "espn";
  const isPicked = !!(selectedPlayerId && String(selectedPlayerId) === String(item?.id));

  return (
    <TouchableOpacity
      onPress={() => onPick(item)}
      disabled={disabled}
      activeOpacity={0.85}
      style={{
        padding: 12,
        borderRadius: 14,
        borderWidth: 2,
        borderColor: isPicked ? colors.primary : colors.border,
        backgroundColor: isPicked ? colors.card2 : colors.card,
        opacity: disabled ? 0.55 : 1,
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
      }}
    >
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: 22,
          overflow: "hidden",
          backgroundColor: colors.card2,
          borderWidth: 1,
          borderColor: colors.border,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {uri ? (
          <Image source={{ uri }} style={{ width: 44, height: 44 }} resizeMode="cover" />
        ) : (
          <Text style={{ color: colors.text, fontWeight: "900" }}>{initials(name)}</Text>
        )}
      </View>

      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Text style={{ fontWeight: "900", color: colors.text, flex: 1 }} numberOfLines={1}>
            {name}
          </Text>

          {isOut ? (
            <Ionicons name="medkit" size={14} color={colors.danger || "#E53935"} />
          ) : null}

          {isPicked ? <Ionicons name="checkmark-circle" size={18} color={colors.primary} /> : null}
        </View>

        {isPicked ? (
          <Text
            style={{
              color: colors.danger || "#E53935",
              fontSize: 12,
              marginTop: 2,
              fontWeight: "800",
            }}
          >
            Ma sélection
          </Text>
        ) : (
          <View style={{ height: 16, marginTop: 2 }} />
        )}
      </View>

      {locked ? null : isPicked ? null : (
        <Ionicons name="chevron-forward" size={18} color={colors.subtext} />
      )}
    </TouchableOpacity>
  );
});

async function buildIdentityForEntry(user) {
  const uid = String(user?.uid || "");
  if (!uid) return { displayName: "Invité", avatarUrl: null };

  try {
    const snap = await firestore().doc(`participants/${uid}`).get();
    const p = snap.exists ? snap.data() || {} : {};

    const displayName =
      (typeof p.displayName === "string" && p.displayName.trim()) ||
      (typeof p.name === "string" && p.name.trim()) ||
      (p.email ? String(p.email).split("@")[0] : "") ||
      (typeof user?.displayName === "string" && user.displayName.trim()) ||
      "Invité";

    const avatarUrl =
      p.avatarUrl ||
      p.photoURL ||
      p.photoUrl ||
      user?.photoURL ||
      user?.photoUrl ||
      null;

    return { displayName, avatarUrl };
  } catch {
    return {
      displayName:
        (typeof user?.displayName === "string" && user.displayName.trim()) || "Invité",
      avatarUrl: user?.photoURL || user?.photoUrl || null,
    };
  }
}

/* ---------------- component ---------------- */

export default function FirstGoalPickScreen() {
  const { challengeId } = useLocalSearchParams();
  const { user } = useAuth();
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [challenge, setChallenge] = useState(null);
  const [players, setPlayers] = useState([]);
  const [entry, setEntry] = useState(null);

  const [loadingChallenge, setLoadingChallenge] = useState(true);
  const [loadingPlayers, setLoadingPlayers] = useState(true);
  const [saving, setSaving] = useState(false);

  const cid = String(challengeId || "");
  const [selectedTeam, setSelectedTeam] = useState(""); // toggle

  /* ---------------- load challenge ---------------- */

  useEffect(() => {
    // reset quand on change de défi
    setChallenge(null);
    setPlayers([]);
    setEntry(null);
    setSelectedTeam("");
  }, [cid]);

  useEffect(() => {
    if (!cid) return;

    setLoadingChallenge(true);

    const unsub = firestore()
      .collection("first_goal_challenges")
      .doc(cid)
      .onSnapshot(
        (snap) => {
          setChallenge(snap?.exists ? { id: snap.id, ...snap.data() } : null);
          setLoadingChallenge(false);
        },
        (err) => {
          console.warn("[FirstGoalPick] challenge snapshot error", err?.code, err?.message);
          setChallenge(null);
          setLoadingChallenge(false);
        }
      );

    return () => {
      try {
        unsub && unsub();
      } catch {}
    };
  }, [cid]);

  /* ---------------- load entry ---------------- */

  useEffect(() => {
    if (!cid || !user?.uid) return;

    const entryRef = firestore()
      .collection("first_goal_challenges")
      .doc(cid)
      .collection("entries")
      .doc(String(user.uid));

    const unsub = entryRef.onSnapshot(
      (snap) => {
        setEntry(snap?.exists ? { id: snap.id, ...snap.data() } : null);
      },
      (err) => {
        console.warn("[FirstGoalPick] entry snapshot error", err?.code, err?.message);
        // important: si permission denied, on évite de “bloquer” le pick
        setEntry(null);
      }
    );

    return () => {
      try {
        unsub && unsub();
      } catch {}
    };
  }, [cid, user?.uid]);

  /* ---------------- load players ---------------- */

  useEffect(() => {
    const home = safeAbbr(challenge?.homeAbbr);
    const away = safeAbbr(challenge?.awayAbbr);
    if (!home || !away) return;

    setLoadingPlayers(true);

    firestore()
      .collection("nhl_players")
      .where("teamAbbr", "in", [home, away])
      .where("active", "==", true)
      .get()
      .then((snap) => {
        const rows = (snap?.docs ?? []).map((d) => ({ id: d.id, ...d.data() }));
        rows.sort(byFullName);
        setPlayers(rows);
      })
      .catch((e) => {
        console.log("[FirstGoalPick] players error", e?.code, e?.message || e);
      })
      .finally(() => setLoadingPlayers(false));
  }, [challenge?.homeAbbr, challenge?.awayAbbr]);

  /* ---------------- derived ---------------- */

  const derived = useMemo(() => {
    const st = String(challenge?.status || "").toLowerCase();
    const statusBlocksPick = ["decided", "closed"].includes(st) || st === "pending";

    const startDate = toDateSafe(challenge?.gameStartTimeUTC);
    const startMs = startDate ? startDate.getTime() : null;

    // ✅ Cutoff: 5 minutes before puck drop
    const cutoffMs = startMs != null ? startMs - 5 * 60 * 1000 : null;
    const nowMs = Date.now();

    const started = startMs != null ? nowMs >= startMs : false;
    const pastCutoff = cutoffMs != null ? nowMs >= cutoffMs : false;

    const hasPicked = !!(entry?.playerId && String(entry.playerId).trim().length > 0);

    const locked = statusBlocksPick || pastCutoff || started;

    const canEditPick = hasPicked && !locked;

    const cutoffDate = cutoffMs != null ? new Date(cutoffMs) : null;
    const cutoffHm = fmtHmLocal(cutoffDate);

    const away = safeAbbr(challenge?.awayAbbr);
    const home = safeAbbr(challenge?.homeAbbr);

    const headerLine = away && home ? `${away} @ ${home}` : "—";
    const startHm = fmtHmLocal(startDate);

    const subtitle = hasPicked
      ? locked
        ? `🎯 ${i18n.t("firstGoal.pick.alreadyPicked", { defaultValue: "Ton choix est verrouillé" })}`
        : `✏️ ${i18n.t("firstGoal.pick.editUntil", { defaultValue: "Tu peux modifier ton choix jusqu’à" })} ${
            cutoffHm || ""
          }`
      : locked
      ? `⏱️ ${i18n.t("firstGoal.pick.locked", { defaultValue: "Le défi est verrouillé" })}`
      : i18n.t("firstGoal.pick.chooseOne", { defaultValue: "Choisis le joueur qui marquera le premier but" });

    return {
      status: st,
      started,
      locked,
      hasPicked,
      startDate,
      startHm,
      away,
      home,
      headerLine,
      subtitle,
      pastCutoff,
      cutoffDate,
      cutoffHm,
      canEditPick,
    };
  }, [challenge, entry]);

  // init toggle (une seule fois quand on a away/home)
  useEffect(() => {
    if (selectedTeam) return;
    if (derived.away) setSelectedTeam(derived.away);
    else if (derived.home) setSelectedTeam(derived.home);
  }, [selectedTeam, derived.away, derived.home]);

  const loading = loadingChallenge || loadingPlayers;

  const filteredPlayers = useMemo(() => {
    const t = safeAbbr(selectedTeam);
    const pickedId = entry?.playerId ? String(entry.playerId) : "";

    const base = t ? players.filter((p) => safeAbbr(p?.teamAbbr) === t) : [...players];

    base.sort((a, b) => {
      const aPicked = pickedId && String(a?.id) === pickedId;
      const bPicked = pickedId && String(b?.id) === pickedId;
      if (aPicked && !bPicked) return -1;
      if (!aPicked && bPicked) return 1;
      return byFullName(a, b);
    });

    return base;
  }, [players, selectedTeam, entry?.playerId]);

  /* ---------------- actions ---------------- */

  const goBackOrHome = useCallback(() => {
    if (router.canGoBack?.()) router.back();
    else router.replace("/(drawer)/(tabs)/AccueilScreen");
  }, [router]);

  function deepStripUndefined(value) {
  if (Array.isArray(value)) {
    return value
      .map(deepStripUndefined)
      .filter((v) => v !== undefined);
  }

  if (value && typeof value === "object") {
    // Firestore Timestamp / FieldValue / Date: on retourne tel quel
    if (typeof value.toDate === "function") return value;
    if (value instanceof Date) return value;

    const out = {};
    Object.keys(value).forEach((k) => {
      const v = deepStripUndefined(value[k]);
      if (v !== undefined) out[k] = v;
    });
    return out;
  }

  return value === undefined ? undefined : value;
}

function strOrNull(v) {
  const s = String(v ?? "").trim();
  return s ? s : null;
}

  const pickPlayer = useCallback(
    async (p) => {
      if (!user?.uid) return;
      if (!cid) return;

      const playerIdRaw = p?.playerId ?? p?.id ?? p?.nhlId ?? p?.playerID;
      const playerId = String(playerIdRaw ?? "").trim();
      const playerName = String(p?.fullName ?? p?.name ?? "").trim() || null;
      const teamAbbr = p?.teamAbbr ? safeAbbr(p.teamAbbr) : null;
      const positionCode = String(p?.positionCode ?? "").trim() || null;
      const headshotUrl = String(p?.headshotUrl ?? p?.headshot ?? "").trim() || null;

      if (!playerId) {
        Alert.alert(i18n.t("common.error", { defaultValue: "Erreur" }), "playerId invalide.");
        return;
      }

      const identity = await buildIdentityForEntry(user);

      try {
        setSaving(true);

        const call = functions().httpsCallable("fgcPick");

        const res = await call({
          challengeId: cid,
          playerId,
          playerName,
          teamAbbr,
          positionCode,
          headshotUrl,
          displayName: identity.displayName,
          avatarUrl: identity.avatarUrl,
        });

        const isFirst = !!res?.data?.isFirstParticipation;

        Alert.alert(
          i18n.t("firstGoal.pick.successTitle", { defaultValue: "Choix enregistré" }),
          isFirst
            ? i18n.t("firstGoal.pick.successBody", { defaultValue: "Ton choix est enregistré. Bonne chance 🍀" })
            : i18n.t("firstGoal.pick.updatedBody", { defaultValue: "Ton choix a été mis à jour." })
        );
      } catch (e) {
        // RNFirebase callable errors: e.code / e.message
        console.log("[fgcPick] ERROR", e?.code, e?.message || e);

        // messages serveur (HttpsError) remontent souvent en e.message
        Alert.alert(
          i18n.t("common.error", { defaultValue: "Erreur" }),
          String(e?.message || e)
        );
      } finally {
        setSaving(false);
      }
    },
    [cid, user?.uid] // ✅ dépendances minimales
  );

  // ✅ callbacks (TOUJOURS déclarés, avant tout return conditionnel)
  const renderItem = useCallback(
    ({ item }) => (
      <PlayerRow
        item={item}
        disabled={derived.locked || saving}
        locked={derived.locked}
        onPick={pickPlayer}
        colors={colors}
        selectedPlayerId={entry?.playerId}
      />
    ),
    [derived.locked, saving, pickPlayer, colors, entry?.playerId]
  );

  const ItemSeparator = useCallback(() => <View style={{ height: 10 }} />, []);

  const ListHeader = useMemo(() => {
    return (
      <View
        style={{
          paddingHorizontal: 12,
          paddingTop: 10,
          paddingBottom: 8,
          backgroundColor: colors.background,
        }}
      >
        <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
          <View
            style={{
              paddingVertical: 4,
              paddingHorizontal: 10,
              borderRadius: 999,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.card,
            }}
          >
            <Text style={{ color: colors.subtext, fontWeight: "800", fontSize: 12 }}>
              {i18n.t("firstGoal.pick.participants", { defaultValue: "Participants" })}:{" "}
              {Number(challenge?.participantsCount || 0)}
            </Text>
          </View>

          {derived.startHm ? (
            <Text style={{ color: colors.subtext, fontSize: 12, fontWeight: "700" }}>
              {i18n.t("firstGoal.pick.startsAt", { defaultValue: "Début" })}: {derived.startHm}
            </Text>
          ) : null}
        </View>

        <TeamToggle
          away={derived.away}
          home={derived.home}
          value={selectedTeam}
          onChange={setSelectedTeam}
          colors={colors}
        />
      </View>
    );
  }, [colors, derived.away, derived.home, derived.startHm, selectedTeam, challenge?.participantsCount]);

  /* ---------------- render ---------------- */

  if (loading || !challenge) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
          <TopBar
            title={i18n.t("firstGoal.pick.title", { defaultValue: "First goal" })}
            subtitle={i18n.t("common.loading", { defaultValue: "Chargement…" })}
            colors={colors}
            onBack={goBackOrHome}
            onClose={goBackOrHome}
          />
          <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
            <ActivityIndicator color={colors.primary} />
          </View>
        </SafeAreaView>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />

      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <TopBar
          title={derived.headerLine}
          subtitle={derived.subtitle}
          colors={colors}
          onBack={goBackOrHome}
          onClose={goBackOrHome}
        />

        <FlatList
          data={filteredPlayers}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          ItemSeparatorComponent={ItemSeparator}
          ListHeaderComponent={ListHeader}
          contentContainerStyle={{
            paddingHorizontal: 12,
            paddingBottom: 12 + insets.bottom,
          }}
          initialNumToRender={20}
          maxToRenderPerBatch={20}
          windowSize={10}
          removeClippedSubviews
          ListEmptyComponent={
            <View style={{ paddingHorizontal: 12, paddingTop: 10 }}>
              <Text style={{ color: colors.subtext }}>
                {i18n.t("firstGoal.pick.noResults", { defaultValue: "Aucun joueur trouvé." })}
              </Text>
            </View>
          }
        />
      </SafeAreaView>
    </>
  );
}