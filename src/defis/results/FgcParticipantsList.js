import React from "react";
import { View, Text, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import i18n from "@src/i18n/i18n";
import TeamLogoBadge from "@src/sports/TeamLogoBadge";
import { lookupTeamByAbbr } from "@src/groups/data/fallbackTeams";

function entryPickName(entry) {
  return (
    entry?.playerName ||
    entry?.selectedPlayerName ||
    entry?.pickPlayerName ||
    "—"
  );
}

function entryTeamAbbr(entry) {
  return String(
    entry?.teamAbbr || entry?.playerTeamAbbr || entry?.selectedTeamAbbr || ""
  )
    .trim()
    .toUpperCase();
}

function isCorrectPick(entry, winnerPlayerId) {
  if (!winnerPlayerId || !entry?.playerId) return false;
  return String(entry.playerId) === String(winnerPlayerId);
}

export default function FgcParticipantsList({
  entries = [],
  loading = false,
  winnerPlayerId = null,
  currentUid = "",
  colors,
  title = null,
  league = "NHL",
  hideOthersPicks = false,
  revealTimeLabel = null,
}) {
  const uid = String(currentUid || "");
  const challengeLeague = String(league || "NHL").toUpperCase();
  const defaultTitle = hideOthersPicks
    ? i18n.t("firstGoal.live.participantsOnlyTitle", { defaultValue: "Participants inscrits" })
    : i18n.t("firstGoal.live.picksTitle", { defaultValue: "Participants & choix" });

  return (
    <View style={{ marginTop: 12 }}>
      {hideOthersPicks && revealTimeLabel ? (
        <Text
          style={{
            fontSize: 12,
            color: colors.subtext,
            textAlign: "center",
            marginBottom: 8,
          }}
        >
          {i18n.t("defi.results.participants.hiddenUntil", { time: revealTimeLabel })}
        </Text>
      ) : null}

      <Text style={{ color: colors.text, fontWeight: "800", marginBottom: 8 }}>
        {title || defaultTitle}
        {!loading && entries.length > 0 ? ` (${entries.length})` : ""}
      </Text>

      {loading ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <ActivityIndicator size="small" color={colors.subtext} />
          <Text style={{ color: colors.subtext, fontSize: 13 }}>
            {i18n.t("common.loading", { defaultValue: "Chargement…" })}
          </Text>
        </View>
      ) : entries.length === 0 ? (
        <Text style={{ color: colors.subtext, fontSize: 13 }}>
          {i18n.t("firstGoal.live.noEntriesYet", { defaultValue: "Aucune participation encore." })}
        </Text>
      ) : (
        <View style={{ gap: 6 }}>
          {entries.map((entry) => {
            const who =
              entry.displayName || entry.name || String(entry.uid || "").slice(0, 6);
            const pick = entryPickName(entry);
            const teamAbbr = entryTeamAbbr(entry);
            const correct = isCorrectPick(entry, winnerPlayerId);
            const isMe = String(entry.uid) === uid;
            const hideThisPick = hideOthersPicks && !isMe;

            return (
              <View
                key={String(entry.uid)}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  paddingVertical: 8,
                  paddingHorizontal: 10,
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: isMe ? "rgba(22,163,74,0.35)" : colors.border,
                  backgroundColor: isMe ? colors.card2 : colors.card,
                }}
              >
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ color: colors.text, fontWeight: "900" }} numberOfLines={1}>
                    {who}
                    {isMe
                      ? ` ${i18n.t("challenges.youSuffix", { defaultValue: "(toi)" })}`
                      : ""}
                  </Text>
                  {hideThisPick ? (
                    <Text style={{ color: colors.subtext, fontSize: 12, marginTop: 4 }}>
                      {i18n.t("firstGoal.live.pickHidden", {
                        defaultValue: "Choix caché jusqu'au début du match",
                      })}
                    </Text>
                  ) : (
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        marginTop: 4,
                        gap: 8,
                        minWidth: 0,
                      }}
                    >
                      {teamAbbr ? (
                        <TeamLogoBadge
                          team={lookupTeamByAbbr(challengeLeague, teamAbbr)}
                          size={22}
                          colors={colors}
                        />
                      ) : (
                        <View style={{ width: 22, height: 22 }} />
                      )}
                      <Text
                        style={{ color: colors.subtext, fontSize: 12, flex: 1 }}
                        numberOfLines={1}
                      >
                        {pick}
                      </Text>
                    </View>
                  )}
                </View>

                {!hideThisPick && winnerPlayerId ? (
                  <Ionicons
                    name={correct ? "checkmark-circle" : "close-circle"}
                    size={20}
                    color={correct ? "#16a34a" : "#dc2626"}
                  />
                ) : null}
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}
