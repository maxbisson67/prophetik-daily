// src/defis/TeamPredictionLiveCard.js

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
import { Ionicons } from "@expo/vector-icons";
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

function safeAbbr(v) {
  return String(v || "").trim().toUpperCase();
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

  let label = i18n.t("tp.status.unknown", { defaultValue: "En cours" });
  let bg = colors.card;
  let fg = colors.text;
  let icon = "time-outline";

  if (st === "open") {
    label = i18n.t("tp.status.open", { defaultValue: "Ouvert" });
    bg = "rgba(34,197,94,0.14)";
    fg = "#16a34a";
    icon = "lock-open-outline";
  } else if (st === "locked" || st === "live") {
    label = i18n.t("tp.status.live", { defaultValue: "Match débuté" });
    bg = "rgba(239,68,68,0.12)";
    fg = "#dc2626";
    icon = "play-circle-outline";
  } else if (st === "pending") {
    label = i18n.t("tp.status.pending", { defaultValue: "En révision" });
    bg = "rgba(245,158,11,0.14)";
    fg = "#d97706";
    icon = "hourglass-outline";
  } else if (st === "decided" || st === "closed") {
    label = i18n.t("tp.status.decided", { defaultValue: "Confirmé" });
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

function getPredictedWinnerAbbr(entry, awayAbbr, homeAbbr) {
  const away = Number(entry?.predictedAwayScore);
  const home = Number(entry?.predictedHomeScore);

  if (!Number.isFinite(away) || !Number.isFinite(home)) {
    return safeAbbr(entry?.winnerAbbr);
  }

  if (away > home) return safeAbbr(awayAbbr);
  if (home > away) return safeAbbr(homeAbbr);

  return safeAbbr(entry?.winnerAbbr);
}

function isPerfectPick(entry = {}, official = {}, awayAbbr, homeAbbr) {
  const predictedWinner = getPredictedWinnerAbbr(entry, awayAbbr, homeAbbr);
  const officialWinner = safeAbbr(official?.winnerAbbr);

  const predictedAwayScore = Number(entry?.predictedAwayScore);
  const predictedHomeScore = Number(entry?.predictedHomeScore);

  const officialAwayScore = Number(official?.awayScore);
  const officialHomeScore = Number(official?.homeScore);

  const predictedOutcome = safeAbbr(entry?.predictedOutcome);
  const officialOutcome = safeAbbr(official?.outcome);

  if (!predictedWinner || !officialWinner) return false;
  if (!Number.isFinite(predictedAwayScore) || !Number.isFinite(predictedHomeScore)) return false;
  if (!Number.isFinite(officialAwayScore) || !Number.isFinite(officialHomeScore)) return false;
  if (!predictedOutcome || !officialOutcome) return false;

  return (
    predictedWinner === officialWinner &&
    predictedAwayScore === officialAwayScore &&
    predictedHomeScore === officialHomeScore &&
    predictedOutcome === officialOutcome
  );
}

function formatOutcomeLabel(outcome) {
  const v = safeAbbr(outcome);

  if (v === "REG") return "en temps régulier";
  if (v === "OT") return "en prolongation";
  if (v === "TB") return "en tirs de barrage";

  return v || "";
}

function formatEntryPick(entry, awayAbbr, homeAbbr) {
  const winnerAbbr = getPredictedWinnerAbbr(entry, awayAbbr, homeAbbr);

  const away = Number(entry?.predictedAwayScore);
  const home = Number(entry?.predictedHomeScore);
  const outcomeLabel = formatOutcomeLabel(entry?.predictedOutcome);

  let scoreLine = "—";

  if (Number.isFinite(away) && Number.isFinite(home)) {
    if (winnerAbbr === safeAbbr(awayAbbr)) {
      scoreLine = `${away}-${home}`;
    } else if (winnerAbbr === safeAbbr(homeAbbr)) {
      scoreLine = `${home}-${away}`;
    } else {
      scoreLine = `${away}-${home}`;
    }
  }

  return {
    winnerAbbr,
    line: `Victoire ${winnerAbbr} ${scoreLine}${outcomeLabel ? ` ${outcomeLabel}` : ""}`,
  };
}

function ResultBanner({ status, challenge, colors }) {
  const st = String(status || "").toLowerCase();
  const official = challenge?.officialResult || {};
  const winnerAbbr = safeAbbr(official?.winnerAbbr);
  const awayScore = official?.awayScore;
  const homeScore = official?.homeScore;
  const outcome = safeAbbr(official?.outcome);

  let text = i18n.t("tp.live.waitingStart", {
    defaultValue: "En attente du début du match.",
  });
  let fg = colors.text;
  let bg = colors.card;
  let icon = "flag-outline";

  if (st === "pending") {
    text = i18n.t("tp.live.resultPending", {
      defaultValue: "Résultat en attente de confirmation.",
    });
    fg = "#d97706";
    bg = "rgba(245,158,11,0.10)";
    icon = "hourglass-outline";
  } else if ((st === "decided" || st === "closed") && winnerAbbr) {
    text = i18n.t("tp.live.resultConfirmed", {
      defaultValue: "Résultat confirmé: {{winner}} {{away}}-{{home}} ({{outcome}})",
      winner: winnerAbbr,
      away: awayScore,
      home: homeScore,
      outcome: outcome || "REG",
    });
    fg = "#2563eb";
    bg = "rgba(59,130,246,0.10)";
    icon = "checkmark-circle-outline";
  } else if (st === "locked" || st === "live") {
    text = i18n.t("tp.live.matchStarted", {
      defaultValue: "Match débuté. Prédictions verrouillées.",
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

function EntryRow({
  entry,
  revealPick,
  isWinner,
  isMe,
  colors,
  awayAbbr,
  homeAbbr,
}) {
  const who =
    entry?.displayName ||
    entry?.name ||
    entry?.playerOwnerName ||
    String(entry?.uid || "").slice(0, 6);

  const avatar = entry?.photoURL || entry?.avatarUrl || null;
  const { winnerAbbr, line } = formatEntryPick(entry, awayAbbr, homeAbbr);
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

        {shouldShowThisPick ? (
          <View style={{ flexDirection: "row", alignItems: "center", marginTop: 2 }}>
            {winnerAbbr ? <TeamLogo abbr={winnerAbbr} size={16} /> : null}
            <Text
              style={{
                color: colors.subtext,
                fontSize: 12,
                marginLeft: winnerAbbr ? 6 : 0,
                fontWeight: "700",
              }}
              numberOfLines={1}
            >
              {line}
            </Text>
          </View>
        ) : (
          <Text style={{ color: colors.subtext, fontSize: 12, marginTop: 2 }}>
            {i18n.t("tp.live.pickHidden", {
              defaultValue: "Prédiction cachée jusqu’au début du match",
            })}
          </Text>
        )}
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
            🏆 {i18n.t("tp.live.winnerBadge", { defaultValue: "Gagnant" })}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

export default function TeamPredictionLiveCard({ visible, challengeId, colors }) {
  const router = useRouter();
  const { user } = useAuth();

  const [challenge, setChallenge] = useState(null);
  const [entries, setEntries] = useState([]);
  const [myEntry, setMyEntry] = useState(null);
  const [loading, setLoading] = useState(false);

  const challengeRefUnsub = useRef(null);
  const entriesRefUnsub = useRef(null);
  const myEntryRefUnsub = useRef(null);

  useEffect(() => {
    if (!visible || !challengeId) {
      setChallenge(null);
      setEntries([]);
      setMyEntry(null);
      setLoading(false);

      try { challengeRefUnsub.current?.(); } catch {}
      try { entriesRefUnsub.current?.(); } catch {}
      try { myEntryRefUnsub.current?.(); } catch {}

      challengeRefUnsub.current = null;
      entriesRefUnsub.current = null;
      myEntryRefUnsub.current = null;
      return;
    }

    setLoading(true);

    const ref = firestore().doc(`team_prediction_challenges/${challengeId}`);

    challengeRefUnsub.current = ref.onSnapshot(
      (snap) => {
        const data = snap?.exists ? { id: snap.id, ...(snap.data() || {}) } : null;
        setChallenge(data);
        setLoading(false);
      },
      (err) => {
        console.log("[TeamPredictionLiveCard] challenge error", err?.message || err);
        setChallenge(null);
        setLoading(false);
      }
    );

    return () => {
      try { challengeRefUnsub.current?.(); } catch {}
      challengeRefUnsub.current = null;
    };
  }, [visible, challengeId]);

  useEffect(() => {
    const status = String(challenge?.status || "").toLowerCase();
    const showParticipants = shouldShowParticipants(status);

    try { entriesRefUnsub.current?.(); } catch {}
    entriesRefUnsub.current = null;

    if (!visible || !challengeId || !showParticipants) {
      setEntries([]);
      return;
    }

    const ref = firestore()
    .collection("team_prediction_challenges")
    .doc(String(challengeId))
    .collection("entries");

    entriesRefUnsub.current = ref.onSnapshot(
      (snap) => {
        const list = snap.docs.map((d) => ({ uid: d.id, ...d.data() }));
        list.sort((a, b) =>
          String(a.displayName || a.name || a.uid || "").localeCompare(
            String(b.displayName || b.name || b.uid || "")
          )
        );
        setEntries(list);
      },
      (err) => {
        console.log("[TeamPredictionLiveCard] entries error", err?.message || err);
        setEntries([]);
      }
    );

    return () => {
      try { entriesRefUnsub.current?.(); } catch {}
      entriesRefUnsub.current = null;
    };
  }, [visible, challengeId, challenge?.status]);

  useEffect(() => {
    try { myEntryRefUnsub.current?.(); } catch {}
    myEntryRefUnsub.current = null;

    if (!visible || !challengeId || !user?.uid) {
      setMyEntry(null);
      return;
    }

    const ref = firestore()
    .collection("team_prediction_challenges")
    .doc(String(challengeId))
    .collection("entries")
    .doc(String(user.uid));

    myEntryRefUnsub.current = ref.onSnapshot(
      (snap) => {
        const data = snap?.exists ? snap.data() || null : null;
        setMyEntry(data);
      },
      (err) => {
        console.log("[TeamPredictionLiveCard] my entry error", err?.message || err);
        setMyEntry(null);
      }
    );

    return () => {
      try { myEntryRefUnsub.current?.(); } catch {}
      myEntryRefUnsub.current = null;
    };
  }, [visible, challengeId, user?.uid]);

  if (loading) {
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

  if (!challenge) {
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
          {i18n.t("tp.live.none", {
            defaultValue: "Aucun défi équipe gagnante pour ce match.",
          })}
        </Text>
      </View>
    );
  }

  const st = String(challenge?.status || "").toLowerCase();
  const awayAbbr = safeAbbr(challenge?.awayAbbr);
  const homeAbbr = safeAbbr(challenge?.homeAbbr);
  const participantsCount = Number(challenge?.participantsCount || entries.length || 0);

  const decided = isDecided(st);
  const revealPicks = shouldRevealPicks(st);
  const canPick = st === "open" && !myEntry;

  const official = challenge?.officialResult || {};
  const winnerUids = decided
    ? entries
        .filter((e) => isPerfectPick(e, official, awayAbbr, homeAbbr))
        .map((e) => String(e.uid))
    : [];

  const winnersLabel =
    winnerUids.length === 0
      ? i18n.t("tp.live.noWinners", { defaultValue: "Aucun gagnant" })
      : winnerUids
          .map((uid) => {
            const e = entries.find((x) => String(x.uid) === String(uid));
            return e?.displayName || e?.name || e?.playerOwnerName || uid.slice(0, 6);
          })
          .join(", ");

  return (
    <View style={{ gap: 10 }}>
      <View
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
            {i18n.t("tp.live.participants", {
              defaultValue: "{{n}} participant(s)",
              n: participantsCount,
            })}
          </Text>

          <StatusChip status={st} colors={colors} />
        </View>

        <View style={{ marginTop: 10, marginBottom: 2 }}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <TeamLogo abbr={awayAbbr} size={22} />
            <Text style={{ color: colors.text, fontWeight: "900", marginLeft: 8 }}>
              {awayAbbr || "—"}
            </Text>

            <Text style={{ color: colors.subtext, marginHorizontal: 10, fontWeight: "900" }}>
              @
            </Text>

            <Text style={{ color: colors.text, fontWeight: "900", marginRight: 8 }}>
              {homeAbbr || "—"}
            </Text>
            <TeamLogo abbr={homeAbbr} size={22} />
          </View>
        </View>

        <ResultBanner status={st} challenge={challenge} colors={colors} />

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
                {i18n.t("tp.live.winners", { defaultValue: "Gagnant(s):" })}
              </Text>{" "}
              <Text style={{ fontWeight: "700" }}>{winnersLabel}</Text>
            </Text>
          </View>
        ) : null}

        {shouldShowParticipants(st) ? (
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
                ? i18n.t("tp.live.picksTitle", {
                    defaultValue: "Participants & prédictions",
                  })
                : i18n.t("tp.live.participantsOnlyTitle", {
                    defaultValue: "Participants inscrits",
                  })}
            </Text>

            {entries.length === 0 ? (
              <Text style={{ color: colors.subtext, fontSize: 13 }}>
                {i18n.t("tp.live.noEntriesYet", {
                  defaultValue: "Aucune participation encore.",
                })}
              </Text>
            ) : (
              <View style={{ gap: 8 }}>
                {entries.slice(0, 30).map((e) => {
                  const isWinner = decided && winnerUids.includes(String(e.uid));
                  return (
                    <EntryRow
                      key={String(e.uid)}
                      entry={e}
                      revealPick={revealPicks}
                      isWinner={isWinner}
                      isMe={String(e.uid) === String(user?.uid || "")}
                      colors={colors}
                      awayAbbr={awayAbbr}
                      homeAbbr={homeAbbr}
                    />
                  );
                })}

                {entries.length > 30 ? (
                  <Text style={{ color: colors.subtext, fontSize: 12, marginTop: 4 }}>
                    {i18n.t("tp.live.moreEntries", {
                      defaultValue: "+{{n}} autre(s)…",
                      n: entries.length - 30,
                    })}
                  </Text>
                ) : null}
              </View>
            )}
          </View>
        ) : null}

        <View style={{ marginTop: 12 }}>
          <TouchableOpacity
            onPress={() =>
              router.push({
                pathname: "/(drawer)/(team-prediction)/pick/[challengeId]",
                params: { challengeId },
              })
            }
            disabled={!user?.uid || (!canPick && !myEntry)}
            style={{
              width: "100%",
              paddingVertical: 10,
              borderRadius: 12,
              alignItems: "center",
              backgroundColor:
                !user?.uid || (!canPick && !myEntry) ? colors.border : "#111827",
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "900" }}>
              {myEntry
                ? canPick
                  ? i18n.t("tp.live.modifyPick", {
                      defaultValue: "Modifier ma prédiction",
                    })
                  : i18n.t("tp.live.viewPick", {
                      defaultValue: "Voir ma prédiction",
                    })
                : i18n.t("tp.live.join", {
                    defaultValue: "Participer",
                  })}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}