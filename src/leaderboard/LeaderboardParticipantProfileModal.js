import React, { useMemo } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Image,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import i18n from "@src/i18n/i18n";
import JerseyFlipAvatar from "@src/ui/JerseyFlipAvatar";
import LiveChallengeKindBadge, { LIVE_BADGE_ACCENTS } from "@src/live/LiveChallengeKindBadge";
import { resolveLeaderboardMember } from "./useLeaderboardProfiles";
import {
  buildLeaderboardRankMaps,
  buildParticipantChallengeStats,
} from "./leaderboardParticipantRanks";
import { isMlbSport } from "./leaderboardDashboardHelpers";

const AVATAR_PLACEHOLDER = require("@src/assets/avatar-placeholder.png");
const JERSEY_SIZE = 132;
const OVERALL_RANK_ACCENT = "#FACC15";

function hexWithAlpha(hex, alphaHex = "22") {
  const clean = String(hex || "").replace("#", "");
  if (clean.length !== 6) return hex;
  return `#${clean}${alphaHex}`;
}

function rankHeadline(rank, t) {
  const n = Number(rank) || 0;
  if (!n) return null;
  if (n === 1) {
    return t("leaderboard.participantProfile.rankFirst", { defaultValue: "1er du groupe" });
  }
  if (n === 2) {
    return t("leaderboard.participantProfile.rankSecond", { defaultValue: "2e du groupe" });
  }
  if (n === 3) {
    return t("leaderboard.participantProfile.rankThird", { defaultValue: "3e du groupe" });
  }
  return t("leaderboard.participantProfile.rankNth", {
    rank: n,
    defaultValue: "{{rank}}e du groupe",
  });
}

function ParticipantRankDisc({ rank, total, accent, colors, t, size = 56, compact = false }) {
  const n = Number(rank) || 0;
  if (!n) return null;

  const discSize = compact ? 44 : size;
  const fontSize = compact ? 16 : Math.round(discSize * 0.38);
  const headline = rankHeadline(n, t);
  const membersLine = t("leaderboard.participantProfile.amongMembers", {
    total: Number(total) || 0,
    defaultValue: "sur {{total}} membres",
  });

  return (
    <View style={{ alignItems: "center", gap: compact ? 2 : 4, minWidth: compact ? 52 : 72 }}>
      <View
        style={{
          width: discSize,
          height: discSize,
          borderRadius: discSize / 2,
          alignItems: "center",
          justifyContent: "center",
          borderWidth: compact ? 2.5 : 3,
          borderColor: accent,
          backgroundColor: hexWithAlpha(accent, "1A"),
          shadowColor: accent,
          shadowOpacity: 0.25,
          shadowOffset: { width: 0, height: 2 },
          shadowRadius: 4,
          elevation: 3,
        }}
      >
        <Text
          style={{
            color: accent,
            fontWeight: "900",
            fontSize,
            includeFontPadding: false,
          }}
        >
          {n}
        </Text>
      </View>
      {!compact ? (
        <>
          <Text
            style={{
              color: colors.text,
              fontWeight: "900",
              fontSize: 14,
              textAlign: "center",
            }}
          >
            {headline}
          </Text>
          <Text
            style={{
              color: colors.subtext,
              fontWeight: "700",
              fontSize: 12,
              textAlign: "center",
            }}
          >
            {membersLine}
          </Text>
        </>
      ) : (
        <Text
          style={{
            color: accent,
            fontWeight: "900",
            fontSize: 10,
            textAlign: "center",
          }}
          numberOfLines={2}
        >
          {t("leaderboard.participantProfile.rankCompact", {
            rank: n,
            total: Number(total) || 0,
            defaultValue: "{{rank}}e / {{total}}",
          })}
        </Text>
      )}
    </View>
  );
}

function withCacheBust(url, tsMillis) {
  if (!url) return null;
  const v = Number.isFinite(tsMillis) ? tsMillis : Date.now();
  return url.includes("?") ? `${url}&_cb=${v}` : `${url}?_cb=${v}`;
}

