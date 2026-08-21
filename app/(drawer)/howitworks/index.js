import React, { useState } from "react";
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
              "Le concept Prophetik, puis les guides pour créer un défi, participer et comprendre les règles.",
          })}
        </Text>
      </View>

      <Section
        title={i18n.t("howItWorks.concept.title", { defaultValue: "Le concept Prophetik" })}
        icon="sparkles-outline"
        colors={colors}
        defaultOpen
      >
        <Text style={{ color: colors.subtext, lineHeight: 20 }}>
          {i18n.t("howItWorks.concept.intro", {
            defaultValue:
              "Prophetik, c’est un défi sportif quotidien entre amis — pas une ligue publique à milliers de participants.",
          })}
        </Text>
        <Bullet colors={colors}>
          {i18n.t("howItWorks.concept.b1", {
            defaultValue:
              "Tu joues dans un groupe privé avec tes amis (NHL ou MLB).",
          })}
        </Bullet>
        <Bullet colors={colors}>
          {i18n.t("howItWorks.concept.b2", {
            defaultValue:
              "Chaque jour : des défis à relever, des picks à faire, des résultats en direct.",
          })}
        </Bullet>
        <Bullet colors={colors}>
          {i18n.t("howItWorks.concept.b4", {
            defaultValue:
              "Tes points s’accumulent sur la saison — le classement du groupe te suit toute l’année.",
          })}
        </Bullet>
        <Pill
          text={i18n.t("howItWorks.concept.cta", {
            defaultValue: "Crée un groupe ou rejoins tes amis avec un code d’invitation.",
          })}
          colors={colors}
          tone="success"
        />
      </Section>

      {/* Groupes */}
      <Section
        title={i18n.t("howItWorks.groups.title", { defaultValue: "Les groupes" })}
        icon="people-outline"
        colors={colors}
        defaultOpen={false}
      >
        <Text style={{ color: colors.subtext, lineHeight: 20 }}>
          {i18n.t("howItWorks.groups.intro", {
            defaultValue:
              "Un groupe, c’est ton cercle privé d’amis : chaque groupe a ses propres défis, son classement et son chat. Prophetik n’est pas une ligue publique — tu joues toujours dans un groupe.",
          })}
        </Text>

        <SubTitle colors={colors}>
          {i18n.t("howItWorks.groups.createTitle", { defaultValue: "Créer un groupe" })}
        </SubTitle>
        <Text style={{ color: colors.subtext, lineHeight: 20 }}>
          {i18n.t("howItWorks.groups.createIntro", {
            defaultValue:
              "Depuis l’onglet Groupes, appuie sur Créer et configure ton groupe :",
          })}
        </Text>
        <Bullet colors={colors}>
          {i18n.t("howItWorks.groups.createName", {
            defaultValue: "Nom — obligatoire (ex. Les Snipers du Nord).",
          })}
        </Bullet>
        <Bullet colors={colors}>
          {i18n.t("howItWorks.groups.createDescription", {
            defaultValue: "Description — optionnelle, visible par les membres.",
          })}
        </Bullet>
        <Bullet colors={colors}>
          {i18n.t("howItWorks.groups.createSport", {
            defaultValue: "Sport — NHL ou MLB. Détermine les matchs et les défis du groupe.",
          })}
        </Bullet>
        <Bullet colors={colors}>
          {i18n.t("howItWorks.groups.createAutopilot", {
            defaultValue:
              "Autopilote — si activé, SOLO, DUO et TRIO sont créés automatiquement chaque matin (vers 6 h 30). Le nombre de groupes en Autopilote dépend de ton forfait.",
          })}
        </Bullet>
        <Bullet colors={colors}>
          {i18n.t("howItWorks.groups.createFavorite", {
            defaultValue:
              "Équipe favorite — utilisée pour prioriser les matchs du groupe (SOLO et DUO). Modifiable à tout moment dans les paramètres.",
          })}
        </Bullet>
        <Text style={{ color: colors.subtext, lineHeight: 20, marginTop: 4 }}>
          {i18n.t("howItWorks.groups.createInvite", {
            defaultValue:
              "Une fois créé, partage le code d’invitation ou le QR Code depuis la fiche du groupe pour inviter tes amis.",
          })}
        </Text>

        <SubTitle colors={colors}>
          {i18n.t("howItWorks.groups.joinTitle", { defaultValue: "Joindre un groupe" })}
        </SubTitle>
        <Text style={{ color: colors.subtext, lineHeight: 20 }}>
          {i18n.t("howItWorks.groups.joinIntro", {
            defaultValue:
              "Depuis l’onglet Groupes, appuie sur Joindre :",
          })}
        </Text>
        <Bullet colors={colors}>
          {i18n.t("howItWorks.groups.joinCode", {
            defaultValue:
              "Saisis le code d’invitation à 8 caractères fourni par le propriétaire du groupe.",
          })}
        </Bullet>
        <Bullet colors={colors}>
          {i18n.t("howItWorks.groups.joinQr", {
            defaultValue:
              "Ou scanne le QR Code affiché sur la fiche du groupe (bouton Scanner un QR).",
          })}
        </Bullet>

        <SubTitle colors={colors}>
          {i18n.t("howItWorks.groups.activeTitle", {
            defaultValue: "Groupe actif et limites d’abonnement",
          })}
        </SubTitle>
        <Text style={{ color: colors.subtext, lineHeight: 20 }}>
          {i18n.t("howItWorks.groups.activeIntro", {
            defaultValue:
              "Tu peux être membre de plusieurs groupes, mais tu ne peux participer aux défis que dans tes groupes actifs — ceux où la participation est activée.",
          })}
        </Text>
        <Bullet colors={colors}>
          {i18n.t("howItWorks.groups.activeSwitch", {
            defaultValue:
              "Dans l’onglet Groupes, active ou désactive la participation pour chaque groupe (Activer la participation / Jouer dans ce groupe).",
          })}
        </Bullet>
        <Bullet colors={colors}>
          {i18n.t("howItWorks.groups.activeLimits", {
            defaultValue:
              "Limites de groupes actifs (jeu) : Gratuit 1 · Pro 5 · VIP 20. Consulte Mon forfait pour voir ton usage.",
          })}
        </Bullet>
        <Bullet colors={colors}>
          {i18n.t("howItWorks.groups.activeJoined", {
            defaultValue:
              "Rejoindre des groupes est illimité : si ta limite est atteinte, tu peux quand même rejoindre en mode inactif et activer plus tard.",
          })}
        </Bullet>
        <Bullet colors={colors}>
          {i18n.t("howItWorks.groups.activeOwned", {
            defaultValue:
              "Groupes possédés et Autopilote : mêmes plafonds par forfait (1 / 5 / 20). Passe à un forfait supérieur si tu veux en gérer davantage.",
          })}
        </Bullet>

        <View style={{ marginTop: 8 }}>
          <Pill
            text={i18n.t("howItWorks.groups.ownerPill", {
              defaultValue: "Le propriétaire gère les membres, les paramètres et peut créer les défis manuellement si l’Autopilote est désactivé.",
            })}
            colors={colors}
            tone="success"
          />
        </View>
      </Section>

      <Section
        title={i18n.t("howItWorks.challenges.title", { defaultValue: "Les défis et les points" })}
        icon="trophy-outline"
        colors={colors}
        defaultOpen={false}
      >
        <Text style={{ color: colors.subtext, lineHeight: 20 }}>
          {i18n.t("howItWorks.challenges.intro", {
            defaultValue:
              "Chaque jour, trois défis s’ajoutent à ton total de points pour le classement du groupe.",
          })}
        </Text>

        <SubTitle colors={colors}>
          {i18n.t("howItWorks.challenges.soloTitle", { defaultValue: "SOLO" })}
        </SubTitle>
        <Text style={{ color: colors.subtext, lineHeight: 20 }}>
          {i18n.t("howItWorks.challenges.soloBody", {
            defaultValue:
              "Premier but (NHL) ou premier point produit (MLB) : choisis le joueur qui marquera en premier.",
          })}
        </Text>
        <Pill
          text={i18n.t("howItWorks.challenges.soloPoints", {
            defaultValue: "+10 pts si tu as le bon joueur",
          })}
          colors={colors}
          tone="success"
        />

        <SubTitle colors={colors}>
          {i18n.t("howItWorks.challenges.duoTitle", { defaultValue: "DUO" })}
        </SubTitle>
        <Text style={{ color: colors.subtext, lineHeight: 20 }}>
          {i18n.t("howItWorks.challenges.duoBody", {
            defaultValue: "Prédire le gagnant de 2 matchs (tu peux aussi viser le score exact).",
          })}
        </Text>
        <Bullet colors={colors}>
          {i18n.t("howItWorks.challenges.duoPointsWinner", {
            defaultValue: "+5 pts par bon gagnant",
          })}
        </Bullet>
        <Bullet colors={colors}>
          {i18n.t("howItWorks.challenges.duoPointsExact", {
            defaultValue: "+5 pts de bonus si le score est exact (10 pts max par match)",
          })}
        </Bullet>

        <SubTitle colors={colors}>
          {i18n.t("howItWorks.challenges.trioTitle", { defaultValue: "TRIO" })}
        </SubTitle>
        <Text style={{ color: colors.subtext, lineHeight: 20 }}>
          {i18n.t("howItWorks.challenges.trioBody", {
            defaultValue:
              "Cumule les points de 3 joueurs qui évoluent aujourd’hui — selon leurs stats réelles du match.",
          })}
        </Text>
        <SubTitle colors={colors}>
          {i18n.t("howItWorks.challenges.trioMlbTitle", { defaultValue: "MLB" })}
        </SubTitle>
        <Bullet colors={colors}>
          {i18n.t("howItWorks.challenges.trioMlbLine1", {
            defaultValue: "Point produit, point compté ou coup sûr = 1 pt",
          })}
        </Bullet>
        <Bullet colors={colors}>
          {i18n.t("howItWorks.challenges.trioMlbLine2", {
            defaultValue: "Double, triple ou circuit = 1 pt supplémentaire",
          })}
        </Bullet>
        <SubTitle colors={colors}>
          {i18n.t("howItWorks.challenges.trioNhlTitle", { defaultValue: "NHL" })}
        </SubTitle>
        <Bullet colors={colors}>
          {i18n.t("howItWorks.challenges.trioNhlLine1", {
            defaultValue: "But = 1 pt",
          })}
        </Bullet>
        <Bullet colors={colors}>
          {i18n.t("howItWorks.challenges.trioNhlLine2", {
            defaultValue: "Passe = 1 pt",
          })}
        </Bullet>

        <View style={{ marginTop: 8, gap: 8 }}>
          <Pill
            text={i18n.t("howItWorks.challenges.bonusTitle", {
              defaultValue: "Bonus du jour (+5 pts)",
            })}
            colors={colors}
            tone="warn"
          />
          <Text style={{ color: colors.subtext, lineHeight: 20 }}>
            {i18n.t("howItWorks.challenges.bonusBody", {
              defaultValue:
                "+5 pts pour celui qui cumule le plus de points SOLO + DUO + TRIO dans la journée.",
            })}
          </Text>
          <Bullet colors={colors}>
            {i18n.t("howItWorks.challenges.bonusTie", {
              defaultValue:
                "En cas d’égalité au sommet, chaque ex æquo reçoit les +5 pts (pas de bris d’égalité).",
            })}
          </Bullet>
        </View>
      </Section>

      {/* Créer */}
      <Section
        title={i18n.t("howItWorks.create.title", { defaultValue: "Créer un défi" })}
        icon="add-circle-outline"
        colors={colors}
        defaultOpen={false}
      >
        <Text style={{ color: colors.subtext, lineHeight: 20 }}>
          {i18n.t("howItWorks.create.intro", {
            defaultValue:
              "Les défis du jour existent par groupe : chaque groupe d’amis a ses propres défis SOLO, DUO et TRIO.",
          })}
        </Text>

        <SubTitle colors={colors}>
          {i18n.t("howItWorks.create.todayTabTitle", { defaultValue: "Onglet Aujourd’hui" })}
        </SubTitle>
        <Text style={{ color: colors.subtext, lineHeight: 20 }}>
          {i18n.t("howItWorks.create.todayTabBody", {
            defaultValue:
              "C’est l’endroit où tu consultes les défis du jour et où tu fais tes picks. Choisis ton groupe en haut de l’écran pour voir les défis de ce groupe.",
          })}
        </Text>

        <SubTitle colors={colors}>
          {i18n.t("howItWorks.create.autopilotTitle", { defaultValue: "Mode Autopilote" })}
        </SubTitle>
        <Text style={{ color: colors.subtext, lineHeight: 20 }}>
          {i18n.t("howItWorks.create.autopilotIntro", {
            defaultValue:
              "Le propriétaire du groupe peut activer ou désactiver l’Autopilote dans les paramètres du groupe.",
          })}
        </Text>
        <Bullet colors={colors}>
          {i18n.t("howItWorks.create.autopilotOn", {
            defaultValue:
              "Autopilote activé : SOLO, DUO et TRIO sont créés automatiquement chaque matin (vers 6 h 30). Les membres sont notifiés.",
          })}
        </Bullet>
        <Bullet colors={colors}>
          {i18n.t("howItWorks.create.autopilotOff", {
            defaultValue:
              "Autopilote désactivé : aucun défi n’est créé automatiquement — le propriétaire doit les lancer.",
          })}
        </Bullet>

        <SubTitle colors={colors}>
          {i18n.t("howItWorks.create.manualTitle", { defaultValue: "Création manuelle" })}
        </SubTitle>
        <Text style={{ color: colors.subtext, lineHeight: 20 }}>
          {i18n.t("howItWorks.create.manualIntro", {
            defaultValue:
              "Si l’Autopilote est désactivé, seul le propriétaire du groupe peut créer les défis depuis l’onglet Aujourd’hui.",
          })}
        </Text>
        <Bullet colors={colors}>
          {i18n.t("howItWorks.create.manualSolo", {
            defaultValue: "SOLO — bouton Créer dans la section Premier but / Premier point produit",
          })}
        </Bullet>
        <Bullet colors={colors}>
          {i18n.t("howItWorks.create.manualDuo", {
            defaultValue: "DUO — bouton Créer dans la section Prédire le match",
          })}
        </Bullet>
        <Bullet colors={colors}>
          {i18n.t("howItWorks.create.manualTrio", {
            defaultValue: "TRIO — bouton Créer dans la section Trio du jour",
          })}
        </Bullet>
      </Section>

      {/* Participer */}
      <Section
        title={i18n.t("howItWorks.join.title", { defaultValue: "Participer à un défi" })}
        icon="checkbox-outline"
        colors={colors}
        defaultOpen={false}
      >
        <Text style={{ color: colors.subtext, lineHeight: 20 }}>
          {i18n.t("howItWorks.join.intro", {
            defaultValue:
              "Tout se passe dans l’onglet Aujourd’hui : choisis ton groupe en haut, puis participe aux trois défis du jour (SOLO, DUO, TRIO).",
          })}
        </Text>

        <SubTitle colors={colors}>
          {i18n.t("howItWorks.join.soloTitle", { defaultValue: "SOLO" })}
        </SubTitle>
        <Text style={{ color: colors.subtext, lineHeight: 20 }}>
          {i18n.t("howItWorks.join.soloBody", {
            defaultValue:
              "Section Premier but (NHL) ou Premier point produit (MLB). Appuie sur Participer, choisis un joueur parmi les deux équipes, puis enregistre.",
          })}
        </Text>
        <Bullet colors={colors}>
          {i18n.t("howItWorks.join.soloDeadline", {
            defaultValue:
              "Heure limite : 5 minutes avant le début du match. Tu peux modifier ton choix jusqu’à ce verrouillage.",
          })}
        </Bullet>
        <Bullet colors={colors}>
          {i18n.t("howItWorks.join.soloPostponed", {
            defaultValue:
              "Match reporté : tu peux encore participer ou modifier ton choix tant que le résultat n’est pas confirmé.",
          })}
        </Bullet>

        <SubTitle colors={colors}>
          {i18n.t("howItWorks.join.duoTitle", { defaultValue: "DUO" })}
        </SubTitle>
        <Text style={{ color: colors.subtext, lineHeight: 20 }}>
          {i18n.t("howItWorks.join.duoBody", {
            defaultValue:
              "Section Prédire l’issue des matchs. Pour chaque confrontation, choisis le gagnant et le pointage (score exact = bonus).",
          })}
        </Text>
        <Bullet colors={colors}>
          {i18n.t("howItWorks.join.duoDeadline", {
            defaultValue:
              "Chaque match se verrouille 5 minutes avant son début. Tu peux compléter tes prédictions progressivement, match par match.",
          })}
        </Bullet>

        <SubTitle colors={colors}>
          {i18n.t("howItWorks.join.trioTitle", { defaultValue: "TRIO" })}
        </SubTitle>
        <Text style={{ color: colors.subtext, lineHeight: 20 }}>
          {i18n.t("howItWorks.join.trioBody", {
            defaultValue:
              "Section Trio du jour. Appuie sur Participer, puis sélectionne 3 joueurs qui évoluent aujourd’hui. Tes points s’accumulent en direct selon leurs stats.",
          })}
        </Text>
        <Bullet colors={colors}>
          {i18n.t("howItWorks.join.trioDeadline", {
            defaultValue:
              "Heure limite : 15 minutes avant le premier match de la journée. Tu peux modifier tes 3 joueurs jusqu’à cette limite.",
          })}
        </Bullet>

        <SubTitle colors={colors}>
          {i18n.t("howItWorks.join.deadlinesTitle", {
            defaultValue: "Heures limites — récapitulatif",
          })}
        </SubTitle>
        <Bullet colors={colors}>
          {i18n.t("howItWorks.join.deadlineAutopilot", {
            defaultValue:
              "Création des défis : vers 6 h 30 (heure de Toronto) si l’Autopilote est activé — tu reçois une notification.",
          })}
        </Bullet>
        <Bullet colors={colors}>
          {i18n.t("howItWorks.join.deadlineSolo", {
            defaultValue: "SOLO : verrouillage 5 min avant le début du match.",
          })}
        </Bullet>
        <Bullet colors={colors}>
          {i18n.t("howItWorks.join.deadlineDuo", {
            defaultValue: "DUO : verrouillage 5 min avant chaque match.",
          })}
        </Bullet>
        <Bullet colors={colors}>
          {i18n.t("howItWorks.join.deadlineTrio", {
            defaultValue: "TRIO : inscription et modifications jusqu’à 15 min avant le premier match.",
          })}
        </Bullet>

        <SubTitle colors={colors}>
          {i18n.t("howItWorks.join.novaTitle", { defaultValue: "Nova Coach" })}
        </SubTitle>
        <Text style={{ color: colors.subtext, lineHeight: 20 }}>
          {i18n.t("howItWorks.join.novaIntro", {
            defaultValue:
              "Nova est l’assistante intégrée qui t’aide à faire tes picks. Elle apparaît lors du choix d’un joueur ou d’un match.",
          })}
        </Text>
        <Bullet colors={colors}>
          {i18n.t("howItWorks.join.novaLearn", {
            defaultValue:
              "Apprendre : réponses instantanées sur les bases (premier but, RBI, OPS, ERA, platoon, BvP, barème DUO…).",
          })}
        </Bullet>
        <Bullet colors={colors}>
          {i18n.t("howItWorks.join.novaStrategy", {
            defaultValue:
              "Stratégies : analyse personnalisée par IA — avis sur un joueur, un match ou une comparaison (consomme ton quota mensuel).",
          })}
        </Bullet>
        <Bullet colors={colors}>
          {i18n.t("howItWorks.join.novaAdvice", {
            defaultValue:
              "Bouton « Avis de Nova » : analyse complète pour le joueur ou le match que tu consultes.",
          })}
        </Bullet>
        <Bullet colors={colors}>
          {i18n.t("howItWorks.join.novaQuota", {
            defaultValue:
              "Quota mensuel : Gratuit 30 · Pro 100 · VIP 250 conseils. Consulte Mon forfait pour suivre ton usage.",
          })}
        </Bullet>

        <View style={{ marginTop: 8, gap: 6 }}>
          <Pill
            text={i18n.t("howItWorks.join.tipsTitle", { defaultValue: "Conseils" })}
            colors={colors}
            tone="warn"
          />
          <Bullet colors={colors}>
            {i18n.t("howItWorks.join.tipInfoBubble", {
              defaultValue:
                "Chaque section affiche une bulle d’info (?) avec le fonctionnement détaillé du défi.",
            })}
          </Bullet>
          <Bullet colors={colors}>
            {i18n.t("howItWorks.join.tipLive", {
              defaultValue:
                "Pendant les matchs, suis tes points en direct dans l’onglet En direct.",
            })}
          </Bullet>
          <Bullet colors={colors}>
            {i18n.t("howItWorks.join.tipBonus", {
              defaultValue:
                "Participe aux trois défis pour viser le bonus du jour (+5 pts au meilleur total SOLO + DUO + TRIO).",
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