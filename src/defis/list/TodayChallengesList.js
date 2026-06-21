import React, { useMemo } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import i18n from "@src/i18n/i18n";
import { tpEntryHasParticipation, resolveChallengeDisplayStatus } from "@src/defis/results/challengeResultsModel";
import { getFgcTitle } from "@src/firstGoal/fgcChallengeUtils";

function normalizeStatus(st) {
  return String(st || "").toLowerCase().trim();
}

function toDateAny(v) {
  if (!v) return null;
  try {
    if (typeof v?.toDate === "function") return v.toDate();
    if (v instanceof Date) return v;
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}

function fmtHM(v) {
  const d = toDateAny(v);
  if (!d) return "—";
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

function titleForItem(item) {
  if (item.kind === "fgc") {
    return getFgcTitle(item?.raw || {}, i18n.t.bind(i18n));
  }
  if (item.kind === "tp") {
    return i18n.t("tp.home.title", { defaultValue: "Prédire l'issue des matchs" });
  }
  return i18n.t("home.todayChallenge", { defaultValue: "Top scoreur" });
}

function statusUi(status) {
  const st = normalizeStatus(status);

  if (st === "open" || st === "live") {
    return {
      label: i18n.t("challenges.status.active", { defaultValue: "Actif" }),
      color: "#16a34a",
      icon: "flame",
    };
  }

  if (st === "awaiting_result" || st === "pending" || st === "locked" || st === "partial") {
    return {
      label: i18n.t("challenges.status.awaiting", { defaultValue: "En cours" }),
      color: "#ea580c",
      icon: "time-outline",
    };
  }

  return {
    label: i18n.t("challenges.status.completed", { defaultValue: "Terminé" }),
    color: "#6b7280",
    icon: "checkmark-circle-outline",
  };
}

function isParticipating(item, maps) {
  if (item.kind === "fgc") {
    return !!maps?.fgc?.[item.id]?.hasPick;
  }
  if (item.kind === "tp") {
    return tpEntryHasParticipation(maps?.tp?.[item.id]);
  }
  if (item.kind === "ts") {
    return !!maps?.ts?.[item.id];
  }
  return false;
}

function typeOrder(kind) {
  if (kind === "fgc") return 0;
  if (kind === "tp") return 1;
  if (kind === "ts") return 2;
  return 9;
}

function challengeSortValue(item) {
  const d =
    toDateAny(item?.signupDeadline) ||
    toDateAny(item?.firstGameUTC) ||
    toDateAny(item?.createdAt);
  return d ? d.getTime() : 0;
}

function resultsCtaLabel() {
  return i18n.t("challenges.seeResults", { defaultValue: "Voir les résultats" });
}

function Row({ item, participating, participationMaps, colors, showDivider, onPress }) {
  const status = statusUi(resolveChallengeDisplayStatus(item));

  return (
    <View>
      <View style={{ paddingVertical: 10 }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
          }}
        >
          <Text
            style={{ color: colors.text, fontWeight: "900", fontSize: 14, flex: 1 }}
            numberOfLines={1}
          >
            {titleForItem(item)}
          </Text>

          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Ionicons name={status.icon} size={14} color={status.color} />
            <Text
              style={{
                marginLeft: 5,
                color: status.color,
                fontWeight: "800",
                fontSize: 12,
              }}
            >
              {status.label}
            </Text>
          </View>
        </View>

        <View
          style={{
            marginTop: 6,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
            <Ionicons
              name={participating ? "checkmark-circle" : "ellipse-outline"}
              size={15}
              color={participating ? "#16a34a" : colors.subtext}
            />
            <Text
              style={{
                marginLeft: 6,
                color: participating ? colors.text : colors.subtext,
                fontWeight: participating ? "800" : "700",
                fontSize: 13,
              }}
            >
              {participating
                ? item.kind === "tp" && item.subtype === "bundle"
                  ? i18n.t("challenges.tpBundleJoined", {
                      defaultValue: "{{done}}/{{total}} matchs prédits",
                      done: Number(participationMaps?.tp?.[item.id]?.picksCompletedCount ?? 0),
                      total: Number(item.raw?.gameCount || item.raw?.games?.length || 0),
                    })
                  : i18n.t("challenges.joined", { defaultValue: "Inscrit" })
                : i18n.t("challenges.notJoined", { defaultValue: "Non inscrit" })}
            </Text>
          </View>

          <Text style={{ color: colors.subtext, fontSize: 13 }}>
            {item.kind === "tp" && item.subtype === "bundle"
              ? i18n.t("challenges.matchCountShort", {
                  defaultValue: "{{count}} match(s)",
                  count: Number(item.raw?.gameCount || item.raw?.games?.length || 0),
                })
              : (
                <>
                  {i18n.t("challenges.signupDeadlineShort", { defaultValue: "Limite" })}:{" "}
                  <Text style={{ color: colors.text, fontWeight: "900" }}>
                    {fmtHM(item.signupDeadline)}
                  </Text>
                </>
              )}
          </Text>
        </View>

        {onPress ? (
          <TouchableOpacity
            onPress={() => onPress(item)}
            activeOpacity={0.9}
            style={{
              marginTop: 12,
              width: "100%",
              paddingVertical: 10,
              borderRadius: 12,
              alignItems: "center",
              backgroundColor: "#b91c1c",
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "900" }}>{resultsCtaLabel()}</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {showDivider ? (
        <View
          style={{
            height: 1,
            backgroundColor: "rgba(239,68,68,0.20)",
            marginHorizontal: 2,
          }}
        />
      ) : null}
    </View>
  );
}

export default function TodayChallengesList({
  items = [],
  colors,
  participationMaps = { fgc: {}, tp: {}, ts: {} },
  onPressItem,
}) {
  const sorted = useMemo(() => {
    return [...items].sort((a, b) => {
      const ta = typeOrder(a.kind);
      const tb = typeOrder(b.kind);
      if (ta !== tb) return ta - tb;
      return challengeSortValue(a) - challengeSortValue(b);
    });
  }, [items]);

  const joinedCount = useMemo(() => {
    return sorted.filter((item) => isParticipating(item, participationMaps)).length;
  }, [sorted, participationMaps]);

  if (!sorted.length) return null;

  return (
    <View
      style={{
        marginBottom: 16,
        borderWidth: 1,
        borderColor: colors.border,
        borderLeftWidth: 4,
        borderLeftColor: "#b91c1c",
        borderBottomWidth: 3,
        borderBottomColor: "#991b1b",
        borderRadius: 16,
        backgroundColor: colors.card,
        overflow: "hidden",
      }}
    >
      <View style={{ paddingHorizontal: 12, paddingTop: 12, paddingBottom: 8 }}>
        <Text style={{ fontSize: 20, fontWeight: "900", color: colors.text }}>
          {i18n.t("challenges.todayTitle", { defaultValue: "Aujourd’hui" })}
        </Text>

        <Text style={{ marginTop: 2, color: colors.subtext, fontSize: 12 }}>
          {i18n.t("challenges.todayCompactSummary", {
            defaultValue: "{{joined}} / {{total}} défis rejoints aujourd’hui",
            joined: joinedCount,
            total: sorted.length,
          })}
        </Text>
      </View>

      <View style={{ paddingHorizontal: 12, paddingBottom: 12 }}>
        {sorted.map((item, index) => (
          <Row
            key={`${item.kind}-${item.id}`}
            item={item}
            participating={isParticipating(item, participationMaps)}
            participationMaps={participationMaps}
            colors={colors}
            showDivider={index < sorted.length - 1}
            onPress={onPressItem}
          />
        ))}
      </View>
    </View>
  );
}