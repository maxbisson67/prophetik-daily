import React, { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import firestore from "@react-native-firebase/firestore";
import { useAuth } from "@src/auth/SafeAuthProvider";
import i18n from "@src/i18n/i18n";

function shouldShowEntries(status) {
  const st = String(status || "").toLowerCase();
  return ["locked", "live", "pending", "decided", "closed"].includes(st);
}

function isDecided(status) {
  const st = String(status || "").toLowerCase();
  return st === "decided" || st === "closed";
}

export default function FirstGoalLiveCard({ visible, gameId, colors }) {
  const router = useRouter();
  const { user } = useAuth();

  const [firstGoalChallenges, setFirstGoalChallenges] = useState([]);
  const [entriesByChallengeId, setEntriesByChallengeId] = useState({}); // my entry
  const [allEntriesByChallengeId, setAllEntriesByChallengeId] = useState({}); // all entries
  const [loadingFirstGoal, setLoadingFirstGoal] = useState(false);

  // keep unsubscribers for entries listeners
  const entriesUnsubsRef = useRef({});

  // Cleanup all entry listeners
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
    if (!visible || !gameId) {
      setFirstGoalChallenges([]);
      setEntriesByChallengeId({});
      setAllEntriesByChallengeId({});
      setLoadingFirstGoal(false);
      cleanupEntryListeners();
      return;
    }

    setLoadingFirstGoal(true);

    const q = firestore()
      .collection("first_goal_challenges")
      .where("gameId", "==", String(gameId))
      .orderBy("createdAt", "desc")
      .limit(5);

    const unsub = q.onSnapshot(
      async (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setFirstGoalChallenges(list);

        // (1) Load "my entry" for each challenge (comme avant)
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
            results.forEach(([cid, data]) => (map[cid] = data));
            setEntriesByChallengeId(map);
          } catch (e) {
            console.log("[FirstGoalLiveCard] entry check error", e?.message || e);
          }
        }

        // (2) Attach listeners to entries subcollection WHEN locked/live/pending/decided/closed
        // Avoid duplicate listeners
        const wantIds = new Set(
          list
            .filter((ch) => shouldShowEntries(ch.status))
            .map((ch) => String(ch.id))
        );

        // remove listeners no longer needed
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

        // add missing listeners
        wantIds.forEach((cid) => {
          if (entriesUnsubsRef.current[cid]) return;

          const entriesRef = firestore()
            .collection("first_goal_challenges")
            .doc(cid)
            .collection("entries");

          // Option: limit si tu veux éviter trop de docs
          // .limit(50) (mais Firestore n'autorise pas limit sans orderBy dans certains cas)
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
  }, [visible, gameId, user?.uid]);

  const cardTitle = useMemo(
    () => i18n.t("firstGoal.live.title", { defaultValue: "Défi: Premier but" }),
    []
  );

  return (
    <View
      style={{
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.card,
        marginBottom: 12,
      }}
    >
      <Text style={{ fontWeight: "700", marginBottom: 6, color: colors.text }}>
        {cardTitle}
      </Text>

      {loadingFirstGoal ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <ActivityIndicator size="small" color={colors.subtext} />
          <Text style={{ color: colors.subtext, fontSize: 13 }}>
            {i18n.t("common.loading", { defaultValue: "Chargement…" })}
          </Text>
        </View>
      ) : firstGoalChallenges.length === 0 ? (
        <Text style={{ color: colors.subtext, fontSize: 13 }}>
          {i18n.t("firstGoal.live.none", { defaultValue: "Aucun défi 'premier but' pour ce match." })}
        </Text>
      ) : (
        <View style={{ gap: 10 }}>
          {firstGoalChallenges.map((ch) => {
            const cid = String(ch.id);
            const st = String(ch.status || "").toLowerCase();
            const entry = entriesByChallengeId[cid] || null;
            const participantsCount = Number(ch.participantsCount || 0);

            const decided = isDecided(st);
            const pending = st === "pending";
            const canPick = (st === "open" || st === "locked") && !entry;

            const allEntries = allEntriesByChallengeId[cid] || [];
            const showEntries = shouldShowEntries(st);

            // Winners:
            // (1) if winnersPreviewUids exists -> use that
            // (2) else derive from firstGoal.playerId and entries
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
                      // si tu stockes displayName dans l’entrée c’est parfait
                      return e?.displayName || e?.name || e?.playerOwnerName || uid.slice(0, 6);
                    })
                    .join(", ");

            const resultLine = decided
              ? ch.firstGoal?.playerName
                ? `✅ ${ch.firstGoal.playerName} (${ch.firstGoal.teamAbbr || ""})`
                : `✅ ${i18n.t("firstGoal.live.noWinner", { defaultValue: "Aucun gagnant" })}`
              : pending
              ? `⏳ ${i18n.t("firstGoal.live.pending", { defaultValue: "Provisoire / en révision NHL…" })}`
              : st === "locked"
              ? `🔒 ${i18n.t("firstGoal.live.locked", { defaultValue: "Verrouillé (match commencé)" })}`
              : st === "open"
              ? `🟢 ${i18n.t("firstGoal.live.open", { defaultValue: "Ouvert" })}`
              : `ℹ️ ${st}`;

            return (
              <View
                key={cid}
                style={{
                  padding: 10,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.card2,
                }}
              >
                <Text style={{ color: colors.text, fontWeight: "800" }}>
                  {i18n.t("firstGoal.live.participants", {
                    defaultValue: "{{n}} participant(s)",
                    n: participantsCount,
                  })}
                </Text>

                <Text style={{ color: colors.subtext, marginTop: 4, fontSize: 13 }}>
                  {resultLine}
                </Text>

                {/* ✅ Gagnants quand decided */}
                {decided ? (
                  <Text style={{ color: colors.text, marginTop: 8, fontSize: 13, fontWeight: "800" }}>
                    🏆 {i18n.t("firstGoal.live.winners", { defaultValue: "Gagnant(s):" })}{" "}
                    <Text style={{ fontWeight: "700" }}>{winnersLabel}</Text>
                  </Text>
                ) : null}

                {/* ✅ Participants + choix dès que locké/live/pending/decided */}
                {showEntries ? (
                  <View style={{ marginTop: 10 }}>
                    <Text style={{ color: colors.text, fontWeight: "800", fontSize: 13, marginBottom: 6 }}>
                      {i18n.t("firstGoal.live.picksTitle", { defaultValue: "Participants & choix" })}
                    </Text>

                    {allEntries.length === 0 ? (
                      <Text style={{ color: colors.subtext, fontSize: 13 }}>
                        {i18n.t("firstGoal.live.noEntriesYet", { defaultValue: "Aucune participation encore." })}
                      </Text>
                    ) : (
                      <View style={{ gap: 6 }}>
                        {allEntries.slice(0, 30).map((e) => {
                          const who =
                            e?.displayName || e?.name || e?.playerOwnerName || String(e.uid || "").slice(0, 6);
                          const pick = e?.playerName || "—";
                          const isWinner = decided && winnerUids.includes(String(e.uid));
                          return (
                            <Text key={String(e.uid)} style={{ color: colors.subtext, fontSize: 13 }}>
                              {isWinner ? "✅ " : "• "}
                              <Text style={{ color: colors.text, fontWeight: "700" }}>{who}</Text>
                              {"  →  "}
                              {pick}
                            </Text>
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

                {/* ✅ Mon choix */}
                {entry ? (
                  <Text style={{ color: colors.subtext, marginTop: 10, fontSize: 13 }}>
                    🎯{" "}
                    {i18n.t("firstGoal.live.myPick", {
                      defaultValue: "Ton choix: {{name}}",
                      name: entry.playerName || "—",
                    })}
                  </Text>
                ) : null}

                <View style={{ flexDirection: "row", gap: 10, marginTop: 10 }}>
                  <TouchableOpacity
                    onPress={() => router.push(`/(first-goal)/pick/${cid}`)}
                    disabled={!user?.uid || (!canPick && !entry)}
                    style={{
                      flex: 1,
                      paddingVertical: 10,
                      borderRadius: 10,
                      alignItems: "center",
                      backgroundColor:
                        !user?.uid || (!canPick && !entry) ? colors.border : "#111827",
                    }}
                  >
                    <Text style={{ color: "#fff", fontWeight: "900" }}>
                      {entry
                        ? i18n.t("firstGoal.live.viewPick", { defaultValue: "Voir mon choix" })
                        : i18n.t("firstGoal.live.join", { defaultValue: "Participer" })}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}