import React, { useMemo } from "react";
import { View, Text, TouchableOpacity, Image } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import i18n from "@src/i18n/i18n";
import { useTheme } from "@src/theme/ThemeProvider";
import { useAnimatedNumber } from "@src/credits/CreditsWallet";
import { MVP_ACHIEVEMENT_COUNT } from "../mvpAchievements.js";
import {
  countUnlockedAchievements,
  normalizeAchievements,
  normalizeStats,
} from "../progressionUtils.js";

const LOGO = require("@src/ui/prophetik_icon_512.png");
const LOGO_LIGHT = require("@src/ui/prophetik_icon_512_white.png");

/** Carte héro pleine largeur */
const CARD_SCALE = 0.7 * 1.15;

function sc(value, scale = CARD_SCALE) {
  return Math.round(value * scale);
}

function getPalette(isDark, cardBg) {
  const bg = cardBg || (isDark ? "#121820" : "#FFFFFF");
  if (isDark) {
    return {
      bg,
      border: "#EF4444",
      borderSoft: "rgba(239, 68, 68, 0.45)",
      ink: "#F3F4F6",
      inkMuted: "rgba(243, 244, 246, 0.72)",
      accent: "#FCA5A5",
      flameGlow: "rgba(239, 68, 68, 0.38)",
      flameCore: "rgba(248, 113, 113, 0.62)",
      sparkle: "rgba(252, 165, 165, 0.55)",
      divider: "rgba(248, 113, 113, 0.35)",
      line: "rgba(248, 113, 113, 0.5)",
      logoRing: bg,
    };
  }

  return {
    bg,
    border: "#B91C1C",
    borderSoft: "rgba(185, 28, 28, 0.55)",
    ink: "#111827",
    inkMuted: "rgba(17, 24, 39, 0.72)",
    accent: "#DC2626",
    flameGlow: "rgba(220, 38, 38, 0.24)",
    flameCore: "rgba(220, 38, 38, 0.42)",
    sparkle: "rgba(185, 28, 28, 0.4)",
    divider: "rgba(185, 28, 28, 0.28)",
    line: "rgba(185, 28, 28, 0.42)",
    logoRing: bg,
  };
}

function CornerBracket({ corner, color, scale }) {
  const size = sc(14, scale);
  const bar = Math.max(1, sc(2, scale));
  const base = { position: "absolute", width: size, height: size };
  const barH = { position: "absolute", height: bar, width: size, backgroundColor: color };
  const barV = { position: "absolute", width: bar, height: size, backgroundColor: color };

  const map = {
    tl: { ...base, top: -1, left: -1, barH: { ...barH, top: 0, left: 0 }, barV: { ...barV, top: 0, left: 0 } },
    tr: { ...base, top: -1, right: -1, barH: { ...barH, top: 0, right: 0 }, barV: { ...barV, top: 0, right: 0 } },
    bl: { ...base, bottom: -1, left: -1, barH: { ...barH, bottom: 0, left: 0 }, barV: { ...barV, bottom: 0, left: 0 } },
    br: { ...base, bottom: -1, right: -1, barH: { ...barH, bottom: 0, right: 0 }, barV: { ...barV, bottom: 0, right: 0 } },
  };

  const c = map[corner];
  return (
    <View style={c}>
      <View style={c.barH} />
      <View style={c.barV} />
    </View>
  );
}

function formatRankDisplay(rank) {
  const r = Number(rank);
  if (!Number.isFinite(r) || r <= 0) return "—";
  return String(r);
}

function getDashboardTheme(isDark) {
  if (isDark) {
    return {
      cardBg: "#0B1018",
      border: "#EF4444",
      divider: "rgba(255,255,255,0.08)",
      title: "#F9FAFB",
      subtitle: "rgba(243,244,246,0.55)",
      streak: {
        icon: "#FB7185",
        glow: "rgba(239,68,68,0.18)",
        value: "#FFFFFF",
        pillBg: "#DC2626",
        pillText: "#FFFFFF",
      },
      points: {
        icon: "#FBBF24",
        glow: "rgba(251,191,36,0.16)",
        value: "#FBBF24",
        pillBg: "#CA8A04",
        pillText: "#111827",
      },
      rank: {
        icon: "#C4B5FD",
        glow: "rgba(167,139,250,0.16)",
        value: "#DDD6FE",
        pillBg: "#7C3AED",
        pillText: "#FFFFFF",
      },
    };
  }

  return {
    cardBg: "#FFFFFF",
    border: "#B91C1C",
    divider: "rgba(17,24,39,0.08)",
    title: "#111827",
    subtitle: "rgba(17,24,39,0.55)",
    streak: {
      icon: "#DC2626",
      glow: "rgba(220,38,38,0.12)",
      value: "#111827",
      pillBg: "#DC2626",
      pillText: "#FFFFFF",
    },
    points: {
      icon: "#D97706",
      glow: "rgba(217,119,6,0.12)",
      value: "#B45309",
      pillBg: "#F59E0B",
      pillText: "#111827",
    },
    rank: {
      icon: "#7C3AED",
      glow: "rgba(124,58,237,0.12)",
      value: "#6D28D9",
      pillBg: "#7C3AED",
      pillText: "#FFFFFF",
    },
  };
}

