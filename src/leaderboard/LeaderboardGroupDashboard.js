import React, { useMemo, useState } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import i18n from "@src/i18n/i18n";
import SportGlyph from "@src/sports/SportGlyph";
import LiveChallengeKindBadge, { LIVE_BADGE_ACCENTS } from "@src/live/LiveChallengeKindBadge";
import LeaderboardRankBadge from "./LeaderboardRankBadge";
import ParticipantAvatar from "@src/ui/ParticipantAvatar";
import useLeaderboardProfiles, {
  resolveLeaderboardMember,
} from "./useLeaderboardProfiles";
import {
  deriveTpExactCount,
  fgcDisplayPoints,
  isMlbSport,
} from "./leaderboardDashboardHelpers";

function formatPts(n) {
  const v = Number(n) || 0;
  return `${v.toLocaleString("fr-FR")} pts`;
}

function cardStyle(colors, accent) {
  return {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 16,
    overflow: "hidden",
    borderLeftWidth: 4,
    borderLeftColor: accent,
  };
}

function SectionHeader({ leading, title, subtitle, colors }) {
  return (
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
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        {leading || null}
        <Text style={{ color: colors.text, fontWeight: "900", fontSize: 16, flex: 1 }}>{title}</Text>
      </View>
      {subtitle ? (
        <Text style={{ color: colors.subtext, fontSize: 12, marginTop: 4, fontWeight: "600" }}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

function playerColumnFlex(columns) {
  return columns[0]?.flex ?? 1.4;
}

function ColumnHeader({ columns, colors }) {
  const nameFlex = playerColumnFlex(columns);

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
      }}
    >
      <View style={{ width: 36 }} />
      <View style={{ flex: nameFlex, minWidth: 0, paddingRight: 6 }}>
        <Text style={{ color: colors.subtext, fontSize: 11, fontWeight: "800" }}>
          {columns[0]?.label || ""}
        </Text>
      </View>
      {columns.slice(1).map((col) => (
        <View
          key={col.key}
          style={{
            flex: col.flex || 1,
            minWidth: 0,
            alignItems: col.align || "center",
          }}
        >
          <Text
            style={{
              color: colors.subtext,
              fontSize: col.headerSize || 10,
              fontWeight: "800",
              textAlign: col.align === "right" ? "right" : "center",
            }}
            numberOfLines={2}
          >
            {col.label}
          </Text>
        </View>
      ))}
    </View>
  );
}

function ChallengeCard({
  sport,
  challengeKind,
  title,
  accent,
  rows,
  columns,
  sortValue,
  hasActivity,
  colors,
  profiles,
  onParticipantPress,
  emptyText,
  t,
}) {
  const [showAll, setShowAll] = useState(false);

  const sorted = useMemo(() => {
    const copy = [...(rows || [])];
    copy.sort((a, b) => Number(sortValue(b) ?? 0) - Number(sortValue(a) ?? 0));
    return copy.filter((row) => hasActivity(row));
  }, [rows, sortValue, hasActivity]);

  const visibleRows = showAll ? sorted : sorted.slice(0, 5);
  const hasMore = sorted.length > 5;

  return (
    <View style={[cardStyle(colors, accent), { marginBottom: 16 }]}>
      <SectionHeader
        leading={
          challengeKind ? (
            <LiveChallengeKindBadge
              kind={challengeKind}
              colors={colors}
              sport={sport}
              compact
            />
          ) : null
        }
        title={title}
        colors={colors}
      />
      <ColumnHeader columns={columns} colors={colors} />
      <RankedRows
        rows={visibleRows}
        colors={colors}
        columns={columns}
        accent={accent}
        profiles={profiles}
        onParticipantPress={onParticipantPress}
        emptyText={emptyText}
      />
      {hasMore ? (
        <TouchableOpacity
          onPress={() => setShowAll((v) => !v)}
          activeOpacity={0.85}
          style={{
            paddingVertical: 12,
            paddingHorizontal: 14,
            borderTopWidth: 1,
            borderTopColor: colors.border,
            alignItems: "flex-end",
          }}
        >
          <Text style={{ color: colors.primary, fontWeight: "900", fontSize: 13 }}>
            {showAll
              ? t("leaderboard.actions.showLess")
              : t("leaderboard.actions.showAll")}
          </Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

function RankedRows({
  rows,
  colors,
  columns,
  accent,
  profiles,
  onParticipantPress,
  emptyText,
}) {
  if (!rows?.length) {
    return (
      <View style={{ padding: 20, alignItems: "center" }}>
        <Text style={{ color: colors.subtext, fontWeight: "700" }}>{emptyText}</Text>
      </View>
    );
  }

  const nameFlex = playerColumnFlex(columns);
  const compactStats = columns.length > 3;
  const avatarSize = compactStats ? 26 : 30;

  return rows.map((row, idx) => {
    const member = resolveLeaderboardMember(row, profiles);
    const version = member.updatedAt?.toMillis?.() ? member.updatedAt.toMillis() : 0;
    const rank = idx + 1;
    const rowStyle = {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderBottomWidth: idx === rows.length - 1 ? 0 : 1,
      borderBottomColor: colors.border,
      backgroundColor: idx % 2 ? colors.rowAlt : colors.card,
    };

    const openProfile = onParticipantPress
      ? () => onParticipantPress(row)
      : null;

    return (
      <View key={`${row.id}:${idx}`} style={rowStyle}>
        <View style={{ width: 36, alignItems: "center" }}>
          <LeaderboardRankBadge rank={rank} colors={colors} size={26} />
        </View>

        <View style={{ flex: nameFlex, minWidth: 0, flexDirection: "row", alignItems: "center", paddingRight: 6 }}>
          <TouchableOpacity
            disabled={!openProfile}
            activeOpacity={openProfile ? 0.75 : 1}
            onPress={openProfile}
            hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
          >
            <View style={{ marginRight: compactStats ? 6 : 8, flexShrink: 0 }}>
            <ParticipantAvatar
              photoURL={member.avatarUrl || member.jerseyFrontUrl}
              avatarUrl={member.avatarUrl}
              jerseyFrontUrl={member.jerseyFrontUrl}
              jerseyBackUrl={member.jerseyBackUrl}
              avatarKind={member.avatarKind}
              name={member.displayName}
              size={avatarSize}
              colors={colors}
              version={version}
            />
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            disabled={!openProfile}
            activeOpacity={openProfile ? 0.75 : 1}
            onPress={openProfile}
            style={{ flex: 1, minWidth: 0 }}
          >
            <Text
              style={{
                color: openProfile ? colors.primary : colors.text,
                fontWeight: "800",
                flex: 1,
                minWidth: 0,
                fontSize: compactStats ? 12 : 14,
                lineHeight: compactStats ? 15 : 18,
              }}
              numberOfLines={compactStats ? 2 : 1}
              ellipsizeMode="tail"
            >
              {member.displayName}
            </Text>
          </TouchableOpacity>
        </View>

        {columns.slice(1).map((col) => {
          const content = col.render ? col.render(row, { accent, colors }) : row?.[col.key];

          return (
            <View
              key={col.key}
              style={{
                flex: col.flex || 1,
                minWidth: 0,
                alignItems:
                  col.align === "right"
                    ? "flex-end"
                    : col.align === "left"
                    ? "flex-start"
                    : "center",
              }}
            >
              {React.isValidElement(content) ? (
                content
              ) : (
                <Text
                  style={{
                    color: col.color || colors.text,
                    fontWeight: col.bold ? "900" : "700",
                    fontSize: col.small ? 11 : compactStats ? 12 : 14,
                    textAlign: col.align === "right" ? "right" : "center",
                  }}
                  numberOfLines={1}
                  adjustsFontSizeToFit={compactStats}
                  minimumFontScale={0.85}
                >
                  {content ?? "—"}
                </Text>
              )}
            </View>
          );
        })}
      </View>
    );
  });
}

function buildChallengeColumns({ t, accent, variant }) {
  const statColumn = (key, label, render, options = {}) => ({
    key,
    label,
    flex: options.flex ?? 1,
    headerSize: options.headerSize,
    align: options.align,
    render,
    color: accent,
    bold: true,
    small: options.small,
  });

  if (variant === "fgc") {
    return [
      { key: "player", label: t("leaderboard.columns.player"), flex: 1.8 },
      statColumn("successes", t("leaderboard.columns.successesShort", { defaultValue: "Réuss." }), (row) =>
        String(Number(row?.fgcWins ?? 0) || 0),
        { flex: 0.75 }
      ),
      statColumn("points", t("leaderboard.columns.pointsShort", { defaultValue: "Pts" }), (row) =>
        String(fgcDisplayPoints(row)),
        { flex: 0.75 }
      ),
    ];
  }

  if (variant === "tp") {
    return [
      { key: "player", label: t("leaderboard.columns.player"), flex: 2.2 },
      statColumn("successes", t("leaderboard.columns.successesShort", { defaultValue: "Réuss." }), (row) =>
        String(Number(row?.tpWins ?? 0) || 0),
        { flex: 0.55, small: true }
      ),
      statColumn("exacts", t("leaderboard.columns.exactsShort", { defaultValue: "Exact." }), (row) =>
        String(deriveTpExactCount(row)),
        { flex: 0.55, small: true }
      ),
      statColumn("points", t("leaderboard.columns.pointsShort", { defaultValue: "Pts" }), (row) =>
        String(Number(row?.tpPoints ?? 0) || 0),
        { flex: 0.55, small: true }
      ),
    ];
  }

  return [
    { key: "player", label: t("leaderboard.columns.player"), flex: 1.8 },
    statColumn("victories", t("leaderboard.columns.victoriesShort", { defaultValue: "Vict." }), (row) =>
      String(Number(row?.tsWins ?? 0) || 0),
      { flex: 0.75 }
    ),
    statColumn("points", t("leaderboard.columns.pointsShort", { defaultValue: "Pts" }), (row) =>
      String(Number(row?.tsPoints ?? 0) || 0),
      { flex: 0.75 }
    ),
  ];
}

export default function LeaderboardGroupDashboard({
  rows,
  colors,
  sport,
  profiles: profilesProp,
  onParticipantPress,
  emptyText,
}) {
  const t = i18n.t.bind(i18n);
  const [showAllTotals, setShowAllTotals] = useState(false);
  const mlb = isMlbSport(sport);

  const normalizedRows = rows || [];
  const uids = useMemo(() => normalizedRows.map((r) => String(r.id)), [normalizedRows]);
  const profilesInternal = useLeaderboardProfiles(uids);
  const profiles = profilesProp || profilesInternal;

  const sectionTitles = useMemo(
    () => ({
      fgc: mlb
        ? t("leaderboard.sections.fgcMlb", { defaultValue: "Premier point produit" })
        : t("leaderboard.sections.fgcNhl", { defaultValue: "Premier but" }),
      tp: t("leaderboard.sections.tp", { defaultValue: "Prédire l'issue du match" }),
      ts: t("leaderboard.sections.ts", { defaultValue: "Trio du jour" }),
    }),
    [mlb, t]
  );

  const emptyTexts = useMemo(
    () => ({
      fgc: mlb
        ? t("leaderboard.challenge.noStats.fgcMlb", {
            defaultValue: "Aucune donnée Premier point produit pour cette compétition.",
          })
        : t("leaderboard.challenge.noStats.fgcNhl", {
            defaultValue: "Aucune donnée Premier but pour cette compétition.",
          }),
      tp: t("leaderboard.challenge.noStats.tp", {
        defaultValue: "Aucune donnée Prédire l'issue du match pour cette compétition.",
      }),
      ts: t("leaderboard.challenge.noStats.ts", {
        defaultValue: "Aucune donnée Trio du jour pour cette compétition.",
      }),
    }),
    [mlb, t]
  );

  const totalsSorted = useMemo(() => {
    const copy = [...normalizedRows];
    copy.sort((a, b) => Number(b?.pointsTotal ?? 0) - Number(a?.pointsTotal ?? 0));
    return copy;
  }, [normalizedRows]);

  const visibleTotals = showAllTotals ? totalsSorted : totalsSorted.slice(0, 5);
  const hasMoreTotals = totalsSorted.length > 5;

  const totalsColumns = [
    { key: "player", label: t("leaderboard.columns.player"), flex: 1.8 },
    {
      key: "pointsTotal",
      label: t("leaderboard.columns.total"),
      flex: 0.9,
      align: "right",
      bold: true,
      render: (row) => formatPts(row?.pointsTotal ?? 0),
    },
  ];

  if (!normalizedRows.length) {
    return (
      <View style={{ paddingVertical: 32, alignItems: "center" }}>
        <Text style={{ color: colors.subtext, fontWeight: "700" }}>{emptyText}</Text>
      </View>
    );
  }

  return (
    <View style={{ gap: 0 }}>
      <View style={[cardStyle(colors, "#FACC15"), { marginBottom: 16 }]}>
        <SectionHeader
          leading={<SportGlyph sport={sport} colors={colors} size={20} />}
          title={t("leaderboard.sections.topScorers")}
          colors={colors}
        />
        <ColumnHeader columns={totalsColumns} colors={colors} />
        <RankedRows
          rows={visibleTotals}
          colors={colors}
          columns={totalsColumns}
          accent="#FACC15"
          profiles={profiles}
          onParticipantPress={onParticipantPress}
          emptyText={emptyText}
        />
        {hasMoreTotals ? (
          <TouchableOpacity
            onPress={() => setShowAllTotals((v) => !v)}
            activeOpacity={0.85}
            style={{
              paddingVertical: 12,
              paddingHorizontal: 14,
              borderTopWidth: 1,
              borderTopColor: colors.border,
              alignItems: "flex-end",
            }}
          >
            <Text style={{ color: colors.primary, fontWeight: "900", fontSize: 13 }}>
              {showAllTotals
                ? t("leaderboard.actions.showLess")
                : t("leaderboard.actions.showAll")}
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <ChallengeCard
        sport={sport}
        challengeKind="fgc"
        title={sectionTitles.fgc}
        accent={LIVE_BADGE_ACCENTS.fgc}
        rows={normalizedRows}
        columns={buildChallengeColumns({ t, accent: LIVE_BADGE_ACCENTS.fgc, variant: "fgc" })}
        sortValue={(row) => fgcDisplayPoints(row)}
        hasActivity={(row) => {
          const wins = Number(row?.fgcWins ?? 0) || 0;
          const pts = fgcDisplayPoints(row);
          return wins > 0 || pts > 0;
        }}
        colors={colors}
        profiles={profiles}
        onParticipantPress={onParticipantPress}
        emptyText={emptyTexts.fgc}
        t={t}
      />

      <ChallengeCard
        sport={sport}
        challengeKind="tp"
        title={sectionTitles.tp}
        accent={LIVE_BADGE_ACCENTS.tp}
        rows={normalizedRows}
        columns={buildChallengeColumns({ t, accent: LIVE_BADGE_ACCENTS.tp, variant: "tp" })}
        sortValue={(row) => Number(row?.tpPoints ?? 0) || 0}
        hasActivity={(row) => {
          const pts = Number(row?.tpPoints ?? 0) || 0;
          const wins = Number(row?.tpWins ?? 0) || 0;
          const exacts = deriveTpExactCount(row);
          return pts > 0 || wins > 0 || exacts > 0;
        }}
        colors={colors}
        profiles={profiles}
        onParticipantPress={onParticipantPress}
        emptyText={emptyTexts.tp}
        t={t}
      />

      <ChallengeCard
        sport={sport}
        challengeKind="ts"
        title={sectionTitles.ts}
        accent={LIVE_BADGE_ACCENTS.ts}
        rows={normalizedRows}
        columns={buildChallengeColumns({ t, accent: LIVE_BADGE_ACCENTS.ts, variant: "ts" })}
        sortValue={(row) => Number(row?.tsPoints ?? 0) || 0}
        hasActivity={(row) => {
          const pts = Number(row?.tsPoints ?? 0) || 0;
          const wins = Number(row?.tsWins ?? 0) || 0;
          return pts > 0 || wins > 0;
        }}
        colors={colors}
        profiles={profiles}
        onParticipantPress={onParticipantPress}
        emptyText={emptyTexts.ts}
        t={t}
      />
    </View>
  );
}
