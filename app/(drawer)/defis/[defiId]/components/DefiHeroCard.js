import React, { useMemo } from "react";
import { View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@src/theme/ThemeProvider";
import i18n from "@src/i18n/i18n";

// 🎨 Prophetik red accents (pale / premium)
const PROPHETIK_RED = {
  solid: "rgba(239,68,68,0.92)",       // red-500-ish
  soft: "rgba(239,68,68,0.14)",
  border: "rgba(239,68,68,0.28)",
  text: "#ef4444",
};

function Chip({ icon, label, tone = "neutral" }) {
  const { colors } = useTheme();

  const cfg =
    tone === "good"
      ? { bg: "rgba(34,197,94,0.14)", bd: "rgba(34,197,94,0.28)", fg: "#16a34a" }
      : tone === "bad"
      ? { bg: "rgba(239,68,68,0.12)", bd: "rgba(239,68,68,0.28)", fg: "#ef4444" }
      : { bg: PROPHETIK_RED.soft, bd: PROPHETIK_RED.border, fg: colors.text };

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: cfg.bd,
        backgroundColor: cfg.bg,
      }}
    >
      <Ionicons name={icon} size={14} color={cfg.fg} />
      <Text style={{ color: cfg.fg, fontWeight: "900", fontSize: 12 }}>{label}</Text>
    </View>
  );
}

function StatTile({ icon, label, value, tone = "neutral" }) {
  const { colors } = useTheme();

  const accent =
    tone === "good"
      ? "rgba(34,197,94,0.16)"
      : tone === "bad"
      ? "rgba(239,68,68,0.14)"
      : PROPHETIK_RED.soft;

  return (
    <View
      style={{
        flex: 1,
        minWidth: 0,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.background,
        padding: 12,
        overflow: "hidden",
      }}
    >
      {/* glow */}
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          right: -30,
          top: -30,
          width: 90,
          height: 90,
          borderRadius: 999,
          backgroundColor: accent,
        }}
      />
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Ionicons name={icon} size={16} color={colors.text} />
        <Text style={{ color: colors.subtext, fontSize: 11, fontWeight: "900" }}>
          {String(label || "").toUpperCase()}
        </Text>
      </View>
      <Text
        numberOfLines={1}
        style={{
          marginTop: 6,
          color: colors.text,
          fontSize: 16,
          fontWeight: "900",
          fontVariant: ["tabular-nums"],
        }}
      >
        {value ?? "—"}
      </Text>
    </View>
  );
}

export default function DefiHeroCard({
  title,
  type,
  gameDayStr,
  signupDeadlineStr,
  picksCount,
  status,
  locked,
  pot,
  requirementsText,
  tiersLegendText,
}) {
  const { colors } = useTheme();

  const header = useMemo(() => {
    if (title) return title;
    if (type) return `${i18n.t("home.challenge")} ${type}x${type}`;
    return i18n.t("defi.header.defaultTitle", { defaultValue: "Challenge" });
  }, [title, type]);

  const statusKey = String(status || "").toLowerCase();
  const tone = locked ? "bad" : statusKey === "open" ? "good" : "neutral";

  // 🔴 Top accent bar (Prophetik)
  const topBar =
    tone === "good"
      ? "rgba(34,197,94,0.90)"
      : tone === "bad"
      ? PROPHETIK_RED.solid
      : PROPHETIK_RED.solid;

  const chipLabel = locked
    ? i18n.t("defi.infoCard.lockedSuffix", { defaultValue: "Locked" })
    : status || "—";

  const selectTitle = i18n.t("defi.pickersCard.title", { defaultValue: "Select your players" });

  return (
    <View
      style={{
        borderRadius: 18,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.card,
        overflow: "hidden",

        shadowColor: "#000",
        shadowOpacity: 0.14,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 10 },
        elevation: 6,
      }}
    >
      {/* accent bar */}
      <View style={{ height: 3, backgroundColor: topBar }} />

      <View style={{ padding: 14, gap: 12 }}>
        {/* Title + chip */}
        <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text numberOfLines={1} style={{ color: colors.text, fontWeight: "900", fontSize: 16 }}>
              {header}
            </Text>
            <Text style={{ marginTop: 3, color: colors.subtext, fontWeight: "800" }}>
              {gameDayStr || "—"}
            </Text>
          </View>

          <Chip
            icon={locked ? "lock-closed" : statusKey === "open" ? "flash" : "information-circle"}
            label={String(chipLabel).toUpperCase()}
            tone={tone}
          />
        </View>

        {/* Stats */}
        <View style={{ flexDirection: "row", gap: 10 }}>
          <StatTile
            icon="calendar"
            label={i18n.t("defi.infoCard.nhlDate", { defaultValue: "NHL date" })}
            value={gameDayStr}
            tone="neutral"
          />
          <StatTile
            icon="time"
            label={i18n.t("defi.infoCard.signupDeadline", { defaultValue: "Signup deadline" })}
            value={signupDeadlineStr || "—"}
            tone={locked ? "bad" : "neutral"}
          />
        </View>

        <View style={{ flexDirection: "row", gap: 10 }}>
          <StatTile
            icon="list"
            label={i18n.t("defi.infoCard.choicesCount", { defaultValue: "Number of picks" })}
            value={String(picksCount ?? "—")}
            tone="neutral"
          />
        <StatTile
          icon="trophy"
          label={i18n.t("defi.infoCard.potLabel", { defaultValue: "Cagnotte" })}
          value={i18n.t("defi.infoCard.pot", { count: pot ?? 0 })}
          tone="neutral"
        />
        </View>

        {/* ✅ Select players (avec la même “courbe / glow”) */}
        <View
          style={{
            borderRadius: 14,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.background,
            padding: 12,
            gap: 6,
            overflow: "hidden",
          }}
        >
          {/* glow circle */}
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              right: -34,
              bottom: -34,
              width: 110,
              height: 110,
              borderRadius: 999,
              backgroundColor: PROPHETIK_RED.soft,
            }}
          />
          {/* subtle arc / curve feel (2nd layer) */}
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              right: -52,
              bottom: -52,
              width: 160,
              height: 160,
              borderRadius: 999,
              borderWidth: 2,
              borderColor: "rgba(239,68,68,0.18)",
              transform: [{ rotate: "18deg" }],
            }}
          />

          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Ionicons name="people" size={16} color={colors.text} />
            <Text style={{ color: colors.text, fontWeight: "900" }}>{selectTitle}</Text>
          </View>

          {!!requirementsText ? (
            <Text style={{ color: colors.text, fontWeight: "800" }}>
              {i18n.t("defi.pickersCard.requirementsPrefix", { defaultValue: "You must pick:" })}{" "}
              <Text style={{ fontWeight: "900" }}>{requirementsText}</Text>
            </Text>
          ) : null}

          {!!tiersLegendText ? (
            <Text style={{ color: colors.subtext, fontWeight: "800", fontSize: 12 }}>
              {tiersLegendText}
            </Text>
          ) : null}
        </View>
      </View>
    </View>
  );
}