function DashboardIconBadge({ name, color, glow, size = 22 }) {
  const outer = size + 18;
  return (
    <View
      style={{
        width: outer,
        height: outer,
        borderRadius: outer / 2,
        backgroundColor: glow,
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 8,
      }}
    >
      <MaterialCommunityIcons name={name} size={size} color={color} />
    </View>
  );
}

function DashboardPill({ label, bg, color }) {
  return (
    <View
      style={{
        marginTop: 8,
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 999,
        backgroundColor: bg,
      }}
    >
      <Text
        numberOfLines={1}
        style={{
          color,
          fontWeight: "800",
          fontSize: 9,
          letterSpacing: 0.6,
        }}
      >
        {label}
      </Text>
    </View>
  );
}

function DashboardColumn({
  icon,
  columnTheme,
  ui,
  title,
  subtitle,
  value,
  valueSuffix,
  pillLabel,
  loading,
}) {
  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "flex-start",
        paddingVertical: 16,
        paddingHorizontal: 6,
      }}
    >
      <DashboardIconBadge name={icon} color={columnTheme.icon} glow={columnTheme.glow} />
      <Text
        style={{
          color: ui.title,
          fontWeight: "900",
          fontSize: 11,
          letterSpacing: 1.4,
        }}
      >
        {title}
      </Text>
      <Text
        numberOfLines={1}
        style={{
          marginTop: 2,
          color: ui.subtitle,
          fontWeight: "700",
          fontSize: 9,
          letterSpacing: 0.5,
        }}
      >
        {subtitle}
      </Text>
      <View style={{ flexDirection: "row", alignItems: "flex-end", marginTop: 8 }}>
        <Text
          style={{
            color: columnTheme.value,
            fontWeight: "900",
            fontSize: 36,
            lineHeight: 38,
            fontVariant: ["tabular-nums"],
          }}
        >
          {loading ? "…" : value}
        </Text>
        {valueSuffix ? (
          <Text
            style={{
              color: columnTheme.value,
              fontWeight: "800",
              fontSize: 18,
              lineHeight: 28,
              marginBottom: 2,
              fontVariant: ["tabular-nums"],
            }}
          >
            {loading ? "" : valueSuffix}
          </Text>
        ) : null}
      </View>
      <DashboardPill label={pillLabel} bg={columnTheme.pillBg} color={columnTheme.pillText} />
    </View>
  );
}

function PointsDashboardColumn({ columnTheme, ui, loading, pointsTarget, pillLabel }) {
  const target = Math.max(0, Math.round(Number(pointsTarget || 0)));
  const animatedPoints = useAnimatedNumber(target, {
    duration: 1700,
    initialValue: 0,
  });

  return (
    <DashboardColumn
      icon="trophy"
      columnTheme={columnTheme}
      ui={ui}
      title={i18n.t("progression.statsPointsTitle", { defaultValue: "POINTS" })}
      subtitle={i18n.t("progression.statsPointsSubtitle", { defaultValue: "MES POINTS" })}
      value={String(animatedPoints)}
      pillLabel={pillLabel}
      loading={loading}
    />
  );
}

function TitleWithLines({ label, palette, style, scale = CARD_SCALE }) {
  return (
    <View style={[{ flexDirection: "row", alignItems: "center", gap: sc(8, scale) }, style]}>
      <View style={{ flex: 1, height: 1, backgroundColor: palette.line }} />
      <Text
        style={{
          color: palette.ink,
          fontWeight: "800",
          fontSize: sc(11, scale),
          letterSpacing: 1.2,
        }}
      >
        {label}
      </Text>
      <View style={{ flex: 1, height: 1, backgroundColor: palette.line }} />
    </View>
  );
}

