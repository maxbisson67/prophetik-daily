import React, { useMemo, useState } from "react";
import { View, Text, TouchableOpacity, Image } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import i18n from "@src/i18n/i18n";
import TeamLogoBadge from "@src/sports/TeamLogoBadge";
import { lookupTeamByAbbr } from "@src/groups/data/fallbackTeams";
import { mlbHeadshotUrl } from "@src/mlb/mlbPlayerAssets";
import {
  confidenceDots,
  labelColor,
  labelText,
  offensiveLabelText,
  tierLabel,
  labelBgColor,
} from "@src/nova/novaIndicatorTheme";

function GaugeBar({ score, color, trackColor, height = 12 }) {
  const pct = Math.max(0, Math.min(100, Number(score) || 0));
  return (
    <View
      style={{
        height,
        borderRadius: height / 2,
        backgroundColor: trackColor,
        overflow: "hidden",
      }}
    >
      <View
        style={{
          width: `${pct}%`,
          height: "100%",
          borderRadius: height / 2,
          backgroundColor: color,
        }}
      />
    </View>
  );
}

function ScoreBadge({ score, color, size = "lg" }) {
  const n = Number(score);
  if (!Number.isFinite(n)) return null;
  const isLg = size === "lg";
  return (
    <View
      style={{
        minWidth: isLg ? 64 : 48,
        paddingHorizontal: isLg ? 12 : 8,
        paddingVertical: isLg ? 8 : 5,
        borderRadius: isLg ? 14 : 10,
        backgroundColor: `${color}22`,
        borderWidth: 2,
        borderColor: `${color}66`,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text style={{ color, fontWeight: "900", fontSize: isLg ? 28 : 18, lineHeight: isLg ? 32 : 22 }}>
        {Math.round(n)}
      </Text>
      {isLg ? (
        <Text style={{ color, fontWeight: "800", fontSize: 9, opacity: 0.85, marginTop: -2 }}>/100</Text>
      ) : null}
    </View>
  );
}

function MiniScorePill({ icon, label, score, rawValue, color, colors, unavailableLabel }) {
  const hasScore = score != null && Number.isFinite(Number(score));
  return (
    <View
      style={{
        flex: 1,
        padding: 10,
        borderRadius: 12,
        backgroundColor: colors.card,
        borderWidth: 1,
        borderColor: hasScore ? `${color}44` : colors.border,
        gap: 4,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
        <Ionicons name={icon} size={14} color={hasScore ? color : colors.subtext} />
        <Text style={{ color: colors.subtext, fontWeight: "800", fontSize: 10 }}>{label}</Text>
      </View>
      {hasScore ? (
        <Text style={{ color, fontWeight: "900", fontSize: 20 }}>{Math.round(Number(score))}</Text>
      ) : (
        <Text style={{ color: colors.subtext, fontWeight: "800", fontSize: 14 }}>{unavailableLabel}</Text>
      )}
      {rawValue ? (
        <Text style={{ color: colors.subtext, fontWeight: "700", fontSize: 11 }}>{rawValue}</Text>
      ) : null}
    </View>
  );
}

function StatTile({ icon, label, value, tier, colors, lang, accentColor }) {
  const tierC =
    tier === "strong" ? "#22C55E" : tier === "weak" ? "#EF4444" : colors.primary;
  return (
    <View
      style={{
        flex: 1,
        minWidth: 0,
        paddingTop: 8,
        paddingBottom: 10,
        paddingHorizontal: 6,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: `${tierC}33`,
        backgroundColor: `${tierC}12`,
        alignItems: "center",
        gap: 3,
        overflow: "hidden",
      }}
    >
      <View style={{ width: "100%", height: 3, backgroundColor: tierC, borderRadius: 2, marginBottom: 2 }} />
      <Ionicons name={icon} size={18} color={tierC} />
      <Text style={{ color: colors.subtext, fontWeight: "800", fontSize: 9, letterSpacing: 0.4 }}>{label}</Text>
      <Text style={{ color: colors.text, fontWeight: "900", fontSize: 17 }}>{value}</Text>
      {tier && tier !== "neutral" ? (
        <Text style={{ color: tierC, fontWeight: "800", fontSize: 9, textTransform: "uppercase" }}>
          {tierLabel(tier, lang)}
        </Text>
      ) : null}
    </View>
  );
}

function RiskChip({ text, colors, isDark }) {
  return (
    <View
      style={{
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 999,
        backgroundColor: isDark ? "rgba(239,68,68,0.25)" : "rgba(239,68,68,0.12)",
        borderWidth: 1,
        borderColor: isDark ? "rgba(248,113,113,0.45)" : "rgba(239,68,68,0.3)",
      }}
    >
      <Text style={{ color: colors.text, fontWeight: "800", fontSize: 11 }}>{text}</Text>
    </View>
  );
}

function SectionCard({ title, accentColor, accentBg, colors, headerRight = null, children }) {
  return (
    <View
      style={{
        borderRadius: 16,
        borderWidth: 2,
        borderColor: `${accentColor}44`,
        backgroundColor: accentBg,
        padding: 14,
        gap: 10,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Text style={{ color: colors.text, fontWeight: "900", fontSize: 14 }}>
          {title}
        </Text>
        {headerRight}
      </View>
      {children}
    </View>
  );
}

function BvpSection({ bvp, colors, isDark, lang = "fr", showDivider = true }) {
  const [expanded, setExpanded] = useState(() => bvp?.defaultExpanded === true);

  if (!bvp) return null;

  const batter = String(bvp?.batterName || "").trim();
  const pitcher = String(bvp?.pitcherName || "").trim();
  const matchupTitle =
    batter && pitcher
      ? i18n.t("novaCoach.indicators.bvpCareerMatchup", {
          defaultValue: "{{batter}} vs {{pitcher}} — carrière",
          batter,
          pitcher,
        })
      : i18n.t("novaCoach.indicators.bvpCareerGeneric", {
          defaultValue: "Face-à-face carrière",
        });

  const handLabel = bvp.actionable
    ? i18n.t("novaCoach.indicators.bvpReliable", { defaultValue: "Échantillon fiable" })
    : i18n.t("novaCoach.indicators.bvpLimited", { defaultValue: "Historique limité" });

  return (
    <View
      style={{
        borderTopWidth: showDivider ? 1 : 0,
        borderTopColor: colors.border,
        marginTop: showDivider ? 2 : 0,
      }}
    >
      <TouchableOpacity
        onPress={() => setExpanded((v) => !v)}
        activeOpacity={0.85}
        style={{ flexDirection: "row", alignItems: "center", paddingTop: 12, paddingBottom: expanded ? 0 : 2, gap: 8 }}
      >
        <View
          style={{
            width: 32,
            height: 32,
            borderRadius: 16,
            backgroundColor: bvp.actionable
              ? isDark
                ? "rgba(34,197,94,0.2)"
                : "rgba(34,197,94,0.12)"
              : isDark
                ? "rgba(255,255,255,0.08)"
                : "rgba(0,0,0,0.05)",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name="swap-horizontal" size={16} color={bvp.actionable ? "#22C55E" : colors.subtext} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.text, fontWeight: "900", fontSize: 13 }} numberOfLines={2}>
            {matchupTitle}
          </Text>
          <Text style={{ color: colors.subtext, fontWeight: "700", fontSize: 11, marginTop: 2 }}>
            {bvp.pa} PA · {handLabel}
          </Text>
        </View>
        <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={18} color={colors.subtext} />
      </TouchableOpacity>

      {expanded ? (
        <View style={{ paddingBottom: 2 }}>
          {!bvp.actionable ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 10 }}>
              <Ionicons name="warning-outline" size={14} color={isDark ? "#FBBF24" : "#D97706"} />
              <Text style={{ color: colors.subtext, fontWeight: "700", fontSize: 11, flex: 1 }}>
                {i18n.t("novaCoach.indicators.bvpCaution", {
                  defaultValue: "Moins de 9 PA — à prendre avec prudence.",
                })}
              </Text>
            </View>
          ) : null}
          <Text style={{ color: colors.text, fontWeight: "800", fontSize: 13, marginTop: 8 }}>
            {bvp.hits} H · {bvp.homeRuns} HR · {bvp.rbi} RBI
            {bvp.ops ? ` · OPS ${bvp.ops}` : ""}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function PitcherAvatar({ pitcher, size = 44, accentColor, isDark }) {
  const headshotUri = pitcher?.id ? mlbHeadshotUrl(pitcher.id) : null;

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        overflow: "hidden",
        borderWidth: 1.5,
        borderColor: `${accentColor}55`,
        backgroundColor: isDark ? `${accentColor}33` : `${accentColor}18`,
      }}
    >
      {headshotUri ? (
        <Image source={{ uri: headshotUri }} style={{ width: size, height: size }} resizeMode="cover" />
      ) : (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <Ionicons name="baseball" size={Math.round(size * 0.5)} color={accentColor} />
        </View>
      )}
    </View>
  );
}

function PitcherMatchupCard({ pitcher, bvp, colors, isDark, lang, accentColor, accentBg }) {
  if (!pitcher && !bvp) return null;

  const handMapFr = { L: "Gaucher", R: "Droitier" };
  const handMapEn = { L: "LHP", R: "RHP" };
  const handMap = lang === "en" ? handMapEn : handMapFr;
  const eraTierColor =
    pitcher?.matchupTier === "strong"
      ? "#22C55E"
      : pitcher?.matchupTier === "weak"
        ? "#EF4444"
        : accentColor;

  const subtitleParts = [];
  if (pitcher?.teamAbbr) subtitleParts.push(pitcher.teamAbbr);
  if (pitcher?.throwHand) subtitleParts.push(handMap[pitcher.throwHand] || pitcher.throwHand);
  if (pitcher?.winsLosses) subtitleParts.push(pitcher.winsLosses);
  if (pitcher?.era) subtitleParts.push(`ERA ${pitcher.era}`);

  return (
    <SectionCard
      title={i18n.t("novaCoach.indicators.matchupTitle", { defaultValue: "Matchup lanceur" })}
      accentColor={eraTierColor}
      accentBg={accentBg}
      colors={colors}
      headerRight={
        pitcher?.era ? (
          <View
            style={{
              paddingHorizontal: 10,
              paddingVertical: 4,
              borderRadius: 999,
              backgroundColor: `${eraTierColor}22`,
              borderWidth: 1,
              borderColor: `${eraTierColor}55`,
            }}
          >
            <Text style={{ color: eraTierColor, fontWeight: "900", fontSize: 12 }}>
              ERA {pitcher.era}
            </Text>
          </View>
        ) : pitcher?.winsLosses ? (
          <View
            style={{
              paddingHorizontal: 10,
              paddingVertical: 4,
              borderRadius: 999,
              backgroundColor: `${eraTierColor}22`,
              borderWidth: 1,
              borderColor: `${eraTierColor}55`,
            }}
          >
            <Text style={{ color: eraTierColor, fontWeight: "900", fontSize: 12 }}>
              {pitcher.winsLosses}
            </Text>
          </View>
        ) : null
      }
    >
      {pitcher ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <PitcherAvatar pitcher={pitcher} accentColor={eraTierColor} isDark={isDark} />
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={{ color: colors.text, fontWeight: "900", fontSize: 15 }}>{pitcher.name}</Text>
            <Text style={{ color: colors.subtext, fontWeight: "700", fontSize: 12 }}>
              {subtitleParts.length ? subtitleParts.join(" · ") : "—"}
              {pitcher.matchupTier && pitcher.matchupTier !== "neutral"
                ? ` · ${tierLabel(pitcher.matchupTier, lang)}`
                : ""}
            </Text>
          </View>
        </View>
      ) : null}

      {bvp ? <BvpSection bvp={bvp} colors={colors} isDark={isDark} lang={lang} showDivider={!!pitcher} /> : null}
    </SectionCard>
  );
}

function normalizeHandCode(code) {
  const c = String(code || "").trim().toUpperCase();
  return c === "L" || c === "R" || c === "S" ? c : null;
}

function handDirectionIcon(code) {
  if (code === "L") return "arrow-back";
  if (code === "R") return "arrow-forward";
  return null;
}

function PlatoonHandFigure({ role, handCode, label, handLabel, accentColor, colors, isDark }) {
  const code = normalizeHandCode(handCode);
  const icon = role === "pitcher" ? "baseball" : "person";
  const directionIcon = handDirectionIcon(code);

  return (
    <View style={{ flex: 1, alignItems: "center", gap: 5 }}>
      <View style={{ alignItems: "center", justifyContent: "center" }}>
        <View
          style={{
            width: 48,
            height: 48,
            borderRadius: 24,
            backgroundColor: isDark ? `${accentColor}33` : `${accentColor}18`,
            borderWidth: 1.5,
            borderColor: `${accentColor}55`,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name={icon} size={24} color={accentColor} />
        </View>
        {code ? (
          <View
            style={{
              position: "absolute",
              bottom: -4,
              right: -6,
              minWidth: 22,
              height: 22,
              paddingHorizontal: 5,
              borderRadius: 11,
              backgroundColor: accentColor,
              borderWidth: 2,
              borderColor: colors.card,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "900", fontSize: 11 }}>{code}</Text>
          </View>
        ) : null}
      </View>

      {directionIcon ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
          <Ionicons name={directionIcon} size={14} color={accentColor} />
          <Text style={{ color: accentColor, fontWeight: "900", fontSize: 12 }}>{code}</Text>
        </View>
      ) : code ? (
        <Text style={{ color: accentColor, fontWeight: "900", fontSize: 12 }}>{code}</Text>
      ) : null}

      <Text style={{ color: colors.subtext, fontWeight: "800", fontSize: 11, textAlign: "center" }}>
        {label}
      </Text>
      {handLabel ? (
        <Text style={{ color: colors.text, fontWeight: "800", fontSize: 12, textAlign: "center" }}>{handLabel}</Text>
      ) : null}
    </View>
  );
}

function PlatoonConnector({ advantageKey, accentColor, colors }) {
  const icon =
    advantageKey === "favorable"
      ? "swap-horizontal"
      : advantageKey === "unfavorable"
        ? "git-compare"
        : "remove";
  const tint =
    advantageKey === "favorable"
      ? accentColor
      : advantageKey === "unfavorable"
        ? accentColor
        : colors.subtext;

  return (
    <View style={{ alignItems: "center", justifyContent: "center", paddingHorizontal: 4, gap: 2 }}>
      <View
        style={{
          width: 34,
          height: 34,
          borderRadius: 17,
          backgroundColor: `${tint}18`,
          borderWidth: 1,
          borderColor: `${tint}44`,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Ionicons name={icon} size={18} color={tint} />
      </View>
      <Text style={{ color: colors.subtext, fontWeight: "800", fontSize: 10 }}>vs</Text>
    </View>
  );
}

function PlatoonMatchupVisual({ platoon, accentColor, colors, isDark }) {
  const batterRole = i18n.t("novaCoach.indicators.platoonBatter", { defaultValue: "Frappeur" });
  const pitcherRole = i18n.t("novaCoach.indicators.platoonPitcher", { defaultValue: "Lanceur" });

  return (
    <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" }}>
      <PlatoonHandFigure
        role="batter"
        handCode={platoon.batSideCode}
        label={batterRole}
        handLabel={platoon.batSide}
        accentColor={accentColor}
        colors={colors}
        isDark={isDark}
      />
      <PlatoonConnector advantageKey={platoon.advantageKey} accentColor={accentColor} colors={colors} />
      <PlatoonHandFigure
        role="pitcher"
        handCode={platoon.throwHandCode}
        label={pitcherRole}
        handLabel={platoon.throwHand}
        accentColor={accentColor}
        colors={colors}
        isDark={isDark}
      />
    </View>
  );
}

function OpposingTeamCard({ opposingTeam, accentColor, accentBg, colors, isDark }) {
  const team = lookupTeamByAbbr("MLB", opposingTeam.abbr);
  const runsAllowed = opposingTeam.runsAllowedPerGame;
  const runsDisplay =
    runsAllowed != null && Number.isFinite(Number(runsAllowed))
      ? Number(runsAllowed).toFixed(2)
      : null;

  return (
    <SectionCard
      title={i18n.t("novaCoach.indicators.opposingTeamTitle", { defaultValue: "Équipe adverse" })}
      accentColor={accentColor}
      accentBg={accentBg}
      colors={colors}
      headerRight={
        opposingTeam.seasonRecord ? (
          <View
            style={{
              paddingHorizontal: 10,
              paddingVertical: 4,
              borderRadius: 999,
              backgroundColor: `${accentColor}22`,
              borderWidth: 1,
              borderColor: `${accentColor}55`,
            }}
          >
            <Text style={{ color: accentColor, fontWeight: "900", fontSize: 12 }}>
              {opposingTeam.seasonRecord}
            </Text>
          </View>
        ) : null
      }
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <TeamLogoBadge team={team} size={48} colors={colors} />
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={{ color: colors.text, fontWeight: "900", fontSize: 18 }}>{opposingTeam.abbr}</Text>
          {team?.name ? (
            <Text style={{ color: colors.subtext, fontWeight: "700", fontSize: 12 }} numberOfLines={2}>
              {team.name}
            </Text>
          ) : null}
        </View>
      </View>

      {runsDisplay ? (
        <View
          style={{
            marginTop: 12,
            paddingVertical: 10,
            paddingHorizontal: 12,
            borderRadius: 12,
            backgroundColor: isDark ? `${accentColor}28` : `${accentColor}14`,
            borderWidth: 1.5,
            borderColor: `${accentColor}55`,
            alignItems: "center",
            gap: 3,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Ionicons name="shield-outline" size={14} color={accentColor} />
            <Text
              style={{
                color: accentColor,
                fontWeight: "900",
                fontSize: 10,
                letterSpacing: 0.5,
                textTransform: "uppercase",
              }}
            >
              {i18n.t("novaCoach.indicators.runsAllowedHighlight", {
                defaultValue: "Points accordés / match",
              })}
            </Text>
          </View>
          <Text style={{ color: accentColor, fontWeight: "900", fontSize: 26, lineHeight: 30 }}>
            {runsDisplay}
          </Text>
          <Text style={{ color: colors.subtext, fontWeight: "700", fontSize: 10 }}>
            {i18n.t("novaCoach.indicators.runsAllowedSeasonNote", {
              defaultValue: "Moyenne saison",
            })}
          </Text>
        </View>
      ) : null}
    </SectionCard>
  );
}

function ParkEnvironmentCard({ model, colors, isDark, lang, contextColor, contextBg, trackColor }) {
  return (
    <SectionCard
      title={i18n.t("novaCoach.indicators.parkAndTemp", { defaultValue: "Parc & température" })}
      accentColor={contextColor}
      accentBg={contextBg}
      colors={colors}
      headerRight={
        model.environment?.contextScore != null ? (
          <ScoreBadge score={model.environment.contextScore} color={contextColor} size="sm" />
        ) : null
      }
    >
      <View style={{ flexDirection: "row", gap: 8 }}>
        <MiniScorePill
          icon="business-outline"
          label={i18n.t("novaCoach.indicators.park", { defaultValue: "Parc" })}
          score={model.environment?.parkScore}
          unavailableLabel={i18n.t("novaCoach.indicators.unavailable", { defaultValue: "—" })}
          rawValue={
            model.environment?.ballparkName
              ? model.environment.ballparkName.slice(0, 18)
              : model.environment?.parkFactorHomeRuns
                ? `HR×${Number(model.environment.parkFactorHomeRuns).toFixed(2)}`
                : null
          }
          color={contextColor}
          colors={colors}
        />
        <MiniScorePill
          icon="thermometer-outline"
          label={i18n.t("novaCoach.indicators.temp", { defaultValue: "Temp." })}
          score={model.environment?.temperatureScore}
          unavailableLabel={i18n.t("novaCoach.indicators.unavailable", { defaultValue: "—" })}
          rawValue={
            model.environment?.weatherNeutralized
              ? i18n.t("novaCoach.indicators.roofClosedShort", { defaultValue: "Toit fermé" })
              : model.environment?.temperatureCelsius != null
                ? `${model.environment.temperatureCelsius} °C`
                : i18n.t("novaCoach.indicators.weatherPending", { defaultValue: "Météo N/D" })
          }
          color={contextColor}
          colors={colors}
        />
      </View>

      {model.environment?.contextScore != null ? (
        <GaugeBar
          score={model.environment.contextScore}
          color={contextColor}
          trackColor={trackColor}
          height={12}
        />
      ) : null}

      {model.environment?.contextScore != null ? (
        <Text style={{ color: contextColor, fontWeight: "900", fontSize: 12 }}>
          {offensiveLabelText(model.environment?.contextLabel, lang)}
        </Text>
      ) : null}

      {!model.environment?.weatherNeutralized &&
      (model.environment?.windSpeedKmh != null || model.environment?.windDirectionText) ? (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            paddingHorizontal: 10,
            paddingVertical: 6,
            borderRadius: 8,
            backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.6)",
          }}
        >
          <Ionicons name="flag-outline" size={14} color={contextColor} />
          <Text style={{ color: colors.subtext, fontWeight: "700", fontSize: 11 }}>
            {model.environment.windSpeedKmh != null ? `${model.environment.windSpeedKmh} km/h` : ""}
            {model.environment.windDirectionText ? ` · ${model.environment.windDirectionText}` : ""}
          </Text>
        </View>
      ) : null}

      {model.environment?.altitudeMeters > 500 ? (
        <Text style={{ color: colors.subtext, fontWeight: "700", fontSize: 11 }}>
          ⛰ {Math.round(model.environment.altitudeMeters)} m
        </Text>
      ) : null}
    </SectionCard>
  );
}

function FgcLineupHero({ model, colors, isDark, lang, trackColor }) {
  const accent = colors.primary;
  const accentBg = isDark ? "rgba(99,102,241,0.15)" : "rgba(99,102,241,0.08)";
  const confDots = confidenceDots(model.verdict?.confidence);
  const slot = model.lineup?.slot;

  return (
    <View
      style={{
        borderRadius: 16,
        borderWidth: 2,
        borderColor: `${accent}55`,
        backgroundColor: accentBg,
        padding: 14,
        gap: 10,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
        {slot != null ? (
          <View
            style={{
              minWidth: 64,
              paddingHorizontal: 12,
              paddingVertical: 8,
              borderRadius: 14,
              backgroundColor: `${accent}22`,
              borderWidth: 2,
              borderColor: `${accent}66`,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ color: accent, fontWeight: "900", fontSize: 28, lineHeight: 32 }}>
              {slot}
            </Text>
            <Text style={{ color: accent, fontWeight: "800", fontSize: 9, opacity: 0.85 }}>
              {i18n.t("novaCoach.lineupSlotShort", { slot, defaultValue: `${slot}e` })}
            </Text>
          </View>
        ) : null}
        <View style={{ flex: 1, gap: 6 }}>
          <Text style={{ color: colors.text, fontWeight: "900", fontSize: 14 }}>
            {i18n.t("novaCoach.indicators.fgcLineupTitle", { defaultValue: "Ordre de frappe & 1re manche" })}
          </Text>
          <Text style={{ color: colors.subtext, fontWeight: "700", fontSize: 12 }}>
            {model.lineup?.sideLabel}
          </Text>
          {model.lineup?.note ? (
            <Text style={{ color: colors.subtext, fontWeight: "600", fontSize: 11, lineHeight: 16 }}>
              {model.lineup.note}
            </Text>
          ) : null}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 }}>
            {Array.from({ length: 4 }).map((_, i) => (
              <View
                key={`fgc-conf-${i}`}
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: i < confDots ? accent : trackColor,
                }}
              />
            ))}
            <Text style={{ color: colors.subtext, fontWeight: "700", fontSize: 10, marginLeft: 4 }}>
              {i18n.t("novaCoach.indicators.confidenceLabel", { defaultValue: "Confiance" })}{" "}
              {i18n.t(`novaCoach.indicators.confidence.${model.verdict?.confidence || "medium"}`, {
                defaultValue: model.verdict?.confidence || "medium",
              })}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

function tpFormatNumber(value, digits = 2) {
  if (value == null || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value);
  return n.toFixed(digits);
}

function tpFormatDiff(value) {
  if (value == null || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value);
  return n > 0 ? `+${n}` : String(n);
}

function tpComparePreferredSide(awayValue, homeValue, prefer) {
  const awayNum = Number(awayValue);
  const homeNum = Number(homeValue);
  if (!prefer || !Number.isFinite(awayNum) || !Number.isFinite(homeNum) || awayNum === homeNum) {
    return { away: false, home: false };
  }
  if (prefer === "higher") {
    return { away: awayNum > homeNum, home: homeNum > awayNum };
  }
  if (prefer === "lower") {
    return { away: awayNum < homeNum, home: homeNum < awayNum };
  }
  return { away: false, home: false };
}

function TpCompareRow({
  label,
  awayValue,
  homeValue,
  awaySubLabel,
  homeSubLabel,
  colors,
  isDark,
  prefer = null,
}) {
  const awayDisplay = awayValue ?? "—";
  const homeDisplay = homeValue ?? "—";
  if (awayDisplay === "—" && homeDisplay === "—") return null;

  const win = tpComparePreferredSide(awayValue, homeValue, prefer);
  const awayColor = win.away ? "#22C55E" : colors.text;
  const homeColor = win.home ? "#22C55E" : colors.text;

  const renderSide = (value, subLabel, color) => (
    <View style={{ flex: 1, alignItems: "center", paddingHorizontal: 4, gap: 4 }}>
      <Text style={{ color, fontWeight: "900", fontSize: 15, textAlign: "center" }}>{value}</Text>
      {subLabel ? (
        <View
          style={{
            paddingHorizontal: 7,
            paddingVertical: 2,
            borderRadius: 999,
            backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)",
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <Text style={{ color: colors.subtext, fontWeight: "800", fontSize: 9, textAlign: "center" }}>
            {subLabel}
          </Text>
        </View>
      ) : null}
    </View>
  );

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 9,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
      }}
    >
      {renderSide(awayDisplay, awaySubLabel, awayColor)}
      <View style={{ width: 96, alignItems: "center", paddingHorizontal: 4 }}>
        <Text
          style={{
            color: colors.subtext,
            fontWeight: "800",
            fontSize: 10,
            textAlign: "center",
            textTransform: "uppercase",
            letterSpacing: 0.3,
          }}
        >
          {label}
        </Text>
      </View>
      {renderSide(homeDisplay, homeSubLabel, homeColor)}
    </View>
  );
}

function TpTeamMatchupCard({ away, home, match, colors, isDark, accentBg }) {
  if (!away?.abbr && !home?.abbr) return null;

  const awayTeam = lookupTeamByAbbr("MLB", away?.abbr);
  const homeTeam = lookupTeamByAbbr("MLB", home?.abbr);

  const rows = [
    {
      key: "record",
      label: i18n.t("novaCoach.indicators.tpCompareRecord", { defaultValue: "Fiche saison" }),
      away: away?.seasonRecord,
      home: home?.seasonRecord,
    },
    {
      key: "rs",
      label: i18n.t("novaCoach.indicators.tpRunsScored", { defaultValue: "Points marqués" }),
      away: tpFormatNumber(away?.runsScoredPerGame),
      home: tpFormatNumber(home?.runsScoredPerGame),
      prefer: "higher",
    },
    {
      key: "ra",
      label: i18n.t("novaCoach.indicators.tpRunsAllowed", { defaultValue: "Points accordés" }),
      away: tpFormatNumber(away?.runsAllowedPerGame),
      home: tpFormatNumber(home?.runsAllowedPerGame),
      prefer: "lower",
    },
    {
      key: "lastTen",
      label: i18n.t("novaCoach.indicators.lastTen", { defaultValue: "10 derniers" }),
      away: away?.lastTen,
      home: home?.lastTen,
    },
    {
      key: "streak",
      label: i18n.t("novaCoach.indicators.streak", { defaultValue: "Série" }),
      away: away?.streak,
      home: home?.streak,
    },
    {
      key: "split",
      label: i18n.t("novaCoach.indicators.tpSplitRecordCenter", { defaultValue: "Fiche" }),
      away: away?.splitRecord,
      home: home?.splitRecord,
      awaySubLabel: i18n.t("novaCoach.indicators.tpAwaySplitTag", { defaultValue: "À l'extérieur" }),
      homeSubLabel: i18n.t("novaCoach.indicators.tpHomeSplitTag", { defaultValue: "À domicile" }),
    },
    {
      key: "diff",
      label: i18n.t("novaCoach.indicators.runDifferential", { defaultValue: "Diff. points" }),
      away: tpFormatDiff(away?.runDifferential),
      home: tpFormatDiff(home?.runDifferential),
      prefer: "higher",
    },
  ];

  return (
    <SectionCard
      title={i18n.t("novaCoach.indicators.tpTeamMatchupTitle", { defaultValue: "Matchup équipes" })}
      accentColor={colors.primary}
      accentBg={accentBg}
      colors={colors}
      headerRight={
        match?.slot != null ? (
          <View
            style={{
              paddingHorizontal: 10,
              paddingVertical: 4,
              borderRadius: 999,
              backgroundColor: `${colors.primary}22`,
              borderWidth: 1,
              borderColor: `${colors.primary}55`,
            }}
          >
            <Text style={{ color: colors.primary, fontWeight: "900", fontSize: 11 }}>
              {i18n.t("novaCoach.indicators.tpMatchSlot", {
                defaultValue: "Match {{slot}}",
                slot: match.slot,
              })}
            </Text>
          </View>
        ) : null
      }
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 14,
          gap: 8,
        }}
      >
        <View style={{ flex: 1, alignItems: "center", gap: 6 }}>
          <TeamLogoBadge team={awayTeam} size={44} colors={colors} />
          <Text style={{ color: colors.text, fontWeight: "900", fontSize: 15 }}>{away?.abbr}</Text>
          {awayTeam?.name ? (
            <Text style={{ color: colors.subtext, fontWeight: "700", fontSize: 10, textAlign: "center" }} numberOfLines={2}>
              {awayTeam.name}
            </Text>
          ) : null}
        </View>
        <Text style={{ color: colors.subtext, fontWeight: "900", fontSize: 18 }}>@</Text>
        <View style={{ flex: 1, alignItems: "center", gap: 6 }}>
          <TeamLogoBadge team={homeTeam} size={44} colors={colors} />
          <Text style={{ color: colors.text, fontWeight: "900", fontSize: 15 }}>{home?.abbr}</Text>
          {homeTeam?.name ? (
            <Text style={{ color: colors.subtext, fontWeight: "700", fontSize: 10, textAlign: "center" }} numberOfLines={2}>
              {homeTeam.name}
            </Text>
          ) : null}
        </View>
      </View>

      <View style={{ borderTopWidth: 1.5, borderTopColor: colors.border, paddingTop: 4 }}>
        {rows.map((row) => (
          <TpCompareRow
            key={row.key}
            label={row.label}
            awayValue={row.away}
            homeValue={row.home}
            awaySubLabel={row.awaySubLabel}
            homeSubLabel={row.homeSubLabel}
            colors={colors}
            isDark={isDark}
            prefer={row.prefer}
          />
        ))}
      </View>
    </SectionCard>
  );
}

function TpPitcherColumn({ pitcher, teamAbbr, accentColor, colors, isDark }) {
  return (
    <View style={{ flex: 1, alignItems: "center", gap: 6, paddingHorizontal: 4 }}>
      <PitcherAvatar pitcher={pitcher} size={52} accentColor={accentColor} isDark={isDark} />
      {pitcher?.name ? (
        <>
          <Text style={{ color: colors.text, fontWeight: "900", fontSize: 14, textAlign: "center" }} numberOfLines={2}>
            {pitcher.name}
          </Text>
          <Text style={{ color: colors.subtext, fontWeight: "700", fontSize: 11, textAlign: "center" }}>
            {teamAbbr || "—"}
          </Text>
        </>
      ) : (
        <Text style={{ color: colors.subtext, fontWeight: "700", fontSize: 12, textAlign: "center" }}>
          {i18n.t("novaCoach.indicators.pitcherTbd", { defaultValue: "À confirmer" })}
        </Text>
      )}
    </View>
  );
}

function TpPitcherMatchupCard({ away, home, colors, isDark, awayAccent, homeAccent, accentBg }) {
  const awayPitcher = away?.pitcher;
  const homePitcher = home?.pitcher;
  if (!awayPitcher?.name && !homePitcher?.name) return null;

  const matchupAccent = colors.primary;

  return (
    <SectionCard
      title={i18n.t("novaCoach.indicators.tpPitcherMatchupTitle", { defaultValue: "Matchup lanceurs" })}
      accentColor={matchupAccent}
      accentBg={accentBg}
      colors={colors}
    >
      <View style={{ flexDirection: "row", alignItems: "flex-start", marginBottom: 12, gap: 8 }}>
        <TpPitcherColumn
          pitcher={awayPitcher}
          teamAbbr={away?.abbr}
          accentColor={awayAccent}
          colors={colors}
          isDark={isDark}
        />
        <View style={{ paddingTop: 14, alignItems: "center", width: 28 }}>
          <Text style={{ color: colors.subtext, fontWeight: "900", fontSize: 12 }}>vs</Text>
        </View>
        <TpPitcherColumn
          pitcher={homePitcher}
          teamAbbr={home?.abbr}
          accentColor={homeAccent}
          colors={colors}
          isDark={isDark}
        />
      </View>

      <View style={{ borderTopWidth: 1.5, borderTopColor: colors.border, paddingTop: 4 }}>
        <TpCompareRow
          label={i18n.t("novaCoach.indicators.tpComparePitcherRecord", { defaultValue: "Fiche V-D" })}
          awayValue={awayPitcher?.winsLosses}
          homeValue={homePitcher?.winsLosses}
          colors={colors}
          isDark={isDark}
        />
        <TpCompareRow
          label="ERA"
          awayValue={awayPitcher?.era}
          homeValue={homePitcher?.era}
          colors={colors}
          isDark={isDark}
          prefer="lower"
        />
      </View>
    </SectionCard>
  );
}

function TpMlbIndicatorContent({ model, colors, isDark, lang }) {
  const awayAccent = isDark ? "#93C5FD" : "#2563EB";
  const homeAccent = isDark ? "#FBBF24" : "#D97706";
  const teamBg = isDark ? "rgba(99,102,241,0.12)" : "rgba(99,102,241,0.08)";
  const pitcherBg = isDark ? "rgba(239,68,68,0.15)" : "rgba(239,68,68,0.08)";
  const pickAccent = colors.primary;
  const pickBg = isDark ? "rgba(99,102,241,0.15)" : "rgba(99,102,241,0.08)";

  return (
    <View style={{ gap: 14 }}>
      <TpTeamMatchupCard
        away={model.away}
        home={model.home}
        match={model.match}
        colors={colors}
        isDark={isDark}
        accentBg={teamBg}
      />

      <TpPitcherMatchupCard
        away={model.away}
        home={model.home}
        colors={colors}
        isDark={isDark}
        awayAccent={awayAccent}
        homeAccent={homeAccent}
        accentBg={pitcherBg}
      />

      {model.participantPick ? (
        <SectionCard
          title={i18n.t("novaCoach.indicators.tpSavedPick", { defaultValue: "Ton pronostic" })}
          accentColor={pickAccent}
          accentBg={pickBg}
          colors={colors}
        >
          <Text style={{ color: colors.text, fontWeight: "900", fontSize: 22, textAlign: "center" }}>
            {model.participantPick.label}
          </Text>
        </SectionCard>
      ) : null}

      {model.risks?.length ? (
        <SectionCard
          title={i18n.t("novaCoach.indicators.risks", { defaultValue: "Risques" })}
          accentColor={isDark ? "#F87171" : "#EF4444"}
          accentBg={isDark ? "rgba(239,68,68,0.15)" : "rgba(239,68,68,0.08)"}
          colors={colors}
        >
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {model.risks.map((r, i) => (
              <RiskChip key={`tp-risk-${i}`} text={r} colors={colors} isDark={isDark} />
            ))}
          </View>
        </SectionCard>
      ) : null}

      {model.reflection ? (
        <View
          style={{
            flexDirection: "row",
            alignItems: "flex-start",
            gap: 10,
            padding: 12,
            borderRadius: 12,
            backgroundColor: isDark ? "rgba(99,102,241,0.12)" : "rgba(99,102,241,0.08)",
            borderWidth: 1,
            borderColor: isDark ? "rgba(99,102,241,0.3)" : "rgba(99,102,241,0.2)",
          }}
        >
          <Ionicons name="chatbubble-ellipses-outline" size={18} color={colors.primary} />
          <Text style={{ color: colors.text, fontWeight: "700", fontSize: 12, flex: 1, lineHeight: 17 }}>
            {model.reflection}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function FgcMlbIndicatorContent({ model, colors, isDark, lang }) {
  const trackColor = isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.08)";
  const seasonAccent = colors.primary;
  const seasonBg = isDark ? "rgba(99,102,241,0.15)" : "rgba(99,102,241,0.08)";
  const platoonAccent =
    model.platoon?.advantageKey === "favorable"
      ? isDark
        ? "#86EFAC"
        : "#16A34A"
      : model.platoon?.advantageKey === "unfavorable"
        ? isDark
          ? "#F87171"
          : "#EF4444"
        : colors.primary;
  const platoonBg = isDark ? "rgba(99,102,241,0.12)" : "rgba(99,102,241,0.08)";
  const teamAccent = isDark ? "#FBBF24" : "#D97706";
  const teamBg = isDark ? "rgba(245,158,11,0.15)" : "rgba(245,158,11,0.08)";
  const matchupAccent =
    model.pitcher?.matchupTier === "strong"
      ? isDark
        ? "#86EFAC"
        : "#16A34A"
      : model.pitcher?.matchupTier === "weak"
        ? isDark
          ? "#F87171"
          : "#EF4444"
        : colors.primary;
  const matchupBg = isDark ? "rgba(239,68,68,0.15)" : "rgba(239,68,68,0.08)";
  const risksAccent = isDark ? "#F87171" : "#EF4444";
  const risksBg = isDark ? "rgba(239,68,68,0.15)" : "rgba(239,68,68,0.08)";

  return (
    <View style={{ gap: 14 }}>
      <FgcLineupHero model={model} colors={colors} isDark={isDark} lang={lang} trackColor={trackColor} />

      {model.stats ? (
        <SectionCard
          title={i18n.t("novaCoach.indicators.fgcSeasonProduction", {
            defaultValue: "Production saison (RBI)",
          })}
          accentColor={seasonAccent}
          accentBg={seasonBg}
          colors={colors}
        >
          <View style={{ flexDirection: "row", gap: 8 }}>
            <StatTile icon="flag-outline" label="RBI" value={String(model.stats.rbi)} colors={colors} lang={lang} />
            <StatTile icon="baseball-outline" label="H" value={String(model.stats.hits)} colors={colors} lang={lang} />
            <StatTile icon="flash-outline" label="HR" value={String(model.stats.homeRuns)} colors={colors} lang={lang} />
            <StatTile
              icon="stats-chart-outline"
              label="AVG"
              value={model.stats.battingAverage ? String(model.stats.battingAverage) : "—"}
              colors={colors}
              lang={lang}
            />
          </View>
        </SectionCard>
      ) : null}

      <PitcherMatchupCard
        pitcher={model.pitcher}
        bvp={model.bvp}
        colors={colors}
        isDark={isDark}
        lang={lang}
        accentColor={matchupAccent}
        accentBg={matchupBg}
      />

      {model.platoon ? (
        <SectionCard
          title={i18n.t("novaCoach.indicators.platoonTitle", { defaultValue: "Avantage platoon" })}
          accentColor={platoonAccent}
          accentBg={platoonBg}
          colors={colors}
          headerRight={
            <View
              style={{
                paddingHorizontal: 10,
                paddingVertical: 4,
                borderRadius: 999,
                backgroundColor: `${platoonAccent}22`,
                borderWidth: 1,
                borderColor: `${platoonAccent}55`,
              }}
            >
              <Text style={{ color: platoonAccent, fontWeight: "900", fontSize: 11 }}>
                {model.platoon.advantage}
              </Text>
            </View>
          }
        >
          <PlatoonMatchupVisual
            platoon={model.platoon}
            accentColor={platoonAccent}
            colors={colors}
            isDark={isDark}
          />
        </SectionCard>
      ) : null}

      {model.opposingTeam?.abbr ? (
        <OpposingTeamCard
          opposingTeam={model.opposingTeam}
          accentColor={teamAccent}
          accentBg={teamBg}
          colors={colors}
          isDark={isDark}
        />
      ) : null}

      {model.risks?.length ? (
        <SectionCard
          title={i18n.t("novaCoach.indicators.risks", { defaultValue: "Risques" })}
          accentColor={risksAccent}
          accentBg={risksBg}
          colors={colors}
        >
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {model.risks.map((r, i) => (
              <RiskChip key={`fgc-risk-${i}`} text={r} colors={colors} isDark={isDark} />
            ))}
          </View>
        </SectionCard>
      ) : null}

      {model.reflection ? (
        <View
          style={{
            flexDirection: "row",
            gap: 10,
            padding: 12,
            borderRadius: 12,
            backgroundColor: isDark ? "rgba(99,102,241,0.15)" : "rgba(99,102,241,0.08)",
            borderWidth: 1,
            borderColor: isDark ? "rgba(99,102,241,0.3)" : "rgba(99,102,241,0.2)",
          }}
        >
          <Ionicons name="chatbubble-ellipses-outline" size={18} color={colors.primary} />
          <Text style={{ color: colors.text, fontWeight: "700", fontSize: 12, flex: 1, lineHeight: 17 }}>
            {model.reflection}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function FgcNhlIndicatorContent({ model, colors, isDark, lang }) {
  const trackColor = isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.08)";
  const accent = colors.primary;
  const accentBg = isDark ? "rgba(99,102,241,0.15)" : "rgba(99,102,241,0.08)";
  const seasonBg = accentBg;
  const risksAccent = isDark ? "#F87171" : "#EF4444";
  const risksBg = isDark ? "rgba(239,68,68,0.15)" : "rgba(239,68,68,0.08)";
  const confDots = confidenceDots(model.verdict?.confidence);

  return (
    <View style={{ gap: 14 }}>
      <View
        style={{
          borderRadius: 16,
          borderWidth: 2,
          borderColor: `${accent}55`,
          backgroundColor: accentBg,
          padding: 14,
          gap: 8,
        }}
      >
        <Text style={{ color: colors.text, fontWeight: "900", fontSize: 16 }}>
          {model.player?.fullName || "—"}
        </Text>
        <Text style={{ color: colors.subtext, fontWeight: "700", fontSize: 12 }}>
          {[model.player?.teamAbbr, model.player?.position, model.player?.sideLabel].filter(Boolean).join(" · ")}
        </Text>
        {model.player?.injury?.status ? (
          <Text style={{ color: isDark ? "#FBBF24" : "#D97706", fontWeight: "700", fontSize: 11 }}>
            {model.player.injury.description || model.player.injury.status}
          </Text>
        ) : null}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <View
              key={`fgc-nhl-conf-${i}`}
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: i < confDots ? accent : trackColor,
              }}
            />
          ))}
          <Text style={{ color: colors.subtext, fontWeight: "700", fontSize: 10, marginLeft: 4 }}>
            {i18n.t("novaCoach.indicators.confidenceLabel", { defaultValue: "Confiance" })}{" "}
            {i18n.t(`novaCoach.indicators.confidence.${model.verdict?.confidence || "medium"}`, {
              defaultValue: model.verdict?.confidence || "medium",
            })}
          </Text>
        </View>
      </View>

      {model.stats ? (
        <SectionCard
          title={i18n.t("novaCoach.indicators.seasonProduction", { defaultValue: "Production saison" })}
          accentColor={accent}
          accentBg={seasonBg}
          colors={colors}
        >
          <View style={{ flexDirection: "row", gap: 8 }}>
            <StatTile icon="flash-outline" label="G" value={String(model.stats.goals)} colors={colors} lang={lang} />
            <StatTile icon="people-outline" label="A" value={String(model.stats.assists)} colors={colors} lang={lang} />
            <StatTile icon="stats-chart-outline" label="P" value={String(model.stats.points)} colors={colors} lang={lang} />
            <StatTile
              icon="trending-up-outline"
              label="PPG"
              value={model.stats.pointsPerGame ? String(model.stats.pointsPerGame) : "—"}
              colors={colors}
              lang={lang}
            />
          </View>
        </SectionCard>
      ) : null}

      {model.matchup?.awayAbbr && model.matchup?.homeAbbr ? (
        <SectionCard
          title={i18n.t("novaCoach.indicators.matchContext", { defaultValue: "Contexte du match" })}
          accentColor={accent}
          accentBg={accentBg}
          colors={colors}
        >
          <Text style={{ color: colors.text, fontWeight: "900", fontSize: 15, textAlign: "center" }}>
            {model.matchup.awayAbbr} @ {model.matchup.homeAbbr}
          </Text>
        </SectionCard>
      ) : null}

      {model.risks?.length ? (
        <SectionCard
          title={i18n.t("novaCoach.indicators.risks", { defaultValue: "Risques" })}
          accentColor={risksAccent}
          accentBg={risksBg}
          colors={colors}
        >
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {model.risks.map((r, i) => (
              <RiskChip key={`fgc-nhl-risk-${i}`} text={r} colors={colors} isDark={isDark} />
            ))}
          </View>
        </SectionCard>
      ) : null}

      {model.reflection ? (
        <View
          style={{
            flexDirection: "row",
            gap: 10,
            padding: 12,
            borderRadius: 12,
            backgroundColor: isDark ? "rgba(99,102,241,0.15)" : "rgba(99,102,241,0.08)",
            borderWidth: 1,
            borderColor: isDark ? "rgba(99,102,241,0.3)" : "rgba(99,102,241,0.2)",
          }}
        >
          <Ionicons name="chatbubble-ellipses-outline" size={18} color={colors.primary} />
          <Text style={{ color: colors.text, fontWeight: "700", fontSize: 12, flex: 1, lineHeight: 17 }}>
            {model.reflection}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

export default function NovaCoachIndicatorView({ model, colors, isDark, lang = "fr" }) {
  const trackColor = isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.08)";

  const globalColor = useMemo(
    () => labelColor(model?.environment?.globalLabel, isDark),
    [model?.environment?.globalLabel, isDark]
  );
  const contextColor = useMemo(
    () => labelColor(model?.environment?.contextLabel, isDark),
    [model?.environment?.contextLabel, isDark]
  );
  const globalBg = useMemo(
    () => labelBgColor(model?.environment?.globalLabel, isDark),
    [model?.environment?.globalLabel, isDark]
  );
  const contextBg = useMemo(
    () => labelBgColor(model?.environment?.contextLabel, isDark),
    [model?.environment?.contextLabel, isDark]
  );

  if (!model) return null;

  if (model.kind === "fgc_mlb") {
    return <FgcMlbIndicatorContent model={model} colors={colors} isDark={isDark} lang={lang} />;
  }

  if (model.kind === "tp_mlb") {
    return <TpMlbIndicatorContent model={model} colors={colors} isDark={isDark} lang={lang} />;
  }

  if (model.kind === "fgc_nhl") {
    return <FgcNhlIndicatorContent model={model} colors={colors} isDark={isDark} lang={lang} />;
  }

  const confDots = confidenceDots(model.verdict?.confidence);
  const globalLabelText = labelText(model.environment?.globalLabel, lang);
  const seasonAccent = colors.primary;
  const seasonBg = isDark ? "rgba(99,102,241,0.15)" : "rgba(99,102,241,0.08)";
  const matchupAccent =
    model.pitcher?.matchupTier === "strong"
      ? isDark
        ? "#86EFAC"
        : "#16A34A"
      : model.pitcher?.matchupTier === "weak"
        ? isDark
          ? "#F87171"
          : "#EF4444"
        : colors.primary;
  const matchupBg = isDark ? "rgba(239,68,68,0.15)" : "rgba(239,68,68,0.08)";
  const risksAccent = isDark ? "#F87171" : "#EF4444";
  const risksBg = isDark ? "rgba(239,68,68,0.15)" : "rgba(239,68,68,0.08)";

  return (
    <View style={{ gap: 14 }}>
      {/* Hero verdict + score global */}
      <View
        style={{
          borderRadius: 16,
          borderWidth: 2,
          borderColor: `${globalColor}55`,
          backgroundColor: globalBg,
          padding: 14,
          gap: 10,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
          {model.environment?.globalScore != null ? (
            <ScoreBadge score={model.environment.globalScore} color={globalColor} size="lg" />
          ) : null}
          <View style={{ flex: 1, gap: 6 }}>
            <View
              style={{
                alignSelf: "flex-start",
                paddingHorizontal: 10,
                paddingVertical: 4,
                borderRadius: 999,
                backgroundColor: `${globalColor}33`,
              }}
            >
              <Text style={{ color: globalColor, fontWeight: "900", fontSize: 12, letterSpacing: 0.3 }}>
                {globalLabelText.toUpperCase()}
              </Text>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              {Array.from({ length: 4 }).map((_, i) => (
                <View
                  key={`conf-${i}`}
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: i < confDots ? globalColor : trackColor,
                  }}
                />
              ))}
              <Text style={{ color: colors.subtext, fontWeight: "700", fontSize: 10, marginLeft: 4 }}>
                {i18n.t("novaCoach.indicators.confidenceLabel", { defaultValue: "Confiance" })}{" "}
                {i18n.t(`novaCoach.indicators.confidence.${model.verdict?.confidence || "medium"}`, {
                  defaultValue: model.verdict?.confidence || "medium",
                })}
              </Text>
            </View>
          </View>
        </View>

        {model.environment?.globalScore != null ? (
          <GaugeBar
            score={model.environment.globalScore}
            color={globalColor}
            trackColor={trackColor}
            height={14}
          />
        ) : null}
      </View>

      {model.stats ? (
        <SectionCard
          title={i18n.t("novaCoach.indicators.seasonProduction", { defaultValue: "Production saison" })}
          accentColor={seasonAccent}
          accentBg={seasonBg}
          colors={colors}
          headerRight={
            model.stats.slgTier && model.stats.slgTier !== "neutral" ? (
              <View
                style={{
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                  borderRadius: 999,
                  backgroundColor: `${seasonAccent}22`,
                  borderWidth: 1,
                  borderColor: `${seasonAccent}55`,
                }}
              >
                <Text style={{ color: seasonAccent, fontWeight: "900", fontSize: 11, textTransform: "uppercase" }}>
                  SLG {tierLabel(model.stats.slgTier, lang)}
                </Text>
              </View>
            ) : null
          }
        >
          <View style={{ flexDirection: "row", gap: 8 }}>
            <StatTile
              icon="baseball-outline"
              label="H"
              value={String(model.stats.hits)}
              colors={colors}
              lang={lang}
            />
            <StatTile
              icon="walk-outline"
              label="R"
              value={String(model.stats.runs)}
              colors={colors}
              lang={lang}
            />
            <StatTile icon="flag-outline" label="RBI" value={String(model.stats.rbi)} colors={colors} lang={lang} />
            <StatTile
              icon="stats-chart-outline"
              label="SLG"
              value={model.stats.slg}
              tier={model.stats.slgTier}
              colors={colors}
              lang={lang}
            />
          </View>
        </SectionCard>
      ) : null}

      <PitcherMatchupCard
        pitcher={model.pitcher}
        bvp={model.bvp}
        colors={colors}
        isDark={isDark}
        lang={lang}
        accentColor={matchupAccent}
        accentBg={matchupBg}
      />

      {model.environment ? (
        <ParkEnvironmentCard
          model={model}
          colors={colors}
          isDark={isDark}
          lang={lang}
          contextColor={contextColor}
          contextBg={contextBg}
          trackColor={trackColor}
        />
      ) : null}

      {model.risks?.length ? (
        <SectionCard
          title={i18n.t("novaCoach.indicators.risks", { defaultValue: "Risques" })}
          accentColor={risksAccent}
          accentBg={risksBg}
          colors={colors}
          headerRight={
            <View
              style={{
                minWidth: 28,
                height: 28,
                borderRadius: 14,
                backgroundColor: `${risksAccent}22`,
                borderWidth: 1,
                borderColor: `${risksAccent}55`,
                alignItems: "center",
                justifyContent: "center",
                paddingHorizontal: 8,
              }}
            >
              <Text style={{ color: risksAccent, fontWeight: "900", fontSize: 12 }}>
                {model.risks.length}
              </Text>
            </View>
          }
        >
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {model.risks.map((r, i) => (
              <RiskChip key={`risk-${i}`} text={r} colors={colors} isDark={isDark} />
            ))}
          </View>
        </SectionCard>
      ) : null}

      {model.reflection ? (
        <View
          style={{
            flexDirection: "row",
            gap: 10,
            padding: 12,
            borderRadius: 12,
            backgroundColor: isDark ? "rgba(99,102,241,0.15)" : "rgba(99,102,241,0.08)",
            borderWidth: 1,
            borderColor: isDark ? "rgba(99,102,241,0.3)" : "rgba(99,102,241,0.2)",
          }}
        >
          <Ionicons name="chatbubble-ellipses-outline" size={18} color={colors.primary} />
          <Text style={{ color: colors.text, fontWeight: "700", fontSize: 12, flex: 1, lineHeight: 17 }}>
            {model.reflection}
          </Text>
        </View>
      ) : null}
    </View>
  );
}
