// src/leaderboard/LeaderboardMemberModal.js
import React, { useMemo, useState } from "react";
import { Modal, View, Text, TouchableOpacity, ScrollView, Image, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import ProphetikIcons from "@src/ui/ProphetikIcons";
import i18n from "@src/i18n/i18n";
import { computeWeightedPeerAverages, listTypesFromComparisons } from "./weightedPeerAverages";
import CompareBar from "@src/ui/charts/CompareBar";
import DonutChart from "@src/ui/charts/DonutChart";

const AVATAR_PLACEHOLDER = require("../../assets/avatar-placeholder.png");

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function clampPct01(x) {
  const n = num(x);
  return Math.max(0, Math.min(1, n));
}

function fmtInt(n) {
  return String(Math.round(num(n)));
}

function fmtDec2(n) {
  return num(n).toFixed(2);
}

function fmtSigned(n) {
  const x = num(n);
  const sign = x > 0 ? "+" : "";
  return `${sign}${Math.round(x)}`;
}

function fmtSignedDec1(n) {
  const x = num(n);
  const sign = x > 0 ? "+" : "";
  return `${sign}${x.toFixed(1)}`;
}

function fmtSignedPct(p) {
  const v = num(p) * 100;
  const sign = v > 0 ? "+" : "";
  return `${sign}${Math.round(v)}%`;
}

function typeLabel(typeKey) {
  const t = String(typeKey);
  return `${t}x${t}`;
}

function Card({ colors, children, style }) {
  return (
    <View
      style={[
        {
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.card,
          borderRadius: 16,
          padding: 14,

          // 🌫️ Ombre (iOS)
          shadowColor: colors.primary,
          shadowOpacity: 0.12,
          shadowOffset: { width: 0, height: 4 },
          shadowRadius: 12,

          // 🌫️ Ombre (Android)
          elevation: 5,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

function Row({ left, right }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
      <View style={{ flex: 1 }}>{left}</View>
      <View>{right}</View>
    </View>
  );
}

function Pill({ colors, icon, label, tone = "neutral" }) {
  const bg =
    tone === "good"
      ? "rgba(34,197,94,0.12)"
      : tone === "bad"
      ? "rgba(239,68,68,0.12)"
      : "rgba(148,163,184,0.10)";

  const border =
    tone === "good"
      ? "rgba(34,197,94,0.30)"
      : tone === "bad"
      ? "rgba(239,68,68,0.30)"
      : colors.border;

  const iconColor =
    tone === "good" ? "#22c55e" : tone === "bad" ? "#ef4444" : colors.subtext;

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 999,
        backgroundColor: bg,
        borderWidth: 1,
        borderColor: border,
      }}
    >
      <MaterialCommunityIcons name={icon} size={14} color={iconColor} />
      <Text style={{ color: colors.text, fontWeight: "900", fontSize: 12 }}>{label}</Text>
    </View>
  );
}

/**
 * mode:
 * - "pct"  => deltaPct (fraction) affiché en %
 * - "int"  => delta affiché en points (arrondi)
 * - "dec1" => delta affiché avec 1 décimale
 */
function DeltaBadge({ colors, delta, deltaPct, mode = "pct" }) {
  const base = mode === "pct" ? deltaPct : delta;

  const isGood = num(base) > 0;
  const isBad = num(base) < 0;

  const tone = isGood ? "good" : isBad ? "bad" : "neutral";
  const icon = isGood ? "trending-up" : isBad ? "trending-down" : "minus";

  const label =
    mode === "pct" ? fmtSignedPct(deltaPct) :
    mode === "dec1" ? fmtSignedDec1(delta) :
    fmtSigned(delta);

  return <Pill colors={colors} icon={icon} label={label} tone={tone} />;
}

function SectionTitle({ colors, title, subtitle }) {
  return (
    <View style={{ gap: 4 }}>
      <Text style={{ color: colors.text, fontWeight: "900", fontSize: 15 }}>{title}</Text>
      {subtitle ? <Text style={{ color: colors.subtext, fontSize: 12 }}>{subtitle}</Text> : null}
    </View>
  );
}

function Accordion({ colors, title, open, onToggle, children, right }) {
  return (
    <View style={{ marginTop: 12 }}>
      {/* ✅ Un seul conteneur (le tiroir) */}
      <View
        style={{
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.card2 ?? colors.card,
          borderRadius: 14,
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <TouchableOpacity
          onPress={onToggle}
          activeOpacity={0.85}
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingVertical: 10,
            paddingHorizontal: 12,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <MaterialCommunityIcons
              name={open ? "chevron-up" : "chevron-down"}
              size={18}
              color={colors.subtext}
            />
            <Text style={{ color: colors.text, fontWeight: "900" }}>{title}</Text>
          </View>
          {right ? <View>{right}</View> : null}
        </TouchableOpacity>

        {/* Contenu (dans le même tiroir) */}
        {open ? (
          <View
            style={{
              borderTopWidth: 1,
              borderTopColor: colors.border,
              padding: 10,
            }}
          >
            {children}
          </View>
        ) : null}
      </View>
    </View>
  );
}

export default function LeaderboardMemberModal({
  visible,
  onClose,
  row,
  peerRows, // ✅ rows du groupe (pour calculer la moyenne des autres)
  colors,
  tierLower, // gardé si tu veux afficher VIP/PRO
  onUpgrade,
}) {
  const t = i18n.t.bind(i18n);

  const displayName = row?.displayName || row?.uid || row?.id || "—";
  const avatarUrl = row?.avatarUrl || null;
  const avatarSource = avatarUrl ? { uri: avatarUrl } : AVATAR_PLACEHOLDER;

  const tier = String(tierLower || "free").toLowerCase();
  const isVip = tier === "vip";
  const isPro = tier === "pro" || tier === "starter";

  // Accordions
  const [openPoints, setOpenPoints] = useState(false);
  const [openRate, setOpenRate] = useState(false);
  const [openAvg, setOpenAvg] = useState(false); // ✅ réutilisé pour Carte 3 NHL

  const comp = useMemo(() => computeWeightedPeerAverages({ row, peerRows }), [row, peerRows]);
  const types = useMemo(() => listTypesFromComparisons(comp), [comp]);

  const me = comp?.me || {};
  const others = comp?.others || {};

  const insets = useSafeAreaInsets();
  const presentationStyle = Platform.OS === "ios" ? "fullScreen" : "fullScreen";

  if (!visible) return null;
  if (!colors) return null;

  return (
    <Modal visible={!!visible} animationType="slide" presentationStyle={presentationStyle} onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        {/* Header */}
        <View
          style={{
            paddingTop: insets.top,
            paddingHorizontal: 16,
            paddingBottom: 14,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
            backgroundColor: colors.background,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Text style={{ color: colors.subtext, fontWeight: "800", fontSize: 12 }}>
              {t("leaderboardMember.header.title", { defaultValue: "Détails participant" })}
            </Text>

            <TouchableOpacity
              onPress={onClose}
              style={{
                padding: 8,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.card,
              }}
              hitSlop={{ top: 10, left: 10, right: 10, bottom: 10 }}
            >
              <MaterialCommunityIcons name="close" size={20} color={colors.text} />
            </TouchableOpacity>
          </View>

          <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginTop: 12 }}>
            <Image
              source={avatarSource}
              style={{
                width: 46,
                height: 46,
                borderRadius: 23,
                backgroundColor: colors.border,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            />

            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text, fontWeight: "900", fontSize: 18 }} numberOfLines={1}>
                {displayName}
              </Text>

              <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 6 }}>
                <Pill
                  colors={colors}
                  icon="account-group"
                  label={t("leaderboardMember.header.othersCount", {
                    count: fmtInt(others.count),
                    defaultValue: "{{count}} autres",
                  })}
                  tone="neutral"
                />
                <Pill
                  colors={colors}
                  icon={isVip ? "crown" : isPro ? "star" : "star-outline"}
                  label={isVip ? "VIP" : isPro ? "PRO" : "FREE"}
                  tone={isVip ? "good" : "neutral"}
                />
              </View>
            </View>
          </View>

          {/* Option upgrade */}
          {!isVip && isPro && onUpgrade ? (
            <TouchableOpacity
              onPress={() => {
                onClose?.();
                setTimeout(() => onUpgrade?.(), 0);
              }}
              activeOpacity={0.9}
              style={{
                marginTop: 12,
                paddingVertical: 10,
                paddingHorizontal: 12,
                borderRadius: 14,
                backgroundColor: colors.primary,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <View style={{ flex: 1, paddingRight: 10 }}>
                <Text style={{ color: "#fff", fontWeight: "900" }}>
                  {t("leaderboardMember.upgrade.title", { defaultValue: "Débloquer VIP" })}
                </Text>
                <Text style={{ color: "#fff", opacity: 0.9, fontSize: 12, marginTop: 2 }}>
                  {t("leaderboardMember.upgrade.body", {
                    defaultValue: "Comparaisons avancées + tendances",
                  })}
                </Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={22} color="#fff" />
            </TouchableOpacity>
          ) : null}
        </View>

        <ScrollView
          contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 22 + insets.bottom }}
          contentInsetAdjustmentBehavior="never"
        >
          {/* Carte 1 — Points */}
          <Card colors={colors}>
            <SectionTitle
              colors={colors}
              title={t("leaderboardMember.cards.points.title", { defaultValue: "Pointage" })}
              subtitle={t("leaderboardMember.cards.points.subtitle", {
                defaultValue: "Comparaison avec la moyenne pondérée des autres participants",
              })}
            />

            <CompareBar
              colors={colors}
              me={me.points}
              other={others.avgPointsTotal}
              labelLeft={t("leaderboardMember.common.avgOthers", { defaultValue: "Moyenne des autres" })}
              labelRight={t("leaderboardMember.common.me", { defaultValue: "Toi" })}
            />

            <Accordion
              colors={colors}
              title={t("leaderboardMember.cards.points.byTypeTitle", { defaultValue: "Détail par type de défi" })}
              open={openPoints}
              onToggle={() => setOpenPoints((v) => !v)}
              right={
                <Text style={{ color: colors.subtext, fontWeight: "900" }}>
                  {types.length
                    ? t("leaderboardMember.common.typesCount", { count: types.length, defaultValue: "{{count}} types" })
                    : "—"}
                </Text>
              }
            >
              {!types.length ? (
                <Text style={{ color: colors.subtext }}>
                  {t("leaderboardMember.common.noDataByType", { defaultValue: "Aucune donnée par type." })}
                </Text>
              ) : (
                <View style={{ gap: 10 }}>
                  {types.map((typeKey, idx) => {
                    const m = me.byType?.[typeKey] || {};
                    const o = others.byType?.[typeKey] || {};

                    const mePts = num(m.points);
                    const otherAvgPts = num(o.avgPointsTotal);
                    const deltaPts = mePts - otherAvgPts;

                    return (
                      <View key={typeKey} style={{ paddingVertical: 10 }}>
                        {/* Header */}
                        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}>
                            <Text style={{ color: colors.text, fontWeight: "900" }}>{typeLabel(typeKey)}</Text>
                            <Text style={{ color: colors.subtext, fontWeight: "800", fontSize: 12 }}>
                              {t("leaderboardMember.common.challengesCount", {
                                count: fmtInt(m.plays),
                                defaultValue: "({{count}} défis)",
                              })}
                            </Text>
                          </View>

                          <DeltaBadge colors={colors} delta={deltaPts} deltaPct={0} mode="int" />
                        </View>

                        {/* Compare bar */}
                        <View style={{ marginTop: 10 }}>
                          <CompareBar
                            colors={colors}
                            me={mePts}
                            other={otherAvgPts}
                            labelLeft={t("leaderboardMember.common.avgOthers", { defaultValue: "Moyenne des autres" })}
                            labelRight={t("leaderboardMember.common.me", { defaultValue: "Toi" })}
                            height={10}
                          />
                        </View>

                        {/* Bottom line */}
                        <View style={{ marginTop: 8, flexDirection: "row", justifyContent: "space-between" }}>
                          <Text style={{ color: colors.subtext, fontWeight: "800", fontSize: 12 }}>
                            {t("leaderboardMember.common.meValue", {
                              value: fmtInt(mePts),
                              defaultValue: "Toi: {{value}}",
                            })}
                          </Text>
                          <Text style={{ color: colors.subtext, fontWeight: "800", fontSize: 12 }}>
                            {t("leaderboardMember.common.avgShortValue", {
                              value: fmtInt(otherAvgPts),
                              defaultValue: "Moy.: {{value}}",
                            })}
                          </Text>
                        </View>

                        {idx < types.length - 1 && (
                          <View style={{ height: 1, backgroundColor: colors.border, marginTop: 12, opacity: 0.6 }} />
                        )}
                      </View>
                    );
                  })}
                </View>
              )}
            </Accordion>
          </Card>

          {/* Carte 2 — Win rate */}
          <Card colors={colors}>
            <SectionTitle
              colors={colors}
              title={t("leaderboardMember.cards.winRate.title", { defaultValue: "Taux de conversion des défis" })}
              subtitle={t("leaderboardMember.cards.winRate.subtitle", {
                defaultValue: "Win rate global + par type (pondéré par nombre de défis).",
              })}
            />

            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, marginTop: 10 }}>
              <View style={{ alignItems: "center" }}>
                <DonutChart
                  value={clampPct01(me.winRate)}
                  size={108}
                  stroke="#ef4444"
                  track={colors.border}
                  strokeWidth={12}
                  label={t("leaderboardMember.common.me", { defaultValue: "Toi" })}
                  labelColor={colors.text}
                  subLabel={`${fmtInt(me.wins)} W / ${fmtInt(me.plays)} P`}
                  subColor={colors.subtext}
                />
              </View>

              <View style={{ alignItems: "center" }}>
                <DonutChart
                  value={clampPct01(others.winRate)}
                  size={108}
                  stroke="#94a3b8"
                  track={colors.border}
                  strokeWidth={12}
                  label={t("leaderboardMember.common.others", { defaultValue: "Les autres" })}
                  labelColor={colors.text}
                  subLabel={`${fmtInt(others.wins)} W / ${fmtInt(others.plays)} P`}
                  subColor={colors.subtext}
                />
              </View>

              <View style={{ alignItems: "flex-end", gap: 8 }}>
                <DeltaBadge
                  colors={colors}
                  delta={0}
                  deltaPct={num(me.winRate) - num(others.winRate)}
                  mode="pct"
                />
                <Text style={{ color: colors.subtext, fontWeight: "900", fontSize: 12 }}>
                  {t("leaderboardMember.common.difference", { defaultValue: "Différence" })}
                </Text>
              </View>
            </View>

            <Accordion
              colors={colors}
              title={t("leaderboardMember.cards.winRate.byTypeTitle", { defaultValue: "Win rate par type de défi" })}
              open={openRate}
              onToggle={() => setOpenRate((v) => !v)}
            >
              {!types.length ? (
                <Text style={{ color: colors.subtext }}>
                  {t("leaderboardMember.common.noDataByType", { defaultValue: "Aucune donnée par type." })}
                </Text>
              ) : (
                <View style={{ gap: 10 }}>
                  {types.map((typeKey, idx) => {
                    const m = me.byType?.[typeKey] || {};
                    const o = others.byType?.[typeKey] || {};

                    const meRate = clampPct01(m.winRate);
                    const otherRate = clampPct01(o.winRate);
                    const deltaRate = meRate - otherRate;

                    return (
                      <View key={typeKey} style={{ paddingVertical: 10 }}>
                        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}>
                            <Text style={{ color: colors.text, fontWeight: "900" }}>{typeLabel(typeKey)}</Text>
                            <Text style={{ color: colors.subtext, fontWeight: "800", fontSize: 12 }}>
                              ({fmtInt(m.wins)} W / {fmtInt(m.plays)} P)
                            </Text>
                          </View>

                          <DeltaBadge colors={colors} delta={0} deltaPct={deltaRate} mode="pct" />
                        </View>

                        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 10 }}>
                          <DonutChart
                            value={meRate}
                            size={86}
                            stroke="#ef4444"
                            track={colors.border}
                            strokeWidth={10}
                            label={t("leaderboardMember.common.me", { defaultValue: "Toi" })}
                            labelColor={colors.text}
                            subLabel={`${fmtInt(m.wins)} W`}
                            subColor={colors.subtext}
                          />

                          <DonutChart
                            value={otherRate}
                            size={86}
                            stroke="#94a3b8"
                            track={colors.border}
                            strokeWidth={10}
                            label={t("leaderboardMember.common.avgShort", { defaultValue: "Moy." })}
                            labelColor={colors.text}
                            subLabel={`${fmtInt(o.wins)} W`}
                            subColor={colors.subtext}
                          />

                          <View style={{ alignItems: "flex-end", gap: 6 }}>
                            <Text style={{ color: colors.subtext, fontWeight: "900", fontSize: 12 }}>
                              {t("leaderboardMember.common.diffShort", { defaultValue: "Diff." })}
                            </Text>
                            <DeltaBadge colors={colors} delta={0} deltaPct={deltaRate} mode="pct" />
                          </View>
                        </View>

                        {idx < types.length - 1 && (
                          <View style={{ height: 1, backgroundColor: colors.border, marginTop: 12, opacity: 0.6 }} />
                        )}
                      </View>
                    );
                  })}
                </View>
              )}
            </Accordion>
          </Card>

          {/* Carte 3 — NHL PPG (VIP seulement) */}
          {isVip ? (
            <Card colors={colors}>
              <SectionTitle
                colors={colors}
                title={t("leaderboardMember.cards.nhl.title", { defaultValue: "Performance des joueurs" })}
                subtitle={t("leaderboardMember.cards.nhl.subtitle", {
                  defaultValue: "Points réels générés par tes sélections (PPG = points / matchs).",
                })}
              />

              {(() => {
                const maxPPG = Math.max(0.01, num(me.nhlPPG), num(others.nhlPPG));
                const mePPG01 = clampPct01(num(me.nhlPPG) / maxPPG);
                const otherPPG01 = clampPct01(num(others.nhlPPG) / maxPPG);
                const deltaPPG = num(me.nhlPPG) - num(others.nhlPPG);

                return (
                  <View style={{ marginTop: 10 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                      <DonutChart
                        value={mePPG01}
                        size={108}
                        stroke="#ef4444"
                        track={colors.border}
                        strokeWidth={12}
                        showPercent={false}
                        centerText={fmtDec2(me.nhlPPG)}
                        label={t("leaderboardMember.common.me", { defaultValue: "Toi" })}
                        labelColor={colors.text}
                        subLabel={t("leaderboardMember.common.gamesCount", {
                          count: fmtInt(me.nhlGamesTotal),
                          defaultValue: "{{count}} matchs",
                        })}
                        subColor={colors.subtext}
                      />

                      <DonutChart
                        value={otherPPG01}
                        size={108}
                        stroke="#94a3b8"
                        track={colors.border}
                        strokeWidth={12}
                        showPercent={false}
                        centerText={fmtDec2(others.nhlPPG)}
                        label={t("leaderboardMember.common.avgOthersShort", { defaultValue: "Moy. autres" })}
                        labelColor={colors.text}
                        subLabel={t("leaderboardMember.common.gamesCount", {
                          count: fmtInt(others.nhlGamesTotal),
                          defaultValue: "{{count}} matchs",
                        })}
                        subColor={colors.subtext}
                      />

                      <View style={{ alignItems: "flex-end", gap: 8 }}>
                        <DeltaBadge colors={colors} delta={deltaPPG} deltaPct={0} mode="dec1" />
                        <Text style={{ color: colors.subtext, fontWeight: "900", fontSize: 12 }}>
                          {t("leaderboardMember.cards.nhl.diffPpg", { defaultValue: "Diff. PPG" })}
                        </Text>
                      </View>
                    </View>
                  </View>
                );
              })()}

              <Accordion
                colors={colors}
                title={t("leaderboardMember.cards.nhl.byTypeTitle", { defaultValue: "PPG par type de défi" })}
                open={openAvg}
                onToggle={() => setOpenAvg((v) => !v)}
                right={
                  <Text style={{ color: colors.subtext, fontWeight: "900" }}>
                    {types.length
                      ? t("leaderboardMember.common.typesCount", { count: types.length, defaultValue: "{{count}} types" })
                      : "—"}
                  </Text>
                }
              >
                {!types.length ? (
                  <Text style={{ color: colors.subtext }}>
                    {t("leaderboardMember.common.noDataByType", { defaultValue: "Aucune donnée par type." })}
                  </Text>
                ) : (
                  <View>
                    {types.map((typeKey, idx) => {
                      const m = me.byType?.[typeKey] || {};
                      const o = others.byType?.[typeKey] || {};

                      const mePPG = num(m.nhlPPG);
                      const otherPPG = num(o.nhlPPG);
                      const delta = mePPG - otherPPG;

                      const maxType = Math.max(0.01, mePPG, otherPPG);
                      const me01 = clampPct01(mePPG / maxType);
                      const other01 = clampPct01(otherPPG / maxType);

                      return (
                        <View key={typeKey} style={{ paddingVertical: 10 }}>
                          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}>
                              <Text style={{ color: colors.text, fontWeight: "900" }}>{typeLabel(typeKey)}</Text>
                              <Text style={{ color: colors.subtext, fontWeight: "800", fontSize: 12 }}>
                                {t("leaderboardMember.common.gamesCount", {
                                  count: fmtInt(m.nhlGamesTotal),
                                  defaultValue: "{{count}} matchs",
                                })}
                              </Text>
                            </View>
                            <DeltaBadge colors={colors} delta={delta} deltaPct={0} mode="dec1" />
                          </View>

                          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, marginTop: 10 }}>
                            <DonutChart
                              value={me01}
                              size={86}
                              stroke="#ef4444"
                              track={colors.border}
                              strokeWidth={10}
                              showPercent={false}
                              centerText={fmtDec2(mePPG)}
                              label={t("leaderboardMember.common.me", { defaultValue: "Toi" })}
                              labelColor={colors.text}
                              subLabel={t("leaderboardMember.common.pointsShort", {
                                value: fmtInt(m.nhlPointsTotal),
                                defaultValue: "{{value}} pts",
                              })}
                              subColor={colors.subtext}
                            />

                            <DonutChart
                              value={other01}
                              size={86}
                              stroke="#94a3b8"
                              track={colors.border}
                              strokeWidth={10}
                              showPercent={false}
                              centerText={fmtDec2(otherPPG)}
                              label={t("leaderboardMember.common.avgShort", { defaultValue: "Moy." })}
                              labelColor={colors.text}
                              subLabel={t("leaderboardMember.common.pointsShort", {
                                value: fmtInt(o.nhlPointsTotal),
                                defaultValue: "{{value}} pts",
                              })}
                              subColor={colors.subtext}
                            />

                            <View style={{ alignItems: "flex-end", gap: 6 }}>
                              <Text style={{ color: colors.subtext, fontWeight: "900", fontSize: 12 }}>
                                {t("leaderboardMember.common.ppg", { defaultValue: "PPG" })}
                              </Text>
                              <Text style={{ color: colors.subtext, fontWeight: "800", fontSize: 12 }}>
                                {fmtInt(m.nhlPointsTotal)} / {fmtInt(m.nhlGamesTotal)}
                              </Text>
                            </View>
                          </View>

                          {idx < types.length - 1 ? (
                            <View style={{ height: 1, backgroundColor: colors.border, marginTop: 12, opacity: 0.6 }} />
                          ) : null}
                        </View>
                      );
                    })}
                  </View>
                )}
              </Accordion>
            </Card>
          ) : null}

          {/* Footer */}
          <Text style={{ color: colors.subtext, fontSize: 12 }}>
            {t("leaderboardMember.footer", {
              plays: fmtInt(me.plays),
              wins: fmtInt(me.wins),
              others: fmtInt(others.count),
              defaultValue:
                "Données: {{plays}} défis, {{wins}} victoires · Comparaison sur {{others}} autres.",
            })}
          </Text>
        </ScrollView>
      </View>
    </Modal>
  );
}