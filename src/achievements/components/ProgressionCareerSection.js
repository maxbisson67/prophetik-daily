import React from "react";
import { View, Text, Image } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import i18n from "@src/i18n/i18n";
import { useTheme } from "@src/theme/ThemeProvider";
import { PROPHETIK_RED, prophetikCardShadow, prophetikSectionCardStyle } from "./prophetikCardStyles.js";

const LOGO = require("@src/ui/prophetik_icon_512.png");
const LOGO_LIGHT = require("@src/ui/prophetik_icon_512_white.png");

function iconBadgeBg(isDark, accent = PROPHETIK_RED) {
  if (accent === PROPHETIK_RED) {
    return isDark ? "rgba(239, 68, 68, 0.16)" : "rgba(185, 28, 28, 0.1)";
  }
  return isDark ? "rgba(255,255,255,0.06)" : "rgba(17,24,39,0.05)";
}

function CareerSectionHeader({ colors, isDark }) {
  const lineColor = isDark ? "#FFFFFF" : PROPHETIK_RED;

  return (
    <View style={{ alignItems: "center", marginBottom: 4 }}>
      <Text
        style={{
          color: colors.text,
          fontWeight: "900",
          fontSize: 17,
          letterSpacing: 0.4,
          textAlign: "center",
        }}
      >
        {i18n.t("progression.career.title", { defaultValue: "Ma carrière Prophetik" })}
      </Text>

      <View
        style={{
          width: "100%",
          marginTop: 12,
          height: 28,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <View
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: "50%",
            height: 1,
            backgroundColor: lineColor,
          }}
        />
        <View
          style={{
            backgroundColor: colors.card,
            paddingHorizontal: 10,
          }}
        >
          <Image
            source={isDark ? LOGO_LIGHT : LOGO}
            style={{ width: 28, height: 28, borderRadius: 14 }}
            resizeMode="cover"
          />
        </View>
      </View>
    </View>
  );
}

