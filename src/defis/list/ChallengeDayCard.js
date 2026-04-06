import React from "react";
import { View, Text, TouchableOpacity, Image } from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import i18n from "@src/i18n/i18n";

function initialsFrom(nameOrEmail = "") {
  const s = String(nameOrEmail).trim();
  if (!s) return "?";
  const parts = s.replace(/\s+/g, " ").split(" ");
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function fmtHM(v) {
  try {
    if (!v) return "—";
    const d =
      typeof v?.toDate === "function"
        ? v.toDate()
        : v instanceof Date
        ? v
        : new Date(v);

    if (!d || Number.isNaN(d.getTime())) return "—";

    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `${hh}:${mm}`;
  } catch {
    return "—";
  }
}

function safeText(v) {
  const s = String(v || "").trim();
  return s || "—";
}

function getWinnerUids(raw) {
  if (Array.isArray(raw?.winnersPreviewUids)) return raw.winnersPreviewUids.map(String);
  if (Array.isArray(raw?.winners)) return raw.winners.map(String);
  return [];
}

function getWinnerShares(raw) {
  return raw?.winnerShares || {};
}

function getTotalPayout(raw) {
  return Number(raw?.payoutTotal ?? raw?.pot ?? raw?.stakePoints ?? 0) || 0;
}

function hasNoWinner(item) {
  if (item.kind === "ts") return false;

  const winnerUids = getWinnerUids(item.raw);
  const winnersCount = Number(item.raw?.winnersCount ?? winnerUids.length ?? 0);

  if (winnerUids.length > 0) return false;
  if (winnersCount > 0) return false;

  const st = String(item?.status || "").toLowerCase().trim();
  return ["decided", "closed", "completed"].includes(st);
}

function AvatarBubble({ uri, name, size = 22, colors }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        overflow: "hidden",
        backgroundColor: colors.card2,
        borderWidth: 1,
        borderColor: colors.border,
        alignItems: "center",
        justifyContent: "center",
        marginRight: 8,
      }}
    >
      {uri ? (
        <Image source={{ uri }} style={{ width: size, height: size }} resizeMode="cover" />
      ) : (
        <Text style={{ color: colors.text, fontWeight: "900", fontSize: 10 }}>
          {initialsFrom(name)}
        </Text>
      )}
    </View>
  );
}

function cardAccent(kind) {
  if (kind === "fgc") return "🏒";
  if (kind === "tp") return "🏆";
  return "🎯";
}

function cardTypeTitle(kind) {
  if (kind === "fgc") {
    return i18n.t("firstGoal.home.title", { defaultValue: "Premier but" });
  }
  if (kind === "tp") {
    return i18n.t("tp.home.title", { defaultValue: "Défi équipe gagnante" });
  }
  return i18n.t("home.todayChallenge", { defaultValue: "Top scoreur" });
}

function statusUi(status) {
  const st = String(status || "").toLowerCase().trim();

  if (st === "open" || st === "live") {
    return {
      label: i18n.t("challenges.status.active", { defaultValue: "Actif" }),
      color: "#16a34a",
      icon: "flame",
      bg: "rgba(34,197,94,0.12)",
    };
  }

  if (st === "awaiting_result" || st === "pending") {
    return {
      label: i18n.t("challenges.status.awaiting", { defaultValue: "En attente" }),
      color: "#ea580c",
      icon: "timer-outline",
      bg: "rgba(234,88,12,0.10)",
    };
  }

  if (st === "cancelled_ghost") {
    return {
      label: i18n.t("challenges.status.cancelledGhost", { defaultValue: "Annulé" }),
      color: "#9ca3af",
      icon: "alert-circle-outline",
      bg: "rgba(156,163,175,0.12)",
    };
  }

  return {
    label: i18n.t("challenges.status.completed", { defaultValue: "Terminé" }),
    color: "#6b7280",
    icon: "checkmark-circle",
    bg: "rgba(107,114,128,0.10)",
  };
}