function ChallengeStatCard({ kind, title, accent, stats, colors, t, memberCount, tpExtra = null }) {
  const hasActivity =
    Number(stats?.points ?? 0) > 0 ||
    Number(stats?.wins ?? 0) > 0 ||
    Number(tpExtra?.exacts ?? 0) > 0;

  return (
    <View
      style={{
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 14,
        backgroundColor: colors.card,
        borderLeftWidth: 4,
        borderLeftColor: accent,
        padding: 12,
        gap: 10,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
        <View style={{ flex: 1, gap: 8 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <LiveChallengeKindBadge kind={kind} colors={colors} compact />
            <Text
              style={{ color: colors.text, fontWeight: "900", fontSize: 14, flex: 1 }}
              numberOfLines={2}
            >
              {title}
            </Text>
          </View>
        </View>
        {stats?.rank ? (
          <ParticipantRankDisc
            rank={stats.rank}
            total={memberCount}
            accent={accent}
            colors={colors}
            t={t}
            compact
          />
        ) : null}
      </View>

      {hasActivity ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          <StatPill
            colors={colors}
            label={t("leaderboard.columns.pointsShort", { defaultValue: "Pts" })}
            value={String(stats.points ?? 0)}
            accent={accent}
          />
          <StatPill
            colors={colors}
            label={t("leaderboard.participantProfile.wins", { defaultValue: "Victoires" })}
            value={String(stats.wins ?? 0)}
          />
          {tpExtra ? (
            <StatPill
              colors={colors}
              label={t("leaderboard.columns.exactsShort", { defaultValue: "Exact." })}
              value={String(tpExtra.exacts ?? 0)}
            />
          ) : null}
        </View>
      ) : (
        <Text style={{ color: colors.subtext, fontWeight: "700", fontSize: 12 }}>
          {t("leaderboard.participantProfile.noChallengeActivity", {
            defaultValue: "Aucune activité pour ce défi.",
          })}
        </Text>
      )}
    </View>
  );
}

function StatPill({ colors, label, value, accent }) {
  return (
    <View
      style={{
        paddingHorizontal: 10,
        paddingVertical: 7,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.card2,
        minWidth: 72,
      }}
    >
      <Text style={{ color: colors.subtext, fontSize: 10, fontWeight: "800" }}>{label}</Text>
      <Text
        style={{
          color: accent || colors.text,
          fontSize: 16,
          fontWeight: "900",
          marginTop: 2,
        }}
      >
        {value}
      </Text>
    </View>
  );
}

export default function LeaderboardParticipantProfileModal({
  visible,
  onClose,
  row,
  peerRows = [],
  profiles = {},
  sport,
  colors,
}) {
  const t = i18n.t.bind(i18n);
  const insets = useSafeAreaInsets();
  const mlb = isMlbSport(sport);

  const memberCount = peerRows.length;

  const identity = useMemo(() => {
    if (!row) return null;
    return resolveLeaderboardMember(row, profiles);
  }, [row, profiles]);

  const stats = useMemo(() => {
    if (!row) return null;
    const rankMaps = buildLeaderboardRankMaps(peerRows);
    return buildParticipantChallengeStats(row, rankMaps);
  }, [row, peerRows]);

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

  if (!visible || !row || !colors) return null;

  const version = identity?.updatedAt?.toMillis?.() ? identity.updatedAt.toMillis() : 0;
  const avatarUri = identity?.avatarUrl ? withCacheBust(identity.avatarUrl, version) : null;
  const isJersey =
    identity?.avatarKind === "jersey" &&
    identity?.jerseyFrontUrl &&
    identity?.jerseyBackUrl;
  const jerseyFrontOnly =
    !isJersey && (identity?.jerseyFrontUrl || identity?.avatarKind === "jersey");

  return (
    <Modal
      visible={!!visible}
      animationType="slide"
      presentationStyle={Platform.OS === "ios" ? "pageSheet" : "fullScreen"}
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <View
          style={{
            paddingTop: insets.top + 8,
            paddingHorizontal: 16,
            paddingBottom: 12,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Text style={{ color: colors.subtext, fontWeight: "800", fontSize: 12 }}>
            {t("leaderboard.participantProfile.title", { defaultValue: "Profil participant" })}
          </Text>
          <TouchableOpacity
            onPress={onClose}
            hitSlop={{ top: 10, left: 10, right: 10, bottom: 10 }}
            style={{
              padding: 8,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.card,
            }}
          >
            <MaterialCommunityIcons name="close" size={20} color={colors.text} />
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={{
            padding: 16,
            gap: 14,
            paddingBottom: 24 + insets.bottom,
          }}
        >
          <View style={{ alignItems: "center", gap: 10 }}>
            {isJersey ? (
              <JerseyFlipAvatar
                frontUrl={identity.jerseyFrontUrl}
                backUrl={identity.jerseyBackUrl}
                size={JERSEY_SIZE}
                holdMs={2800}
                fadeDurationMs={1100}
                backgroundColor="transparent"
              />
            ) : jerseyFrontOnly && identity?.jerseyFrontUrl ? (
              <Image
                source={{ uri: identity.jerseyFrontUrl }}
                style={{
                  width: JERSEY_SIZE,
                  height: JERSEY_SIZE,
                }}
                resizeMode="contain"
              />
            ) : (
              <Image
                source={avatarUri ? { uri: avatarUri } : AVATAR_PLACEHOLDER}
                style={{
                  width: JERSEY_SIZE,
                  height: JERSEY_SIZE,
                  borderRadius: JERSEY_SIZE / 2,
                  borderWidth: 3,
                  borderColor: colors.border,
                  backgroundColor: colors.card2,
                }}
              />
            )}

            <Text
              style={{ color: colors.text, fontWeight: "900", fontSize: 22, textAlign: "center" }}
              numberOfLines={2}
            >
              {identity?.displayName || row?.id || "—"}
            </Text>

            <ParticipantRankDisc
              rank={stats?.overall?.rank}
              total={memberCount}
              accent={OVERALL_RANK_ACCENT}
              colors={colors}
              t={t}
              size={64}
            />
          </View>

          <View
            style={{
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 16,
              backgroundColor: colors.card,
              borderLeftWidth: 4,
              borderLeftColor: OVERALL_RANK_ACCENT,
              padding: 14,
              gap: 8,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <View
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 14,
                  borderWidth: 2,
                  borderColor: OVERALL_RANK_ACCENT,
                  backgroundColor: hexWithAlpha(OVERALL_RANK_ACCENT, "1A"),
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text style={{ fontSize: 14 }}>🏆</Text>
              </View>
              <Text style={{ color: colors.text, fontWeight: "900", fontSize: 14, flex: 1 }}>
                {t("leaderboard.sections.topScorers", { defaultValue: "Meilleurs pointeurs" })}
              </Text>
            </View>
            <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 8 }}>
              <Text style={{ color: colors.text, fontWeight: "900", fontSize: 28 }}>
                {stats?.overall?.points ?? 0}
              </Text>
              <Text style={{ color: colors.subtext, fontWeight: "800", fontSize: 14, paddingBottom: 4 }}>
                {t("leaderboard.columns.pointsShort", { defaultValue: "Pts" })}
              </Text>
            </View>
            <Text style={{ color: colors.subtext, fontWeight: "700", fontSize: 12 }}>
              {t("leaderboard.participantProfile.totalWins", {
                count: stats?.overall?.wins ?? 0,
                defaultValue: "{{count}} victoires au total",
              })}
            </Text>
          </View>

          <Text style={{ color: colors.text, fontWeight: "900", fontSize: 15 }}>
            {t("leaderboard.participantProfile.byChallenge", {
              defaultValue: "Classement par défi",
            })}
          </Text>

          <ChallengeStatCard
            kind="fgc"
            title={sectionTitles.fgc}
            accent={LIVE_BADGE_ACCENTS.fgc}
            stats={stats?.fgc}
            memberCount={memberCount}
            colors={colors}
            t={t}
          />

          <ChallengeStatCard
            kind="tp"
            title={sectionTitles.tp}
            accent={LIVE_BADGE_ACCENTS.tp}
            stats={stats?.tp}
            memberCount={memberCount}
            tpExtra={{ exacts: stats?.tp?.exacts ?? 0 }}
            colors={colors}
            t={t}
          />

          <ChallengeStatCard
            kind="ts"
            title={sectionTitles.ts}
            accent={LIVE_BADGE_ACCENTS.ts}
            stats={stats?.ts}
            memberCount={memberCount}
            colors={colors}
            t={t}
          />
        </ScrollView>
      </View>
    </Modal>
  );
}
