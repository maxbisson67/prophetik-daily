import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Image,
} from "react-native";
import { useRouter } from "expo-router";
import firestore from "@react-native-firebase/firestore";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useAuth } from "@src/auth/SafeAuthProvider";
import i18n from "@src/i18n/i18n";
import { TeamLogo } from "@src/nhl/nhlAssets";

function shouldShowParticipants(status) {
  const st = String(status || "").toLowerCase();
  return ["open", "locked", "live", "pending", "decided", "closed"].includes(st);
}

function shouldRevealPicks(status) {
  const st = String(status || "").toLowerCase();
  return ["locked", "live", "pending", "decided", "closed"].includes(st);
}

function isDecided(status) {
  const st = String(status || "").toLowerCase();
  return st === "decided" || st === "closed";
}

function statusRank(status) {
  const st = String(status || "").toLowerCase();
  if (st === "open") return 0;
  if (st === "locked") return 1;
  if (st === "live") return 2;
  if (st === "pending") return 3;
  if (st === "decided") return 4;
  if (st === "closed") return 5;
  return 6;
}

function initials(name) {
  const s = String(name || "").trim();
  if (!s) return "?";
  const parts = s.split(/\s+/).filter(Boolean);
  const a = parts[0]?.[0] || "";
  const b = parts.length > 1 ? parts[parts.length - 1]?.[0] : "";
  return (a + b).toUpperCase();
}

function AvatarBubble({ uri, name, colors, size = 34 }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        overflow: "hidden",
        backgroundColor: colors.card2,
        borderWidth: 1,
        borderColor: colors.border,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {uri ? (
        <Image source={{ uri }} style={{ width: size, height: size }} resizeMode="cover" />
      ) : (
        <Text style={{ color: colors.text, fontWeight: "900", fontSize: 12 }}>
          {initials(name)}
        </Text>
      )}
    </View>
  );
}

function StatusChip({ status, colors }) {
  const st = String(status || "").toLowerCase();

  let label = i18n.t("firstGoal.status.unknown", { defaultValue: "En cours" });
  let bg = colors.card;
  let fg = colors.text;
  let icon = "time-outline";

  if (st === "open") {
    label = i18n.t("firstGoal.status.open", { defaultValue: "Ouvert" });
    bg = "rgba(34,197,94,0.14)";
    fg = "#16a34a";
    icon = "lock-open-outline";
  } else if (st === "locked" || st === "live") {
    label = i18n.t("firstGoal.status.live", { defaultValue: "Match débuté" });
    bg = "rgba(239,68,68,0.12)";
    fg = "#dc2626";
    icon = "play-circle-outline";
  } else if (st === "pending") {
    label = i18n.t("firstGoal.status.pending", { defaultValue: "En révision" });
    bg = "rgba(245,158,11,0.14)";
    fg = "#d97706";
    icon = "hourglass-outline";
  } else if (st === "decided" || st === "closed") {
    label = i18n.t("firstGoal.status.decided", { defaultValue: "Confirmé" });
    bg = "rgba(59,130,246,0.14)";
    fg = "#2563eb";
    icon = "checkmark-circle-outline";
  }

  return (
    <View
      style={{
        alignSelf: "flex-start",
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 999,
        backgroundColor: bg,
        flexDirection: "row",
        alignItems: "center",
      }}
    >
      <Ionicons name={icon} size={13} color={fg} />
      <Text style={{ color: fg, fontWeight: "900", fontSize: 12, marginLeft: 6 }}>
        {label}
      </Text>
    </View>
  );
}

