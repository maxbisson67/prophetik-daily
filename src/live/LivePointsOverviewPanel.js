import React, { useMemo } from "react";
import { View, Text, ActivityIndicator, ScrollView } from "react-native";
import i18n from "@src/i18n/i18n";
import { useAuth } from "@src/auth/SafeAuthProvider";
import { useProphetikBusinessYmd } from "@src/hooks/useProphetikBusinessDate";
import useLiveGroupPointsOverview from "@src/live/useLiveGroupPointsOverview";
import useLeaderboardProfiles, {
  resolveLeaderboardMember,
} from "@src/leaderboard/useLeaderboardProfiles";
import LeaderboardRankBadge from "@src/leaderboard/LeaderboardRankBadge";
import ParticipantAvatar from "@src/ui/ParticipantAvatar";
import LiveChallengeKindBadge, { LIVE_BADGE_ACCENTS } from "@src/live/LiveChallengeKindBadge";

function StatCell({ value, colors, accent, bold }) {
  const v = Number(value) || 0;
  return (
    <Text
      style={{
        color: v > 0 ? accent || colors.text : colors.subtext,
        fontWeight: bold ? "900" : "700",
        fontSize: 13,
        textAlign: "center",
        fontVariant: ["tabular-nums"],
      }}
    >
      {v > 0 ? String(v) : "—"}
    </Text>
  );
}