const RED = "#b91c1c";
const RED_BOTTOM = "#991b1b";

const ChallengeItemCard = React.memo(function ChallengeItemCard({
  item,
  isToday,
  colors,
  winnerInfoMap,
  onOpen,
}) {
  const ui = statusUi(item.status);
  const payout = getTotalPayout(item.raw);

  const showPastSummary =
    !isToday &&
    ["closed", "decided", "completed", "cancelled_ghost"].includes(item.status);

  const renderWinnersBlock = () => {
    const winnerUids = getWinnerUids(item.raw);
    const winnerShares = getWinnerShares(item.raw);

    if (hasNoWinner(item)) {
      return (
        <View
          style={{
            marginTop: 8,
            paddingVertical: 8,
            paddingHorizontal: 10,
            borderRadius: 10,
            backgroundColor: colors.card2,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <Text style={{ color: colors.subtext, fontWeight: "700" }}>
            {i18n.t("challenges.noWinner", { defaultValue: "Aucun gagnant" })}
          </Text>
        </View>
      );
    }

    if (!winnerUids.length) return null;

    return (
      <View
        style={{
          marginTop: 8,
          paddingVertical: 8,
          paddingHorizontal: 10,
          borderRadius: 10,
          backgroundColor: colors.card2,
          borderWidth: 1,
          borderColor: colors.border,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 6 }}>
          <MaterialCommunityIcons name="trophy" size={16} color="#16a34a" />
          <Text style={{ marginLeft: 6, color: colors.text, fontWeight: "800" }}>
            {winnerUids.length > 1
              ? i18n.t("challenges.winnersTitlePlural", { defaultValue: "Gagnants" })
              : i18n.t("challenges.winnersTitleSingular", { defaultValue: "Gagnant" })}
          </Text>
        </View>

        {winnerUids.map((uid) => {
          const info = winnerInfoMap[uid] || { name: uid, photoURL: null };
          const share = Number(winnerShares?.[uid] ?? 0);

          return (
            <View
              key={uid}
              style={{
                flexDirection: "row",
                alignItems: "center",
                marginBottom: 6,
              }}
            >
              <AvatarBubble uri={info.photoURL} name={info.name} colors={colors} size={22} />
              <Text style={{ color: colors.text }}>
                {info.name}
                {share > 0 ? ` (+${share})` : ""}
              </Text>
            </View>
          );
        })}
      </View>
    );
  };

  return (
    <View style={{ paddingVertical: 10 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <View style={{ flexDirection: "row", alignItems: "center", flex: 1, minWidth: 0 }}>
          <Text style={{ fontSize: 18, marginRight: 8 }}>{cardAccent(item.kind)}</Text>
          <Text
            style={{
              fontWeight: "900",
              fontSize: 16,
              color: colors.text,
              flex: 1,
            }}
            numberOfLines={1}
          >
            {cardTypeTitle(item.kind)}
          </Text>
        </View>

        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 10,
            paddingVertical: 5,
            borderRadius: 999,
            backgroundColor: ui.bg,
          }}
        >
          <Ionicons name={ui.icon} size={14} color={ui.color} />
          <Text style={{ marginLeft: 6, color: ui.color, fontWeight: "800", fontSize: 12 }}>
            {ui.label}
          </Text>
        </View>
      </View>

        <View style={{ marginTop: 10 }}>
        {(item.kind === "fgc" || item.kind === "tp") ? (
            <Text style={{ color: colors.text, fontWeight: "900" }}>
            {safeText(item.raw?.awayAbbr)} @ {safeText(item.raw?.homeAbbr)}
            </Text>
        ) : null}
        </View>

      {isToday ? (
        <View style={{ marginTop: 8 }}>
          <Text style={{ color: colors.subtext, fontSize: 13 }}>
            {i18n.t("challenges.signupDeadlineLabel", { defaultValue: "Heure limite" })}:{" "}
            <Text style={{ color: colors.text, fontWeight: "900" }}>
              {fmtHM(item.signupDeadline)}
            </Text>
          </Text>
        </View>
      ) : null}

        {showPastSummary ? (
        <>
            {!hasNoWinner(item) ? (
            <View
                style={{
                marginTop: 8,
                paddingVertical: 8,
                paddingHorizontal: 10,
                borderRadius: 10,
                backgroundColor: colors.card2,
                borderWidth: 1,
                borderColor: colors.border,
                }}
            >
                <Text style={{ color: colors.text, fontWeight: "800" }}>
                💰 {i18n.t("challenges.potWon", { defaultValue: "Cagnotte gagnée" })}: +{payout}
                </Text>
            </View>
            ) : null}

            {renderWinnersBlock(item)}
        </>
        ) : null}

        {/* CTA seulement pour TS OU pour aujourd’hui */}
        {(item.kind === "ts" || isToday) ? (
        <View style={{ marginTop: 12 }}>
            <TouchableOpacity
            onPress={() => onOpen(item, isToday)}
            style={{
                width: "100%",
                paddingVertical: 10,
                borderRadius: 12,
                alignItems: "center",
                backgroundColor: isToday ? "#b91c1c" : colors.card2,
                borderWidth: isToday ? 0 : 1,
                borderColor: isToday ? "transparent" : colors.border,
            }}
            >
            <Text
                style={{
                color: isToday ? "#fff" : colors.text,
                fontWeight: "900",
                }}
            >
            {isToday
            ? item.kind === "fgc"
                ? i18n.t("challenges.viewParticipants", {
                    defaultValue: "Voir les participants",
                })
                : item.kind === "tp"
                ? i18n.t("challenges.viewParticipants", {
                    defaultValue: "Voir les participants",
                })
                : i18n.t("challenges.openChallenge", { defaultValue: "Ouvrir" })
            : i18n.t("challenges.seeResults", { defaultValue: "Voir les résultats" })}
            </Text>
            </TouchableOpacity>
        </View>
        ) : null}
            </View>
  );
});

const ChallengeDayCard = React.memo(function ChallengeDayCard({
  section,
  colors,
  winnerInfoMap,
  onOpen,
  getTodayKey,
}) {
  const isToday = section.key === getTodayKey();

  return (
    <View
      style={{
        marginBottom: 16,
        borderWidth: 1,
        borderColor: colors.border,
        borderLeftWidth: 4,
        borderLeftColor: RED,
        borderBottomWidth: 3,
        borderBottomColor: RED_BOTTOM,
        borderRadius: 16,
        backgroundColor: colors.card,
        overflow: "hidden",
      }}
    >
      <View
        style={{
          paddingHorizontal: 12,
          paddingTop: 12,
          paddingBottom: 10,
          backgroundColor: colors.card,
        }}
      >
        <Text style={{ fontSize: 20, fontWeight: "900", color: colors.text }}>
          {section.title}
        </Text>

        <Text style={{ marginTop: 2, color: colors.subtext, fontSize: 12 }}>
          {isToday
            ? i18n.t("challenges.todayDaySummary", {
                defaultValue: "Défis disponibles aujourd’hui",
              })
            : i18n.t("challenges.pastDaySummary", {
                defaultValue: "Résultats des défis de cette journée",
              })}
        </Text>
      </View>

      <View style={{ paddingHorizontal: 12, paddingBottom: 6 }}>
        {section.data.map((item, index) => (
          <View key={`${item.kind}-${item.id}`}>
            <ChallengeItemCard
              item={item}
              isToday={isToday}
              colors={colors}
              winnerInfoMap={winnerInfoMap}
              onOpen={onOpen}
            />

            {index < section.data.length - 1 ? (
            <View
                style={{
                height: 4,
                backgroundColor: "rgba(239,68,68,0.22)",
                marginTop: 10,
                marginBottom: 8,
                marginHorizontal: 2,
                }}
            />
            ) : null}
          </View>
        ))}
      </View>
    </View>
  );
});

export default ChallengeDayCard;