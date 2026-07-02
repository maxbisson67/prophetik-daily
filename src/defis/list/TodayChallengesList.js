import React, { useMemo } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import i18n from "@src/i18n/i18n";
import { getFgcTitle } from "@src/firstGoal/fgcChallengeUtils";
import ParticipantTaskStatusChip from "@src/defis/participant/ParticipantTaskStatusChip";
import {
  formatParticipantCtaLabel,
  participantHasJoined,
  resolveParticipantTaskStatusForItem,
} from "@src/defis/participant/participantTaskStatus";

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
  return i18n.t("home.todayChallenge", { defaultValue: "Meilleurs pointeurs" });
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

function Row({ item, participationMaps, colors, showDivider, onPress }) {
  const participantTask = resolveParticipantTaskStatusForItem(item, {
    isToday: true,
    participationMaps,
  });

  const primaryCtaLabel = formatParticipantCtaLabel(
    participantTask.showPrimaryCta ? participantTask.ctaKey : null
  );

  return (
    <View>
      <View style={{ paddingVertical: 10 }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 10,
          }}
        >
          <Text
            style={{ color: colors.text, fontWeight: "900", fontSize: 14, flex: 1 }}
            numberOfLines={2}
          >
            {titleForItem(item)}
          </Text>

          <ParticipantTaskStatusChip task={participantTask} colors={colors} compact />
        </View>

        <View style={{ marginTop: 6 }}>
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

        {onPress && participantTask.showPrimaryCta && primaryCtaLabel ? (
          <TouchableOpacity
            onPress={() => onPress(item, participantTask)}
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
            <Text style={{ color: "#fff", fontWeight: "900" }}>{primaryCtaLabel}</Text>
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
    return sorted.filter((item) =>
      participantHasJoined(
        resolveParticipantTaskStatusForItem(item, {
          isToday: true,
          participationMaps,
        })
      )
    ).length;
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
