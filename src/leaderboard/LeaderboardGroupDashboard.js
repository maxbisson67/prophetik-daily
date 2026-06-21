import React, { useMemo, useState } from "react";
import { View, Text, TouchableOpacity, Image } from "react-native";
import i18n from "@src/i18n/i18n";
import SportGlyph from "@src/sports/SportGlyph";
import LeaderboardRankBadge from "./LeaderboardRankBadge";
import useLeaderboardProfiles, {
  resolveLeaderboardMember,
} from "./useLeaderboardProfiles";

const AVATAR_PLACEHOLDER = require("@src/assets/avatar-placeholder.png");

function withCacheBust(url, tsMillis) {
  if (!url) return null;
  const v = Number.isFinite(tsMillis) ? tsMillis : Date.now();
  return url.includes("?") ? `${url}&_cb=${v}` : `${url}?_cb=${v}`;
}

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

function ColumnHeader({ columns, colors }) {
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
      <View style={{ flex: 1.4, paddingRight: 6 }}>
        <Text style={{ color: colors.subtext, fontSize: 11, fontWeight: "800" }}>
          {columns[0]?.label || ""}
        </Text>
      </View>
      {columns.slice(1).map((col) => (
        <View key={col.key} style={{ flex: col.flex || 1, alignItems: col.align || "center" }}>
          <Text
            style={{
              color: colors.subtext,
              fontSize: 10,
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
  title,
  accent,
  rows,
  winsKey,
  pointsKey,
  playsKey,
  colors,
  profiles,
  onRowPress,
  emptyText,
  t,
}) {
  const sorted = useMemo(() => {
    const copy = [...(rows || [])];
    copy.sort((a, b) => Number(b?.[pointsKey] ?? 0) - Number(a?.[pointsKey] ?? 0));
    return copy.filter((r) => {
      const pts = Number(r?.[pointsKey] ?? 0) || 0;
      const wins = Number(r?.[winsKey] ?? 0) || 0;
      const plays = playsKey
        ? Number(r?.[`${playsKey}Plays`] ?? r?.families?.[playsKey]?.plays ?? 0) || 0
        : 0;
      return pts > 0 || wins > 0 || plays > 0;
    });
  }, [rows, pointsKey, winsKey, playsKey]);

  const columns = [
    { key: "player", label: t("leaderboard.columns.player") },
    {
      key: "wins",
      label: t("leaderboard.columns.correctPicks"),
      flex: 1,
      render: (row) => String(Number(row?.[winsKey] ?? 0) || 0),
      color: accent,
      bold: true,
    },
    {
      key: "points",
      label: t("leaderboard.columns.points"),
      flex: 1,
      render: (row) => String(Number(row?.[pointsKey] ?? 0) || 0),
      color: accent,
      bold: true,
    },
  ];

  return (
    <View style={[cardStyle(colors, accent), { marginBottom: 16 }]}>
      <SectionHeader
        leading={<SportGlyph sport={sport} colors={colors} size={20} />}
        title={title}
        colors={colors}
      />
      <ColumnHeader columns={columns} colors={colors} />
      <RankedRows
        rows={sorted.slice(0, 5)}
        colors={colors}
        columns={columns}
        accent={accent}
        profiles={profiles}
        onRowPress={onRowPress}
        emptyText={emptyText}
      />
    </View>
  );
}

function RankedRows({
  rows,
  colors,
  columns,
  accent,
  profiles,
  onRowPress,
  emptyText,
}) {
  if (!rows?.length) {
    return (
      <View style={{ padding: 20, alignItems: "center" }}>
        <Text style={{ color: colors.subtext, fontWeight: "700" }}>{emptyText}</Text>
      </View>
    );
  }

  return rows.map((row, idx) => {
    const { displayName, avatarUrl, updatedAt } = resolveLeaderboardMember(row, profiles);
    const version = updatedAt?.toMillis?.() ? updatedAt.toMillis() : 0;
    const uri = avatarUrl ? withCacheBust(avatarUrl, version) : null;
    const rank = idx + 1;

    return (
      <TouchableOpacity
        key={`${row.id}:${idx}`}
        activeOpacity={0.85}
        onPress={() => onRowPress?.(row)}
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingVertical: 10,
          paddingHorizontal: 12,
          borderBottomWidth: idx === rows.length - 1 ? 0 : 1,
          borderBottomColor: colors.border,
          backgroundColor: idx % 2 ? colors.rowAlt : colors.card,
        }}
      >
        <View style={{ width: 36, alignItems: "center" }}>
          <LeaderboardRankBadge rank={rank} colors={colors} size={26} />
        </View>

        <View style={{ flex: 1.4, flexDirection: "row", alignItems: "center", paddingRight: 6 }}>
          <Image
            source={uri ? { uri } : AVATAR_PLACEHOLDER}
            style={{
              width: 30,
              height: 30,
              borderRadius: 15,
              marginRight: 8,
              backgroundColor: colors.border,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          />
          <Text style={{ color: colors.text, fontWeight: "800", flex: 1 }} numberOfLines={1}>
            {displayName}
          </Text>
        </View>

        {columns.slice(1).map((col) => {
          const content = col.render ? col.render(row, { accent, colors }) : row?.[col.key];

          return (
            <View
              key={col.key}
              style={{
                flex: col.flex || 1,
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
                    fontSize: col.small ? 12 : 14,
                    textAlign: col.align === "right" ? "right" : "center",
                  }}
                >
                  {content ?? "—"}
                </Text>
              )}
            </View>
          );
        })}
      </TouchableOpacity>
    );
  });
}

export default function LeaderboardGroupDashboard({ rows, colors, sport, onRowPress, emptyText }) {
  const t = i18n.t.bind(i18n);
  const [showAllTotals, setShowAllTotals] = useState(false);

  const normalizedRows = rows || [];
  const uids = useMemo(() => normalizedRows.map((r) => String(r.id)), [normalizedRows]);
  const profiles = useLeaderboardProfiles(uids);

  const totalsSorted = useMemo(() => {
    const copy = [...normalizedRows];
    copy.sort((a, b) => Number(b?.pointsTotal ?? 0) - Number(a?.pointsTotal ?? 0));
    return copy;
  }, [normalizedRows]);

  const visibleTotals = showAllTotals ? totalsSorted : totalsSorted.slice(0, 5);
  const hasMoreTotals = totalsSorted.length > 5;

  const totalsColumns = [
    { key: "player", label: t("leaderboard.columns.player") },
    {
      key: "pointsTotal",
      label: t("leaderboard.columns.total"),
      flex: 1,
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
          onRowPress={onRowPress}
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
        title={t("leaderboard.sections.fgc")}
        accent="#22C55E"
        rows={normalizedRows}
        winsKey="fgcWins"
        pointsKey="fgcPoints"
        playsKey="fgc"
        colors={colors}
        profiles={profiles}
        onRowPress={onRowPress}
        emptyText={t("leaderboard.challenge.noStats.fgc")}
        t={t}
      />

      <ChallengeCard
        sport={sport}
        title={t("leaderboard.sections.tp")}
        accent="#3B82F6"
        rows={normalizedRows}
        winsKey="tpWins"
        pointsKey="tpPoints"
        playsKey="tp"
        colors={colors}
        profiles={profiles}
        onRowPress={onRowPress}
        emptyText={t("leaderboard.challenge.noStats.tp")}
        t={t}
      />

      <ChallengeCard
        sport={sport}
        title={t("leaderboard.sections.ts")}
        accent="#A855F7"
        rows={normalizedRows}
        winsKey="tsWins"
        pointsKey="tsPoints"
        playsKey="ts"
        colors={colors}
        profiles={profiles}
        onRowPress={onRowPress}
        emptyText={t("leaderboard.challenge.noStats.ts")}
        t={t}
      />
    </View>
  );
}
