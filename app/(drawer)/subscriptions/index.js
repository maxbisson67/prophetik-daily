// app/(drawer)/subscriptions/index.js
import React, { useMemo, useState, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTheme } from "@src/theme/ThemeProvider";
import { useAuth } from "@src/auth/SafeAuthProvider";
import i18n from "@src/i18n/i18n";
import { useLanguage } from "@src/i18n/LanguageProvider";


import firestore from "@react-native-firebase/firestore";

import useEntitlement from "./useEntitlement";

import ProphetikIcons from "@src/ui/ProphetikIcons";


/* =========================================================
   Small UI helpers
========================================================= */

function Pill({ text, bg, fg }) {
  return (
    <View
      style={{
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 999,
        backgroundColor: bg,
        alignSelf: "flex-start",
      }}
    >
      <Text style={{ color: fg, fontWeight: "800", fontSize: 12 }}>{text}</Text>
    </View>
  );
}

function ValueChip({ text, colors, tone = "neutral" }) {
  const bg =
    tone === "vip"
      ? colors.primary
      : tone === "pro"
      ? colors.card2
      : colors.background;

  const fg = tone === "vip" ? "#fff" : colors.text;

  return (
    <View
      style={{
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 10,
        backgroundColor: bg,
        borderWidth: 1,
        borderColor: colors.border,
        alignItems: "center",
        justifyContent: "center",
        minHeight: 34,
      }}
    >
      <Text
        style={{
          color: fg,
          fontWeight: "800",
          fontVariant: ["tabular-nums"],
          textAlign: "center",
          fontSize: 12,
        }}
        numberOfLines={2}
      >
        {text}
      </Text>
    </View>
  );
}

