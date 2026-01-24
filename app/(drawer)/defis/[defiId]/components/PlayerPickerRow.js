// app/defis/[defiId]/components/PlayerPickerRow.js
import React, { useMemo } from "react";
import { View, Text, TouchableOpacity, Image } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@src/theme/ThemeProvider";
import i18n from "@src/i18n/i18n";

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function formatShortName(fullName = "") {
  const s = String(fullName || "").trim();
  if (!s) return "—";
  const parts = s.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0];
  const first = parts[0];
  const last = parts[parts.length - 1];
  return `${first.slice(0, 1).toUpperCase()}. ${last}`;
}

function TierPill({ tier }) {
  const { colors } = useTheme();
  const t = String(tier || "").toUpperCase();

  const cfg =
    t === "T1"
      ? { bg: "rgba(245,158,11,0.16)", border: "rgba(245,158,11,0.40)", fg: "#b45309" }
      : t === "T2"
      ? { bg: "rgba(59,130,246,0.14)", border: "rgba(59,130,246,0.35)", fg: "#1d4ed8" }
      : { bg: "rgba(107,114,128,0.14)", border: colors.border, fg: colors.subtext };

  if (!t) return null;

  return (
    <View
      style={{
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 999,
        backgroundColor: cfg.bg,
        borderWidth: 1,
        borderColor: cfg.border,
      }}
    >
      <Text style={{ fontSize: 12, fontWeight: "900", color: cfg.fg, lineHeight: 14 }}>{t}</Text>
    </View>
  );
}

export default function PlayerPickerRow({
  label,
  value,
  onEdit,
  locked,
  tierLower = "free",
  headshotUrl,
  teamLogo, // pour afficher les logos du matchup (PRO/VIP seulement)
}) {
  const { colors } = useTheme();

  const tier = String(tierLower || "free").toLowerCase();
  const isVip = tier === "vip";
  const isPro = tier === "pro" || isVip;
  const isFree = !isPro;

  const picked = !!value?.playerId;

  const photoUri = useMemo(() => {
    if (!picked) return null;
    const abbr = String(value?.teamAbbr || "").toUpperCase();
    const pid = String(value?.playerId || "");
    const u = headshotUrl?.(abbr, pid);
    return u || value?.photoUrl || value?.avatarUrl || null;
  }, [picked, value?.teamAbbr, value?.playerId, value?.photoUrl, value?.avatarUrl, headshotUrl]);

  const shortName = useMemo(() => formatShortName(value?.fullName), [value?.fullName]);
  const tierCode = useMemo(() => String(value?.tier || "").toUpperCase(), [value?.tier]);

  const g = num(value?.goals);
  const a = num(value?.assists);
  const p = num(value?.points);

  const ppg = useMemo(() => {
    const v = value?.pointsPerGame;
    if (Number.isFinite(Number(v))) return Number(v).toFixed(2);

    const gp = Number(value?.gamesPlayed);
    if (Number.isFinite(gp) && gp > 0) return (p / gp).toFixed(2);

    return null;
  }, [value?.pointsPerGame, value?.gamesPlayed, p]);

  // Matchup icons (awayLogo @ homeLogo) — ✅ PRO/VIP seulement
  const matchup = value?.matchup || null;
  const awayAbbr = String(matchup?.awayAbbr || "").toUpperCase();
  const homeAbbr = String(matchup?.homeAbbr || "").toUpperCase();
  const canShowMatchup = !isFree && picked && !!teamLogo && !!awayAbbr && !!homeAbbr;

  return (
    <View
      style={{
        padding: 12,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 12,
        backgroundColor: colors.background,
        gap: 10,
      }}
    >
      {/* Header: label + action */}
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <Text style={{ flex: 1, color: colors.subtext, fontWeight: "900" }}>{label}</Text>

        <TouchableOpacity
          onPress={onEdit}
          disabled={locked}
          activeOpacity={0.85}
          style={{
            paddingHorizontal: 10,
            paddingVertical: 6,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: locked ? colors.border : colors.card,
            opacity: locked ? 0.6 : 1,
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
          }}
        >
          <Ionicons name={picked ? "create-outline" : "add-circle-outline"} size={16} color={colors.text} />
          <Text style={{ color: colors.text, fontWeight: "900" }}>
            {picked ? i18n.t("common.edit", { defaultValue: "Modifier" }) : i18n.t("common.select", { defaultValue: "Choisir" })}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Body */}
      {picked ? (
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          {/* Avatar */}
          <View
            style={{
              width: 42,
              height: 42,
              borderRadius: 21,
              overflow: "hidden",
              backgroundColor: colors.card,
              borderWidth: 1,
              borderColor: colors.border,
              marginRight: 10,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {photoUri ? <Image source={{ uri: photoUri }} style={{ width: 42, height: 42 }} /> : <Ionicons name="person" size={20} color={colors.subtext} />}
          </View>

          <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
            {/* Ligne 1: Tier + nom */}
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, minWidth: 0 }}>
              <TierPill tier={tierCode} />
              <Text numberOfLines={1} style={{ color: colors.text, fontWeight: "900", fontSize: 16, flexShrink: 1 }}>
                {shortName}
              </Text>
            </View>

            {/* Ligne 2: G-A-P + PPG (✅ FREE: pas de PPG) */}
            <Text style={{ color: colors.subtext, fontWeight: "800" }}>
              {g}-{a}-{p}
              {!isFree && ppg ? ` • PPG ${ppg}` : ""}
            </Text>

            {/* Ligne 3: matchup (✅ PRO/VIP seulement) */}
            {canShowMatchup ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Image source={teamLogo(awayAbbr)} style={{ width: 16, height: 16 }} />
                <Text style={{ color: colors.subtext, fontWeight: "900" }}>@</Text>
                <Image source={teamLogo(homeAbbr)} style={{ width: 16, height: 16 }} />
              </View>
            ) : null}
          </View>
        </View>
      ) : (
        <Text style={{ color: colors.subtext, fontWeight: "700" }}>
          {i18n.t("defi.pickersCard.emptyPick", { defaultValue: "Aucun joueur sélectionné." })}
        </Text>
      )}
    </View>
  );
}