function ResultBanner({ status, challenge, colors }) {
  const st = String(status || "").toLowerCase();
  const decided = st === "decided" || st === "closed";
  const pending = st === "pending";
  const locked = st === "locked" || st === "live";

  const firstGoalName = challenge?.firstGoal?.playerName || null;
  const firstGoalTeam = challenge?.firstGoal?.teamAbbr || "";

  let text = i18n.t("firstGoal.live.noGoalYet", {
    defaultValue: "Aucun but pour le moment.",
  });
  let fg = colors.text;
  let bg = colors.card;
  let icon = "flash-outline";

  if (pending && firstGoalName) {
    text = i18n.t("firstGoal.live.goalPending", {
      defaultValue: "Premier but: {{name}} {{team}} · en attente de confirmation",
      name: firstGoalName,
      team: firstGoalTeam ? `(${firstGoalTeam})` : "",
    });
    fg = "#d97706";
    bg = "rgba(245,158,11,0.10)";
    icon = "hourglass-outline";
  } else if (decided && firstGoalName) {
    text = i18n.t("firstGoal.live.goalConfirmed", {
      defaultValue: "Premier but confirmé: {{name}} {{team}}",
      name: firstGoalName,
      team: firstGoalTeam ? `(${firstGoalTeam})` : "",
    });
    fg = "#2563eb";
    bg = "rgba(59,130,246,0.10)";
    icon = "checkmark-circle-outline";
  } else if (decided && !firstGoalName) {
    text = i18n.t("firstGoal.live.noWinner", {
      defaultValue: "Aucun gagnant",
    });
    fg = colors.text;
    bg = colors.card;
    icon = "close-circle-outline";
  } else if (locked) {
    text = i18n.t("firstGoal.live.noGoalYet", {
      defaultValue: "Aucun but pour le moment.",
    });
    fg = "#dc2626";
    bg = "rgba(239,68,68,0.08)";
    icon = "play-outline";
  }

  return (
    <View
      style={{
        marginTop: 10,
        padding: 10,
        borderRadius: 12,
        backgroundColor: bg,
        borderWidth: 1,
        borderColor: colors.border,
        flexDirection: "row",
        alignItems: "flex-start",
      }}
    >
      <Ionicons
        name={icon}
        size={16}
        color={fg}
        style={{ marginTop: 1, marginRight: 8 }}
      />
      <Text style={{ color: fg, fontWeight: "800", fontSize: 13, flex: 1 }}>
        {text}
      </Text>
    </View>
  );
}

