import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import i18n from "@src/i18n/i18n";
import LiveChallengeKindBadge, { LIVE_BADGE_ACCENTS } from "@src/live/LiveChallengeKindBadge";

const DEFI_TABS = [
  { value: "fgc", kind: "fgc" },
  { value: "tp", kind: "tp" },
  { value: "ts", kind: "ts" },
];

const COMPLETE_GREEN = "#16a34a";

function hexWithAlpha(hex, alphaHex = "22") {
  const clean = String(hex || "").replace("#", "");
  if (clean.length !== 6) return hex;
  return `#${clean}${alphaHex}`;
}

export function getChallengeAccent(kind) {
  return LIVE_BADGE_ACCENTS[String(kind || "").toLowerCase()] || LIVE_BADGE_ACCENTS.fgc;
}

export function paleChallengeBackground(kind, alphaHex = "16") {
  return hexWithAlpha(getChallengeAccent(kind), alphaHex);
}

function resolveTabProgress(value) {
  if (value && typeof value === "object" && "done" in value) {
    const done = Math.max(0, Number(value.done) || 0);
    const total = Math.max(0, Number(value.total) || 0);
    const expiredCount = Math.max(0, Number(value.expiredCount) || 0);
    const enrolled = !!value.enrolled;
    const expired = !!value.expired && total > 0 && done < total && !enrolled;
    return { done, total, expired, expiredCount, enrolled };
  }

  if (value === true) return { done: 1, total: 1, expired: false, expiredCount: 0, enrolled: false };
  if (value === false) return { done: 0, total: 0, expired: false, expiredCount: 0, enrolled: false };

  return { done: 0, total: 0, expired: false, expiredCount: 0, enrolled: false };
}

function tagAccent(kind) {
  return getChallengeAccent(kind);
}

export function isHomeDefiTabComplete(value) {
  const { done, total, enrolled } = resolveTabProgress(value);
  if (enrolled) return true;
  return total > 0 && done >= total;
}

export function areAllHomeDefisComplete(completedByTab = {}) {
  return DEFI_TABS.every((tab) => isHomeDefiTabComplete(completedByTab?.[tab.value]));
}

export function countEnrolledHomeDefis(completedByTab = {}) {
  return DEFI_TABS.filter((tab) => isHomeDefiTabComplete(completedByTab?.[tab.value])).length;
}

/** @deprecated use countEnrolledHomeDefis */
export function countCompletedHomeDefis(completedByTab = {}) {
  return countEnrolledHomeDefis(completedByTab);
}

function ExpiredTag({ onAccent, colors }) {
  return (
    <View
      style={{
        marginTop: 6,
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: onAccent ? "rgba(255,255,255,0.45)" : colors.border,
        backgroundColor: onAccent ? "rgba(255,255,255,0.12)" : colors.card,
      }}
    >
      <Text
        style={{
          color: onAccent ? "#fff" : colors.subtext,
          fontSize: 10,
          fontWeight: "900",
          letterSpacing: 0.2,
          textAlign: "center",
        }}
      >
        {i18n.t("home.defiTabExpired")}
      </Text>
    </View>
  );
}

function TodoTag({ onAccent, colors }) {
  return (
    <View
      style={{
        marginTop: 6,
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: onAccent ? "rgba(255,255,255,0.45)" : colors.border,
        backgroundColor: onAccent ? "rgba(255,255,255,0.12)" : colors.card,
      }}
    >
      <Text
        style={{
          color: onAccent ? "#fff" : colors.subtext,
          fontSize: 10,
          fontWeight: "900",
          letterSpacing: 0.2,
          textAlign: "center",
        }}
      >
        {i18n.t("home.defiTabTodo")}
      </Text>
    </View>
  );
}

function StatusLine({ children, onAccent, colors }) {
  return (
    <Text
      style={{
        color: onAccent ? "rgba(255,255,255,0.92)" : colors.subtext,
        fontSize: 10,
        fontWeight: "800",
        textAlign: "center",
        lineHeight: 13,
        marginTop: 6,
      }}
      numberOfLines={2}
    >
      {children}
    </Text>
  );
}

function TabCompletionBadge({ progress, onAccent, colors }) {
  const { done, total, expired, expiredCount, enrolled } = progress;
  if (!total) return null;

  const complete = done >= total;
  const showCheck = complete || enrolled;

  if (showCheck) {
    return (
      <View style={{ alignItems: "center", marginTop: 6 }}>
        <MaterialCommunityIcons
          name="check-circle"
          size={18}
          color={onAccent ? "#fff" : COMPLETE_GREEN}
        />
        {expiredCount > 0 ? (
          <StatusLine onAccent={onAccent} colors={colors}>
            {i18n.t("home.defiTabExpiredMatches", { count: expiredCount })}
          </StatusLine>
        ) : null}
      </View>
    );
  }

  if (expired) {
    return <ExpiredTag onAccent={onAccent} colors={colors} />;
  }

  return <TodoTag onAccent={onAccent} colors={colors} />;
}

function DefiTabCell({ tab, active, sport, colors, progress, onPress }) {
  const accent = tagAccent(tab.kind);
  const indicatorColor = active
    ? colors.primary || "#ef4444"
    : colors.border || "#D1D5DB";

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.88}
      style={{
        flex: 1,
        minHeight: 58,
        borderRadius: 10,
        borderWidth: 2,
        borderColor: accent,
        backgroundColor: active ? accent : hexWithAlpha(accent, "14"),
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: 8,
        paddingHorizontal: 6,
      }}
    >
      <LiveChallengeKindBadge
        kind={tab.kind}
        colors={colors}
        sport={sport}
        compact
        inverted={active}
      />
      <View
        style={{
          marginTop: 5,
          height: 3,
          width: "70%",
          borderRadius: 999,
          backgroundColor: indicatorColor,
        }}
      />
      <TabCompletionBadge progress={progress} onAccent={active} colors={colors} />
    </TouchableOpacity>
  );
}

export default function HomeDefisToggle({
  value = "fgc",
  onChange,
  colors,
  sport = "NHL",
  completedByTab = {},
  title = null,
}) {
  return (
    <View style={{ marginBottom: 12 }}>
      {title ? (
        <View style={{ marginBottom: 14, alignItems: "center" }}>
          <Text
            style={{
              color: colors.primary || "#ef4444",
              fontWeight: "900",
              fontSize: 20,
              textAlign: "center",
              lineHeight: 26,
              letterSpacing: 0.15,
            }}
          >
            {title}
          </Text>
          <View
            style={{
              marginTop: 6,
              height: 3,
              width: 56,
              borderRadius: 999,
              backgroundColor: colors.primary || "#ef4444",
            }}
          />
        </View>
      ) : null}

      <View
        style={{
          flexDirection: "row",
          gap: 8,
          marginBottom: 12,
        }}
      >
        {DEFI_TABS.map((tab) => {
          const active = value === tab.value;
          const progress = resolveTabProgress(completedByTab?.[tab.value]);

          return (
            <DefiTabCell
              key={tab.value}
              tab={tab}
              active={active}
              sport={sport}
              colors={colors}
              progress={progress}
              onPress={() => onChange?.(tab.value)}
            />
          );
        })}
      </View>
    </View>
  );
}
