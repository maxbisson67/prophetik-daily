// app/defis/[defiId]/components/PlayerSelectModal.js

import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Modal,
  FlatList,
  KeyboardAvoidingView,
  Keyboard,
  Platform,
  TouchableOpacity,
  Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@src/theme/ThemeProvider";
import i18n from "@src/i18n/i18n";

import TeamMetaBadge from "./TeamMetaBadge"; // ✅ Rank: 2ième, +/-: 28

function TierBadge({ tier }) {
  const { colors } = useTheme();
  const t = String(tier || "T3").toUpperCase();
  const styles =
    {
      T1: { bg: "rgba(245,158,11,0.14)", border: "rgba(245,158,11,0.35)", fg: "#b45309" },
      T2: { bg: "rgba(59,130,246,0.14)", border: "rgba(59,130,246,0.35)", fg: "#1d4ed8" },
      T3: { bg: "rgba(107,114,128,0.14)", border: colors.border, fg: colors.subtext },
    }[t] || { bg: "rgba(107,114,128,0.14)", border: colors.border, fg: colors.subtext };

  return (
    <View
      style={{
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 999,
        backgroundColor: styles.bg,
        borderWidth: 1,
        borderColor: styles.border,
      }}
    >
      <Text style={{ fontSize: 12, fontWeight: "800", color: styles.fg, lineHeight: 14 }}>{t}</Text>
    </View>
  );
}

function InjuryIcon({ injury, size = 16 }) {
  const { colors } = useTheme();
  const status = String(injury?.status || "").toLowerCase();
  if (!status || status === "active") return null;

  const iconName =
    status === "out"
      ? "medkit"
      : status === "daytoday"
      ? "warning"
      : status === "questionable"
      ? "help-circle"
      : status === "probable"
      ? "pulse"
      : "alert-circle";

  const color = status === "out" ? "#ef4444" : status === "daytoday" ? "#f59e0b" : colors.subtext;
  return <Ionicons name={iconName} size={size} color={color} style={{ marginLeft: 4 }} />;
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function shortPlayerName(fullName = "") {
  const s = String(fullName || "").trim();
  if (!s) return "—";
  const parts = s.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0];
  const first = parts[0];
  const last = parts[parts.length - 1];
  return `${first.slice(0, 1).toUpperCase()}. ${last}`;
}