export default function LivePointsOverviewPanel({ groupId, sport, colors }) {
  const { user } = useAuth();
  const gameYmd = useProphetikBusinessYmd();
  const league = sport === "MLB" ? "MLB" : "NHL";
  const t = i18n.t.bind(i18n);

  const { rows, loading, hasAnyChallenge } = useLiveGroupPointsOverview({
    groupId,
    league,
    gameYmd,
    enabled: !!groupId,
  });

  const uids = useMemo(() => rows.map((r) => String(r.uid)), [rows]);
  const profiles = useLeaderboardProfiles(uids);

  const sectionTitles = useMemo(
    () => ({
      fgc: league === "MLB"
        ? t("live.challenge.fgcTitleMlb", { defaultValue: "Premier point produit" })
        : t("live.challenge.fgcTitleNhl", { defaultValue: "Premier but" }),
      tp: t("live.challenge.tpTitle", { defaultValue: "Prédire le match" }),
      ts: t("live.challenge.tsTitle", { defaultValue: "Trio du jour" }),
    }),
    [league, t]
  );

  if (!groupId) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24 }}>
        <Text style={{ color: colors.subtext, fontWeight: "700", textAlign: "center" }}>
          {t("live.selectGroupLabel")}
        </Text>
      </View>
    );
  }

  if (loading && !rows.length) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={colors.primary} />
        <Text style={{ color: colors.subtext, marginTop: 8, fontWeight: "600" }}>
          {t("live.pointsOverview.loading", { defaultValue: "Chargement des points…" })}
        </Text>
      </View>
    );
  }

  if (!hasAnyChallenge) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24 }}>
        <Text style={{ color: colors.subtext, fontWeight: "700", textAlign: "center" }}>
          {t("live.pointsOverview.noChallenges", {
            defaultValue: "Aucun défi du jour pour ce groupe.",
          })}
        </Text>
      </View>
    );
  }

  if (!rows.length) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24 }}>
        <Text style={{ color: colors.subtext, fontWeight: "700", textAlign: "center" }}>
          {t("live.pointsOverview.noParticipants", {
            defaultValue: "Aucune participation pour l'instant.",
          })}
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24, paddingTop: 4 }}
      showsVerticalScrollIndicator={false}
    >
      <View
        style={{
          borderRadius: 16,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.card,
          overflow: "hidden",
        }}
      >
        <View
          style={{
            paddingHorizontal: 14,
            paddingVertical: 12,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
            backgroundColor: colors.card2,
          }}
        >
          <Text style={{ color: colors.text, fontWeight: "900", fontSize: 15 }}>
            {t("live.pointsOverview.title", { defaultValue: "Points du jour" })}
          </Text>
          <Text style={{ color: colors.subtext, fontSize: 12, marginTop: 4, fontWeight: "600" }}>
            {t("live.pointsOverview.subtitle", {
              defaultValue: "Récapitulatif live par participant",
            })}
          </Text>
        </View>

        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingVertical: 8,
            paddingHorizontal: 10,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
          }}
        >
          <View style={{ width: 32 }} />
          <View style={{ flex: 1.8, minWidth: 0, paddingRight: 6 }}>
            <Text style={{ color: colors.subtext, fontSize: 10, fontWeight: "800" }}>
              {t("leaderboard.columns.player", { defaultValue: "Joueur" })}
            </Text>
          </View>
          <View style={{ flex: 0.55, alignItems: "center" }}>
            <LiveChallengeKindBadge kind="fgc" sport={league} colors={colors} compact />
          </View>
          <View style={{ flex: 0.55, alignItems: "center" }}>
            <LiveChallengeKindBadge kind="tp" sport={league} colors={colors} compact />
          </View>
          <View style={{ flex: 0.55, alignItems: "center" }}>
            <LiveChallengeKindBadge kind="ts" sport={league} colors={colors} compact />
          </View>
          <View style={{ flex: 0.55, alignItems: "center" }}>
            <Text style={{ color: colors.subtext, fontSize: 10, fontWeight: "800" }}>
              {t("leaderboard.columns.total", { defaultValue: "Total" })}
            </Text>
          </View>
        </View>

        {rows.map((row, idx) => {
          const member = resolveLeaderboardMember(row, profiles);
          const isMe = user?.uid && String(row.uid) === String(user.uid);
          const rank = idx + 1;
          const version = member.updatedAt?.toMillis?.() ? member.updatedAt.toMillis() : 0;

          return (
            <View
              key={row.uid}
              style={{
                flexDirection: "row",
                alignItems: "center",
                paddingVertical: 10,
                paddingHorizontal: 10,
                borderBottomWidth: idx === rows.length - 1 ? 0 : 1,
                borderBottomColor: colors.border,
                backgroundColor: isMe ? colors.rowAlt : idx % 2 ? colors.rowAlt : colors.card,
              }}
            >
              <View style={{ width: 32, alignItems: "center" }}>
                <LeaderboardRankBadge rank={rank} colors={colors} size={24} />
              </View>

              <View
                style={{
                  flex: 1.8,
                  minWidth: 0,
                  flexDirection: "row",
                  alignItems: "center",
                  paddingRight: 6,
                }}
              >
                <View style={{ marginRight: 6, flexShrink: 0 }}>
                  <ParticipantAvatar
                    photoURL={member.avatarUrl || member.jerseyFrontUrl}
                    avatarUrl={member.avatarUrl}
                    jerseyFrontUrl={member.jerseyFrontUrl}
                    jerseyBackUrl={member.jerseyBackUrl}
                    avatarKind={member.avatarKind}
                    name={member.displayName}
                    size={26}
                    colors={colors}
                    version={version}
                  />
                </View>
                <Text
                  style={{
                    color: isMe ? colors.primary : colors.text,
                    fontWeight: "800",
                    fontSize: 12,
                    flex: 1,
                  }}
                  numberOfLines={2}
                >
                  {member.displayName}
                </Text>
              </View>

              <View style={{ flex: 0.55, alignItems: "center" }}>
                <StatCell value={row.fgcPoints} colors={colors} accent={LIVE_BADGE_ACCENTS.fgc} />
              </View>
              <View style={{ flex: 0.55, alignItems: "center" }}>
                <StatCell value={row.tpPoints} colors={colors} accent={LIVE_BADGE_ACCENTS.tp} />
              </View>
              <View style={{ flex: 0.55, alignItems: "center" }}>
                <StatCell value={row.tsPoints} colors={colors} accent={LIVE_BADGE_ACCENTS.ts} />
              </View>
              <View style={{ flex: 0.55, alignItems: "center" }}>
                <StatCell value={row.totalPoints} colors={colors} accent="#FACC15" bold />
              </View>
            </View>
          );
        })}
      </View>

      <Text
        style={{
          color: colors.subtext,
          fontSize: 11,
          lineHeight: 16,
          fontWeight: "600",
          marginTop: 10,
          paddingHorizontal: 4,
        }}
      >
        {t("live.pointsOverview.hint", {
          defaultValue:
            "Points provisoires selon les résultats confirmés ou en cours. Le trio peut évoluer pendant les matchs.",
        })}
      </Text>

      <View style={{ marginTop: 10, gap: 6, paddingHorizontal: 4 }}>
        <Text style={{ color: colors.subtext, fontSize: 11, fontWeight: "700" }}>
          {sectionTitles.fgc} · {sectionTitles.tp} · {sectionTitles.ts}
        </Text>
      </View>
    </ScrollView>
  );
}