function StreakCompactBar({
  currentStreak,
  palette,
  showBadgesHint,
  unlockedCount,
  onPress,
  groupSummary,
  isDark,
}) {
  const ui = useMemo(() => getDashboardTheme(isDark), [isDark]);
  const showGroupStats = groupSummary?.show === true;
  const loadingGroup = !!groupSummary?.loading;

  const pointsTarget = Math.round(Number(groupSummary?.myPoints || 0));
  const rankDisplay = formatRankDisplay(groupSummary?.myRank);

  const dayPillLabel =
    Number(currentStreak || 0) === 1
      ? i18n.t("progression.statsDayPill", { defaultValue: "JOUR" })
      : i18n.t("progression.daysLabel", { defaultValue: "JOURS" });

  const inner = (
    <View
      style={{
        alignSelf: "stretch",
        width: "100%",
        marginTop: 4,
        marginBottom: 4,
      }}
    >
      <View
        style={{
          borderWidth: 2,
          borderColor: ui.border,
          backgroundColor: ui.cardBg,
          borderRadius: 14,
          overflow: "hidden",
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "stretch" }}>
          {showGroupStats ? (
            <>
              <PointsDashboardColumn
                columnTheme={ui.points}
                ui={ui}
                pointsTarget={pointsTarget}
                pillLabel={i18n.t("progression.statsPointsPill", { defaultValue: "POINTS" })}
                loading={loadingGroup}
              />
              <View
                style={{
                  width: 1,
                  backgroundColor: ui.divider,
                  marginVertical: 14,
                }}
              />
              <DashboardColumn
                icon="podium"
                columnTheme={ui.rank}
                ui={ui}
                title={i18n.t("progression.statsRankTitle", { defaultValue: "RANG" })}
                subtitle={i18n.t("progression.statsRankSubtitle", { defaultValue: "MA POS." })}
                value={rankDisplay}
                pillLabel={i18n.t("progression.statsPositionPill", { defaultValue: "POS." })}
                loading={loadingGroup}
              />
              <View
                style={{
                  width: 1,
                  backgroundColor: ui.divider,
                  marginVertical: 14,
                }}
              />
            </>
          ) : null}

          <DashboardColumn
            icon="fire"
            columnTheme={ui.streak}
            ui={ui}
            title={i18n.t("progression.statsStreakTitle", { defaultValue: "SÉRIE" })}
            subtitle={i18n.t("progression.statsStreakSubtitle", { defaultValue: "EN FEU" })}
            value={String(currentStreak)}
            pillLabel={dayPillLabel}
          />
        </View>
      </View>

      {showBadgesHint ? (
        <Text
          style={{
            textAlign: "center",
            color: palette.inkMuted,
            fontSize: 11,
            fontWeight: "600",
            marginTop: 8,
          }}
        >
          {i18n.t("progression.badgesCount", {
            unlocked: unlockedCount,
            total: MVP_ACHIEVEMENT_COUNT,
            defaultValue: `${unlockedCount}/${MVP_ACHIEVEMENT_COUNT} badges`,
          })}
          {onPress
            ? ` · ${i18n.t("progression.seeAll", { defaultValue: "Voir tous les badges" })}`
            : ""}
        </Text>
      ) : null}
    </View>
  );

  if (!onPress) return inner;

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.88} accessibilityRole="button">
      {inner}
    </TouchableOpacity>
  );
}

