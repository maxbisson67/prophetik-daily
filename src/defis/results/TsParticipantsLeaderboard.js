import React from "react";
import { View, Text, Image } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import i18n from "@src/i18n/i18n";
import TeamLogoBadge from "@src/sports/TeamLogoBadge";
import { lookupTeamByAbbr } from "@src/groups/data/fallbackTeams";
import { resolveDefiHeadshotUrl } from "@src/mlb/mlbPlayerAssets";
import {
  buildParticipantPickRows,
  formatPickStatLine,
  resolveTsHideOthersPicks,
} from "./tsResultsUtils";

function TsPlayerHeadshot({ sport, teamAbbr, playerId, colors, size = 28 }) {
  const uri = resolveDefiHeadshotUrl(sport, teamAbbr, playerId);
  const league = String(sport || "NHL").toUpperCase();

  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: colors.card2,
        }}
      />
    );
  }

  if (league === "MLB") {
    const team = lookupTeamByAbbr("MLB", teamAbbr);
    return <TeamLogoBadge team={{ ...team, sport: "MLB", abbreviation: teamAbbr }} size={size - 8} colors={colors} />;
  }

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: colors.border,
      }}
    />
  );
}

const MLB_STAT_COL_WIDTH = 44;
const HEADSHOT_SIZE_DEFAULT = 28;
const HEADSHOT_SIZE_COMPACT = 26;
const HEADSHOT_MARGIN_RIGHT = 10;
const TEAM_LOGO_SIZE_DEFAULT = 18;
const TEAM_LOGO_SIZE_COMPACT = 16;
const AVATAR_LOGO_GAP = 4;
const NAME_MARGIN_RIGHT = 8;

function resolvePickTeam(sport, teamAbbr) {
  const league = String(sport || "NHL").toUpperCase();
  const abbr = String(teamAbbr || "").trim().toUpperCase();
  if (!abbr) return null;
  const team = lookupTeamByAbbr(league, abbr);
  if (!team) return null;
  return { ...team, sport: league, abbreviation: abbr };
}

function avatarWithTeamSlotWidth(compact = false) {
  const headshotSize = compact ? HEADSHOT_SIZE_COMPACT : HEADSHOT_SIZE_DEFAULT;
  const logoSize = compact ? TEAM_LOGO_SIZE_COMPACT : TEAM_LOGO_SIZE_DEFAULT;
  return headshotSize + AVATAR_LOGO_GAP + logoSize + HEADSHOT_MARGIN_RIGHT;
}

function TsPlayerAvatarWithTeam({ sport, teamAbbr, playerId, colors, compact = false }) {
  const headshotSize = compact ? HEADSHOT_SIZE_COMPACT : HEADSHOT_SIZE_DEFAULT;
  const logoSize = compact ? TEAM_LOGO_SIZE_COMPACT : TEAM_LOGO_SIZE_DEFAULT;
  const team = resolvePickTeam(sport, teamAbbr);

  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: AVATAR_LOGO_GAP }}>
      <TsPlayerHeadshot
        sport={sport}
        teamAbbr={teamAbbr}
        playerId={playerId}
        colors={colors}
        size={headshotSize}
      />
      {team ? <TeamLogoBadge team={team} size={logoSize} colors={colors} /> : null}
    </View>
  );
}

function headshotSlotWidth(compact = false) {
  return avatarWithTeamSlotWidth(compact);
}

function MlbPickColumnsHeader({ colors, compact = false }) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingTop: 2,
        paddingBottom: 6,
      }}
    >
      <View style={{ width: headshotSlotWidth(compact) }} />
      <View style={{ flex: 1, marginRight: NAME_MARGIN_RIGHT }} />
      {["H", "RBI", "HR"].map((col) => (
        <Text
          key={col}
          style={{
            width: MLB_STAT_COL_WIDTH,
            textAlign: "center",
            color: colors.subtext,
            fontWeight: "900",
            fontSize: 11,
          }}
        >
          {col}
        </Text>
      ))}
    </View>
  );
}

