import React, { useEffect, useMemo, useState } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import firestore from "@react-native-firebase/firestore";

import i18n from "@src/i18n/i18n";
import { useAuth } from "@src/auth/SafeAuthProvider";
import FgcParticipantsModal from "@src/defis/results/FgcParticipantsModal";
import TeamLogoBadge from "@src/sports/TeamLogoBadge";
import { lookupTeamByAbbr } from "@src/groups/data/fallbackTeams";
import {
  getFgcLeague,
  getFgcResultPlayerId,
  getFgcResultPlayerName,
  getFgcResultPrefix,
  getFgcResultTeamAbbr,
} from "@src/firstGoal/fgcChallengeUtils";

function safeAbbr(v) {
  const s = String(v || "").trim().toUpperCase();
  return s || "";
}

function MatchupRow({ awayAbbr, homeAbbr, sport, colors }) {
  const away = safeAbbr(awayAbbr);
  const home = safeAbbr(homeAbbr);
  const league = String(sport || "NHL").toUpperCase() === "MLB" ? "MLB" : "NHL";

  return (
    <View style={{ flexDirection: "row", alignItems: "center" }}>
      <TeamLogoBadge team={lookupTeamByAbbr(league, away)} size={22} colors={colors} />
      <Text style={{ color: colors.text, fontWeight: "900", marginLeft: 8 }}>{away || "—"}</Text>
      <Text style={{ color: colors.subtext, marginHorizontal: 10, fontWeight: "900" }}>@</Text>
      <Text style={{ color: colors.text, fontWeight: "900", marginRight: 8 }}>{home || "—"}</Text>
      <TeamLogoBadge team={lookupTeamByAbbr(league, home)} size={22} colors={colors} />
    </View>
  );
}

function entryTeamAbbr(entry) {
  return safeAbbr(
    entry?.teamAbbr || entry?.playerTeamAbbr || entry?.selectedTeamAbbr || ""
  );
}

function entryPickName(entry) {
  return (
    entry?.playerName ||
    entry?.selectedPlayerName ||
    entry?.pickPlayerName ||
    "—"
  );
}

function entryPoints(entry) {
  if (entry?.payout != null) return Number(entry.payout) || 0;
  if (entry?.won === true) return Number(entry?.points ?? 0) || 0;
  return 0;
}

function isCorrectPick(entry, winnerPlayerId) {
  if (!winnerPlayerId || !entry?.playerId) return false;
  return String(entry.playerId) === String(winnerPlayerId);
}

