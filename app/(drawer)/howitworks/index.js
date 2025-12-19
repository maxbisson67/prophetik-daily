import React, { useMemo, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity } from "react-native";
import { useTheme } from "@src/theme/ThemeProvider";
import i18n from "@src/i18n/i18n";
import { Ionicons } from "@expo/vector-icons";

function Section({ title, icon, children, defaultOpen = true, colors }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <View
      style={{
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.card2,
        borderRadius: 14,
        overflow: "hidden",
      }}
    >
      <TouchableOpacity
        onPress={() => setOpen((v) => !v)}
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

function Row({ left, right, colors, boldRight = false }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
      <Text style={{ color: colors.subtext, fontWeight: "700" }}>{left}</Text>
      <Text style={{ color: colors.text, fontWeight: boldRight ? "900" : "700" }}>{right}</Text>
    </View>
  );
}

export default function CommentCaMarcheScreen() {
  const { colors } = useTheme();

  const formats = useMemo(
    () => [
      { f: "1x1", picks: 1, cost: 1 },
      { f: "2x2", picks: 2, cost: 2 },
      { f: "3x3", picks: 3, cost: 3 },
      { f: "4x4", picks: 4, cost: 4 },
      { f: "5x5", picks: 5, cost: 5 },
      { f: "6x7", picks: 6, cost: 6, special: true },
    ],
    []
  );

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ padding: 16, paddingBottom: 28, gap: 12 }}
    >
      <View style={{ gap: 6 }}>
        <Text style={{ color: colors.text, fontSize: 22, fontWeight: "900" }}>
          {i18n.t("howItWorks.title", { defaultValue: "Comment ça marche" })}
        </Text>
        <Text style={{ color: colors.subtext, lineHeight: 20 }}>
          {i18n.t("howItWorks.subtitle", {
            defaultValue:
              "Tout ce qu’il faut savoir pour créer un défi, participer, comprendre les formats, la cagnotte et le bris d’égalité.",
          })}
        </Text>
      </View>

      <Section
        title={i18n.t("howItWorks.formats.title", { defaultValue: "Formats & coût de participation" })}
        icon="grid-outline"
        colors={colors}
        defaultOpen
      >
        <Pill
          text={i18n.t("howItWorks.formats.rule", {
            defaultValue: "Règle simple : coût = nombre de joueurs à sélectionner",
          })}
          colors={colors}
          tone="neutral"
        />

        <View style={{ gap: 8, marginTop: 6 }}>
          {formats.map((x) => (
            <View
              key={x.f}
              style={{
                padding: 12,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.card,
                gap: 6,
              }}
            >
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Text style={{ color: colors.text, fontWeight: "900", fontSize: 16 }}>
                  {x.f} {x.special ? "🔥" : ""}
                </Text>
               <Pill
                text={i18n.t("howItWorks.formats.costPill", {
                  cost: x.cost,
                  defaultValue: `${x.cost} crédit(s)`
                })}
                colors={colors}
                tone={x.special ? "warn" : "neutral"}
              />
              </View>
              <Row
                left={i18n.t("howItWorks.formats.picksLabel", { defaultValue: "Joueurs à choisir" })}
                right={`${x.picks}`}
                colors={colors}
              />
              <Row
                left={i18n.t("howItWorks.formats.costLabel", { defaultValue: "Coût pour participer" })}
                right={`${x.cost}`}
                colors={colors}
              />
              {x.special ? (
                <Text style={{ color: "#92400e", fontWeight: "800", marginTop: 4 }}>
                  {i18n.t("howItWorks.formats.special67Note", {
                    defaultValue: "Événement spécial (samedi seulement). Bonus au gagnant.",
                  })}
                </Text>
              ) : null}
            </View>
          ))}
        </View>
      </Section>

      <Section
        title={i18n.t("howItWorks.create.title", { defaultValue: "Créer un défi" })}
        icon="add-circle-outline"
        colors={colors}
        defaultOpen={false}
      >
        <Bullet colors={colors}>
          {i18n.t("howItWorks.create.step1", { defaultValue: "Accède à l’onglet Défis." })}
        </Bullet>
        <Bullet colors={colors}>
          {i18n.t("howItWorks.create.step2", { defaultValue: "Choisis un groupe." })}
        </Bullet>
        <Bullet colors={colors}>
          {i18n.t("howItWorks.create.step3", { defaultValue: "Sélectionne un format (1x1, 2x2, …, 6x7)." })}
        </Bullet>
        <Bullet colors={colors}>
          {i18n.t("howItWorks.create.step4", { defaultValue: "Choisis la date NHL." })}
        </Bullet>
        <Bullet colors={colors}>
          {i18n.t("howItWorks.create.step5", { defaultValue: "Clique sur “Créer le défi”." })}
        </Bullet>

        <View style={{ marginTop: 8, gap: 6 }}>
          <Pill
            text={i18n.t("howItWorks.create.deadlinePill", {
              defaultValue: "Inscription/modification : jusqu’à 1h avant le 1er match",
            })}
            colors={colors}
            tone="warn"
          />
          <Text style={{ color: colors.subtext, lineHeight: 20 }}>
            {i18n.t("howItWorks.create.deadlineNote", {
              defaultValue:
                "Le bouton “Créer” peut se désactiver si la date limite est passée (1h avant le premier match).",
            })}
          </Text>
        </View>
      </Section>

      <Section
        title={i18n.t("howItWorks.join.title", { defaultValue: "Participer à un défi" })}
        icon="checkbox-outline"
        colors={colors}
        defaultOpen={false}
      >
        <Bullet colors={colors}>
          {i18n.t("howItWorks.join.step1", { defaultValue: "Accède à l’onglet Défis." })}
        </Bullet>
        <Bullet colors={colors}>
          {i18n.t("howItWorks.join.step2", { defaultValue: "Repère le défi (format + date)." })}
        </Bullet>
        <Bullet colors={colors}>
          {i18n.t("howItWorks.join.step3", { defaultValue: "Clique sur “Participer”." })}
        </Bullet>
        <Bullet colors={colors}>
          {i18n.t("howItWorks.join.step4", { defaultValue: "Sélectionne le nombre de joueurs requis par le format." })}
        </Bullet>
        <Bullet colors={colors}>
          {i18n.t("howItWorks.join.step5", { defaultValue: "Sauvegarde tes choix." })}
        </Bullet>

        <View style={{ marginTop: 8, gap: 8 }}>
          <Pill
            text={i18n.t("howItWorks.join.editPill", {
              defaultValue: "Tu peux modifier tes choix jusqu’à 1h avant le 1er match",
            })}
            colors={colors}
            tone="neutral"
          />
        </View>
      </Section>

      <Section
        title={i18n.t("howItWorks.pot.title", { defaultValue: "Cagnotte & gains" })}
        icon="cash-outline"
        colors={colors}
        defaultOpen={false}
      >
        <Bullet colors={colors}>
          {i18n.t("howItWorks.pot.rule1", {
            defaultValue: "Chaque participation ajoute des crédits à la cagnotte.",
          })}
        </Bullet>
        <Bullet colors={colors}>
          {i18n.t("howItWorks.pot.rule2", {
            defaultValue: "Le gagnant remporte la cagnotte du défi.",
          })}
        </Bullet>

        <View
          style={{
            marginTop: 8,
            padding: 12,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.card,
            gap: 6,
          }}
        >
          <Text style={{ color: colors.text, fontWeight: "900" }}>
            {i18n.t("howItWorks.pot.exampleTitle", { defaultValue: "Exemple" })}
          </Text>
          <Text style={{ color: colors.subtext, lineHeight: 20 }}>
            {i18n.t("howItWorks.pot.exampleBody", {
              defaultValue:
                "Défi 2x2 avec 5 participants → coût 2 crédits chacun → cagnotte = 10 crédits.",
            })}
          </Text>
        </View>

        <View style={{ marginTop: 8, gap: 6 }}>
          <Pill
            text={i18n.t("howItWorks.pot.special67Pill", {
              defaultValue: "6x7 : bonus spécial au gagnant (6 ou 7 crédits)",
            })}
            colors={colors}
            tone="warn"
          />
        </View>
      </Section>

      <Section
        title={i18n.t("howItWorks.tiebreak.title", { defaultValue: "Bris d’égalité" })}
        icon="trophy-outline"
        colors={colors}
        defaultOpen={false}
      >
        <Text style={{ color: colors.subtext, lineHeight: 20 }}>
          {i18n.t("howItWorks.tiebreak.intro", {
            defaultValue:
              "Si plusieurs participants ont le même score, Prophetik utilise un bris d’égalité automatique pour déterminer un seul gagnant.",
          })}
        </Text>

        <View style={{ marginTop: 6, gap: 8 }}>
          <Bullet colors={colors}>
            {i18n.t("howItWorks.tiebreak.rule1", { defaultValue: "1) Total de buts" })}
          </Bullet>
          <Bullet colors={colors}>
            {i18n.t("howItWorks.tiebreak.rule2", { defaultValue: "2) Total de passes" })}
          </Bullet>
          <Bullet colors={colors}>
            {i18n.t("howItWorks.tiebreak.rule3", {
              defaultValue: "3) Moins de joueurs différents utilisés (avantage à la précision)",
            })}
          </Bullet>
          <Bullet colors={colors}>
            {i18n.t("howItWorks.tiebreak.rule4", {
              defaultValue: "4) Heure de participation (premier inscrit)",
            })}
          </Bullet>
        </View>

        <Pill
          text={i18n.t("howItWorks.tiebreak.note", {
            defaultValue: "Tu peux ajuster ces règles selon la logique backend.",
          })}
          colors={colors}
          tone="neutral"
        />
      </Section>

      <Section
        title={i18n.t("howItWorks.groups.title", { defaultValue: "Groupes : créer et joindre" })}
        icon="people-outline"
        colors={colors}
        defaultOpen={false}
      >
        <Bullet colors={colors}>
          {i18n.t("howItWorks.groups.create", { defaultValue: "Créer un groupe : choisis un nom, puis invite des amis." })}
        </Bullet>
        <Bullet colors={colors}>
          {i18n.t("howItWorks.groups.join", { defaultValue: "Joindre un groupe : accepte une invitation ou utilise un code/lien (si disponible)." })}
        </Bullet>
        <Bullet colors={colors}>
          {i18n.t("howItWorks.groups.role", { defaultValue: "Le propriétaire du groupe peut gérer les paramètres et les membres." })}
        </Bullet>
      </Section>

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