function PickRow({ row, sport, isMlbTs, colors, compact = false }) {
  if (isMlbTs) {
    const hits = Number(row?.goals) || 0;
    const rbi = Number(row?.assists) || 0;
    const hr = Number(row?.homeRuns) || 0;

    return (
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingVertical: compact ? 4 : 6,
        }}
      >
        <View
          style={{
            width: headshotSlotWidth(compact) - HEADSHOT_MARGIN_RIGHT,
            marginRight: HEADSHOT_MARGIN_RIGHT,
          }}
        >
          <TsPlayerAvatarWithTeam
            sport={sport}
            teamAbbr={row.teamAbbr}
            playerId={row.playerId}
            colors={colors}
            compact={compact}
          />
        </View>
        <Text
          numberOfLines={1}
          style={{
            flex: 1,
            color: colors.text,
            fontSize: compact ? 13 : 14,
            fontWeight: "600",
            marginRight: NAME_MARGIN_RIGHT,
          }}
        >
          {row.playerName}
        </Text>
        {[hits, rbi, hr].map((value, index) => (
          <Text
            key={index}
            style={{
              width: MLB_STAT_COL_WIDTH,
              textAlign: "center",
              fontWeight: "800",
              color: colors.text,
              fontVariant: ["tabular-nums"],
              fontSize: compact ? 12 : 13,
            }}
          >
            {value}
          </Text>
        ))}
      </View>
    );
  }

  const statLabel = formatPickStatLine(row, isMlbTs);

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: compact ? 4 : 6,
      }}
    >
      <View
        style={{
          width: headshotSlotWidth(compact) - HEADSHOT_MARGIN_RIGHT,
          marginRight: 10,
        }}
      >
        <TsPlayerAvatarWithTeam
          sport={sport}
          teamAbbr={row.teamAbbr}
          playerId={row.playerId}
          colors={colors}
          compact={compact}
        />
      </View>
      <Text
        numberOfLines={1}
        style={{
          flex: 1,
          color: colors.text,
          fontSize: compact ? 13 : 14,
          fontWeight: "600",
          marginRight: 10,
        }}
      >
        {row.playerName}
      </Text>
      <Text
        style={{
          minWidth: 86,
          textAlign: "right",
          fontWeight: "800",
          color: colors.text,
          fontVariant: ["tabular-nums"],
          fontSize: compact ? 12 : 13,
        }}
      >
        {statLabel}
      </Text>
    </View>
  );
}