function PlanCard({ plan, isCurrent, onSelect, loading, colors }) {
  const borderColor = isCurrent ? colors.primary : colors.border;

  return (
    <View
      style={{
        borderWidth: 1,
        borderColor,
        backgroundColor: colors.card,
        borderRadius: 16,
        padding: 14,
      }}
    >
      {/* Header */}
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <View style={{ flex: 1, paddingRight: 10 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <ProphetikIcons mode="badge" variant={plan.id} iconOnly size="xxl" />
            <Text style={{ color: colors.text, fontWeight: "900", fontSize: 18 }}>
              {plan.title}
            </Text>
          </View>

          <Text style={{ color: colors.subtext, marginTop: 2 }}>{plan.subtitle}</Text>
        </View>

        {isCurrent ? (
          <Pill
            text={i18n.t("subscriptions.active", { defaultValue: "Actif" })}
            bg={colors.primary}
            fg={"#fff"}
          />
        ) : plan.badge ? (
          <Pill text={plan.badge} bg={colors.card2} fg={colors.text} />
        ) : null}
      </View>

      {/* Price */}
      <View style={{ marginTop: 12 }}>
        <Text style={{ color: colors.text, fontWeight: "900", fontSize: 22 }}>
          {plan.price}
          <Text style={{ color: colors.subtext, fontWeight: "700", fontSize: 14 }}>
            {plan.priceNote}
          </Text>
        </Text>
      </View>

      {/* Highlights */}
      {plan.highlights?.length ? (
        <View style={{ marginTop: 12, gap: 6 }}>
          {plan.highlights.map((h, idx) => (
            <View
              key={idx}
              style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
            >
              <MaterialCommunityIcons
                // ✅ valide MaterialCommunityIcons (remplace "sparkles")
                name="star-four-points"
                size={18}
                color={plan.accent || colors.primary}
              />
              <Text style={{ color: colors.text, fontWeight: "600", flex: 1 }}>
                {h}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      {/* CTA */}
      <TouchableOpacity
        disabled={loading || isCurrent}
        onPress={onSelect}
        activeOpacity={0.9}
        style={{
          marginTop: 14,
          backgroundColor: isCurrent ? colors.card2 : plan.ctaBg || colors.primary,
          paddingVertical: 12,
          borderRadius: 12,
          alignItems: "center",
          opacity: loading ? 0.6 : 1,
        }}
      >
        {loading ? (
          <ActivityIndicator color={"#fff"} />
        ) : (
          <Text
            style={{
              color: isCurrent ? colors.text : "#fff",
              fontWeight: "900",
            }}
          >
            {isCurrent
              ? i18n.t("subscriptions.currentPlan", { defaultValue: "Forfait actuel" })
              : plan.cta}
          </Text>
        )}
      </TouchableOpacity>
    </View>
  );
}



/* =========================================================
   Compare table (3 columns)
========================================================= */

function CompareHeader({ colors }) {
  return (
    <View
      style={{
        flexDirection: "row",
        paddingVertical: 10,
        paddingHorizontal: 10,
        backgroundColor: colors.card2,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        alignItems: "center",
      }}
    >
      <View style={{ flex: 1.6 }}>
        <Text style={{ color: colors.subtext, fontWeight: "800" }}>
          {i18n.t("subscriptions.compare.feature", { defaultValue: "Fonctionnalité" })}
        </Text>
      </View>

      <View style={{ flex: 1, alignItems: "center" }}>
        <Text style={{ color: colors.text, fontWeight: "900" }}>
          {i18n.t("subscriptions.plans.free.title", { defaultValue: "Gratuit" })}
        </Text>
      </View>

      <View style={{ flex: 1, alignItems: "center" }}>
        <Text style={{ color: colors.text, fontWeight: "900" }}>
          {i18n.t("subscriptions.plans.pro.title", { defaultValue: "Pro" })}
        </Text>
      </View>

      <View style={{ flex: 1, alignItems: "center" }}>
        <Text style={{ color: colors.text, fontWeight: "900" }}>
          {i18n.t("subscriptions.plans.vip.title", { defaultValue: "Vip" })}
        </Text>
      </View>
    </View>
  );
}

function CompareRow({ label, free, pro, vip, colors, idx }) {
  return (
    <View
      style={{
        flexDirection: "row",
        paddingVertical: 10,
        paddingHorizontal: 10,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        backgroundColor: idx % 2 ? colors.rowAlt : colors.card,
        alignItems: "center",
        gap: 10,
      }}
    >
      <View style={{ flex: 1.6 }}>
        <Text style={{ color: colors.text, fontWeight: "700" }}>{label}</Text>
      </View>

      <View style={{ flex: 1 }}>
        <ValueChip text={String(free)} colors={colors} tone="free" />
      </View>

      <View style={{ flex: 1 }}>
        <ValueChip text={String(pro)} colors={colors} tone="pro" />
      </View>

      <View style={{ flex: 1 }}>
        <ValueChip text={String(vip)} colors={colors} tone="vip" />
      </View>
    </View>
  );
}

function CompareTable({ rows, colors }) {
  return (
    <View
      style={{
        backgroundColor: colors.card,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 16,
        overflow: "hidden",
      }}
    >
      <CompareHeader colors={colors} />

      {rows.map((r, idx) => {
        const { key: _rowKey, ...rowProps } = r; // enlève "key" des props
        return (
          <CompareRow
            key={_rowKey || idx}   // key seulement ici
            {...rowProps}          // plus de key dans le spread
            idx={idx}
            colors={colors}
          />
        );
      })}
    </View>
  );
  }

  async function writeEntitlementTier(uid, tier) {
  if (!uid) throw new Error("Missing uid");

  // ✅ Modèle racine: entitlements/{uid}
  const ref = firestore().collection("entitlements").doc(String(uid));

  await ref.set(
    {
      tier: String(tier || "free").toLowerCase(),
      active: true,
      updatedAt: firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
}

/* =========================================================
   Screen
========================================================= */

export default function SubscriptionsScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const { tier, loading } = useEntitlement(user?.uid);

  const [pendingTier, setPendingTier] = useState(null);

  const currentTier = (tier || "free").toLowerCase();

  const { lang } = useLanguage();

  const isUpgrade = (from, to) => {
    const rank = { free: 0, pro: 1, vip: 2 };
    return (rank[to] ?? 0) > (rank[from] ?? 0);
  };

  const plans = useMemo(() => {
    return [
      {
        id: "free",
        title: i18n.t("subscriptions.plans.free.title", { defaultValue: "Gratuit" }),
        subtitle: i18n.t("subscriptions.plans.free.subtitle", {
          defaultValue: "Essentiel pour débuter",
        }),
        price: "0 $",
        priceNote: i18n.t("subscriptions.perMonth", { defaultValue: "/mois" }),
        badge: null,
        accent: colors.subtext,
        highlights: [
          i18n.t("subscriptions.highlights.free.1", {
            defaultValue: "1 groupe (owner et participant)",
          }),
          i18n.t("subscriptions.highlights.free.2", {
            defaultValue: "Formats 1x1 à 3x3",
          }),
          i18n.t("subscriptions.highlights.free.3", {
            defaultValue: "Participation limitée (semaine)",
          }),
        ],
        cta: i18n.t("subscriptions.chooseFree", { defaultValue: "Choisir Gratuit" }),
        ctaBg: colors.subtext,
      },
      {
        id: "pro",
        title: i18n.t("subscriptions.plans.pro.title", { defaultValue: "Pro" }),
        subtitle: i18n.t("subscriptions.plans.pro.subtitle", {
          defaultValue: "Pour suivre tes performances",
        }),
        price: "6,99 $",
        priceNote: i18n.t("subscriptions.perMonth", { defaultValue: "/mois" }),
        badge: i18n.t("subscriptions.badge.popular", { defaultValue: "Populaire" }),
        accent: "#f59e0b",
        highlights: [
          i18n.t("subscriptions.highlights.pro.1", {
            defaultValue: "Accès au classement (avancé)",
          }),
          i18n.t("subscriptions.highlights.pro.2", {
            defaultValue: "Formats 1x1 à 5x5",
          }),
          i18n.t("subscriptions.highlights.pro.3", {
            defaultValue: "Plus de groupes et limites/semaine",
          }),
        ],
        cta: i18n.t("subscriptions.upgradePro", { defaultValue: "Passer à Pro" }),
        ctaBg: isUpgrade(currentTier, "pro") ? colors.primary : colors.subtext,
      },
      {
        id: "vip",
        title: i18n.t("subscriptions.plans.vip.title", { defaultValue: "Vip" }),
        subtitle: i18n.t("subscriptions.plans.vip.subtitle", {
          defaultValue: "Le plein potentiel Prophetik",
        }),
        price: "12,99 $",
        priceNote: i18n.t("subscriptions.perMonth", { defaultValue: "/mois" }),
        badge: i18n.t("subscriptions.badge.best", { defaultValue: "Meilleur" }),
        accent: "#60a5fa",
        highlights: [
          i18n.t("subscriptions.highlights.vip.1", {
            defaultValue: "Formats 1x1 à 6x7",
          }),
          i18n.t("subscriptions.highlights.vip.2", {
            defaultValue: "Statistiques avancées + conseil IA",
          }),
          i18n.t("subscriptions.highlights.vip.3", {
            defaultValue: "Nova IA optionnelle (peut être retirée)",
          }),
        ],
        cta: i18n.t("subscriptions.upgradeVip", { defaultValue: "Passer à Vip" }),
        ctaBg: isUpgrade(currentTier, "vip") ? colors.primary : colors.subtext,
      },
    ];
  }, [colors, lang]);

  const compareRows = useMemo(() => {
    // ✅ Aligné sur le tableau du PDF
    return [
      {
        key: "ownerGroups",
        label: i18n.t("subscriptions.compare.ownerGroups", {
          defaultValue: "Groupes (Propriétaire)",
        }),
        free: "1",
        pro: "3",
        vip: "5",
      },
      {
        key: "memberGroups",
        label: i18n.t("subscriptions.compare.memberGroups", {
          defaultValue: "Groupes (Participant)",
        }),
        free: "1",
        pro: "5",
        vip: "10",
      },
      {
        key: "nova",
        label: i18n.t("subscriptions.compare.novaAi", {
          defaultValue: "Nova IA participante",
        }),
        free: i18n.t("subscriptions.compare.nova.required", {
          defaultValue: "Obligatoire",
        }),
        pro: i18n.t("subscriptions.compare.nova.required", {
          defaultValue: "Obligatoire",
        }),
        vip: i18n.t("subscriptions.compare.nova.optional", {
          defaultValue: "Optionnelle",
        }),
      },
      {
        key: "createPerWeek",
        label: i18n.t("subscriptions.compare.createPerWeek", {
          defaultValue: "Défis – Création / semaine",
        }),
        free: "2",
        pro: "7",
        vip: "35",
      },
      {
        key: "joinPerWeek",
        label: i18n.t("subscriptions.compare.joinPerWeek", {
          defaultValue: "Défis – Participation / semaine",
        }),
        free: "3",
        pro: "7",
        vip: "70",
      },
      {
        key: "formats",
        label: i18n.t("subscriptions.compare.formats", {
          defaultValue: "Formats disponibles",
        }),
        free: "1x1 → 3x3",
        pro: "1x1 → 5x5",
        vip: "1x1 → 6x7",
      },
      {
        key: "playerStats",
        label: i18n.t("subscriptions.compare.playerStats", {
          defaultValue: "Statistiques joueurs",
        }),
        free: i18n.t("subscriptions.compare.stats.basic", {
          defaultValue: "De base",
        }),
        pro: i18n.t("subscriptions.compare.stats.advanced", {
          defaultValue: "Avancées",
        }),
        vip: i18n.t("subscriptions.compare.stats.advancedAi", {
          defaultValue: "Avancées + IA",
        }),
      },
      {
        key: "leaderboard",
        label: i18n.t("subscriptions.compare.leaderboard", {
          defaultValue: "Classement",
        }),
        free: i18n.t("subscriptions.compare.lb.basic", {
          defaultValue: "De base",
        }),
        pro: i18n.t("subscriptions.compare.lb.advanced", {
          defaultValue: "Avancé",
        }),
        vip: i18n.t("subscriptions.compare.lb.advanced", {
          defaultValue: "Avancé",
        }),
      },
      {
        key: "price",
        label: i18n.t("subscriptions.compare.price", { defaultValue: "Prix" }),
        free: "0 $",
        pro: "6,99 $/mois",
        vip: "12,99 $/mois",
      },
    ];
  }, [lang]);

  const selectTier = useCallback(
    (target) => {
      if (!user?.uid) {
        Alert.alert("Connexion", "Connecte-toi pour gérer ton abonnement.");
        return;
      }

      const next = String(target || "").toLowerCase();
      if (!next) return;
      if (next === currentTier) return;

      // ✅ downgrade vers Gratuit (MVP): on écrit tout de suite dans Firestore
      if (next === "free") {
        Alert.alert(
          i18n.t("subscriptions.downgradeTitle", { defaultValue: "Passer à Gratuit ?" }),
          i18n.t("subscriptions.downgradeBody", {
            defaultValue:
              "Tu perdras l’accès aux fonctionnalités premium. Tu pourras revenir à Pro/Vip quand tu veux.",
          }),
          [
            { text: i18n.t("common.cancel", { defaultValue: "Annuler" }), style: "cancel" },
            {
              text: i18n.t("common.continue", { defaultValue: "Continuer" }),
              style: "destructive",
              onPress: async () => {
                try {
                  setPendingTier("free");
                  await writeEntitlementTier(user.uid, "free");
                } catch (e) {
                  Alert.alert(
                    i18n.t("common.unknownError", { defaultValue: "Erreur inconnue" }),
                    String(e?.message || e)
                  );
                } finally {
                  setPendingTier(null);
                }
              },
            },
          ]
        );
        return;
      }

      // Placeholder paiement (RevenueCat/Stripe) pour Pro/Vip
      setPendingTier(next);
      Alert.alert(
        "Abonnement",
        `Paiement à connecter pour activer "${next.toUpperCase()}".`,
        [{ text: "OK", onPress: () => setPendingTier(null) }]
      );
    },
    [user?.uid, user?.uid, currentTier]
  );

  if (!user) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.background,
          alignItems: "center",
          justifyContent: "center",
          padding: 16,
        }}
      >
        <Text style={{ color: colors.text, fontWeight: "800" }}>
          {i18n.t("subscriptions.loginToManage", {
            defaultValue: "Connecte-toi pour gérer ton abonnement.",
          })}
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 28 }}
    >


      {/* Current tier */}
      <View
        style={{
          backgroundColor: colors.card,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 14,
          padding: 12,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <MaterialCommunityIcons
            name="crown-outline"
            size={22}
            color={colors.text}
          />
          <View>
            <Text style={{ color: colors.subtext, fontWeight: "700", fontSize: 12 }}>
              {i18n.t("subscriptions.yourPlan", { defaultValue: "Ton forfait" })}
            </Text>
            <Text style={{ color: colors.text, fontWeight: "900", fontSize: 16 }}>
              {currentTier.toUpperCase()}
            </Text>
          </View>
        </View>
        {loading ? <ActivityIndicator color={colors.primary} /> : null}
      </View>

      {/* Plan cards */}
      {plans.map((p) => (
        <PlanCard
          key={p.id}
          plan={p}
          colors={colors}
          isCurrent={p.id === currentTier}
          loading={pendingTier === p.id}
          onSelect={() => selectTier(p.id)}
        />
      ))}

    </ScrollView>
  );
}