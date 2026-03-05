// src/firstGoal/CreateFirstGoalModal.js
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  Modal,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import firestore from "@react-native-firebase/firestore";
import { useAuth } from "@src/auth/SafeAuthProvider";
import { useTheme } from "@src/theme/ThemeProvider";
import i18n from "@src/i18n/i18n";
import functions from "@react-native-firebase/functions";

/* ---------------- UI bits ---------------- */

function StepPill({ active, done, label, colors }) {
  const bg = active ? colors.primary : done ? colors.card2 : colors.card;
  const border = active ? colors.primary : colors.border;
  const textColor = active ? "#fff" : colors.text;

  return (
    <View
      style={{
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: border,
        backgroundColor: bg,
      }}
    >
      <Text style={{ color: textColor, fontWeight: "900", fontSize: 12 }}>
        {label}
      </Text>
    </View>
  );
}

function WizardHeader({ step, colors, onClose }) {
  return (
    <View style={{ gap: 10 }}>
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <Text
          style={{
            fontSize: 18,
            fontWeight: "900",
            color: colors.text,
            flex: 1,
          }}
        >
          {i18n.t("firstGoal.create.title", {
            defaultValue: "First goal challenge",
          })}
        </Text>

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
          accessibilityRole="button"
          accessibilityLabel={i18n.t("common.close", { defaultValue: "Fermer" })}
        >
          <Ionicons name="close" size={20} color={colors.text} />
        </TouchableOpacity>
      </View>

      <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
        <StepPill
          active={step === 1}
          done={step > 1}
          colors={colors}
          label={i18n.t("firstGoal.create.step1", {
            defaultValue: "1. Groupe",
          })}
        />
        <StepPill
          active={step === 2}
          done={step > 2}
          colors={colors}
          label={i18n.t("firstGoal.create.step2", {
            defaultValue: "2. Match",
          })}
        />
        <StepPill
          active={step === 3}
          done={false}
          colors={colors}
          label={i18n.t("firstGoal.create.step3", {
            defaultValue: "3. Confirmer",
          })}
        />
      </View>
    </View>
  );
}

/* ---------------- helpers ---------------- */

function ymdLocalToday() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function safeAbbr(v) {
  return String(v || "").trim().toUpperCase();
}

function sortByName(a, b) {
  const an = String(a?.fullName || a?.name || "").toLowerCase();
  const bn = String(b?.fullName || b?.name || "").toLowerCase();
  return an.localeCompare(bn);
}

