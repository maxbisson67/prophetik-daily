import React, { useMemo } from "react";
import { View, Text, Image, ActivityIndicator } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import i18n from "@src/i18n/i18n";
import TeamLogoBadge from "@src/sports/TeamLogoBadge";
import { formatMlbHalfInningLabel } from "@src/mlb/mlbInningLabel";
import { formatMlbPlayerBroadcastName } from "@src/mlb/mlbPlayerDisplayName";
import { mlbHeadshotUrl } from "@src/mlb/mlbPlayerAssets";
import {
  battingTeamAbbrForPlay,
  groupScoringPlaysByInning,
  formatScoringParticipantNames,
  isScoringPlayHighlight,
  resolveScoringPlayBatter,
  resolveScoringPlayRbiCredit,
  resolveScoringPlayRunScorers,
  scoringPlayHeadline,
} from "@src/mlb/mlbScoringPlayDisplay";

function halfInningTitle(half, inning) {
  const label = formatMlbHalfInningLabel(half, inning);
  if (label) return label;
  return String(half || "");
}

function MlbScoringPlayHeadshot({ batterId, teamAbbr, team, colors, size = 44 }) {
  const uri = batterId ? mlbHeadshotUrl(batterId) : null;
  const badgeSize = 16;

  return (
    <View style={{ width: size, height: size, marginRight: 12 }}>
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          overflow: "hidden",
          backgroundColor: colors.card2 || colors.card,
          borderWidth: 1,
          borderColor: colors.border,
        }}
      >
        {uri ? (
          <Image source={{ uri }} style={{ width: size, height: size }} resizeMode="cover" />
        ) : teamAbbr ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <TeamLogoBadge team={team || { sport: "MLB", abbreviation: teamAbbr }} size={size - 12} colors={colors} />
          </View>
        ) : (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <MaterialCommunityIcons name="baseball-bat" size={20} color={colors.subtext} />
          </View>
        )}
      </View>

      {teamAbbr ? (
        <View
          style={{
            position: "absolute",
            right: -2,
            bottom: -2,
            width: badgeSize,
            height: badgeSize,
            borderRadius: badgeSize / 2,
            backgroundColor: colors.card,
            borderWidth: 1,
            borderColor: colors.border,
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
          }}
        >
          <TeamLogoBadge team={team || { sport: "MLB", abbreviation: teamAbbr }} size={badgeSize - 4} colors={colors} />
        </View>
      ) : null}
    </View>
  );
}

function MlbScoringPlayScoreColumn({ game, play, colors, teamForAbbr }) {
  const awayAbbr = game?.awayAbbr;
  const homeAbbr = game?.homeAbbr;
  const battingAbbr = battingTeamAbbrForPlay(play, game);
  const awayTeam = awayAbbr ? teamForAbbr?.(awayAbbr) : null;
  const homeTeam = homeAbbr ? teamForAbbr?.(homeAbbr) : null;

  if (play?.awayScore == null && play?.homeScore == null) return null;

  const scoreFor = (abbr) => {
    const isBatting =
      battingAbbr && String(abbr || "").toUpperCase() === String(battingAbbr).toUpperCase();
    return {
      color: isBatting ? colors.text : colors.subtext,
      weight: isBatting ? "900" : "700",
    };
  };

  const awayStyle = scoreFor(awayAbbr);
  const homeStyle = scoreFor(homeAbbr);

  return (
    <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 12, marginLeft: 8 }}>
      <View style={{ alignItems: "center", minWidth: 28 }}>
        <TeamLogoBadge team={awayTeam || { sport: "MLB", abbreviation: awayAbbr }} size={20} colors={colors} />
        <Text
          style={{
            color: awayStyle.color,
            fontWeight: awayStyle.weight,
            fontSize: 16,
            marginTop: 4,
            fontVariant: ["tabular-nums"],
          }}
        >
          {play.awayScore ?? "—"}
        </Text>
      </View>
      <View style={{ alignItems: "center", minWidth: 28 }}>
        <TeamLogoBadge team={homeTeam || { sport: "MLB", abbreviation: homeAbbr }} size={20} colors={colors} />
        <Text
          style={{
            color: homeStyle.color,
            fontWeight: homeStyle.weight,
            fontSize: 16,
            marginTop: 4,
            fontVariant: ["tabular-nums"],
          }}
        >
          {play.homeScore ?? "—"}
        </Text>
      </View>
    </View>
  );
}

