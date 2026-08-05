import React, { useState } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import i18n from "@src/i18n/i18n";
import { useTheme } from "@src/theme/ThemeProvider";

function OrdinalSuperscript({ text, colors, baseSize = 14 }) {
  return (
    <View style={{ transform: [{ translateY: -Math.round(baseSize * 0.38) }] }}>
      <Text
        style={{
          fontSize: Math.round(baseSize * 0.62),
          fontWeight: "900",
          color: colors.text,
          lineHeight: Math.round(baseSize * 0.68),
          includeFontPadding: false,
        }}
      >
        {text}
      </Text>
    </View>
  );
}

function FgcInfoTitle({ sport, colors }) {
  const isMlb = String(sport || "NHL").toUpperCase() === "MLB";
  const textStyle = { color: colors.text, fontWeight: "900" };

  if (isMlb) {
    return (
      <View style={{ flex: 1, flexDirection: "row", flexWrap: "wrap", alignItems: "flex-end" }}>
        <Text style={textStyle}>
          {i18n.t("firstGoal.home.infoTitleMlbPrefix", {
            defaultValue: "Fonctionnement du défi 1",
          })}
        </Text>
        <OrdinalSuperscript
          text={i18n.t("firstGoal.home.infoTitleMlbOrdinal", { defaultValue: "ier" })}
          colors={colors}
        />
        <Text style={textStyle}>
          {i18n.t("firstGoal.home.infoTitleMlbSuffix", {
            defaultValue: " point produit",
          })}
        </Text>
      </View>
    );
  }

  return (
    <Text style={{ ...textStyle, flex: 1 }}>
      {i18n.t("firstGoal.home.infoTitleNhl", {
        defaultValue: "Fonctionnement du défi premier but",
      })}
    </Text>
  );
}

function getBubbleCopy(kind, sport) {
  if (kind === "fgc") {
    return {
      titleNode: "fgc",
      body: i18n.t("firstGoal.home.infoBody", {
        defaultValue:
          "• Choisis le joueur qui marquera le premier but ou le premier point produit du match.\n• 10 points seront alloués à celui qui a prédit le bon joueur.",
      }),
      extra: null,
      sport,
    };
  }

  if (kind === "tp") {
    return {
      title: i18n.t("tp.home.infoTitle", {
        defaultValue: "Fonctionnement du défi Prédire les matchs",
      }),
      body: i18n.t("tp.home.infoBody", {
        defaultValue:
          "Choisis le pointage de chaque confrontation. Un match bien prédit donne 5 points ; un score exact donne 5 points supplémentaires.",
      }),
      extra: i18n.t("tp.home.infoLockHint", {
        defaultValue:
          "Chaque match se verrouille 5 minutes avant le début. Tu peux compléter tes prédictions progressivement.",
      }),
    };
  }

  if (kind === "ts") {
    return {
      title: i18n.t("home.tsInfoTitle", {
        defaultValue: "Comment fonctionne ce défi",
      }),
      sections: [
        {
          heading: i18n.t("home.tsInfoFunctioningTitle", {
            defaultValue: "Fonctionnement",
          }),
          bullets: [
            i18n.t("home.tsInfoFunctioning1", {
              defaultValue:
                "Choisis 3 joueurs qui jouent aujourd'hui.",
            }),
            i18n.t("home.tsInfoFunctioning2", {
              defaultValue:
                "Tes joueurs cumulent des points en temps réel selon leurs performances.",
            }),
          ],
        },
        {
          heading: i18n.t("home.tsInfoScoringTitle", {
            defaultValue: "Comment cumuler des points",
          }),
          bullets: [
            i18n.t("home.tsInfoScoringMlb", {
              defaultValue:
                "Baseball : 1 point par coup sûr, 1 point par point produit et un bonus de 1 point pour un coup de circuit.",
            }),
            i18n.t("home.tsInfoScoringNhl", {
              defaultValue: "Hockey : 1 point par but et 1 point par passe.",
            }),
          ],
        },
      ],
    };
  }

  return {
    title: i18n.t("home.todayChallengeInfoTitle", {
      defaultValue: "C’est quoi le défi du jour?",
    }),
    body: i18n.t("home.todayChallengeInfoBody", {
      defaultValue:
        "Chaque défi du jour te demande de choisir un certain nombre de joueurs selon le format (ex. 2x2, 3x3). Tes joueurs accumulent des points réels selon leurs performances, et le meilleur total remporte le défi.",
    }),
    extra: null,
  };
}

export default function DefiChallengeInfoBubble({
  kind,
  colors,
  sport = "NHL",
  inIntroBand = false,
  footerContent = null,
}) {
  const { isDark } = useTheme();
  const [open, setOpen] = useState(false);
  const copy = getBubbleCopy(kind, sport);

  const shellStyle = inIntroBand
    ? {
        backgroundColor: colors.card2,
        borderColor: colors.border,
      }
    : {
        backgroundColor: colors.card2,
        borderColor: colors.border,
      };

  return (
    <View
      style={{
        borderRadius: 12,
        borderWidth: 1,
        marginTop: inIntroBand ? 8 : 0,
        marginBottom: inIntroBand ? 0 : 10,
        overflow: "hidden",
        ...shellStyle,
      }}
    >
      <TouchableOpacity
        onPress={() => setOpen((v) => !v)}
        activeOpacity={0.85}
        style={{
          paddingHorizontal: 12,
          paddingVertical: 8,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
          <MaterialCommunityIcons
            name="information-outline"
            size={18}
            color={colors.subtext}
            style={{ marginTop: 1 }}
          />
          <View style={{ marginLeft: 8, flex: 1 }}>
            {copy.titleNode === "fgc" ? (
              <FgcInfoTitle sport={copy.sport || sport} colors={colors} />
            ) : (
              <Text style={{ color: colors.text, fontWeight: "900", flex: 1 }}>{copy.title}</Text>
            )}
          </View>
        </View>

        <MaterialCommunityIcons
          name={open ? "chevron-up" : "chevron-down"}
          size={22}
          color={colors.subtext}
        />
      </TouchableOpacity>

      {open ? (
        <View
          style={{
            paddingHorizontal: 12,
            paddingBottom: 12,
            borderTopWidth: 1,
            borderTopColor: inIntroBand ? shellStyle.borderColor : colors.border,
          }}
        >
          {Array.isArray(copy.sections) && copy.sections.length ? (
            copy.sections.map((section, sectionIndex) => (
              <View key={section.heading || sectionIndex} style={{ marginTop: sectionIndex ? 14 : 10 }}>
                <Text style={{ color: colors.text, fontWeight: "900", marginBottom: 6 }}>
                  {section.heading}
                </Text>
                {(section.bullets || []).map((bullet, bulletIndex) => (
                  <Text
                    key={`${sectionIndex}-${bulletIndex}`}
                    style={{
                      color: colors.subtext,
                      lineHeight: 18,
                      marginTop: bulletIndex ? 4 : 0,
                    }}
                  >
                    • {bullet}
                  </Text>
                ))}
              </View>
            ))
          ) : (
            <Text style={{ color: colors.subtext, marginTop: 10, lineHeight: 18 }}>{copy.body}</Text>
          )}
          {copy.extra ? (
            <Text style={{ color: colors.subtext, marginTop: 10, lineHeight: 18 }}>{copy.extra}</Text>
          ) : null}
          {footerContent ? (
            <View
              style={{
                marginTop: 14,
                paddingTop: 12,
                borderTopWidth: 1,
                borderTopColor: inIntroBand ? shellStyle.borderColor : colors.border,
              }}
            >
              {footerContent}
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