function fmtTime(ts) {
  if (!ts) return "—";
  const d = ts?.toDate?.()
    ? ts.toDate()
    : ts instanceof Date
    ? ts
    : new Date(ts);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

function fmtMatchLabel(g) {
  const away = String(g?.awayAbbr || "").toUpperCase();
  const home = String(g?.homeAbbr || "").toUpperCase();
  return away && home ? `${away} @ ${home}` : String(g?.id || "—");
}

/* ---------------- component ---------------- */

export default function CreateFirstGoalModal({
  visible,
  onClose,
  groups = [],
  initialGroupId = null,
  onCreated,
}) {
  const { user } = useAuth();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const [step, setStep] = useState(1);

  // group dropdown
  const [groupDropdownOpen, setGroupDropdownOpen] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState(initialGroupId);

  // games
  const [games, setGames] = useState([]);
  const [loadingGames, setLoadingGames] = useState(false);
  const [selectedGameId, setSelectedGameId] = useState(null);

  // players (Step 3)
  const [playersByTeam, setPlayersByTeam] = useState({ home: [], away: [] });
  const [loadingPlayers, setLoadingPlayers] = useState(false);
  const [playersError, setPlayersError] = useState(null);

  // create
  const [creating, setCreating] = useState(false);

  // ✅ owner groups come from group_memberships (source of truth)
  // groups prop is expected to contain actual /groups docs (id + fields)
  // we fetch memberships here and then filter groups by membership role.
  const [membershipsByGroupId, setMembershipsByGroupId] = useState({}); // { [groupId]: { role, status, ... } }
  const [loadingMemberships, setLoadingMemberships] = useState(false);
  const [membershipError, setMembershipError] = useState(null);

  useEffect(() => {
    if (!visible) return;
    if (!user?.uid) return;

    setLoadingMemberships(true);
    setMembershipError(null);

    // We can query by uid + status, then filter role in JS (safer than needing "in" index)
    const q = firestore()
      .collection("group_memberships")
      .where("uid", "==", String(user.uid))
      .where("status", "==", "active");

    const unsub = q.onSnapshot(
      (snap) => {
        const map = {};
        snap.docs.forEach((d) => {
          const data = d.data() || {};
          const gid = String(data.groupId || "");
          if (!gid) return;
          map[gid] = { id: d.id, ...data };
        });
        setMembershipsByGroupId(map);
        setLoadingMemberships(false);
      },
      (err) => {
        console.log("[CreateFirstGoal] group_memberships error", err?.message || err);
        setMembershipError(
          err?.code === "permission-denied"
            ? i18n.t("firstGoal.create.errors.groupsPermission", {
                defaultValue:
                  "Accès refusé à group_memberships. Vérifie les règles Firestore.",
              })
            : i18n.t("firstGoal.create.errors.groupsLoad", {
                defaultValue: "Impossible de charger tes groupes.",
              })
        );
        setMembershipsByGroupId({});
        setLoadingMemberships(false);
      }
    );

    return () => {
      try {
        unsub();
      } catch {}
    };
  }, [visible, user?.uid]);

  // ✅ Owner/admin groups based on membership role
  const ownedGroups = useMemo(() => {
    const byId = membershipsByGroupId || {};
    const list = (groups || []).filter((g) => {
      if (!g) return false;

      // group status guard (if your groups docs have it)
      const gst = String(g.status || "").toLowerCase();
      if (["archived", "deleted"].includes(gst)) return false;

      const gid = String(g.id || "");
      const m = byId[gid];
      if (!m) return false;

      const mStatus = String(m.status || "").toLowerCase();
      if (mStatus !== "active") return false;

      const role = String(m.role || "").toLowerCase();
      return role === "owner" || role === "admin";
    });

    // optional: sort by name
    list.sort((a, b) =>
      String(a?.name || a?.title || a?.id || "").localeCompare(
        String(b?.name || b?.title || b?.id || "")
      )
    );

    return list;
  }, [groups, membershipsByGroupId]);

  const selectedGroup = useMemo(
    () => ownedGroups.find((g) => String(g.id) === String(selectedGroupId)) || null,
    [ownedGroups, selectedGroupId]
  );

  const selectedGame = useMemo(
    () => games.find((g) => String(g.id) === String(selectedGameId)) || null,
    [games, selectedGameId]
  );

  // reset on open
  useEffect(() => {
    if (!visible) return;
    setStep(1);
    setGroupDropdownOpen(false);
    setSelectedGameId(null);
    setGames([]);
    setPlayersByTeam({ home: [], away: [] });
    setPlayersError(null);
  }, [visible]);

  // default group selection
  useEffect(() => {
    if (!visible) return;
    setSelectedGroupId((prev) => {
      if (prev && ownedGroups.some((g) => String(g.id) === String(prev))) return prev;
      if (initialGroupId && ownedGroups.some((g) => String(g.id) === String(initialGroupId))) {
        return initialGroupId;
      }
      return ownedGroups[0]?.id ?? null;
    });
  }, [visible, ownedGroups, initialGroupId]);

  // load games when step 2 visible
  useEffect(() => {
    if (!visible) return;
    if (step !== 2) return;

    setLoadingGames(true);

    const ref = firestore().collection("nhl_live_games");

    const unsub = ref.onSnapshot(
      (snap) => {
        const all = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

        const nowMs = Date.now();
        const today = ymdLocalToday();

        const todays = all.filter((g) => {
          const t = g.startTimeUTC;
          if (!t) return false;

          const dt = t?.toDate?.() ? t.toDate() : new Date(t);
          if (!dt || isNaN(dt.getTime())) return false;

          // keep only games that haven't started
          if (dt.getTime() <= nowMs) return false;

          const y = dt.getFullYear();
          const m = String(dt.getMonth() + 1).padStart(2, "0");
          const day = String(dt.getDate()).padStart(2, "0");
          return `${y}-${m}-${day}` === today;
        });

        todays.sort((a, b) => {
          const ta = a.startTimeUTC?.toDate?.()
            ? a.startTimeUTC.toDate().getTime()
            : new Date(a.startTimeUTC).getTime();
          const tb = b.startTimeUTC?.toDate?.()
            ? b.startTimeUTC.toDate().getTime()
            : new Date(b.startTimeUTC).getTime();
          return ta - tb;
        });

        setGames(todays);
        setLoadingGames(false);
      },
      (err) => {
        console.log("[CreateFirstGoal] nhl_live_games error", err?.message || err);
        setLoadingGames(false);
      }
    );

    return () => {
      try {
        unsub();
      } catch {}
    };
  }, [visible, step]);

  // load players when step 3 visible
  useEffect(() => {
    if (!visible) return;
    if (step !== 3) return;

    const home = safeAbbr(selectedGame?.homeAbbr);
    const away = safeAbbr(selectedGame?.awayAbbr);

    // reset
    setPlayersByTeam({ home: [], away: [] });
    setPlayersError(null);

    if (!home || !away) {
      setPlayersError(
        i18n.t("firstGoal.create.errors.teamsMissing", {
          defaultValue: "Impossible d’identifier les équipes de ce match.",
        })
      );
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        setLoadingPlayers(true);

        const snap = await firestore()
          .collection("nhl_players")
          .where("teamAbbr", "in", [home, away])
          .where("active", "==", true)
          .get();

        if (cancelled) return;

        const all = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

        const homePlayers = all
          .filter((p) => safeAbbr(p.teamAbbr) === home)
          .sort(sortByName);

        const awayPlayers = all
          .filter((p) => safeAbbr(p.teamAbbr) === away)
          .sort(sortByName);

        setPlayersByTeam({ home: homePlayers, away: awayPlayers });

        if (homePlayers.length === 0 || awayPlayers.length === 0) {
          setPlayersError(
            i18n.t("firstGoal.create.errors.rosterEmpty", {
              defaultValue:
                "Roster incomplet pour ce match (0 joueur trouvé pour une des équipes).",
            })
          );
        }
      } catch (e) {
        const msg =
          e?.code === "permission-denied"
            ? i18n.t("firstGoal.create.errors.playersPermission", {
                defaultValue:
                  "Accès refusé à nhl_players. Vérifie les règles Firestore.",
              })
            : i18n.t("firstGoal.create.errors.playersLoad", {
                defaultValue: "Impossible de charger les joueurs.",
              });

        setPlayersError(msg);
        console.log("[CreateFirstGoal] nhl_players error", e?.message || e);
      } finally {
        if (!cancelled) setLoadingPlayers(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [visible, step, selectedGameId]); // selectedGameId suffit

  const canGoNext1 = !!selectedGroupId && ownedGroups.length > 0 && !loadingMemberships;
  const canGoNext2 = !!selectedGameId;

  const rostersOk =
    playersByTeam.home.length > 0 && playersByTeam.away.length > 0 && !loadingPlayers;

  const canCreate = !!selectedGroupId && !!selectedGameId && rostersOk;

  const goNext = useCallback(() => setStep((s) => Math.min(3, s + 1)), []);
  const goBack = useCallback(() => setStep((s) => Math.max(1, s - 1)), []);

  const handleClose = useCallback(() => {
    setStep(1);
    onClose?.();
  }, [onClose]);

  async function handleCreate() {
    if (!user?.uid) return;
    if (!selectedGroupId || !selectedGameId) return;

    if (!selectedGame) {
      Alert.alert(
        i18n.t("common.error", { defaultValue: "Erreur" }),
        i18n.t("firstGoal.create.errors.gameMissing", {
          defaultValue: "Match introuvable. Réessaie.",
        })
      );
      return;
    }

    try {
      setCreating(true);

      const call = functions().httpsCallable("fgcCreate");

      const res = await call({
        groupId: String(selectedGroupId),
        gameId: String(selectedGameId),

        // on envoie le match tel que vu dans nhl_live_games
        gameStartTimeUTC: selectedGame?.startTimeUTC?.toDate?.()
          ? selectedGame.startTimeUTC.toDate().toISOString()
          : selectedGame?.startTimeUTC
          ? new Date(selectedGame.startTimeUTC).toISOString()
          : null,

        homeAbbr: selectedGame?.homeAbbr ?? null,
        awayAbbr: selectedGame?.awayAbbr ?? null,

        // optionnel: si tu veux forcer “expiresAt” côté serveur
        // expiresInDays: 2,
      });

      const challengeId = res?.data?.challengeId || null;

      if (!challengeId) {
        throw new Error("Création échouée: challengeId manquant.");
      }

      onCreated?.({
        challengeId,
        groupId: String(selectedGroupId),
        gameId: String(selectedGameId),
      });

      onClose?.();
    } catch (e) {
      console.log("[fgcCreate] ERROR", e?.code, e?.message || e);

      // Si la function renvoie "already-exists", tu peux afficher un message friendly
      const msg = String(e?.message || e);

      Alert.alert(
        i18n.t("common.error", { defaultValue: "Erreur" }),
        msg
      );
    } finally {
      setCreating(false);
    }
}
  /* ---------------- step UIs ---------------- */

  const renderStep1 = () => {
    if (loadingMemberships) {
      return (
        <View style={{ gap: 10 }}>
          <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
            <ActivityIndicator color={colors.primary} />
            <Text style={{ color: colors.subtext }}>
              {i18n.t("common.loading", { defaultValue: "Chargement…" })}
            </Text>
          </View>
        </View>
      );
    }

    if (membershipError) {
      return (
        <View style={{ gap: 8 }}>
          <Text style={{ color: colors.text, fontWeight: "900" }}>
            {i18n.t("common.error", { defaultValue: "Erreur" })}
          </Text>
          <Text style={{ color: colors.subtext }}>{membershipError}</Text>
        </View>
      );
    }

    if (ownedGroups.length === 0) {
      return (
        <View style={{ gap: 8 }}>
          <Text style={{ color: colors.text, fontWeight: "900" }}>
            {i18n.t("firstGoal.create.noOwnedGroupsTitle", {
              defaultValue: "Aucun groupe",
            })}
          </Text>
          <Text style={{ color: colors.subtext }}>
            {i18n.t("firstGoal.create.noOwnedGroupsBody", {
              defaultValue:
                "Tu dois être propriétaire d’un groupe pour lancer ce défi.",
            })}
          </Text>
        </View>
      );
    }

    if (ownedGroups.length === 1 && selectedGroup) {
      return (
        <View style={{ gap: 8 }}>
          <Text style={{ fontSize: 12, color: colors.subtext }}>
            {i18n.t("firstGoal.create.groupLabel", {
              defaultValue: "Groupe",
            })}
          </Text>
          <View
            style={{
              padding: 12,
              borderWidth: 1,
              borderRadius: 12,
              borderColor: colors.border,
              backgroundColor: colors.card2,
            }}
          >
            <Text style={{ color: colors.text, fontWeight: "900" }}>
              {selectedGroup.name || selectedGroup.id}
            </Text>
          </View>
        </View>
      );
    }

    return (
      <View style={{ gap: 8 }}>
        <Text style={{ fontSize: 12, color: colors.subtext }}>
          {i18n.t("firstGoal.create.groupChoose", {
            defaultValue: "Choisir un groupe",
          })}
        </Text>

        <TouchableOpacity
          onPress={() => setGroupDropdownOpen((v) => !v)}
          activeOpacity={0.85}
          style={{
            paddingVertical: 12,
            paddingHorizontal: 12,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.card2,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Text style={{ color: colors.text, fontWeight: "900" }} numberOfLines={1}>
            {selectedGroup?.name ||
              selectedGroup?.id ||
              i18n.t("common.choose", { defaultValue: "Choisir…" })}
          </Text>
          <Ionicons
            name={groupDropdownOpen ? "chevron-up" : "chevron-down"}
            size={18}
            color={colors.text}
          />
        </TouchableOpacity>

        {groupDropdownOpen ? (
          <View
            style={{
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 12,
              backgroundColor: colors.card,
              overflow: "hidden",
            }}
          >
            <ScrollView style={{ maxHeight: 220 }}>
              {ownedGroups.map((g) => {
                const active = String(g.id) === String(selectedGroupId);
                return (
                  <TouchableOpacity
                    key={g.id}
                    onPress={() => {
                      setSelectedGroupId(g.id);
                      setGroupDropdownOpen(false);
                    }}
                    style={{
                      paddingVertical: 12,
                      paddingHorizontal: 12,
                      borderTopWidth: 1,
                      borderTopColor: colors.border,
                      backgroundColor: active ? colors.card2 : colors.card,
                    }}
                  >
                    <Text style={{ color: colors.text, fontWeight: active ? "900" : "800" }}>
                      {g.name || g.id}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        ) : null}
      </View>
    );
  };

  const renderGameRow = (g) => {
    const active = String(g.id) === String(selectedGameId);
    const label = fmtMatchLabel(g);
    const time = fmtTime(g.startTimeUTC);

    return (
      <TouchableOpacity
        key={g.id}
        onPress={() => setSelectedGameId(String(g.id))}
        activeOpacity={0.85}
        style={{
          padding: 12,
          borderRadius: 12,
          borderWidth: 2,
          borderColor: active ? colors.primary : colors.border,
          backgroundColor: active ? colors.card2 : colors.card,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <View style={{ flex: 1, paddingRight: 10 }}>
          <Text style={{ color: colors.text, fontWeight: "900" }} numberOfLines={1}>
            {label}
          </Text>
          <Text style={{ color: colors.subtext, marginTop: 2, fontSize: 12 }}>
            {i18n.t("firstGoal.create.gameTime", {
              defaultValue: "Début: {{time}}",
              time,
            })}
          </Text>
        </View>

        {active ? (
          <Ionicons name="checkmark-circle" size={22} color={colors.primary} />
        ) : (
          <Ionicons name="ellipse-outline" size={22} color={colors.subtext} />
        )}
      </TouchableOpacity>
    );
  };

  const renderStep2 = () => {
    return (
      <View style={{ gap: 10 }}>
        <Text style={{ color: colors.text, fontWeight: "900" }}>
          {i18n.t("firstGoal.create.pickGameTitle", {
            defaultValue: "Choisir un match (aujourd’hui)",
          })}
        </Text>

        {loadingGames ? (
          <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
            <ActivityIndicator color={colors.primary} />
            <Text style={{ color: colors.subtext }}>
              {i18n.t("common.loading", { defaultValue: "Chargement…" })}
            </Text>
          </View>
        ) : games.length === 0 ? (
          <Text style={{ color: colors.subtext }}>
            {i18n.t("firstGoal.create.noGamesToday", {
              defaultValue: "Aucun match trouvé aujourd’hui.",
            })}
          </Text>
        ) : (
          <View style={{ gap: 10 }}>{games.map(renderGameRow)}</View>
        )}
      </View>
    );
  };

  const renderStep3 = () => {
    const groupLabel = selectedGroup?.name || selectedGroup?.id || selectedGroupId || "—";
    const gameLabel = selectedGame ? fmtMatchLabel(selectedGame) : "—";
    const gameTime = selectedGame ? fmtTime(selectedGame.startTimeUTC) : "—";

    const homeAbbr = safeAbbr(selectedGame?.homeAbbr);
    const awayAbbr = safeAbbr(selectedGame?.awayAbbr);

    const homeCount = playersByTeam.home.length;
    const awayCount = playersByTeam.away.length;

    const homePreview = playersByTeam.home.slice(0, 6);
    const awayPreview = playersByTeam.away.slice(0, 6);

    return (
      <View style={{ gap: 12 }}>
        <Text style={{ color: colors.text, fontWeight: "900", fontSize: 16 }}>
          {i18n.t("firstGoal.create.confirmTitle", { defaultValue: "Confirmer" })}
        </Text>

        <View
          style={{
            padding: 12,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 12,
            backgroundColor: colors.card2,
            gap: 10,
          }}
        >
          {/* Groupe */}
          <View>
            <Text style={{ color: colors.subtext, fontSize: 12, fontWeight: "800" }}>
              {i18n.t("firstGoal.create.summary.group", { defaultValue: "Groupe" })}
            </Text>
            <Text style={{ color: colors.text, fontWeight: "900", marginTop: 2 }}>
              {groupLabel}
            </Text>
          </View>

          {/* Match */}
          <View>
            <Text style={{ color: colors.subtext, fontSize: 12, fontWeight: "800" }}>
              {i18n.t("firstGoal.create.summary.game", { defaultValue: "Match" })}
            </Text>
            <Text style={{ color: colors.text, fontWeight: "900", marginTop: 2 }}>
              {gameLabel}
            </Text>
            <Text style={{ color: colors.subtext, marginTop: 2, fontSize: 12 }}>
              {i18n.t("firstGoal.create.summary.startAt", {
                defaultValue: "Début: {{time}}",
                time: gameTime,
              })}
            </Text>
          </View>

          {/* Joueurs (nhl_players) */}
          <View
            style={{
              marginTop: 4,
              paddingTop: 10,
              borderTopWidth: 1,
              borderTopColor: colors.border,
              gap: 10,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Ionicons name="people-outline" size={18} color={colors.text} />
              <Text style={{ color: colors.text, fontWeight: "900" }}>
                {i18n.t("firstGoal.create.players.title", {
                  defaultValue: "Joueurs",
                })}
              </Text>
            </View>

            {loadingPlayers ? (
              <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
                <ActivityIndicator color={colors.primary} />
                <Text style={{ color: colors.subtext }}>
                  {i18n.t("firstGoal.create.players.loading", {
                    defaultValue: "Chargement des rosters…",
                  })}
                </Text>
              </View>
            ) : (
              <>
                {!!playersError ? (
                  <Text style={{ color: colors.subtext, fontSize: 12 }}>{playersError}</Text>
                ) : null}

                <View style={{ gap: 10 }}>
                  {/* Away */}
                  <View style={{ gap: 4 }}>
                    <Text style={{ color: colors.text, fontWeight: "900" }}>
                      {awayAbbr || "AWAY"}{" "}
                      <Text style={{ color: colors.subtext, fontWeight: "800" }}>
                        ({awayCount})
                      </Text>
                    </Text>
                    {awayCount === 0 ? (
                      <Text style={{ color: colors.subtext, fontSize: 12 }}>
                        {i18n.t("firstGoal.create.players.none", {
                          defaultValue: "Aucun joueur trouvé.",
                        })}
                      </Text>
                    ) : (
                      <Text style={{ color: colors.subtext, fontSize: 12 }}>
                        {awayPreview.map((p) => p.fullName || p.name || p.id).join(" • ")}
                        {awayCount > awayPreview.length ? " • …" : ""}
                      </Text>
                    )}
                  </View>

                  {/* Home */}
                  <View style={{ gap: 4 }}>
                    <Text style={{ color: colors.text, fontWeight: "900" }}>
                      {homeAbbr || "HOME"}{" "}
                      <Text style={{ color: colors.subtext, fontWeight: "800" }}>
                        ({homeCount})
                      </Text>
                    </Text>
                    {homeCount === 0 ? (
                      <Text style={{ color: colors.subtext, fontSize: 12 }}>
                        {i18n.t("firstGoal.create.players.none", {
                          defaultValue: "Aucun joueur trouvé.",
                        })}
                      </Text>
                    ) : (
                      <Text style={{ color: colors.subtext, fontSize: 12 }}>
                        {homePreview.map((p) => p.fullName || p.name || p.id).join(" • ")}
                        {homeCount > homePreview.length ? " • …" : ""}
                      </Text>
                    )}
                  </View>
                </View>
              </>
            )}
          </View>

          <Text style={{ color: colors.subtext, fontSize: 12, marginTop: 6 }}>
            {i18n.t("firstGoal.create.summary.hint", {
              defaultValue:
                "Les membres recevront une notification et pourront choisir 1 joueur avant le début du match.",
            })}
          </Text>
        </View>
      </View>
    );
  };

  if (!visible) return null;

  const nextDisabled =
    creating ||
    (step === 1 && !canGoNext1) ||
    (step === 2 && !selectedGameId);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
      presentationStyle="pageSheet"
    >
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={{
            padding: 16,
            gap: 14,
            paddingTop: 16,
            paddingBottom: 16 + insets.bottom,
          }}
        >
          <WizardHeader step={step} colors={colors} onClose={handleClose} />

          {/* body */}
          <View
            style={{
              padding: 14,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.card,
            }}
          >
            {step === 1 ? renderStep1() : null}
            {step === 2 ? renderStep2() : null}
            {step === 3 ? renderStep3() : null}
          </View>

          {/* actions */}
          <View style={{ flexDirection: "row", gap: 10, marginTop: 4 }}>
            <TouchableOpacity
              onPress={step === 1 ? onClose : goBack}
              disabled={creating}
              style={{
                flex: 1,
                padding: 12,
                borderRadius: 12,
                borderWidth: 1,
                alignItems: "center",
                borderColor: colors.border,
                backgroundColor: colors.card,
              }}
            >
              <Text style={{ color: colors.text, fontWeight: "800" }}>
                {step === 1
                  ? i18n.t("common.cancel", { defaultValue: "Annuler" })
                  : i18n.t("common.back", { defaultValue: "Retour" })}
              </Text>
            </TouchableOpacity>

            {step < 3 ? (
              <TouchableOpacity
                onPress={goNext}
                disabled={nextDisabled}
                style={{
                  flex: 1,
                  padding: 12,
                  borderRadius: 12,
                  alignItems: "center",
                  backgroundColor: nextDisabled ? colors.subtext : "#111827",
                }}
              >
                <Text style={{ color: "#fff", fontWeight: "900" }}>
                  {i18n.t("common.next", { defaultValue: "Suivant" })}
                </Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                onPress={handleCreate}
                disabled={!canCreate || creating}
                style={{
                  flex: 1,
                  padding: 12,
                  borderRadius: 12,
                  alignItems: "center",
                  backgroundColor: !canCreate || creating ? colors.subtext : "#111827",
                }}
              >
                <Text style={{ color: "#fff", fontWeight: "900" }}>
                  {creating
                    ? i18n.t("firstGoal.create.creating", { defaultValue: "Création…" })
                    : i18n.t("firstGoal.create.createNow", { defaultValue: "Créer" })}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}