export default function PlayerSelectModal({
  visible,
  onClose,
  options,
  onPick,
  alreadyChosenIds = [],
  tierLower = "free",
  teamLogo,
  headshotUrl,
  forcedTier = null,
}) {
  const { colors } = useTheme();

  const [q, setQ] = useState("");
  const [kbHeight, setKbHeight] = useState(0);

  const [tierFilter, setTierFilter] = useState("T1");
  const [sortKey, setSortKey] = useState("points"); // points | ppg

  const tier = String(tierLower || "free").toLowerCase();
  const isVip = tier === "vip";
  const isPro = tier === "pro" || isVip;
  const isFree = !isPro; // ✅ FREE = pas pro/vip


  useEffect(() => {
    if (!visible) return;

    setQ("");
    setSortKey("points");

    const ft = String(forcedTier || "").toUpperCase();
    if (ft === "T1" || ft === "T2" || ft === "T3") {
        setTierFilter(ft);
    } else {
        setTierFilter("T1"); // fallback
    }
    }, [visible, forcedTier]);

  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
      (e) => setKbHeight(e.endCoordinates?.height ?? 0)
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide",
      () => setKbHeight(0)
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const chosenSet = useMemo(() => new Set((alreadyChosenIds || []).map((x) => String(x))), [
    JSON.stringify(alreadyChosenIds || []),
  ]);

  // ✅ en FREE, on force l’affichage à "points" (au cas où)
  useEffect(() => {
    if (isFree && sortKey === "ppg") setSortKey("points");
  }, [isFree, sortKey]);

  function getStatLabel() {
    if (sortKey === "ppg" && !isFree) return "PPG";
    return "PTS";
  }

  function getStatValue(p) {
    if (sortKey === "ppg" && !isFree) return num(p?.pointsPerGame).toFixed(2);
    return String(Math.round(num(p?.points)));
  }

  function sortComparator(a, b) {
    // ✅ points | ppg
    if (sortKey === "points") return num(b.points) - num(a.points);
    if (sortKey === "ppg" && !isFree) return num(b.pointsPerGame) - num(a.pointsPerGame);

    // fallback rank
    const ra = num(a.rank ?? 999999);
    const rb = num(b.rank ?? 999999);
    if (ra !== rb) return ra - rb;
    return String(a.fullName || "").localeCompare(String(b.fullName || ""));
  }

  const filtered = useMemo(() => {
    const base = Array.isArray(options) ? options.slice() : [];
    const qq = q.trim().toLowerCase();
    let list = base;

    if (qq) {
      list = list.filter((p) => {
        const name = String(p.fullName || p.skaterFullName || "").toLowerCase();
        const team = String(p.teamAbbr || "").toLowerCase();
        return name.includes(qq) || team.includes(qq);
      });
    }

    list = list.filter((p) => String(p.tier || "").toUpperCase() === tierFilter);
    list.sort(sortComparator);
    return list;
  }, [q, options, tierFilter, sortKey, isFree]);

  const keyboardVerticalOffset = Platform.select({ ios: 64, android: 0 });

  function Chip({ label, active, onPress, locked }) {
    const tierStyles = {
      T1: { bg: "rgba(245,158,11,0.18)", border: "rgba(245,158,11,0.45)", fg: "#b45309" },
      T2: { bg: "rgba(59,130,246,0.18)", border: "rgba(59,130,246,0.45)", fg: "#1d4ed8" },
      T3: { bg: "rgba(107,114,128,0.18)", border: colors.border, fg: colors.subtext },
      POINTS: { bg: "rgba(239,68,68,0.14)", border: "rgba(239,68,68,0.40)", fg: "#ef4444" },
      PPG: { bg: "rgba(99,102,241,0.14)", border: "rgba(99,102,241,0.40)", fg: "#6366f1" },
    };

    const key = String(label || "").toUpperCase();
    const cfg = tierStyles[key];

    const bgColor = active ? cfg?.bg ?? "rgba(59,130,246,0.14)" : colors.background;
    const borderColor = active ? cfg?.border ?? colors.primary : colors.border;
    const textColor = active ? cfg?.fg ?? colors.text : colors.subtext;

    return (
      <TouchableOpacity
        onPress={onPress}
        disabled={locked}
        activeOpacity={0.85}
        style={{
          paddingHorizontal: 10,
          paddingVertical: 7,
          borderRadius: 999,
          borderWidth: 1,
          borderColor,
          backgroundColor: bgColor,
          opacity: locked ? 0.45 : 1,
        }}
      >
        <Text style={{ color: textColor, fontWeight: "900", fontSize: 12 }}>
          {label}
          {locked ? " 🔒" : ""}
        </Text>
      </TouchableOpacity>
    );
  }

  function Avatar({ player, size = 36, style }) {
    const primary =
      headshotUrl?.(player?.teamAbbr, player?.playerId) || player?.photoUrl || player?.avatarUrl || null;

    const fallback = `https://ui-avatars.com/api/?name=${encodeURIComponent(
      player?.fullName || "Player"
    )}&background=111827&color=f9fafb&size=${Math.max(64, size * 2)}`;

    const [uri, setUri] = React.useState(primary || fallback);

    React.useEffect(() => {
      setUri(primary || fallback);
    }, [player?.playerId, primary]);

    return (
      <Image
        source={{ uri }}
        onError={() => setUri(fallback)}
        style={[{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.card }, style]}
      />
    );
  }

  return (
    <Modal animationType="slide" transparent visible={visible} onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={{ flex: 1, justifyContent: "flex-end" }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={keyboardVerticalOffset}
      >
        <View
          style={{
            backgroundColor: colors.card,
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
            paddingTop: 8,
            paddingHorizontal: 12,
            maxHeight: "88%",
            minHeight: 320,
            borderTopWidth: 1,
            borderColor: colors.border,
          }}
        >
          {/* Handle */}
          <View style={{ alignItems: "center", paddingVertical: 6 }}>
            <View style={{ width: 44, height: 4, borderRadius: 2, backgroundColor: colors.border }} />
          </View>

          {/* Header */}
          <View style={{ flexDirection: "row", alignItems: "center", paddingBottom: 6 }}>
            <Text style={{ fontSize: 18, fontWeight: "700", flex: 1, color: colors.text }}>
              {i18n.t("defi.playerSelect.title", { defaultValue: "Choisir un joueur" })}
            </Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={{ fontSize: 16, color: colors.primary, fontWeight: "800" }}>
                {i18n.t("defi.playerSelect.close", { defaultValue: "Fermer" })}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Search */}
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder={i18n.t("defi.playerSelect.searchPlaceholder", { defaultValue: "Rechercher un joueur…" })}
            placeholderTextColor={colors.subtext}
            style={{
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 12,
              paddingHorizontal: 12,
              paddingVertical: 10,
              marginBottom: 10,
              backgroundColor: colors.background,
              color: colors.text,
              fontWeight: "600",
            }}
          />

          {/* Filters */}
          <View style={{ gap: 10, marginBottom: 10 }}>
         
            {forcedTier ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Text style={{ color: colors.subtext, fontWeight: "900", fontSize: 12 }}>
                    {i18n.t("defi.playerSelect.tierLocked", { defaultValue: "Tier :" })}
                    </Text>
                    <TierBadge tier={forcedTier} />
             </View>
            ) : null}

      

            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              <Chip label="Points" active={sortKey === "points"} onPress={() => setSortKey("points")} />
              {!isFree ? (
                <Chip
                  label="Points par partie"
                  active={sortKey === "ppg"}
                  onPress={() => setSortKey("ppg")}
                  locked={!isPro}
                />
              ) : null}
            </View>
          </View>

          {/* Players list */}
          <FlatList
            data={filtered}
            keyExtractor={(item, idx) => String(item?.playerId ?? item?.id ?? `player-${idx}`)}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: kbHeight + 24 }}
            initialNumToRender={20}
            maxToRenderPerBatch={20}
            updateCellsBatchingPeriod={50}
            windowSize={10}
            removeClippedSubviews={Platform.OS === "android"}
            renderItem={({ item }) => {
              const pid = String(item?.playerId ?? "");
              const isChosen = pid && chosenSet.has(pid);

              const team = String(item?.teamAbbr || "").toUpperCase();
              const opp = String(item?.matchup?.opponentAbbr || "").toUpperCase();

              const injuryStatus = String(item?.injury?.status || "").toLowerCase();
              const isOut = injuryStatus === "out";

              const oppRankOverall = item?.matchup?.oppRankOverall;
              const oppGoalDifferential = item?.matchup?.oppGoalDifferential;

              return (
                <TouchableOpacity
                  disabled={isChosen}
                  onPress={() => {
                    onPick?.(item);
                    onClose?.();
                  }}
                  activeOpacity={0.85}
                  style={{
                    paddingVertical: 10,
                    paddingHorizontal: 8,
                    borderBottomWidth: 1,
                    borderBottomColor: colors.border,
                    opacity: isChosen ? 0.45 : 1,
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <Avatar player={item} size={36} style={{ marginRight: 10 }} />

                    <View style={{ flex: 1, minWidth: 0 }}>
                      {/* Ligne 1: Tier + Nom + injury + logos (matchup caché en FREE) */}
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, minWidth: 0 }}>
                        <TierBadge tier={item?.tier} />

                        <Text
                          numberOfLines={1}
                          style={{
                            fontSize: 16,
                            fontWeight: "800",
                            color: isOut ? colors.subtext : colors.text,
                            flexShrink: 1,
                          }}
                        >
                          {shortPlayerName(item?.fullName)}
                        </Text>

                        <InjuryIcon injury={item?.injury} size={16} />

                        {!!team && teamLogo ? <Image source={teamLogo(team)} style={{ width: 16, height: 16 }} /> : null}

                        {/* ✅ PRO/VIP seulement: matchup */}
                        {!isFree && !!opp && teamLogo ? (
                          <>
                            <Text style={{ color: colors.subtext, fontWeight: "900" }}>@</Text>
                            <Image source={teamLogo(opp)} style={{ width: 16, height: 16 }} />
                          </>
                        ) : null}
                      </View>

                      {/* Ligne 2: aide décision (PRO/VIP seulement) */}
                      {!isFree && item?.matchup ? (
                        <View style={{ marginTop: 6 }}>
                          <TeamMetaBadge
                            compact
                            rankOverall={oppRankOverall}
                            goalDifferential={oppGoalDifferential}
                          />
                        </View>
                      ) : null}
                    </View>

                    {/* Stats droite */}
                    <View
                      style={{
                        marginLeft: 10,
                        paddingHorizontal: 10,
                        paddingVertical: 6,
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: colors.border,
                        backgroundColor: colors.background,
                        alignItems: "flex-end",
                        minWidth: 72,
                      }}
                    >
                      <Text style={{ color: colors.subtext, fontSize: 11, fontWeight: "900" }}>{getStatLabel()}</Text>
                      <Text
                        style={{
                          color: colors.text,
                          fontSize: 13,
                          fontWeight: "900",
                          fontVariant: ["tabular-nums"],
                        }}
                      >
                        {getStatValue(item)}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            }}
          />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}