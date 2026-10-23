import React, { useMemo } from "react";
import { View, Text, ActivityIndicator } from "react-native";
import i18n from "@src/i18n/i18n";
import useGroupDailyParticipation from "./useGroupDailyParticipation";
import useLeaderboardProfiles, { resolveLeaderboardMember } from "./useLeaderboardProfiles";
import ParticipantAvatar from "@src/ui/ParticipantAvatar";

function formatPctRate(rate) {
  if (rate == null || Number.isNaN(rate)) return "—";
  return `${Math.round(rate * 1000) / 10}%`;
}

export default function GroupParticipationSection({
  groupId,
  colors,
  currentUserId = null,
  competitionFromYmd = null,
  competitionToYmd = null,
}) {
  const t = i18n.t.bind(i18n);
  const {
    loading,
    error,
    participatingMembers,
    totalFromYmd,
    totalToYmd,
    avg7RatePct,
    challengeDayCount7,
    challengeDayCountTotal,
    participantRows,
  } = useGroupDailyParticipation(groupId, {
    enabled: !!groupId,
    competitionFromYmd,
    competitionToYmd,
  });

  const uids = useMemo(
    () => (participantRows || []).map((r) => r.uid),
    [participantRows]
  );
  const profiles = useLeaderboardProfiles(uids);

  if (!groupId) return null;

  const accent = colors.primary || "#ef4444";

  return (
    <View
      style={{
        marginBottom: 16,
        backgroundColor: colors.card,
        borderColor: colors.border,
        borderWidth: 1,
        borderRadius: 16,
        overflow: "hidden",
        borderLeftWidth: 4,
        borderLeftColor: accent,
      }}
    >
      <View
        style={{
          paddingHorizontal: 14,
          paddingTop: 14,
          paddingBottom: 10,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
          backgroundColor: colors.card2,
        }}
      >
        <Text style={{ color: colors.text, fontWeight: "900", fontSize: 16 }}>
          {t("leaderboard.sections.participation", {
            defaultValue: "Participation aux défis",
          })}
        </Text>
        <Text style={{ color: colors.subtext, fontSize: 12, marginTop: 4, fontWeight: "600" }}>
          {t("leaderboard.sections.participationHintV2", {
            defaultValue:
              "%7j = jours joués ÷ jours avec défis (7 j) · %Total = idem sur la phase sélectionnée",
          })}
        </Text>
      </View>

      {loading ? (
        <View style={{ padding: 24, alignItems: "center" }}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : error ? (
        <View style={{ padding: 16 }}>
          <Text style={{ color: colors.subtext, fontWeight: "600" }}>
            {t("leaderboard.sections.participationError", {
              defaultValue: "Impossible de charger la participation pour ce groupe.",
            })}
          </Text>
        </View>
      ) : (
        <View style={{ padding: 12, gap: 10 }}>
          <Text style={{ color: colors.subtext, fontSize: 12, fontWeight: "600" }}>
            {t("leaderboard.participation.metaV2", {
              participating: participatingMembers ?? 0,
              from: totalFromYmd,
              to: totalToYmd,
              days7: challengeDayCount7 ?? 0,
              daysTotal: challengeDayCountTotal ?? 0,
              avg7: avg7RatePct != null ? `${avg7RatePct}%` : "—",
              defaultValue:
                "{{participating}} joueurs actifs · phase {{from}} → {{to}} · {{daysTotal}} j. avec défis (total) · moy. groupe 7j {{avg7}}",
            })}
          </Text>

          {(participantRows || []).length > 0 ? (
            <View style={{ gap: 0 }}>
              <View
                style={{
                  flexDirection: "row",
                  paddingVertical: 6,
                  paddingHorizontal: 4,
                  borderBottomWidth: 1,
                  borderBottomColor: colors.border,
                }}
              >
                <Text style={{ flex: 1, color: colors.subtext, fontSize: 11, fontWeight: "800" }}>
                  {t("leaderboard.participation.byMember", { defaultValue: "Participant" })}
                </Text>
                <Text
                  style={{
                    width: 52,
                    textAlign: "right",
                    color: colors.subtext,
                    fontSize: 11,
                    fontWeight: "800",
                  }}
                >
                  {t("leaderboard.participation.pct7", { defaultValue: "%7j" })}
                </Text>
                <Text
                  style={{
                    width: 52,
                    textAlign: "right",
                    color: colors.subtext,
                    fontSize: 11,
                    fontWeight: "800",
                  }}
                >
                  {t("leaderboard.participation.pctTotal", { defaultValue: "%Total" })}
                </Text>
              </View>
              {participantRows.map((row, idx) => {
                const member = resolveLeaderboardMember(
                  { uid: row.uid, id: row.uid },
                  profiles
                );
                const version = member.updatedAt?.toMillis?.()
                  ? member.updatedAt.toMillis()
                  : 0;
                const isSelf = currentUserId && String(row.uid) === String(currentUserId);
                const ineligible = row.eligibleForDefis === false;
                const muted = ineligible ? colors.subtext : colors.text;
                return (
                  <View
                    key={row.uid}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      paddingVertical: 8,
                      paddingHorizontal: 4,
                      borderBottomWidth: idx === participantRows.length - 1 ? 0 : 1,
                      borderBottomColor: colors.border,
                      backgroundColor: idx % 2 ? colors.rowAlt : colors.card,
                      opacity: ineligible ? 0.72 : 1,
                    }}
                  >
                    <ParticipantAvatar
                      photoURL={member.avatarUrl || member.jerseyFrontUrl}
                      avatarUrl={member.avatarUrl}
                      jerseyFrontUrl={member.jerseyFrontUrl}
                      jerseyBackUrl={member.jerseyBackUrl}
                      avatarKind={member.avatarKind}
                      name={member.displayName}
                      size={28}
                      colors={colors}
                      version={version}
                    />
                    <View style={{ flex: 1, marginLeft: 8, minWidth: 0 }}>
                      <Text
                        style={{
                          color: isSelf ? colors.primary : colors.text,
                          fontWeight: isSelf ? "900" : "800",
                          fontSize: 13,
                        }}
                        numberOfLines={1}
                      >
                        {member.displayName}
                      </Text>
                      {ineligible ? (
                        <Text
                          style={{
                            color: colors.subtext,
                            fontSize: 10,
                            fontWeight: "600",
                            marginTop: 1,
                          }}
                          numberOfLines={1}
                        >
                          {t("leaderboard.participation.notInDefis", {
                            defaultValue: "Hors défis (admin / pause)",
                          })}
                        </Text>
                      ) : null}
                    </View>
                    <Text
                      style={{
                        width: 52,
                        textAlign: "right",
                        color: muted,
                        fontWeight: "800",
                        fontSize: 12,
                      }}
                    >
                      {formatPctRate(row.rate7)}
                    </Text>
                    <Text
                      style={{
                        width: 52,
                        textAlign: "right",
                        color: muted,
                        fontWeight: "800",
                        fontSize: 12,
                      }}
                    >
                      {formatPctRate(row.rateTotal)}
                    </Text>
                  </View>
                );
              })}
            </View>
          ) : (
            <Text style={{ color: colors.subtext, fontWeight: "600", fontSize: 13 }}>
              {t("leaderboard.participation.noMembers", {
                defaultValue: "Aucun membre dans ce groupe pour le moment.",
              })}
            </Text>
          )}
        </View>
      )}
    </View>
  );
}
