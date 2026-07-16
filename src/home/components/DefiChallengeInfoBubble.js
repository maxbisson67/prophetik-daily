import React, { useState } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import i18n from "@src/i18n/i18n";
import { useTheme } from "@src/theme/ThemeProvider";

function getBubbleCopy(kind) {
  if (kind === "fgc") {
    return {
      title: i18n.t("firstGoal.home.infoTitle", { defaultValue: "Comment fonctionne ce défi" }),
      body: i18n.t("firstGoal.home.infoBody", {
        defaultValue:
          "• Choisis le joueur qui marquera le premier but ou le premier point produit du match.\n• 10 points seront alloués à celui qui a prédit le bon joueur.",
      }),
      extra: null,
    };
  }

  if (kind === "tp") {
    return {
      title: i18n.t("tp.home.infoTitle", {
        defaultValue: "Comment fonctionne ce défi",
      }),
      body: i18n.t("tp.home.infoBody", {
        defaultValue:
          "Choisis le pointage des confrontations proposées et cumule des points pour chaque bonne prédiction. Avec la bonne prédiction du pointage, cumule encore plus de points.",
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
                "Sois meilleur que tes amis en sélectionnant 3 joueurs qui jouent aujourd'hui.",
            }),
            i18n.t("home.tsInfoFunctioning2", {
              defaultValue:
                "Le(s) participant(s) ayant cumulé le plus de points se partagent la cagnotte.",
            }),
            i18n.t("home.tsInfoFunctioning3", {
              defaultValue: "La cagnotte augmente de 3 points par inscription.",
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

export default function DefiChallengeInfoBubble({ kind, colors, inIntroBand = false }) {
  const { isDark } = useTheme();
  const [open, setOpen] = useState(false);
  const copy = getBubbleCopy(kind);

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
          <Text style={{ color: colors.text, fontWeight: "900", marginLeft: 8, flex: 1 }}>
            {copy.title}
          </Text>
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
        </View>
      ) : null}
    </View>
  );
}