function EntryRow({ entry, revealPick, isWinner, isMe, colors }) {
  const who =
    entry?.displayName ||
    entry?.name ||
    entry?.playerOwnerName ||
    String(entry?.uid || "").slice(0, 6);

  const avatar = entry?.photoURL || entry?.avatarUrl || null;
  const pick = entry?.playerName || "—";

  const shouldShowThisPick = revealPick || isMe;

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 8,
        paddingHorizontal: 10,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: isWinner ? colors.card : colors.background,
      }}
    >
      <AvatarBubble uri={avatar} name={who} colors={colors} size={34} />

      <View style={{ flex: 1, marginLeft: 10 }}>
        <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap" }}>
          <Text style={{ color: colors.text, fontWeight: "900", fontSize: 13 }} numberOfLines={1}>
            {who}
          </Text>

          {isMe ? (
            <View
              style={{
                marginLeft: 8,
                paddingHorizontal: 8,
                paddingVertical: 2,
                borderRadius: 999,
                backgroundColor: colors.card2,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <Text style={{ color: colors.subtext, fontWeight: "900", fontSize: 11 }}>
                {i18n.t("common.me", { defaultValue: "Toi" })}
              </Text>
            </View>
          ) : null}
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", marginTop: 2 }}>
          {shouldShowThisPick ? (
            <>
              {entry?.teamAbbr ? (
                <TeamLogo abbr={entry.teamAbbr} size={16} />
              ) : null}

              <Text
                style={{
                  color: colors.subtext,
                  fontSize: 12,
                  marginLeft: entry?.teamAbbr ? 6 : 0,
                  fontWeight: "700",
                }}
                numberOfLines={1}
              >
                {pick}
              </Text>
            </>
          ) : (
            <Text style={{ color: colors.subtext, fontSize: 12 }}>
              {i18n.t("firstGoal.live.pickHidden", {
                defaultValue: "Choix caché jusqu’au début du match",
              })}
            </Text>
          )}
        </View>
      </View>

      {isWinner ? (
        <View
          style={{
            marginLeft: 10,
            paddingHorizontal: 8,
            paddingVertical: 4,
            borderRadius: 999,
            backgroundColor: "rgba(34,197,94,0.14)",
          }}
        >
          <Text style={{ color: "#16a34a", fontWeight: "900", fontSize: 12 }}>
            🏆 {i18n.t("firstGoal.live.winnerBadge", { defaultValue: "Gagnant" })}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

export default function FirstGoalLiveCard({ visible, gameId, colors }) {
  const router = useRouter();
  const { user } = useAuth();

  const [firstGoalChallenges, setFirstGoalChallenges] = useState([]);
  const [entriesByChallengeId, setEntriesByChallengeId] = useState({});
  const [allEntriesByChallengeId, setAllEntriesByChallengeId] = useState({});
  const [loadingFirstGoal, setLoadingFirstGoal] = useState(false);
  const [allowedGroupIds, setAllowedGroupIds] = useState([]);
  const [groupNameById, setGroupNameById] = useState({});

  const entriesUnsubsRef = useRef({});

  const cleanupEntryListeners = () => {
    const map = entriesUnsubsRef.current || {};
    Object.keys(map).forEach((cid) => {
      try {
        map[cid]?.();
      } catch {}
    });
    entriesUnsubsRef.current = {};
  };

  useEffect(() => {
    if (!user?.uid) {
      setAllowedGroupIds([]);
      setGroupNameById({});
      return;
    }

    const qByUid = firestore()
      .collection("group_memberships")
      .where("uid", "==", String(user.uid));

    const qOwnerCreated = firestore()
      .collection("groups")
      .where("createdBy", "==", String(user.uid));

    const qOwnerOwnerId = firestore()
      .collection("groups")
      .where("ownerId", "==", String(user.uid));

    let memberships = [];
    let ownedCreated = [];
    let ownedOwnerId = [];

    const recompute = () => {
      const memberIds = memberships
        .filter((m) => {
          const st = String(m?.status || "").toLowerCase();
          if (st) return ["active", "open", "approved"].includes(st);
          return m?.active !== false;
        })
        .map((m) => String(m.groupId || ""))
        .filter(Boolean);

      const ownerRows = [...ownedCreated, ...ownedOwnerId];
      const ownerIds = ownerRows.map((g) => String(g.id || "")).filter(Boolean);

      const ids = Array.from(new Set([...memberIds, ...ownerIds]));
      setAllowedGroupIds(ids);

      const names = {};
      ownerRows.forEach((g) => {
        const id = String(g.id || "");
        if (!id) return;
        names[id] = g?.name || g?.title || id;
      });

      setGroupNameById((prev) => ({ ...prev, ...names }));
    };

    const un1 = qByUid.onSnapshot(
      (snap) => {
        memberships = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        recompute();
      },
      (err) => {
        console.log("[FirstGoalLiveCard] group_memberships error", err?.message || err);
      }
    );

    const un2 = qOwnerCreated.onSnapshot(
      (snap) => {
        ownedCreated = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        recompute();
      },
      (err) => {
        console.log("[FirstGoalLiveCard] groups(createdBy) error", err?.message || err);
      }
    );

    const un3 = qOwnerOwnerId.onSnapshot(
      (snap) => {
        ownedOwnerId = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        recompute();
      },
      (err) => {
        console.log("[FirstGoalLiveCard] groups(ownerId) error", err?.message || err);
      }
    );

    return () => {
      try {
        un1();
      } catch {}
      try {
        un2();
      } catch {}
      try {
        un3();
      } catch {}
    };
  }, [user?.uid]);

  useEffect(() => {
    if (!allowedGroupIds.length) return;

    const missingIds = allowedGroupIds.filter((gid) => !groupNameById[gid]);
    if (!missingIds.length) return;

    const unsubs = [];

    missingIds.forEach((gid) => {
      const un = firestore()
        .collection("groups")
        .doc(String(gid))
        .onSnapshot((snap) => {
          if (!snap.exists) return;
          const data = snap.data() || {};
          setGroupNameById((prev) => ({
            ...prev,
            [gid]: data?.name || data?.title || gid,
          }));
        });

      unsubs.push(un);
    });

    return () => {
      unsubs.forEach((u) => {
        try {
          u();
        } catch {}
      });
    };
  }, [allowedGroupIds.join("|"), Object.keys(groupNameById).join("|")]);

  useEffect(() => {
    if (!visible || !gameId) {
      setFirstGoalChallenges([]);
      setEntriesByChallengeId({});
      setAllEntriesByChallengeId({});
      setLoadingFirstGoal(false);
      cleanupEntryListeners();
      return;
    }

    if (!allowedGroupIds.length) {
      setFirstGoalChallenges([]);
      setEntriesByChallengeId({});
      setAllEntriesByChallengeId({});
      setLoadingFirstGoal(false);
      cleanupEntryListeners();
      return;
    }

    setLoadingFirstGoal(true);

    const allowed = new Set(allowedGroupIds.map(String));

    const q = firestore()
      .collection("first_goal_challenges")
      .where("gameId", "==", String(gameId))
      .orderBy("createdAt", "desc")
      .limit(20);

    const unsub = q.onSnapshot(
      async (snap) => {
        const list = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((ch) => allowed.has(String(ch.groupId || "")))
          .sort((a, b) => {
            const ra = statusRank(a.status);
            const rb = statusRank(b.status);
            if (ra !== rb) return ra - rb;

            const ga = groupNameById[String(a.groupId || "")] || String(a.groupId || "");
            const gb = groupNameById[String(b.groupId || "")] || String(b.groupId || "");
            return ga.localeCompare(gb);
          });

        setFirstGoalChallenges(list);

        if (!user?.uid || list.length === 0) {
          setEntriesByChallengeId({});
        } else {
          try {
            const results = await Promise.all(
              list.map(async (ch) => {
                const entrySnap = await firestore()
                  .collection("first_goal_challenges")
                  .doc(String(ch.id))
                  .collection("entries")
                  .doc(String(user.uid))
                  .get();

                return [String(ch.id), entrySnap.exists ? entrySnap.data() : null];
              })
            );

            const map = {};
            results.forEach(([cid, data]) => {
              map[cid] = data;
            });
            setEntriesByChallengeId(map);
          } catch (e) {
            console.log("[FirstGoalLiveCard] entry check error", e?.message || e);
          }
        }

        const wantIds = new Set(
          list
            .filter((ch) => shouldShowParticipants(ch.status))
            .map((ch) => String(ch.id))
        );

        Object.keys(entriesUnsubsRef.current || {}).forEach((cid) => {
          if (!wantIds.has(cid)) {
            try {
              entriesUnsubsRef.current[cid]?.();
            } catch {}
            delete entriesUnsubsRef.current[cid];
            setAllEntriesByChallengeId((prev) => {
              const next = { ...prev };
              delete next[cid];
              return next;
            });
          }
        });

        wantIds.forEach((cid) => {
          if (entriesUnsubsRef.current[cid]) return;

          const entriesRef = firestore()
            .collection("first_goal_challenges")
            .doc(cid)
            .collection("entries");

          const unsubEntries = entriesRef.onSnapshot(
            (esnap) => {
              const rows = esnap.docs.map((d) => ({
                uid: d.id,
                ...d.data(),
              }));
              setAllEntriesByChallengeId((prev) => ({ ...prev, [cid]: rows }));
            },
            (err) => {
              console.log("[FirstGoalLiveCard] entries error", cid, err?.message || err);
            }
          );

          entriesUnsubsRef.current[cid] = unsubEntries;
        });

        setLoadingFirstGoal(false);
      },
      (err) => {
        console.log("[FirstGoalLiveCard] first_goal_challenges error", err?.message || err);
        setLoadingFirstGoal(false);
      }
    );

    return () => {
      try {
        unsub();
      } catch {}
      cleanupEntryListeners();
    };
  }, [visible, gameId, user?.uid, allowedGroupIds.join("|"), Object.keys(groupNameById).join("|")]);

  if (loadingFirstGoal) {
    return (
      <View
        style={{
          padding: 12,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.card,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <ActivityIndicator size="small" color={colors.subtext} />
          <Text style={{ color: colors.subtext, fontSize: 13 }}>
            {i18n.t("common.loading", { defaultValue: "Chargement…" })}
          </Text>
        </View>
      </View>
    );
  }

  if (firstGoalChallenges.length === 0) {
    return (
      <View
        style={{
          padding: 12,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.card,
        }}
      >
        <Text style={{ color: colors.subtext, fontSize: 13 }}>
          {i18n.t("firstGoal.live.none", {
            defaultValue: "Aucun défi 'premier but' pour ce match.",
          })}
        </Text>
      </View>
    );
  }

  return (
    <View style={{ gap: 10 }}>
      {firstGoalChallenges.map((ch) => {
        const cid = String(ch.id);
        const st = String(ch.status || "").toLowerCase();
        const entry = entriesByChallengeId[cid] || null;
        const participantsCount = Number(ch.participantsCount || 0);

        const decided = isDecided(st);
        const pending = st === "pending";
        const locked = st === "locked" || st === "live";
        const canPick = st === "open" && !entry;

        const allEntries = allEntriesByChallengeId[cid] || [];
        const showParticipants = shouldShowParticipants(st);
        const revealPicks = shouldRevealPicks(st);

        const firstGoalPlayerId = ch?.firstGoal?.playerId || null;
        const winnerUids =
          Array.isArray(ch?.winnersPreviewUids) && ch.winnersPreviewUids.length
            ? ch.winnersPreviewUids.map(String)
            : decided && firstGoalPlayerId
            ? allEntries
                .filter((e) => String(e.playerId || "") === String(firstGoalPlayerId))
                .map((e) => String(e.uid))
            : [];

        const winnersLabel =
          winnerUids.length === 0
            ? i18n.t("firstGoal.live.noWinners", { defaultValue: "Aucun gagnant" })
            : winnerUids
                .map((uid) => {
                  const e = allEntries.find((x) => String(x.uid) === String(uid));
                  return e?.displayName || e?.name || e?.playerOwnerName || uid.slice(0, 6);
                })
                .join(", ");

        const firstGoalName = ch?.firstGoal?.playerName || null;
        const firstGoalTeam = ch?.firstGoal?.teamAbbr || "";

        return (
          <View
            key={cid}
            style={{
              padding: 12,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.card,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <Text style={{ color: colors.text, fontWeight: "900", fontSize: 15 }}>
                {i18n.t("firstGoal.live.participants", {
                  defaultValue: "{{n}} participant(s)",
                  n: participantsCount,
                })}
              </Text>

              <StatusChip status={st} colors={colors} />
            </View>

            <ResultBanner status={st} challenge={ch} colors={colors} />

            {decided ? (
              <View
                style={{
                  marginTop: 8,
                  padding: 10,
                  borderRadius: 12,
                  backgroundColor: "rgba(34,197,94,0.08)",
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <Text style={{ color: colors.text, fontSize: 13 }}>
                  🏆{" "}
                  <Text style={{ fontWeight: "900" }}>
                    {i18n.t("firstGoal.live.winners", { defaultValue: "Gagnant(s):" })}
                  </Text>{" "}
                  <Text style={{ fontWeight: "700" }}>{winnersLabel}</Text>
                </Text>
              </View>
            ) : null}

            {showParticipants ? (
              <View style={{ marginTop: 10 }}>
                <Text
                  style={{
                    color: colors.text,
                    fontWeight: "900",
                    fontSize: 13,
                    marginBottom: 8,
                  }}
                >
                  {revealPicks
                    ? i18n.t("firstGoal.live.picksTitle", {
                        defaultValue: "Participants & choix",
                      })
                    : i18n.t("firstGoal.live.participantsOnlyTitle", {
                        defaultValue: "Participants inscrits",
                      })}
                </Text>

                {allEntries.length === 0 ? (
                  <Text style={{ color: colors.subtext, fontSize: 13 }}>
                    {i18n.t("firstGoal.live.noEntriesYet", {
                      defaultValue: "Aucune participation encore.",
                    })}
                  </Text>
                ) : (
                  <View style={{ gap: 8 }}>
                    {allEntries.slice(0, 30).map((e) => {
                      const isWinner = decided && winnerUids.includes(String(e.uid));
                      return (
                        <EntryRow
                          key={String(e.uid)}
                          entry={e}
                          revealPick={revealPicks}
                          isWinner={isWinner}
                          isMe={String(e.uid) === String(user?.uid || "")}
                          colors={colors}
                        />
                      );
                    })}

                    {allEntries.length > 30 ? (
                      <Text style={{ color: colors.subtext, fontSize: 12, marginTop: 4 }}>
                        {i18n.t("firstGoal.live.moreEntries", {
                          defaultValue: "+{{n}} autre(s)…",
                          n: allEntries.length - 30,
                        })}
                      </Text>
                    ) : null}
                  </View>
                )}
              </View>
            ) : null}

            <View style={{ marginTop: 12 }}>
              <TouchableOpacity
                onPress={() => router.push(`/(first-goal)/pick/${cid}`)}
                disabled={!user?.uid || (!canPick && !entry)}
                style={{
                  width: "100%",
                  paddingVertical: 10,
                  borderRadius: 12,
                  alignItems: "center",
                  backgroundColor:
                    !user?.uid || (!canPick && !entry) ? colors.border : "#111827",
                }}
              >
                <Text style={{ color: "#fff", fontWeight: "900" }}>
                  {entry
                    ? canPick
                      ? i18n.t("firstGoal.live.modifyPick", {
                          defaultValue: "Modifier mon choix",
                        })
                      : i18n.t("firstGoal.live.viewPick", {
                          defaultValue: "Voir mon choix",
                        })
                    : i18n.t("firstGoal.live.join", {
                        defaultValue: "Participer",
                      })}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        );
      })}
    </View>
  );
}