function ParticipantBlock({
  entry,
  name,
  photoURL,
  colors,
  liveStats,
  playerMap,
  isMlbTs,
  sport,
  isSelf = false,
  compact = false,
  hidePicks = false,
}) {
  const picks = Array.isArray(entry?.picks) ? entry.picks : [];
  const rows = buildParticipantPickRows({
    picks,
    liveStats,
    playerMap,
    isMlbTs,
  });

  return (
    <View
      style={{
        paddingVertical: compact ? 8 : 12,
        paddingHorizontal: compact ? 8 : 10,
        backgroundColor: isSelf ? colors.card2 : colors.card,
        borderWidth: 1,
        borderColor: isSelf ? colors.primary : colors.border,
        borderRadius: 12,
        marginBottom: compact ? 8 : 12,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", marginBottom: hidePicks ? 0 : 8 }}>
        {photoURL ? (
          <Image
            source={{ uri: photoURL }}
            style={{
              width: compact ? 36 : 44,
              height: compact ? 36 : 44,
              borderRadius: compact ? 18 : 22,
              marginRight: 10,
              backgroundColor: colors.card2,
            }}
          />
        ) : (
          <View
            style={{
              width: compact ? 36 : 44,
              height: compact ? 36 : 44,
              borderRadius: compact ? 18 : 22,
              marginRight: 10,
              backgroundColor: colors.border,
            }}
          />
        )}
        <View style={{ flex: 1 }}>
          <Text numberOfLines={1} style={{ fontWeight: "700", color: colors.text }}>
            {name}
          </Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <MaterialCommunityIcons name="star-circle" size={compact ? 18 : 22} color={colors.text} />
          <Text style={{ fontSize: compact ? 18 : 20, fontWeight: "800", color: colors.text }}>
            {Number(entry?.livePoints || 0).toFixed(0)}
          </Text>
        </View>
      </View>

      {!hidePicks ? (
        <View>
          {isMlbTs && rows.length > 0 ? (
            <MlbPickColumnsHeader colors={colors} compact={compact} />
          ) : null}
          {rows.map((row) => (
            <PickRow
              key={row.playerId}
              row={row}
              sport={sport}
              isMlbTs={isMlbTs}
              colors={colors}
              compact={compact}
            />
          ))}
        </View>
      ) : (
        <Text style={{ color: colors.subtext, fontStyle: "italic", marginTop: 4 }}>
          {i18n.t("defi.results.participants.hiddenSelections")}
        </Text>
      )}
    </View>
  );
}

export default function TsParticipantsLeaderboard({
  leaderboard = [],
  namesMap = {},
  participantInfoMap = {},
  colors,
  liveStats,
  playerMap,
  currentUid,
  hideOthersPicks = false,
  revealTimeLabel = null,
  isMlbTs = false,
  sport = "NHL",
  compact = false,
  maxOthers = null,
}) {
  if (!Array.isArray(leaderboard) || leaderboard.length === 0) {
    return (
      <Text style={{ color: colors.subtext, textAlign: "center" }}>
        {i18n.t("defi.results.participants.empty")}
      </Text>
    );
  }

  const myEntry = currentUid ? leaderboard.find((r) => r.uid === currentUid) : null;
  const others = leaderboard.filter((r) => r.uid !== currentUid);
  const othersLimit = maxOthers != null ? others.slice(0, maxOthers) : others;
  const fullList = compact ? null : leaderboard;

  const containerStyle = compact
    ? {}
    : {
        marginHorizontal: 16,
        marginBottom: 12,
        padding: 12,
        borderWidth: 1,
        borderRadius: 12,
        backgroundColor: colors.card,
        borderColor: colors.border,
      };

  return (
    <View style={containerStyle}>
      {hideOthersPicks && revealTimeLabel ? (
        <Text style={{ fontSize: 12, color: colors.subtext, textAlign: "center", marginBottom: 8 }}>
          {i18n.t("defi.results.participants.hiddenUntil", { time: revealTimeLabel })}
        </Text>
      ) : null}

      {!isMlbTs ? (
        <View style={{ alignItems: "center", marginBottom: compact ? 6 : 8 }}>
          <Text style={{ fontSize: 12, color: colors.subtext }}>
            {i18n.t("defi.results.participants.legend")}
          </Text>
        </View>
      ) : null}

      {compact && myEntry ? (
        <ParticipantBlock
          entry={myEntry}
          name={namesMap[myEntry.uid] || myEntry.uid}
          photoURL={participantInfoMap[myEntry.uid]?.photoURL || null}
          colors={colors}
          liveStats={liveStats}
          playerMap={playerMap}
          isMlbTs={isMlbTs}
          sport={sport}
          isSelf
          compact={compact}
          hidePicks={false}
        />
      ) : null}

      {!compact && fullList
        ? fullList.map((entry) => {
            const hidePicks = hideOthersPicks && entry.uid !== currentUid;
            return (
              <ParticipantBlock
                key={entry.uid}
                entry={entry}
                name={namesMap[entry.uid] || entry.uid}
                photoURL={participantInfoMap[entry.uid]?.photoURL || null}
                colors={colors}
                liveStats={liveStats}
                playerMap={playerMap}
                isMlbTs={isMlbTs}
                sport={sport}
                isSelf={entry.uid === currentUid}
                compact={compact}
                hidePicks={hidePicks}
              />
            );
          })
        : null}

      {compact && othersLimit.length > 0 ? (
        <View
          style={{
            padding: 8,
            borderRadius: 10,
            backgroundColor: colors.card2,
            borderWidth: 1,
            borderColor: colors.border,
            gap: 4,
          }}
        >
          <Text style={{ color: colors.subtext, fontWeight: "800", fontSize: 12, marginBottom: 4 }}>
            {i18n.t("challenges.tsLiveTop", { defaultValue: "Classement" })}
          </Text>
          {othersLimit.map((entry) => {
            const hidePicks = hideOthersPicks && entry.uid !== currentUid;
            if (hidePicks) {
              return (
                <View key={entry.uid} style={{ flexDirection: "row", alignItems: "center", paddingVertical: 2 }}>
                  <Text style={{ width: 24, color: colors.subtext, fontWeight: "900" }}>{entry.rank}.</Text>
                  <Text style={{ flex: 1, color: colors.text, fontWeight: "700" }} numberOfLines={1}>
                    {namesMap[entry.uid] || entry.uid}
                  </Text>
                  <Text style={{ color: colors.text, fontWeight: "900" }}>
                    {Number(entry.livePoints || 0).toFixed(0)}
                  </Text>
                </View>
              );
            }
            return (
              <ParticipantBlock
                key={entry.uid}
                entry={entry}
                name={namesMap[entry.uid] || entry.uid}
                photoURL={participantInfoMap[entry.uid]?.photoURL || null}
                colors={colors}
                liveStats={liveStats}
                playerMap={playerMap}
                isMlbTs={isMlbTs}
                sport={sport}
                compact
              />
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

export { PickRow, ParticipantBlock, TsPlayerHeadshot, TsPlayerAvatarWithTeam };
