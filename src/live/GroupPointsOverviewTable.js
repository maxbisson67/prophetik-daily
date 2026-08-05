import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import i18n from "@src/i18n/i18n";
import ParticipantAvatar from "@src/ui/ParticipantAvatar";
import LiveChallengeKindBadge, { LIVE_BADGE_ACCENTS } from "@src/live/LiveChallengeKindBadge";

const STAT_COL_WIDTH = 42;
const TS_COL_WIDTH = 46;
const JERSEY_COL_WIDTH = 32;

function StatCell({ value, colors, accent, bold }) {
  const v = Number(value) || 0;
  const hasPoints = v > 0;

  return (
    <Text
      style={{
        color: hasPoints
          ? bold
            ? colors.text
            : accent || colors.text
          : bold
          ? colors.text
          : colors.subtext,
        fontWeight: bold ? "900" : "700",
        fontSize: bold ? 14 : 13,
        textAlign: "center",
        fontVariant: ["tabular-nums"],
      }}
    >
      {String(v)}
    </Text>
  );
}

function TsBonusSuperscript({ bonus, colors }) {
  return (
    <View style={{ transform: [{ translateY: -7 }] }}>
      <Text
        style={{
          fontSize: 9,
          fontWeight: "900",
          color: colors.subtext,
          lineHeight: 10,
          includeFontPadding: false,
        }}
      >
        +{bonus}
      </Text>
    </View>
  );
}

function TotalStatCell({ row, colors }) {
  const total = Number(row.totalPoints) || 0;
  const bonus = Number(row.dailyBonusPoints) || 0;
  const base = bonus > 0 ? Math.max(0, total - bonus) : total;
  const hasPoints = total > 0 || bonus > 0;

  if (bonus > 0) {
    return (
      <View
        style={{
          flexDirection: "row",
          alignItems: "flex-start",
          justifyContent: "center",
        }}
      >
        <Text
          style={{
            fontVariant: ["tabular-nums"],
            color: hasPoints ? colors.text : colors.subtext,
            fontWeight: "900",
            fontSize: 14,
            lineHeight: 16,
            includeFontPadding: false,
          }}
        >
          {String(base)}
        </Text>
        <TsBonusSuperscript bonus={bonus} colors={colors} />
      </View>
    );
  }

  return <StatCell value={total} colors={colors} bold />;
}

function TsStatCell({ row, colors }) {
  const accent = LIVE_BADGE_ACCENTS.ts;
  const total = Number(row.tsPoints) || 0;
  const live = Number(row.tsLivePoints) || 0;
  const value = row?.tsFinalized ? total : live;
  return <StatCell value={value} colors={colors} accent={accent} />;
}

export default function GroupPointsOverviewTable({
  rows = [],
  league = "NHL",
  colors,
  currentUid = "",
  resolveMember,
  embedded = false,
  onParticipantPress = null,
  onChallengeKindPress = null,
}) {
  const t = i18n.t.bind(i18n);

  const tableBody = (
    <>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingVertical: 8,
          paddingHorizontal: 8,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
          gap: 4,
        }}
      >
        <View style={{ width: JERSEY_COL_WIDTH }} />
        <View style={{ flex: 1.55, minWidth: 0, paddingRight: 4 }}>
          <Text style={{ color: colors.subtext, fontSize: 10, fontWeight: "800" }}>
            {t("leaderboard.columns.player", { defaultValue: "Joueur" })}
          </Text>
        </View>
        <View style={{ width: STAT_COL_WIDTH, alignItems: "center" }}>
          <LiveChallengeKindBadge
            kind="fgc"
            sport={league}
            colors={colors}
            tableHeader
            onPress={onChallengeKindPress ? () => onChallengeKindPress("fgc") : null}
          />
        </View>
        <View style={{ width: STAT_COL_WIDTH, alignItems: "center" }}>
          <LiveChallengeKindBadge
            kind="tp"
            sport={league}
            colors={colors}
            tableHeader
            onPress={onChallengeKindPress ? () => onChallengeKindPress("tp") : null}
          />
        </View>
        <View style={{ width: TS_COL_WIDTH, alignItems: "center" }}>
          <LiveChallengeKindBadge
            kind="ts"
            sport={league}
            colors={colors}
            tableHeader
            onPress={onChallengeKindPress ? () => onChallengeKindPress("ts") : null}
          />
        </View>
        <View style={{ width: STAT_COL_WIDTH, alignItems: "center" }}>
          <Text style={{ color: colors.subtext, fontSize: 10, fontWeight: "800" }}>
            {t("leaderboard.columns.total", { defaultValue: "Total" })}
          </Text>
        </View>
      </View>

      {rows.map((row, idx) => {
        const member = resolveMember(row);
        const isMe = currentUid && String(row.uid) === String(currentUid);
        const version = member.updatedAt?.toMillis?.() ? member.updatedAt.toMillis() : 0;
        const openProfile = onParticipantPress ? () => onParticipantPress(row) : null;

        return (
          <View
            key={row.uid}
            style={{
              flexDirection: "row",
              alignItems: "center",
              paddingVertical: 10,
              paddingHorizontal: 8,
              borderBottomWidth: idx === rows.length - 1 ? 0 : 1,
              borderBottomColor: colors.border,
              backgroundColor: isMe ? colors.rowAlt : idx % 2 ? colors.rowAlt : colors.card,
              gap: 4,
            }}
          >
            <TouchableOpacity
              disabled={!openProfile}
              onPress={openProfile}
              activeOpacity={openProfile ? 0.75 : 1}
              style={{ width: JERSEY_COL_WIDTH, alignItems: "center" }}
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
            </TouchableOpacity>

            <TouchableOpacity
              disabled={!openProfile}
              onPress={openProfile}
              activeOpacity={openProfile ? 0.75 : 1}
              style={{ flex: 1.55, minWidth: 0, paddingRight: 4, justifyContent: "center" }}
            >
              <Text
                style={{
                  color: openProfile ? (isMe ? colors.primary : colors.text) : isMe ? colors.primary : colors.text,
                  fontWeight: "800",
                  fontSize: 13,
                }}
                numberOfLines={2}
              >
                {member.displayName}
              </Text>
            </TouchableOpacity>

            <View style={{ width: STAT_COL_WIDTH, alignItems: "center" }}>
              <StatCell value={row.fgcPoints} colors={colors} accent={LIVE_BADGE_ACCENTS.fgc} />
            </View>
            <View style={{ width: STAT_COL_WIDTH, alignItems: "center" }}>
              <StatCell value={row.tpPoints} colors={colors} accent={LIVE_BADGE_ACCENTS.tp} />
            </View>
            <View style={{ width: TS_COL_WIDTH, alignItems: "center" }}>
              <TsStatCell row={row} colors={colors} />
            </View>
            <View style={{ width: STAT_COL_WIDTH, alignItems: "center" }}>
              <TotalStatCell row={row} colors={colors} />
            </View>
          </View>
        );
      })}
    </>
  );

  if (embedded) return tableBody;

  return (
    <View
      style={{
        borderRadius: 16,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.card,
        overflow: "hidden",
      }}
    >
      {tableBody}
    </View>
  );
}
