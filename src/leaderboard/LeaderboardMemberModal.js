import React, { useMemo, useState } from "react";
import { Modal, View, Text, TouchableOpacity, ScrollView, Image, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import i18n from "@src/i18n/i18n";
import CompareBar from "@src/ui/charts/CompareBar";

const AVATAR_PLACEHOLDER = require("../../assets/avatar-placeholder.png");
const RED = "#b91c1c";

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function fmtInt(n) {
  return String(Math.round(num(n)));
}

function fmtSigned(n) {
  const x = num(n);
  const sign = x > 0 ? "+" : "";
  return `${sign}${Math.round(x)}`;
}

function prophetikCardStyle(colors, accent = RED) {
  return {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 14,

    shadowColor: colors.primary,
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 5,

    borderLeftWidth: 4,
    borderLeftColor: accent,
    borderBottomWidth: 2,
    borderBottomColor: accent,
  };
}

function Card({ colors, children, style }) {
  return <View style={[prophetikCardStyle(colors), style]}>{children}</View>;
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

function DeltaBadge({ colors, delta }) {
  const n = num(delta);
  const tone = n > 0 ? "good" : n < 0 ? "bad" : "neutral";
  const icon = n > 0 ? "trending-up" : n < 0 ? "trending-down" : "trending-neutral";
  return <Pill colors={colors} icon={icon} label={fmtSigned(n)} tone={tone} />;
}

function SectionTitle({ colors, title, subtitle }) {
  return (
    <View style={{ gap: 4 }}>
      <Text style={{ color: colors.text, fontWeight: "900", fontSize: 15 }}>{title}</Text>
      {subtitle ? <Text style={{ color: colors.subtext, fontSize: 12 }}>{subtitle}</Text> : null}
    </View>
  );
}

function SegmentButton({ active, label, onPress, colors }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.9}
      style={{
        flex: 1,
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: active ? colors.primary : colors.border,
        backgroundColor: active ? colors.primary : colors.card,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text
        style={{
          color: active ? "#fff" : colors.text,
          fontWeight: "900",
          fontSize: 13,
        }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function getFamilyLabel(key, t) {
  if (key === "total") return t("leaderboardMember.family.total", { defaultValue: "Total" });
  if (key === "fgc") return t("leaderboardMember.family.fgc", { defaultValue: "Premier but" });
  if (key === "standard") return t("leaderboardMember.family.standard", { defaultValue: "Standard" });
  if (key === "ascension") return t("leaderboardMember.family.ascension", { defaultValue: "Ascension" });
  return key;
}

function getFamilyIcon(key) {
  if (key === "total") return "◎";
  if (key === "fgc") return "🏒";
  if (key === "standard") return "🎯";
  if (key === "ascension") return "🏔";
  return "◎";
}

function computeFamilyComparisons(row, peerRows) {
  const me = row || {};
  const peers = Array.isArray(peerRows) ? peerRows : [];

  const meId = String(me?.uid || me?.id || "");
  const others = peers.filter((p) => String(p?.uid || p?.id || "") !== meId);

  const mePoints = {
    total: num(me?.pointsTotal),
    fgc: num(me?.fgcPoints),
    standard: num(me?.standardPoints),
    ascension: num(me?.ascensionPoints),
  };

  const meWins = {
    total: num(me?.wins),
    fgc: num(me?.fgcWins),
    standard: num(me?.standardWins),
    ascension: num(me?.ascensionWins),
  };

  const participantCount = peers.length;
  const othersCount = others.length;

  const avgPoints = {
    total: othersCount ? others.reduce((s, p) => s + num(p?.pointsTotal), 0) / othersCount : 0,
    fgc: othersCount ? others.reduce((s, p) => s + num(p?.fgcPoints), 0) / othersCount : 0,
    standard: othersCount ? others.reduce((s, p) => s + num(p?.standardPoints), 0) / othersCount : 0,
    ascension: othersCount ? others.reduce((s, p) => s + num(p?.ascensionPoints), 0) / othersCount : 0,
  };

  const avgWins = {
    total: othersCount ? others.reduce((s, p) => s + num(p?.wins), 0) / othersCount : 0,
    fgc: othersCount ? others.reduce((s, p) => s + num(p?.fgcWins), 0) / othersCount : 0,
    standard: othersCount ? others.reduce((s, p) => s + num(p?.standardWins), 0) / othersCount : 0,
    ascension: othersCount ? others.reduce((s, p) => s + num(p?.ascensionWins), 0) / othersCount : 0,
  };

  return {
    participantCount,
    othersCount,
    mePoints,
    avgPoints,
    meWins,
    avgWins,
  };
}

function FamilyModeCard({
  colors,
  icon,
  label,
  meValue,
  avgValue,
  mode,
}) {
  const delta = num(meValue) - num(avgValue);
  const isWins = mode === "wins";

  return (
    <Card colors={colors}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}>
          <Text style={{ fontSize: 18 }}>{icon}</Text>
          <Text style={{ color: colors.text, fontWeight: "900", fontSize: 15 }}>{label}</Text>
        </View>

        <DeltaBadge colors={colors} delta={delta} />
      </View>

      <View style={{ marginTop: 12 }}>
        <CompareBar
          colors={colors}
          me={meValue}
          other={avgValue}
          labelLeft="Moy. autres"
          labelRight="Toi"
          height={10}
        />
      </View>

      <View
        style={{
          marginTop: 10,
          flexDirection: "row",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <Text style={{ color: colors.subtext, fontWeight: "800", fontSize: 12 }}>
          {isWins ? `Toi: ${fmtInt(meValue)} V` : `Toi: ${fmtInt(meValue)}`}
        </Text>

        <Text style={{ color: colors.subtext, fontWeight: "800", fontSize: 12 }}>
          {isWins ? `Moy.: ${fmtInt(avgValue)} V` : `Moy.: ${fmtInt(avgValue)}`}
        </Text>
      </View>
    </Card>
  );
}

export default function LeaderboardMemberModal({
  visible,
  onClose,
  row,
  peerRows,
  colors,
}) {
  const t = i18n.t.bind(i18n);

  const displayName = row?.displayName || row?.uid || row?.id || "—";
  const avatarUrl = row?.avatarUrl || null;
  const avatarSource = avatarUrl ? { uri: avatarUrl } : AVATAR_PLACEHOLDER;

  const insets = useSafeAreaInsets();
  const presentationStyle = Platform.OS === "ios" ? "fullScreen" : "fullScreen";

  const comp = useMemo(() => computeFamilyComparisons(row, peerRows), [row, peerRows]);

  const [mode, setMode] = useState("points"); // "points" | "wins"

  const families = ["total", "fgc", "standard", "ascension"];

  const totalValue = mode === "points" ? comp.mePoints.total : comp.meWins.total;
  const totalLabel =
    mode === "points"
      ? t("leaderboardMember.mode.points", { defaultValue: "Pointage" })
      : t("leaderboardMember.mode.wins", { defaultValue: "Victoires" });

  if (!visible) return null;
  if (!colors) return null;

  return (
    <Modal
      visible={!!visible}
      animationType="slide"
      presentationStyle={presentationStyle}
      onRequestClose={onClose}
    >
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
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
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
              <Text
                style={{ color: colors.text, fontWeight: "900", fontSize: 18 }}
                numberOfLines={1}
              >
                {displayName}
              </Text>

              <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 6 }}>
                <Pill
                  colors={colors}
                  icon="account-group"
                  label={t("leaderboardMember.header.participantsCount", {
                    count: fmtInt(comp.participantCount),
                    defaultValue: "{{count}} participants",
                  })}
                  tone="neutral"
                />
              </View>
            </View>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 22 + insets.bottom }}
          contentInsetAdjustmentBehavior="never"
        >


          {/* Switcher */}
          <Card colors={colors}>
            <SectionTitle
              colors={colors}
              title={t("leaderboardMember.switcher.title", { defaultValue: "Affichage" })}
              subtitle={t("leaderboardMember.switcher.subtitle", {
                defaultValue: "Choisis entre le pointage et les victoires.",
              })}
            />

            <View
              style={{
                marginTop: 12,
                flexDirection: "row",
                gap: 10,
              }}
            >
              <SegmentButton
                colors={colors}
                active={mode === "points"}
                label={t("leaderboardMember.mode.points", { defaultValue: "Pointage" })}
                onPress={() => setMode("points")}
              />
              <SegmentButton
                colors={colors}
                active={mode === "wins"}
                label={t("leaderboardMember.mode.wins", { defaultValue: "Victoires" })}
                onPress={() => setMode("wins")}
              />
            </View>
          </Card>

          {/* 4 cartes familles */}
          {families.map((key) => (
            <FamilyModeCard
              key={key}
              colors={colors}
              icon={getFamilyIcon(key)}
              label={getFamilyLabel(key, t)}
              meValue={mode === "points" ? comp.mePoints[key] : comp.meWins[key]}
              avgValue={mode === "points" ? comp.avgPoints[key] : comp.avgWins[key]}
              mode={mode}
            />
          ))}

          {/* Footer */}
          <Text style={{ color: colors.subtext, fontSize: 12 }}>
            {t("leaderboardMember.footer", {
              wins: fmtInt(comp.meWins.total),
              points: fmtInt(comp.mePoints.total),
              others: fmtInt(comp.othersCount),
              participants: fmtInt(comp.participantCount),
              defaultValue:
                "Données: {{points}} points, {{wins}} victoires · Comparaison sur {{others}} autres parmi {{participants}} participants.",
            })}
          </Text>
        </ScrollView>
      </View>
    </Modal>
  );
}