function MlbScoringPlayParticipants({ play, colors }) {
  const runScorers = resolveScoringPlayRunScorers(play);
  const rbiCredit = resolveScoringPlayRbiCredit(play);

  const runsLine =
    runScorers.length > 0
      ? i18n.t("live.mlb.scoringRunsLine", {
          defaultValue: "Points : {{names}}",
          names: formatScoringParticipantNames(runScorers, formatMlbPlayerBroadcastName),
        })
      : null;

  const rbiLine = rbiCredit?.name
    ? i18n.t("live.mlb.scoringRbiLine", {
        defaultValue: "RBI : {{name}} ({{count}})",
        name: formatMlbPlayerBroadcastName(rbiCredit.name),
        count: rbiCredit.count,
      })
    : null;

  if (!runsLine && !rbiLine) return null;

  return (
    <View style={{ marginTop: 8, gap: 2 }}>
      {runsLine ? (
        <Text style={{ color: colors.text, fontSize: 12, fontWeight: "700" }} numberOfLines={2}>
          {runsLine}
        </Text>
      ) : null}
      {rbiLine ? (
        <Text style={{ color: colors.subtext, fontSize: 12, fontWeight: "600" }} numberOfLines={1}>
          {rbiLine}
        </Text>
      ) : null}
    </View>
  );
}

function MlbScoringPlayCard({ play, game, colors, teamForAbbr }) {
  const battingAbbr = battingTeamAbbrForPlay(play, game);
  const battingTeam = battingAbbr ? teamForAbbr?.(battingAbbr) : null;
  const { batterId, batterName } = resolveScoringPlayBatter(play);
  const headline = scoringPlayHeadline(play);
  const highlight = isScoringPlayHighlight(play);
  const displayName = batterName ? formatMlbPlayerBroadcastName(batterName) : null;

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "flex-start",
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.card,
        marginBottom: 8,
      }}
    >
      <MlbScoringPlayHeadshot
        batterId={batterId}
        teamAbbr={battingAbbr}
        team={battingTeam}
        colors={colors}
      />

      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
          <View style={{ flex: 1, minWidth: 0, paddingRight: 8 }}>
            {displayName ? (
              <Text style={{ color: colors.text, fontWeight: "800", fontSize: 15 }} numberOfLines={1}>
                {displayName}
              </Text>
            ) : null}
            <Text
              style={{
                color: highlight ? "#dc2626" : colors.primary || colors.text,
                fontWeight: "800",
                fontSize: 13,
                marginTop: displayName ? 2 : 0,
              }}
              numberOfLines={2}
            >
              {headline}
            </Text>
          </View>

          <MlbScoringPlayScoreColumn game={game} play={play} colors={colors} teamForAbbr={teamForAbbr} />
        </View>

        <MlbScoringPlayParticipants play={play} colors={colors} />

        {play?.description ? (
          <Text
            style={{
              color: colors.subtext,
              fontSize: 12,
              lineHeight: 18,
              marginTop: 8,
            }}
          >
            {play.description}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

export default function MlbScoringSummary({ game, plays = [], loading = false, colors, teamForAbbr }) {
  const playGroups = useMemo(() => groupScoringPlaysByInning(plays), [plays]);

  return (
    <View>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          marginBottom: 12,
        }}
      >
        <MaterialCommunityIcons name="scoreboard-outline" size={18} color={colors.primary || colors.text} />
        <Text style={{ color: colors.text, fontWeight: "800", fontSize: 16 }}>
          {i18n.t("live.mlb.scoringSummary", { defaultValue: "Résumé du pointage" })}
        </Text>
        {!loading && plays.length > 0 ? (
          <View
            style={{
              marginLeft: "auto",
              backgroundColor: colors.card2 || colors.card,
              paddingHorizontal: 8,
              paddingVertical: 4,
              borderRadius: 999,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Text style={{ color: colors.subtext, fontWeight: "700", fontSize: 11 }}>
              {plays.length}
            </Text>
          </View>
        ) : null}
      </View>

      {loading ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 12 }}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={{ color: colors.subtext }}>
            {i18n.t("live.mlb.loadingPlays", "Chargement des actions…")}
          </Text>
        </View>
      ) : plays.length === 0 ? (
        <View
          style={{
            padding: 16,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.card,
            alignItems: "center",
          }}
        >
          <MaterialCommunityIcons name="baseball-bat" size={28} color={colors.subtext} />
          <Text style={{ color: colors.subtext, textAlign: "center", marginTop: 8 }}>
            {i18n.t("live.mlb.noScoringPlays", "Aucune action marquante pour le moment.")}
          </Text>
        </View>
      ) : (
        playGroups.map((group) => {
          const inningTitle = halfInningTitle(group.halfInning, group.inning);

          return (
            <View key={`${group.inning}-${group.halfInning}`} style={{ marginBottom: 16 }}>
              <Text
                style={{
                  color: colors.subtext,
                  fontWeight: "800",
                  fontSize: 12,
                  letterSpacing: 0.4,
                  marginBottom: 8,
                }}
              >
                {inningTitle}
              </Text>

              {group.plays.map((play) => (
                <MlbScoringPlayCard
                  key={play.id}
                  play={play}
                  game={game}
                  colors={colors}
                  teamForAbbr={teamForAbbr}
                />
              ))}
            </View>
          );
        })
      )}
    </View>
  );
}