function StreakHeroCardFull({
  currentStreak,
  bestStreak,
  palette,
  isDark,
  showBadgesHint,
  unlockedCount,
  onPress,
}) {
  const cardHeight = sc(148);
  const logoOuter = sc(46);
  const logoInner = sc(38);

  const content = (
    <View style={{ paddingTop: sc(22), paddingHorizontal: sc(2) }}>
      <View
        style={{
          borderWidth: Math.max(1, sc(2)),
          borderColor: palette.border,
          backgroundColor: palette.bg,
          padding: sc(5),
        }}
      >
        <View
          style={{
            borderWidth: Math.max(1, sc(2)),
            borderColor: palette.borderSoft,
            minHeight: cardHeight,
            overflow: "hidden",
          }}
        >
          {(["tl", "tr", "bl", "br"]).map((corner) => (
            <CornerBracket key={corner} corner={corner} color={palette.border} scale={CARD_SCALE} />
          ))}

          <View style={{ flexDirection: "row", minHeight: cardHeight }}>
            <View
              style={{
                flex: 1.55,
                paddingVertical: sc(18),
                paddingHorizontal: sc(14),
                justifyContent: "center",
              }}
            >
              <View
                pointerEvents="none"
                style={{
                  position: "absolute",
                  left: sc(-10),
                  bottom: sc(-20),
                }}
              >
                <MaterialCommunityIcons name="fire" size={sc(148)} color={palette.flameGlow} />
                <View style={{ position: "absolute", left: sc(14), bottom: sc(10) }}>
                  <MaterialCommunityIcons name="fire" size={sc(96)} color={palette.flameCore} />
                </View>
              </View>

              <TitleWithLines
                label={i18n.t("progression.streakOnFire", { defaultValue: "SÉRIE EN FEU" })}
                palette={palette}
              />

              <Text
                style={{
                  marginTop: sc(6),
                  textAlign: "center",
                  color: palette.ink,
                  fontWeight: "900",
                  fontSize: sc(56),
                  lineHeight: sc(58),
                  fontVariant: ["tabular-nums"],
                }}
              >
                {currentStreak}
              </Text>

              <TitleWithLines
                label={i18n.t("progression.daysLabel", { defaultValue: "JOURS" })}
                palette={palette}
                style={{ marginTop: sc(2) }}
              />
            </View>

            <View
              style={{
                width: 1,
                backgroundColor: palette.divider,
                marginVertical: sc(16),
              }}
            />

            <View
              style={{
                flex: 0.95,
                paddingVertical: sc(18),
                paddingHorizontal: sc(10),
                alignItems: "center",
                justifyContent: "center",
                gap: sc(4),
              }}
            >
              <MaterialCommunityIcons name="trophy" size={sc(28)} color={palette.accent} />

              <Text
                style={{
                  color: palette.inkMuted,
                  fontWeight: "800",
                  fontSize: sc(9),
                  letterSpacing: 0.6,
                  textAlign: "center",
                  marginTop: sc(4),
                }}
              >
                {i18n.t("progression.streakBestShort", { defaultValue: "À BATTRE" })}
              </Text>

              <Text
                style={{
                  color: palette.accent,
                  fontWeight: "900",
                  fontSize: sc(34),
                  lineHeight: sc(36),
                  fontVariant: ["tabular-nums"],
                }}
              >
                {bestStreak}
              </Text>

              <Text
                style={{
                  color: palette.accent,
                  fontWeight: "800",
                  fontSize: sc(11),
                  letterSpacing: 1,
                }}
              >
                {i18n.t("progression.daysLabel", { defaultValue: "JOURS" })}
              </Text>
            </View>
          </View>
        </View>
      </View>

      <View
        style={{
          position: "absolute",
          top: 0,
          alignSelf: "center",
          width: logoOuter,
          height: logoOuter,
          borderRadius: logoOuter / 2,
          backgroundColor: palette.logoRing,
          borderWidth: Math.max(1, sc(2)),
          borderColor: palette.border,
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
        }}
      >
        <Image
          source={isDark ? LOGO_LIGHT : LOGO}
          style={{
            width: logoInner,
            height: logoInner,
            borderRadius: logoInner / 2,
          }}
          resizeMode="cover"
        />
      </View>

      {showBadgesHint ? (
        <View style={{ alignItems: "center", marginTop: sc(10) }}>
          <Text style={{ color: palette.inkMuted, fontSize: sc(12), fontWeight: "600" }}>
            {i18n.t("progression.badgesCount", {
              unlocked: unlockedCount,
              total: MVP_ACHIEVEMENT_COUNT,
              defaultValue: `${unlockedCount}/${MVP_ACHIEVEMENT_COUNT} badges`,
            })}
            {onPress
              ? ` · ${i18n.t("progression.seeAll", { defaultValue: "Voir tous les badges" })}`
              : ""}
          </Text>
        </View>
      ) : null}
    </View>
  );

  if (!onPress) return content;

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.88} accessibilityRole="button">
      {content}
    </TouchableOpacity>
  );
}

export default function StreakHeroCard({
  stats: rawStats,
  achievements: rawAchievements,
  onPress,
  showBadgesHint = true,
  embedded = false,
  groupSummary = null,
}) {
  const { isDark, colors } = useTheme();
  const palette = useMemo(
    () => getPalette(isDark, embedded ? colors.card : null),
    [isDark, embedded, colors.card]
  );

  const stats = normalizeStats(rawStats);
  const achievements = normalizeAchievements(rawAchievements);
  const currentStreak = Number(stats.currentStreak || 0);
  const bestStreak = Number(stats.bestStreak || 0);
  const unlockedCount = countUnlockedAchievements(achievements);

  if (embedded) {
    return (
      <StreakCompactBar
        currentStreak={currentStreak}
        palette={palette}
        showBadgesHint={showBadgesHint}
        unlockedCount={unlockedCount}
        onPress={onPress}
        groupSummary={groupSummary}
        isDark={isDark}
      />
    );
  }

  return (
    <StreakHeroCardFull
      currentStreak={currentStreak}
      bestStreak={bestStreak}
      palette={palette}
      isDark={isDark}
      showBadgesHint={showBadgesHint}
      unlockedCount={unlockedCount}
      onPress={onPress}
    />
  );
}
