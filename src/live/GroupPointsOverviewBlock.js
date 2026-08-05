import React, { useMemo, useState } from "react";
import { View, Text, ActivityIndicator } from "react-native";
import i18n from "@src/i18n/i18n";
import { useAuth } from "@src/auth/SafeAuthProvider";
import { useProphetikBusinessYmd } from "@src/hooks/useProphetikBusinessDate";
import useLiveGroupPointsOverview from "@src/live/useLiveGroupPointsOverview";
import useLeaderboardProfiles, {
  resolveLeaderboardMember,
} from "@src/leaderboard/useLeaderboardProfiles";
import GroupPointsOverviewTable from "@src/live/GroupPointsOverviewTable";
import LeaderboardParticipantProfileModal from "@src/leaderboard/LeaderboardParticipantProfileModal";
import LiveChallengePicksModal from "@src/live/LiveChallengePicksModal";
import { DAILY_TOP_BONUS_POINTS } from "@src/lib/challengeScoringConstants";

export default function GroupPointsOverviewBlock({
  groupId,
  sport,
  gameYmd: gameYmdProp,
  colors,
  variant = "live",
  dateLabel = "",
  style = null,
}) {
  const { user } = useAuth();
  const defaultYmd = useProphetikBusinessYmd();
  const gameYmd = gameYmdProp || defaultYmd;
  const league = sport === "MLB" ? "MLB" : "NHL";
  const t = i18n.t.bind(i18n);
  const isHistory = variant === "history";
  const [profileRow, setProfileRow] = useState(null);
  const [picksKind, setPicksKind] = useState("");

  const {
    rows,
    loading,
    hasAnyChallenge,
    fgcChallenge,
    tpBundle,
    tsDefi,
    challengeIds,
  } = useLiveGroupPointsOverview({
    groupId,
    league,
    gameYmd,
    enabled: !!groupId,
    inferDailyBonus: isHistory,
  });

  const uids = useMemo(() => rows.map((r) => String(r.uid)), [rows]);
  const profiles = useLeaderboardProfiles(uids);

  const title = isHistory
    ? t("challenges.pointsOverview.title", {
        defaultValue: "Points — {{date}}",
        date: dateLabel || gameYmd,
      })
    : t("live.pointsOverview.title", { defaultValue: "Points du jour" });

  const subtitle = isHistory
    ? t("challenges.pointsOverview.subtitle", {
        defaultValue: "Récapitulatif par participant",
      })
    : t("live.pointsOverview.subtitle", {
        defaultValue: "Récapitulatif live par participant",
      });

  const hint = isHistory
    ? t("challenges.pointsOverview.hint", {
        defaultValue: "Points finaux selon les résultats confirmés.",
      })
    : t("live.pointsOverview.hint", {
        defaultValue:
          "Points provisoires selon les résultats confirmés ou en cours. Clique sur SOLO, DUO ou TRIO pour voir le détail.",
      });

  if (!groupId) return null;

  if (loading && !rows.length) {
    return (
      <View style={[{ alignItems: "center", paddingVertical: 20 }, style]}>
        <ActivityIndicator color={colors.primary} />
        <Text style={{ color: colors.subtext, marginTop: 8, fontWeight: "600" }}>
          {t("live.pointsOverview.loading", { defaultValue: "Chargement des points…" })}
        </Text>
      </View>
    );
  }

  if (!hasAnyChallenge) {
    return (
      <View style={[{ paddingVertical: 8 }, style]}>
        <Text style={{ color: colors.subtext, fontWeight: "700", textAlign: "center" }}>
          {t("challenges.pointsOverview.noChallenges", {
            defaultValue: "Aucun défi pour cette journée.",
          })}
        </Text>
      </View>
    );
  }

  if (!rows.length) {
    return (
      <View style={[{ paddingVertical: 8 }, style]}>
        <Text style={{ color: colors.subtext, fontWeight: "700", textAlign: "center" }}>
          {t("live.pointsOverview.noParticipants", {
            defaultValue: "Aucune participation pour l'instant.",
          })}
        </Text>
      </View>
    );
  }

  return (
    <>
      <View
        style={[
          {
            borderRadius: 16,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.card,
            overflow: "hidden",
          },
          style,
        ]}
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
          <Text style={{ color: colors.text, fontWeight: "900", fontSize: 15 }}>{title}</Text>
          <Text style={{ color: colors.subtext, fontSize: 12, marginTop: 4, fontWeight: "600" }}>
            {subtitle}
          </Text>
        </View>

        <GroupPointsOverviewTable
          rows={rows}
          league={league}
          colors={colors}
          currentUid={user?.uid}
          resolveMember={(row) => resolveLeaderboardMember(row, profiles)}
          embedded
          onParticipantPress={setProfileRow}
          onChallengeKindPress={setPicksKind}
        />

        <View style={{ paddingHorizontal: 14, paddingBottom: 12 }}>
          {hint ? (
          <Text
            style={{
              color: colors.subtext,
              fontSize: 11,
              lineHeight: 16,
              fontWeight: "600",
              marginTop: 10,
            }}
          >
            {hint}
          </Text>
          ) : null}

          {isHistory ? (
            <Text
              style={{
                color: colors.subtext,
                fontSize: 11,
                lineHeight: 16,
                fontWeight: "600",
                marginTop: 6,
              }}
            >
              {t("live.pointsOverview.dailyBonusNote", {
                bonus: DAILY_TOP_BONUS_POINTS,
                defaultValue:
                  "Bonus meilleure soirée : +{{bonus}} pts pour le plus haut total cumulé SOLO + DUO + TRIO (affiché en exposant sur la colonne Total).",
              })}
            </Text>
          ) : null}
        </View>
      </View>

      <LeaderboardParticipantProfileModal
        visible={!!profileRow}
        row={profileRow}
        peerRows={rows}
        profiles={profiles}
        sport={sport}
        colors={colors}
        variant="daily"
        onClose={() => setProfileRow(null)}
      />

      <LiveChallengePicksModal
        visible={!!picksKind}
        kind={picksKind}
        sport={sport}
        colors={colors}
        fgcChallenge={fgcChallenge}
        tpBundle={tpBundle ? { ...tpBundle, id: challengeIds.tpBundleId } : null}
        tsDefiId={challengeIds.tsDefiId}
        tsDefi={tsDefi}
        onClose={() => setPicksKind("")}
      />
    </>
  );
}
