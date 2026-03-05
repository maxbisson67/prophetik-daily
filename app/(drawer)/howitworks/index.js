import React, { useMemo, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity } from "react-native";
import { useTheme } from "@src/theme/ThemeProvider";
import i18n from "@src/i18n/i18n";
import { Ionicons } from "@expo/vector-icons";

const RED = "#b91c1c";

function prophetikCardStyle(colors, accent = RED) {
  return {
    borderLeftWidth: 4,
    borderLeftColor: accent,
    borderBottomWidth: 2,
    borderBottomColor: accent,
  };
}

function Section({ title, icon, children, defaultOpen = true, colors }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
      <View
        style={[
          {
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.card2,
            borderRadius: 14,
            overflow: "hidden",
          },
          prophetikCardStyle(colors),
        ]}
      >
      <TouchableOpacity
        onPress={() => setOpen((v) => !v)}
        activeOpacity={0.85}
        style={{
          paddingHorizontal: 14,
          paddingVertical: 12,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          backgroundColor: colors.card,
          borderBottomWidth: open ? 1 : 0,
          borderBottomColor: colors.border,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
          <Ionicons name={icon} size={18} color={colors.text} />
          <Text style={{ color: colors.text, fontWeight: "900", fontSize: 15, flex: 1 }}>
            {title}
          </Text>
        </View>

        <Ionicons
          name={open ? "chevron-up" : "chevron-down"}
          size={18}
          color={colors.subtext}
        />
      </TouchableOpacity>

      {open ? <View style={{ padding: 14, gap: 10 }}>{children}</View> : null}
    </View>
  );
}

function Bullet({ children, colors }) {
  return (
    <View style={{ flexDirection: "row", gap: 10 }}>
      <Text style={{ color: colors.subtext, marginTop: 1 }}>•</Text>
      <Text style={{ color: colors.text, flex: 1, lineHeight: 20 }}>{children}</Text>
    </View>
  );
}

function Pill({ text, colors, tone = "neutral" }) {
  const stylesByTone = {
    neutral: { bg: colors.card, border: colors.border, text: colors.text },
    danger: { bg: "#fee2e2", border: "#fecaca", text: "#7f1d1d" },
    warn: { bg: "#fffbeb", border: "#f59e0b", text: "#92400e" },
    success: { bg: "#dcfce7", border: "#86efac", text: "#14532d" },
  };

  const s = stylesByTone[tone] || stylesByTone.neutral;

  return (
    <View
      style={{
        alignSelf: "flex-start",
        paddingVertical: 6,
        paddingHorizontal: 10,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: s.border,
        backgroundColor: s.bg,
      }}
    >
      <Text style={{ color: s.text, fontWeight: "800", fontSize: 12 }}>{text}</Text>
    </View>
  );
}

function SubTitle({ children, colors }) {
  return (
    <Text style={{ color: colors.text, fontWeight: "900", marginTop: 6 }}>
      {children}
    </Text>
  );
}

export default function CommentCaMarcheScreen() {
  const { colors } = useTheme();

  const dailyFormats = useMemo(
    () => [
      { f: "1x1", picks: 1, pot: 1 },
      { f: "2x2", picks: 2, pot: 2 },
      { f: "3x3", picks: 3, pot: 3 },
      { f: "4x4", picks: 4, pot: 4 },
      { f: "5x5", picks: 5, pot: 5 },
      { f: "6x6", picks: 6, pot: 6 },
      { f: "7x7", picks: 7, pot: 7 },
    ],
    []
  );

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ padding: 16, paddingBottom: 28, gap: 12 }}
    >
      {/* Header */}
      <View style={{ gap: 6 }}>
        <Text style={{ color: colors.text, fontSize: 22, fontWeight: "900" }}>
          {i18n.t("howItWorks.title", { defaultValue: "Comment ça marche" })}
        </Text>
        <Text style={{ color: colors.subtext, lineHeight: 20 }}>
          {i18n.t("howItWorks.subtitle", {
            defaultValue:
              "Tout ce qu’il faut savoir sur les défis, la création, la participation et les règles d’abonnement.",
          })}
        </Text>
      </View>

      {/* 1) Formats */}
      <Section
        title={i18n.t("howItWorks.formats.title", { defaultValue: "Formats des défis" })}
        icon="grid-outline"
        colors={colors}
        defaultOpen
      >

        <Pill
          text={i18n.t("howItWorks.formats.legendPill", {
            defaultValue: "Lecture rapide : 3x3 = 3 joueurs à choisir + 3 points ajoutés à la cagnotte",
          })}
          colors={colors}
          tone="neutral"
        />

        <Text style={{ color: colors.subtext, lineHeight: 20 }}>
          {i18n.t("howItWorks.formats.legendBody", {
            defaultValue:
              "Le premier nombre indique le nombre de joueurs à sélectionner. Le deuxième nombre indique combien de points Prophetik ajoute à la cagnotte du défi (gratuit pour participer).",
          })}
        </Text>

        <SubTitle colors={colors}>
          {i18n.t("howItWorks.formats.dailyTitle", { defaultValue: "Défis quotidiens (1x1 à 7x7)" })}
        </SubTitle>

        <Text style={{ color: colors.subtext, lineHeight: 20 }}>
          {i18n.t("howItWorks.formats.dailyBody", {
            defaultValue:
              "Chaque défi quotidien te demande de sélectionner de 1 à 7 joueurs (selon le format).",
          })}
        </Text>

        <View style={{ gap: 8, marginTop: 6 }}>
          {dailyFormats.map((x) => (
            <View
              key={x.f}
              style={{
                padding: 12,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.card,
              }}
            >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
              }}
            >
              {/* FORMAT À GAUCHE */}
                <View style={{ width: 64 }}>
                  <Text style={{ color: colors.text, fontWeight: "900", fontSize: 18 }}>
                    {x.f}
                  </Text>
                </View>

              {/* PILLS À DROITE */} 
              <View style={{ flex: 1, flexDirection: "row", justifyContent: "flex-end", gap: 8 }}>
                <Pill text={`${x.picks} joueur(s)`} colors={colors} tone="neutral" />
                <Pill text={`+${x.pot} cagnotte`} colors={colors} tone="success" />
              </View>
            </View>
            </View>
          ))}
        </View>

        <SubTitle colors={colors}>
          {i18n.t("howItWorks.formats.ascTitle", { defaultValue: "Défis Ascension" })}
        </SubTitle>
        <Text style={{ color: colors.subtext, lineHeight: 20 }}>
          {i18n.t("howItWorks.formats.ascBody", {
            defaultValue:
              "Ascension 4 (4 jours) et Ascension 7 (7 jours). Les performances s’accumulent sur plusieurs jours.",
          })}
        </Text>

        <SubTitle colors={colors}>
          {i18n.t("howItWorks.formats.firstGoalTitle", { defaultValue: "Défi Premier But" })}
        </SubTitle>
        <Text style={{ color: colors.subtext, lineHeight: 20 }}>
          {i18n.t("howItWorks.formats.firstGoalBody", {
            defaultValue:
              "Choisis un seul joueur parmi les deux équipes qui s’affrontent. Si ton joueur marque le premier but confirmé, tu gagnes.",
          })}
        </Text>

        <View style={{ marginTop: 8, gap: 8 }}>
          <Pill
            text={i18n.t("howItWorks.formats.potTitle", {
              defaultValue: "Cagnotte (défis 1x1 à 7x7)",
            })}
            colors={colors}
            tone="neutral"
          />
          <Text style={{ color: colors.subtext, lineHeight: 20 }}>
            {i18n.t("howItWorks.formats.potBody", {
              defaultValue:
                  "Pour les défis quotidiens 1x1 à 7x7, Prophetik ajoute des points à la cagnotte selon le format (le 2e nombre). Aucun coût d’inscription n’est requis.",            })}
          </Text>
        </View>
      </Section>

      {/* 2) Créer */}
      <Section
        title={i18n.t("howItWorks.create.title", { defaultValue: "Créer un défi" })}
        icon="add-circle-outline"
        colors={colors}
        defaultOpen={false}
      >
        <Pill
          text={i18n.t("howItWorks.create.whereTitle", { defaultValue: "Où créer un défi" })}
          colors={colors}
          tone="neutral"
        />
        <Text style={{ color: colors.subtext, lineHeight: 20 }}>
          {i18n.t("howItWorks.create.whereBody", {
            defaultValue: "Depuis la page d’Accueil, l’onglet Groupes ou l’onglet Défis.",
          })}
        </Text>

        <Pill
          text={i18n.t("howItWorks.create.notifyTitle", { defaultValue: "Notification" })}
          colors={colors}
          tone="success"
        />
        <Text style={{ color: colors.subtext, lineHeight: 20 }}>
          {i18n.t("howItWorks.create.notifyBody", {
            defaultValue:
              "Lorsqu’un défi est créé, une notification est envoyée aux membres du groupe.",
          })}
        </Text>

        <SubTitle colors={colors}>
          {i18n.t("howItWorks.create.dailyTitle", { defaultValue: "Créer un défi quotidien (3 étapes)" })}
        </SubTitle>
        <Bullet colors={colors}>
          {i18n.t("howItWorks.create.dailyS1", { defaultValue: "1) Choix du groupe" })}
        </Bullet>
        <Bullet colors={colors}>
          {i18n.t("howItWorks.create.dailyS2", { defaultValue: "2) Choix du format (1x1 à 7x7)" })}
        </Bullet>
        <Bullet colors={colors}>
          {i18n.t("howItWorks.create.dailyS3", { defaultValue: "3) Choix de la date" })}
        </Bullet>

        <SubTitle colors={colors}>
          {i18n.t("howItWorks.create.ascTitle", { defaultValue: "Créer une Ascension (4 étapes)" })}
        </SubTitle>
        <Bullet colors={colors}>
          {i18n.t("howItWorks.create.ascS1", { defaultValue: "1) Choix du groupe" })}
        </Bullet>
        <Bullet colors={colors}>
          {i18n.t("howItWorks.create.ascS2", { defaultValue: "2) Type d’Ascension (4 jours ou 7 jours)" })}
        </Bullet>
        <Bullet colors={colors}>
          {i18n.t("howItWorks.create.ascS3", { defaultValue: "3) Choix de la date" })}
        </Bullet>
        <Bullet colors={colors}>
          {i18n.t("howItWorks.create.ascS4", { defaultValue: "4) Confirmation" })}
        </Bullet>

        <SubTitle colors={colors}>
          {i18n.t("howItWorks.create.firstGoalTitle", { defaultValue: "Créer un défi Premier But" })}
        </SubTitle>
        <Text style={{ color: colors.subtext, lineHeight: 20 }}>
          {i18n.t("howItWorks.create.firstGoalBody", {
            defaultValue: "Le défi Premier But se crée pour la journée même uniquement.",
          })}
        </Text>

        <View style={{ marginTop: 8, gap: 6 }}>
          <Pill
            text={i18n.t("howItWorks.create.constraintsTitle", { defaultValue: "Contraintes" })}
            colors={colors}
            tone="warn"
          />
          <Bullet colors={colors}>
            {i18n.t("howItWorks.create.c1", { defaultValue: "Création : propriétaire du groupe seulement." })}
          </Bullet>
          <Bullet colors={colors}>
            {i18n.t("howItWorks.create.c2", {
              defaultValue:
                "Abonnement Free : maximum 7 créations par semaine (défis quotidiens ou ascensions). La semaine débute le samedi à minuit.",
            })}
          </Bullet>
          <Bullet colors={colors}>
            {i18n.t("howItWorks.create.c3", {
              defaultValue: "Ascension 7 : réservée aux abonnements Pro et VIP.",
            })}
          </Bullet>
          <Bullet colors={colors}>
            {i18n.t("howItWorks.create.c4", {
              defaultValue:
                "Défi quotidien / ascension : doit être créé pour un match qui débute dans moins de 72 heures.",
            })}
          </Bullet>
          <Bullet colors={colors}>
            {i18n.t("howItWorks.create.c5", {
              defaultValue:
                "Premier But : limité à 1 par jour et par groupe (journée même).",
            })}
          </Bullet>
        </View>
      </Section>

      {/* 3) Participer */}
      <Section
        title={i18n.t("howItWorks.join.title", { defaultValue: "Participer à un défi" })}
        icon="checkbox-outline"
        colors={colors}
        defaultOpen={false}
      >
        <SubTitle colors={colors}>
          {i18n.t("howItWorks.join.dailyTitle", { defaultValue: "Défi quotidien" })}
        </SubTitle>
        <Text style={{ color: colors.subtext, lineHeight: 20 }}>
          {i18n.t("howItWorks.join.dailyBody", {
            defaultValue:
              "Choisis le nombre de joueurs requis selon le format (1 à 7).",
          })}
        </Text>

        <SubTitle colors={colors}>
          {i18n.t("howItWorks.join.ascTitle", { defaultValue: "Défi Ascension" })}
        </SubTitle>
        <Text style={{ color: colors.subtext, lineHeight: 20 }}>
          {i18n.t("howItWorks.join.ascBody", {
            defaultValue:
              "L’inscription n’est pas obligatoire, mais elle est fortement suggérée vu la nature du défi (sur plusieurs jours).",
          })}
        </Text>

        <SubTitle colors={colors}>
          {i18n.t("howItWorks.join.firstGoalTitle", { defaultValue: "Défi Premier But" })}
        </SubTitle>
        <Text style={{ color: colors.subtext, lineHeight: 20 }}>
          {i18n.t("howItWorks.join.firstGoalBody", {
            defaultValue:
              "Choisis un seul joueur parmi les deux équipes. Le premier buteur est confirmé officiellement quelques minutes après le but (pour éviter les buts annulés ou réattribués).",
          })}
        </Text>

        <View style={{ marginTop: 8, gap: 6 }}>
          <Pill
            text={i18n.t("howItWorks.join.constraintsTitle", { defaultValue: "Contraintes" })}
            colors={colors}
            tone="warn"
          />
          <Bullet colors={colors}>
            {i18n.t("howItWorks.join.j1", {
              defaultValue:
                "Abonnement Free : limité à 7 participations par semaine. La semaine commence le samedi à minuit.",
            })}
          </Bullet>
          <Bullet colors={colors}>
            {i18n.t("howItWorks.join.j2", {
              defaultValue:
                "Participation à l’Ascension 7 : réservée aux abonnements Pro et VIP.",
            })}
          </Bullet>
          <Bullet colors={colors}>
            {i18n.t("howItWorks.join.j3", {
              defaultValue:
                "Inscription : permise jusqu’à 1 heure avant le début du premier match de la journée.",
            })}
          </Bullet>
        </View>
      </Section>

      {/* Footer note */}
      <View style={{ paddingTop: 6 }}>
        <Text style={{ color: colors.subtext, fontSize: 12, lineHeight: 18 }}>
          {i18n.t("howItWorks.footer", {
            defaultValue:
              "Prophetik évolue : certaines options peuvent varier selon le groupe ou les événements spéciaux.",
          })}
        </Text>
      </View>
    </ScrollView>
  );
}