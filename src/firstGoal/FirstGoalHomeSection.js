// src/firstGoal/FirstGoalHomeSection.js
import React, { useEffect, useMemo, useState, useCallback } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import firestore from "@react-native-firebase/firestore";
import { useRouter } from "expo-router";
import i18n from "@src/i18n/i18n";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { TeamLogo } from "@src/nhl/nhlAssets";

/* --------------------------------- Helpers -------------------------------- */

function chunk(arr, size = 10) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function todayYmdLocal() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function toDateAny(ts) {
  if (!ts) return null;
  try {
    if (typeof ts?.toDate === "function") return ts.toDate();
    if (ts instanceof Date) return ts;
    const d = new Date(ts);
    if (!d || Number.isNaN(d.getTime())) return null;
    return d;
  } catch {
    return null;
  }
}

function fmtTimeShort(ts) {
  const d = toDateAny(ts);
  if (!d) return null;
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

// ✅ Deadline robuste:
// - si ch.signupDeadline (ou variantes) existe -> utilise ça
// - sinon -> gameStartTimeUTC - 5 min
function getSignupDeadline(ch) {
  const explicit =
    ch?.signupDeadline ??
    ch?.signupDeadlineUTC ??
    ch?.signupDeadlineAt ??
    ch?.signupDeadlineAtUTC ??
    ch?.lockAtUTC ??
    ch?.lockAt;

  const d1 = toDateAny(explicit);
  if (d1) return d1;

  const start = toDateAny(ch?.gameStartTimeUTC);
  if (!start) return null;

  return new Date(start.getTime() - 5 * 60 * 1000);
}

function safeAbbr(v) {
  return String(v || "").trim().toUpperCase();
}

/* ------------------------------ UI subcomponents --------------------------- */

function InfoBubbleFGC({ colors }) {
  const [open, setOpen] = useState(false);

  return (
    <View
      style={{
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.card2,
        marginBottom: 10,
        overflow: "hidden",
      }}
    >
      <TouchableOpacity
        onPress={() => setOpen((v) => !v)}
        activeOpacity={0.85}
        style={{
          paddingHorizontal: 12,
          paddingVertical: 10,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
          <MaterialCommunityIcons
            name="information-outline"
            size={18}
            color={colors.subtext}
            style={{ marginTop: 1 }}
          />
          <Text style={{ color: colors.text, fontWeight: "900", marginLeft: 8, flex: 1 }}>
            {i18n.t("firstGoal.home.infoTitle", { defaultValue: "C’est quoi ce défi?" })}
          </Text>
        </View>

        <MaterialCommunityIcons
          name={open ? "chevron-up" : "chevron-down"}
          size={22}
          color={colors.subtext}
        />
      </TouchableOpacity>

      {open ? (
        <View
          style={{
            paddingHorizontal: 12,
            paddingBottom: 12,
            borderTopWidth: 1,
            borderTopColor: colors.border,
          }}
        >
          <Text style={{ color: colors.subtext, marginTop: 10, lineHeight: 18 }}>
            {i18n.t("firstGoal.home.infoBody", {
              defaultValue:
                "Choisis le joueur qui marquera le premier but du match. Regarde les résultats dans l'onglet Sports/MatchLive. Un point sera alloué à celui qui a prédit le premier compteur. Si personne n'a fait la bonne prédiction, le point sera reporté et la cagnotte augmentera.",
            })}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function MatchupRow({ awayAbbr, homeAbbr, colors }) {
  const away = safeAbbr(awayAbbr);
  const home = safeAbbr(homeAbbr);

  return (
    <View style={{ flexDirection: "row", alignItems: "center" }}>
      <TeamLogo abbr={away} size={22} />
      <Text style={{ color: colors.text, fontWeight: "900", marginLeft: 8 }}>
        {away || "—"}
      </Text>

      <Text style={{ color: colors.subtext, marginHorizontal: 10, fontWeight: "900" }}>
        @
      </Text>

      <Text style={{ color: colors.text, fontWeight: "900", marginRight: 8 }}>
        {home || "—"}
      </Text>
      <TeamLogo abbr={home} size={22} />
    </View>
  );
}

/* -------------------------------- Component -------------------------------- */

export default function FirstGoalHomeSection({
  groups = [],
  colors,
  currentGroupId = null,
  onHasChallengeChange,
}) {
  const router = useRouter();

  const groupIds = useMemo(() => {
    return (groups || []).map((g) => String(g?.id || "")).filter(Boolean);
  }, [groups]);

  const groupNameById = useMemo(() => {
    const map = {};
    (groups || []).forEach((g) => {
      const id = String(g?.id || "");
      if (!id) return;
      map[id] = g?.name || g?.title || id;
    });
    return map;
  }, [groups]);

  // ✅ Fix 2: pré-calcul du boni par groupe (évite .find dans la loop)
  const groupBoniById = useMemo(() => {
    const map = {};
    (groups || []).forEach((g) => {
      const id = String(g?.id || "");
      if (!id) return;
      map[id] = Math.max(1, Number(g?.fgcBonus ?? 1));
    });
    return map;
  }, [groups]);

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  const mergeAndSet = useCallback((mapById) => {
    const list = Array.from(mapById.values());

    const weight = (st) =>
      st === "open" ? 0 : st === "locked" ? 1 : st === "pending" ? 2 : st === "decided" ? 3 : 4;

    list.sort((a, b) => {
      const wa = weight(String(a.status || "").toLowerCase());
      const wb = weight(String(b.status || "").toLowerCase());
      if (wa !== wb) return wa - wb;

      const ta = a.gameStartTimeUTC?.toDate?.() ? a.gameStartTimeUTC.toDate().getTime() : 0;
      const tb = b.gameStartTimeUTC?.toDate?.() ? b.gameStartTimeUTC.toDate().getTime() : 0;
      return ta - tb;
    });

    setItems(list);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (typeof onHasChallengeChange !== "function") return;
    onHasChallengeChange(items.length > 0);
  }, [items.length, onHasChallengeChange]);

  useEffect(() => {
    const gid = String(currentGroupId || "").trim();
    const targetGroupIds = gid ? [gid] : groupIds;

    if (!targetGroupIds.length) {
      setItems([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const ymd = todayYmdLocal();

    const unsubs = [];
    const mapById = new Map();
    const chunkDocIds = new Map();

    const makeQuery = (ids) => {
      const base = firestore()
        .collection("first_goal_challenges")
        .where("league", "==", "NHL")
        .where("type", "==", "first_goal")
        .where("gameYmd", "==", ymd);

      if (ids.length === 1) return base.where("groupId", "==", String(ids[0]));
      return base.where("groupId", "in", ids);
    };

    const idsChunks = gid ? [targetGroupIds] : chunk(targetGroupIds, 10);

    idsChunks.forEach((ids) => {
      const chunkKey = ids.join(",");
      const q = makeQuery(ids);

      const unsub = q.onSnapshot(
        (snap) => {
          const nextIds = new Set(snap.docs.map((d) => d.id));
          const prevIds = chunkDocIds.get(chunkKey) || new Set();

          prevIds.forEach((docId) => {
            if (!nextIds.has(docId)) mapById.delete(docId);
          });

          snap.docs.forEach((d) => {
            mapById.set(d.id, { id: d.id, ...d.data() });
          });

          chunkDocIds.set(chunkKey, nextIds);
          mergeAndSet(mapById);
        },
        (err) => {
          console.log(
            "[FirstGoalHomeSection] error",
            String(err?.code || ""),
            err?.message || String(err)
          );
          setLoading(false);
        }
      );

      unsubs.push(unsub);
    });

    // ✅ FIX: fermeture correcte du forEach
    return () => {
      unsubs.forEach((u) => {
        try {
          u();
        } catch {}
      });
    };
  }, [groupIds.join("|"), currentGroupId, mergeAndSet]);

  return (
    <View style={{ marginBottom: 14 }}>
      {loading ? (
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
          <ActivityIndicator size="small" color={colors.subtext} />
        </View>
      ) : null}

      <InfoBubbleFGC colors={colors} />

      {items.length === 0 ? (
        <Text style={{ color: colors.subtext, fontSize: 13 }}>
          {i18n.t("firstGoal.home.empty", {
            defaultValue: "Aucun défi 'premier but' aujourd’hui dans tes groupes.",
          })}
        </Text>
      ) : (
        <View style={{ gap: 10 }}>
          {items.slice(0, 6).map((ch) => {
            const awayAbbr = safeAbbr(ch?.awayAbbr);
            const homeAbbr = safeAbbr(ch?.homeAbbr);

            const participants =
              Number(ch.participantsCount ?? 0) ||
              (Array.isArray(ch.participantUids) ? ch.participantUids.length : 0);

            const groupId = String(ch?.groupId || "");
            const groupName = groupNameById[groupId] || null;

            const boni = groupBoniById[groupId] ?? 1;

            const deadline = getSignupDeadline(ch);
            const deadlineHM = fmtTimeShort(deadline);
            const deadlinePassed = deadline ? Date.now() >= deadline.getTime() : false;

            const st = String(ch.status || "").toLowerCase();

            const result =
              st === "decided" || st === "closed"
                ? ch.firstGoal?.playerName
                  ? `Premier but: ${ch.firstGoal.playerName} (${ch.firstGoal.teamAbbr || ""})`
                  : i18n.t("firstGoal.home.noWinner", { defaultValue: "Aucun gagnant" })
                : null;

            const ctaLabel = deadlinePassed
              ? i18n.t("firstGoal.cta.matchLive", { defaultValue: "Match Live" })
              : i18n.t("firstGoal.cta.pickScorer", { defaultValue: "Choisir mon joueur" });

            const onPressCta = () => {
              const id = String(ch.id || "").trim();
              if (!id) return;

              if (deadlinePassed) router.push(`/(first-goal)/pick/${id}?mode=live`);
              else router.push(`/(first-goal)/pick/${id}`);
            };

            return (
              <View
                key={String(ch.id)}
                style={{
                  padding: 12,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.card,
                }}
              >
                <MatchupRow awayAbbr={awayAbbr} homeAbbr={homeAbbr} colors={colors} />

                <View style={{ flexDirection: "row", alignItems: "center", marginTop: 10 }}>
                  <Text style={{ color: "#f97316", fontWeight: "900", fontSize: 14 }}>
                    🔥 {i18n.t("firstGoal.home.boni", { defaultValue: "Boni" })}: +{boni}
                  </Text>
                </View>

                <Text style={{ color: colors.subtext, marginTop: 8, fontSize: 13 }}>
                  {i18n.t("firstGoal.home.signupDeadline", {
                    defaultValue: "Heure limite d'inscription",
                  })}
                  {": "}
                  <Text style={{ color: colors.text, fontWeight: "900" }}>{deadlineHM || "—"}</Text>
                </Text>

                <View style={{ flexDirection: "row", alignItems: "center", marginTop: 8 }}>
                  <MaterialCommunityIcons name="account-group" size={16} color={colors.subtext} />
                  <Text style={{ color: colors.subtext, marginLeft: 6, fontSize: 13 }}>
                    {participants}{" "}
                    {i18n.t("common.participants", { defaultValue: "participant(s)" })}
                  </Text>
                </View>

                {result ? (
                  <Text style={{ color: colors.subtext, marginTop: 8, fontSize: 13 }}>
                    {result}
                  </Text>
                ) : null}

                <TouchableOpacity
                  onPress={onPressCta}
                  activeOpacity={0.9}
                  style={{
                    marginTop: 12,
                    paddingVertical: 10,
                    borderRadius: 12,
                    alignItems: "center",
                    backgroundColor: "#b91c1c",
                  }}
                >
                  <Text style={{ color: "#fff", fontWeight: "900" }}>{ctaLabel}</Text>
                </TouchableOpacity>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}