export default function FgcResultDetailBlock({ item, colors }) {
  const { user } = useAuth();
  const uid = String(user?.uid || "");

  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showParticipantsModal, setShowParticipantsModal] = useState(false);

  const challenge = item?.raw || {};
  const challengeId = String(item?.id || challenge?.id || "");
  const challengeLeague = getFgcLeague(challenge);
  const winnerPlayerId = getFgcResultPlayerId(challenge);
  const winnerName = getFgcResultPlayerName(challenge);
  const winnerTeam = getFgcResultTeamAbbr(challenge);

  useEffect(() => {
    if (!challengeId) {
      setEntries([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const ref = firestore()
      .collection("first_goal_challenges")
      .doc(challengeId)
      .collection("entries");

    const unsub = ref.onSnapshot(
      (snap) => {
        const list = snap.docs
          .map((d) => ({ uid: d.id, ...d.data() }))
          .filter((e) => !!e.playerId)
          .sort((a, b) =>
            String(a.displayName || a.uid || "").localeCompare(
              String(b.displayName || b.uid || "")
            )
          );
        setEntries(list);
        setLoading(false);
      },
      () => {
        setEntries([]);
        setLoading(false);
      }
    );

    return () => {
      try {
        unsub();
      } catch {}
    };
  }, [challengeId]);

  const myEntry = useMemo(
    () => entries.find((e) => String(e.uid) === uid) || null,
    [entries, uid]
  );

  const myPoints = entryPoints(myEntry);
  const myCorrect = isCorrectPick(myEntry, winnerPlayerId);
  const myTeamAbbr = entryTeamAbbr(myEntry);

  return (
    <View style={{ marginTop: 10 }}>
      <MatchupRow
        awayAbbr={challenge?.awayAbbr}
        homeAbbr={challenge?.homeAbbr}
        sport={challengeLeague}
        colors={colors}
      />

      <View
        style={{
          marginTop: 10,
          paddingVertical: 8,
          paddingHorizontal: 10,
          borderRadius: 10,
          backgroundColor: colors.card2,
          borderWidth: 1,
          borderColor: colors.border,
        }}
      >
        <Text style={{ color: colors.subtext, fontSize: 12, fontWeight: "700" }}>
          {getFgcResultPrefix(challenge, i18n.t.bind(i18n))}
        </Text>
        {winnerName ? (
          <View style={{ flexDirection: "row", alignItems: "center", marginTop: 4 }}>
            {winnerTeam ? (
              <TeamLogoBadge
                team={lookupTeamByAbbr(challengeLeague, safeAbbr(winnerTeam))}
                size={18}
                colors={colors}
              />
            ) : null}
            <Text
              style={{
                color: colors.text,
                fontWeight: "900",
                marginLeft: winnerTeam ? 6 : 0,
                flexShrink: 1,
              }}
              numberOfLines={1}
            >
              {winnerName}
            </Text>
          </View>
        ) : (
          <Text style={{ color: colors.text, fontWeight: "900", marginTop: 2 }}>
            {i18n.t("firstGoal.home.noWinner", { defaultValue: "Aucun gagnant" })}
          </Text>
        )}
      </View>

      {myEntry ? (
        <View style={{ marginTop: 10, gap: 4 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <View style={{ flexDirection: "row", alignItems: "center", flex: 1, minWidth: 0 }}>
              <Text style={{ color: colors.subtext, fontSize: 13 }}>
                {i18n.t("challenges.myPick", { defaultValue: "Mon choix" })}
                {": "}
              </Text>
              {myTeamAbbr ? (
                <TeamLogoBadge
                  team={lookupTeamByAbbr(challengeLeague, myTeamAbbr)}
                  size={18}
                  colors={colors}
                />
              ) : null}
              <Text
                style={{
                  color: colors.text,
                  fontWeight: "900",
                  fontSize: 13,
                  marginLeft: myTeamAbbr ? 6 : 0,
                  flexShrink: 1,
                }}
                numberOfLines={1}
              >
                {entryPickName(myEntry)}
              </Text>
            </View>
            <Ionicons
              name={myCorrect ? "checkmark-circle" : "close-circle"}
              size={20}
              color={myCorrect ? "#16a34a" : "#dc2626"}
              style={{ marginLeft: 8 }}
            />
          </View>

          {myCorrect ? (
            <Text style={{ color: colors.subtext, fontSize: 13 }}>
              {i18n.t("challenges.myPointsEarned", { defaultValue: "Mes points" })}
              {": "}
              <Text style={{ color: colors.text, fontWeight: "900" }}>{myPoints}</Text>
            </Text>
          ) : null}
        </View>
      ) : (
        <Text style={{ color: colors.subtext, marginTop: 10, fontSize: 13 }}>
          {i18n.t("challenges.notJoined", { defaultValue: "Non inscrit" })}
        </Text>
      )}

      {!loading && entries.length > 0 ? (
        <TouchableOpacity
          onPress={() => setShowParticipantsModal(true)}
          activeOpacity={0.85}
          style={{
            marginTop: 12,
            flexDirection: "row",
            alignItems: "center",
            alignSelf: "flex-start",
          }}
        >
          <Text style={{ color: "#b91c1c", fontWeight: "800", fontSize: 13 }}>
            {i18n.t("challenges.viewOtherParticipantsPicks", {
              defaultValue: "Voir les choix des autres participants",
            })}
          </Text>
          <Text style={{ color: colors.subtext, fontSize: 13, marginLeft: 6 }}>
            ({entries.length})
          </Text>
          <Ionicons name="chevron-forward" size={14} color="#b91c1c" style={{ marginLeft: 2 }} />
        </TouchableOpacity>
      ) : loading ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 12 }}>
          <ActivityIndicator size="small" color={colors.subtext} />
        </View>
      ) : null}

      <FgcParticipantsModal
        visible={showParticipantsModal}
        onClose={() => setShowParticipantsModal(false)}
        challenge={challenge}
        entries={entries}
        loading={loading}
        currentUid={uid}
        colors={colors}
      />
    </View>
  );
}