function CareerLeadingIcon({ name, colors, isDark, color = null, size = 20, accent = null }) {
  const iconColor = color || colors.text;
  const badgeColor = iconBadgeBg(isDark, accent || (color === PROPHETIK_RED ? PROPHETIK_RED : null));

  return (
    <View style={{ width: 38, alignItems: "center", justifyContent: "center" }}>
      <View
        style={{
          width: 34,
          height: 34,
          borderRadius: 11,
          backgroundColor: badgeColor,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <MaterialCommunityIcons name={name} size={size} color={iconColor} />
      </View>
    </View>
  );
}

function PuckBaseballIcons({ colors, isDark, size = 16 }) {
  return (
    <View style={{ width: 38, alignItems: "center", justifyContent: "center" }}>
      <View
        style={{
          width: 34,
          height: 34,
          borderRadius: 11,
          backgroundColor: iconBadgeBg(isDark),
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <MaterialCommunityIcons name="hockey-puck" size={size} color={colors.text} />
        <MaterialCommunityIcons
          name="baseball"
          size={size}
          color={colors.text}
          style={{ marginLeft: -4 }}
        />
      </View>
    </View>
  );
}

function FirstObjectiveIcon({ colors, isDark }) {
  return (
    <CareerLeadingIcon
      name="medal"
      colors={colors}
      isDark={isDark}
      color={PROPHETIK_RED}
      size={20}
      accent={PROPHETIK_RED}
    />
  );
}

function FgcWinLabel({ colors }) {
  const suffix = i18n.t("progression.career.fgcWinsSuffix", {
    defaultValue: "buteur ou point produit remporté",
  });
  const sup = i18n.t("progression.career.fgcWinsSup", { defaultValue: "ier" });

  return (
    <Text style={{ color: colors.text, fontWeight: "700", fontSize: 14, flex: 1 }}>
      1
      <Text style={{ fontSize: 9, fontWeight: "800", lineHeight: 16 }}>{sup}</Text> {suffix}
    </Text>
  );
}

function CareerGroupLabel({ label, colors }) {
  return (
    <Text
      style={{
        color: colors.subtext,
        fontWeight: "900",
        fontSize: 10,
        letterSpacing: 1.1,
        marginTop: 10,
        marginBottom: 2,
        paddingHorizontal: 6,
      }}
    >
      {label}
    </Text>
  );
}

function CareerStatRow({ leading = null, label, value, colors, isDark, isLast = false, highlight = false }) {
  const labelNode =
    typeof label === "string" ? (
      <Text style={{ color: colors.text, fontWeight: "700", fontSize: 14, flex: 1 }}>{label}</Text>
    ) : (
      label
    );

  const num = Number(value);
  const showValue = Number.isFinite(num) ? num : value;

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingVertical: 11,
        paddingHorizontal: 6,
        borderBottomWidth: isLast ? 0 : 1,
        borderBottomColor: colors.border,
        backgroundColor: highlight
          ? isDark
            ? "rgba(239, 68, 68, 0.07)"
            : "rgba(185, 28, 28, 0.04)"
          : "transparent",
        borderRadius: highlight ? 10 : 0,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}>
        {leading}
        {labelNode}
      </View>
      <View
        style={{
          minWidth: 48,
          paddingHorizontal: 10,
          paddingVertical: 5,
          borderRadius: 10,
          backgroundColor: isDark ? "rgba(239, 68, 68, 0.14)" : "rgba(185, 28, 28, 0.09)",
          alignItems: "center",
          marginLeft: 10,
        }}
      >
        <Text
          style={{
            color: PROPHETIK_RED,
            fontWeight: "900",
            fontSize: 22,
            fontVariant: ["tabular-nums"],
          }}
        >
          {showValue}
        </Text>
      </View>
    </View>
  );
}

export default function ProgressionCareerSection({ colors, stats }) {
  const { isDark } = useTheme();

  const sections = [
    {
      key: "activity",
      label: i18n.t("progression.career.groupActivity", { defaultValue: "ACTIVITÉ" }),
      rows: [
        {
          key: "participations",
          leading: <PuckBaseballIcons colors={colors} isDark={isDark} />,
          label: i18n.t("progression.career.participations", { defaultValue: "Défis joués" }),
          value: stats.totalParticipations,
          highlight: true,
        },
      ],
    },
    {
      key: "tp",
      label: i18n.t("progression.career.groupPredictions", { defaultValue: "PRÉDICTIONS" }),
      rows: [
        {
          key: "tpMatch",
          leading: <CareerLeadingIcon name="binoculars" colors={colors} isDark={isDark} size={19} />,
          label: i18n.t("progression.career.tpMatchOutcome", {
            defaultValue: "Prédire l'issue du match",
          }),
          value: stats.totalCorrectPredictions,
        },
        {
          key: "exact",
          leading: <CareerLeadingIcon name="target" colors={colors} isDark={isDark} size={19} />,
          label: i18n.t("progression.career.exactScore", { defaultValue: "Pointage exact" }),
          value: stats.exactScores,
        },
      ],
    },
    {
      key: "records",
      label: i18n.t("progression.career.groupRecords", { defaultValue: "RECORDS" }),
      rows: [
        {
          key: "bestStreak",
          leading: (
            <CareerLeadingIcon
              name="fire"
              colors={colors}
              isDark={isDark}
              color={PROPHETIK_RED}
              size={19}
              accent={PROPHETIK_RED}
            />
          ),
          label: i18n.t("progression.career.bestStreak", { defaultValue: "Série record (jours)" }),
          value: stats.bestStreak,
        },
        {
          key: "fgc",
          leading: <FirstObjectiveIcon colors={colors} isDark={isDark} />,
          label: <FgcWinLabel colors={colors} />,
          value: stats.fgcWins,
        },
      ],
    },
  ];

  return (
    <View style={prophetikCardShadow()}>
      <View style={prophetikSectionCardStyle(colors)}>
        <CareerSectionHeader colors={colors} isDark={isDark} />

        <View
          style={{
            marginTop: 8,
            borderRadius: 12,
            backgroundColor: colors.card2 || colors.background,
            borderWidth: 1,
            borderColor: colors.border,
            paddingHorizontal: 4,
            paddingBottom: 4,
          }}
        >
          {sections.map((section, sectionIndex) => (
            <View key={section.key}>
              <CareerGroupLabel label={section.label} colors={colors} />
              {section.rows.map((row, index) => (
                <CareerStatRow
                  key={row.key}
                  leading={row.leading}
                  label={row.label}
                  value={row.value}
                  colors={colors}
                  isDark={isDark}
                  highlight={row.highlight}
                  isLast={sectionIndex === sections.length - 1 && index === section.rows.length - 1}
                />
              ))}
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}
