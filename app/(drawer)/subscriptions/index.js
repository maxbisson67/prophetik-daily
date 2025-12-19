// app/(drawer)/subscriptions/index.js
import React, { useMemo } from "react";
import { View, Text, ScrollView, TouchableOpacity, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@src/theme/ThemeProvider";
import i18n from "@src/i18n/i18n";

import { useAuth } from "@src/auth/SafeAuthProvider";
import { useEntitlement } from "./useEntitlement";
import { getFunctions, httpsCallable } from "firebase/functions";

function Pill({ text, tone = "neutral", colors }) {
  const t = {
    neutral: { bg: colors.card, bd: colors.border, tx: colors.text },
    warn: { bg: "#fffbeb", bd: "#f59e0b", tx: "#92400e" },
    success: { bg: "#dcfce7", bd: "#86efac", tx: "#14532d" },
    info: { bg: "#dbeafe", bd: "#93c5fd", tx: "#1e3a8a" },
  }[tone];

  return (
    <View
      style={{
        alignSelf: "flex-start",
        paddingVertical: 6,
        paddingHorizontal: 10,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: t.bd,
        backgroundColor: t.bg,
      }}
    >
      <Text style={{ color: t.tx, fontWeight: "900", fontSize: 12 }}>{text}</Text>
    </View>
  );
}

function FeatureRow({ ok, label, colors }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
      <Ionicons
        name={ok ? "checkmark-circle" : "close-circle"}
        size={18}
        color={ok ? "#16a34a" : colors.subtext}
      />
      <Text style={{ color: colors.text, fontWeight: "700", flex: 1 }}>{label}</Text>
    </View>
  );
}

function PlanCard({ plan, isCurrent, highlight, colors, onPress }) {
  const borderColor = highlight ? "#f59e0b" : colors.border;
  const bg = highlight ? "#fffbeb" : colors.card2;

  const ctaText = isCurrent
    ? i18n.t("subscriptions.cta.current", { defaultValue: "Current plan" })
    : i18n.t("subscriptions.cta.choose", { defaultValue: "Choose" });

  const ctaSub = isCurrent
    ? i18n.t("subscriptions.cta.currentHint", { defaultValue: "You are already on this plan." })
    : i18n.t("subscriptions.cta.chooseHint", { defaultValue: "Instant change." });

  return (
    <View
      style={{
        borderWidth: 2,
        borderColor,
        backgroundColor: bg,
        borderRadius: 16,
        overflow: "hidden",
      }}
    >
      <View style={{ padding: 14, gap: 8 }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
          }}
        >
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.text, fontWeight: "900", fontSize: 18 }}>
              {plan.title}
            </Text>
            {plan.tag ? (
              <View style={{ marginTop: 6 }}>
                <Pill text={plan.tag} tone={highlight ? "warn" : "neutral"} colors={colors} />
              </View>
            ) : null}
          </View>

          <Ionicons name={plan.icon} size={26} color={highlight ? "#92400e" : colors.text} />
        </View>

        <Text style={{ color: colors.subtext, fontWeight: "800" }}>{plan.priceLabel}</Text>

        <Text style={{ color: colors.text, fontWeight: "900", fontSize: 22 }}>
          {i18n.t("subscriptions.plan.creditsPerMonth", {
            credits: plan.credits,
            defaultValue: "{{credits}} credits / month",
          })}
        </Text>

        <Text style={{ color: colors.subtext, lineHeight: 20 }}>{plan.desc}</Text>

        <View style={{ marginTop: 8, gap: 8 }}>
          <FeatureRow
            ok={plan.autoCredit}
            colors={colors}
            label={
              plan.autoCredit
                ? i18n.t("subscriptions.features.autoYes", { defaultValue: "Automatic credits" })
                : i18n.t("subscriptions.features.autoNo", { defaultValue: "Manual credit claim" })
            }
          />
          <FeatureRow
            ok={plan.has67}
            colors={colors}
            label={i18n.t("subscriptions.features.has67", { defaultValue: "Access to special 6x7 challenge" })}
          />
        </View>
      </View>

      <View style={{ padding: 14, paddingTop: 0 }}>
        <TouchableOpacity
          onPress={onPress}
          disabled={isCurrent}
          style={{
            paddingVertical: 12,
            borderRadius: 14,
            alignItems: "center",
            backgroundColor: isCurrent ? colors.border : highlight ? "#b91c1c" : colors.primary,
            opacity: isCurrent ? 0.7 : 1,
          }}
        >
          <Text style={{ color: "#fff", fontWeight: "900", fontSize: 15 }}>
            {isCurrent ? ctaText : `${ctaText} ${plan.title}`}
          </Text>
        </TouchableOpacity>

        <Text style={{ marginTop: 8, color: colors.subtext, fontSize: 12, lineHeight: 16 }}>
          {ctaSub}
        </Text>
      </View>
    </View>
  );
}

function CompareTable({ plans, colors }) {
  const colStyle = { flex: 1, alignItems: "center", gap: 6 };

  const Cell = ({ children, strong }) => (
    <Text style={{ color: colors.text, fontWeight: strong ? "900" : "700", fontSize: 12, textAlign: "center" }}>
      {children}
    </Text>
  );

  const Mark = ({ ok }) => (
    <Ionicons name={ok ? "checkmark" : "close"} size={16} color={ok ? "#16a34a" : colors.subtext} />
  );

  return (
    <View
      style={{
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.card2,
        borderRadius: 16,
        overflow: "hidden",
      }}
    >
      <View style={{ padding: 14, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <Text style={{ color: colors.text, fontWeight: "900", fontSize: 16 }}>
          {i18n.t("subscriptions.compare.title", { defaultValue: "Quick comparison" })}
        </Text>
        <Text style={{ color: colors.subtext, marginTop: 6, lineHeight: 18 }}>
          {i18n.t("subscriptions.compare.subtitle", { defaultValue: "A simple overview of plan differences." })}
        </Text>
      </View>

      <View style={{ flexDirection: "row", padding: 12, gap: 10 }}>
        <View style={{ flex: 1.2 }}>
          <Cell strong>{i18n.t("subscriptions.compare.feature", { defaultValue: "Feature" })}</Cell>
        </View>
        {plans.map((p) => (
          <View key={p.key} style={colStyle}>
            <Cell strong>{p.short}</Cell>
          </View>
        ))}
      </View>

      {[
        {
          label: i18n.t("subscriptions.compare.credits", { defaultValue: "Credits / month" }),
          render: (p) => <Cell strong>{String(p.credits)}</Cell>,
        },
        {
          label: i18n.t("subscriptions.compare.auto", { defaultValue: "Automatic allocation" }),
          render: (p) => <Mark ok={p.autoCredit} />,
        },
        {
          label: i18n.t("subscriptions.compare.has67", { defaultValue: "6x7 challenge" }),
          render: (p) => <Mark ok={p.has67} />,
        },
      ].map((row, idx) => (
        <View
          key={idx}
          style={{
            flexDirection: "row",
            padding: 12,
            gap: 10,
            borderTopWidth: idx === 0 ? 1 : 0,
            borderTopColor: colors.border,
            backgroundColor: idx % 2 === 0 ? colors.card : "transparent",
          }}
        >
          <View style={{ flex: 1.2, justifyContent: "center" }}>
            <Text style={{ color: colors.subtext, fontWeight: "800", fontSize: 12 }}>{row.label}</Text>
          </View>
          {plans.map((p) => (
            <View key={p.key} style={colStyle}>
              {row.render(p)}
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

function formatDateTime(ts, timeZone) {
  if (!ts) return null;

  const d =
    typeof ts.toDate === "function"
      ? ts.toDate()
      : ts instanceof Date
      ? ts
      : null;

  if (!d) return null;

  const locale =
    (i18n?.locale || i18n?.language || "en").startsWith("fr")
      ? "fr-CA"
      : "en-CA";

  return new Intl.DateTimeFormat(locale, {
    timeZone: timeZone || undefined, // 👈 IMPORTANT
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export default function SubscriptionsScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();

  // ✅ IMPORTANT: langue utilisée comme dépendance pour re-render plans
  const langKey = i18n?.locale || i18n?.language || "en";

  const uid = user?.uid || null;
  const { entitlement, loading: entLoading } = useEntitlement(uid);

  const plans = useMemo(() => {
    const FREE = {
      key: "free",
      short: i18n.t("subscriptions.plan.free.short", { defaultValue: "Free" }),
      title: i18n.t("subscriptions.plan.free.title", { defaultValue: "Free" }),
      tag: i18n.t("subscriptions.plan.free.tag", { defaultValue: "Discovery" }),
      icon: "leaf-outline",
      priceLabel: i18n.t("subscriptions.plan.free.price", { defaultValue: "$0 / month" }),
      credits: 10,
      autoCredit: true,
      has67: false,
      desc: i18n.t("subscriptions.plan.free.desc", { defaultValue: "10 credits per month." }),
    };

    const BASE = {
      key: "base",
      short: i18n.t("subscriptions.plan.base.short", { defaultValue: "Base" }),
      title: i18n.t("subscriptions.plan.base.title", { defaultValue: "Base" }),
      tag: null,
      icon: "card-outline",
      priceLabel: i18n.t("subscriptions.plan.base.price", { defaultValue: "$4.99 CAD / month" }),
      credits: 30,
      autoCredit: true,
      has67: false,
      desc: i18n.t("subscriptions.plan.base.desc", { defaultValue: "Credits are added automatically every 30 days." }),
    };

    const POP = {
      key: "popular",
      short: i18n.t("subscriptions.plan.popular.short", { defaultValue: "Popular" }),
      title: i18n.t("subscriptions.plan.popular.title", { defaultValue: "Popular" }),
      tag: i18n.t("subscriptions.plan.popular.tag", { defaultValue: "Most popular" }),
      icon: "star-outline",
      priceLabel: i18n.t("subscriptions.plan.popular.price", { defaultValue: "$9.99 CAD / month" }),
      credits: 75,
      autoCredit: true,
      has67: true,
      desc: i18n.t("subscriptions.plan.popular.desc", { defaultValue: "Perfect for active groups." }),
    };

    const PRO = {
      key: "prophetik",
      short: i18n.t("subscriptions.plan.prophetik.short", { defaultValue: "Prophetik" }),
      title: i18n.t("subscriptions.plan.prophetik.title", { defaultValue: "Prophetik" }),
      tag: i18n.t("subscriptions.plan.prophetik.tag", { defaultValue: "Ultimate" }),
      icon: "diamond-outline",
      priceLabel: i18n.t("subscriptions.plan.prophetik.price", { defaultValue: "$14.99 CAD / month" }),
      credits: 225,
      autoCredit: true,
      has67: true,
      desc: i18n.t("subscriptions.plan.prophetik.desc", { defaultValue: "For power users: high credit volume." }),
    };

    return [FREE, BASE, POP, PRO];
  }, [langKey]); // ✅ re-calc quand la langue change

  const currentPlanKey = entitlement?.planKey || "free";
  const currentPlan = plans.find((p) => p.key === currentPlanKey) || null;

  const entitlementTz = entitlement?.timeZone || "America/Toronto";

  const nextGrantText = formatDateTime(
    entitlement?.nextGrantAt,
    entitlementTz
    );

  const monthlyCreditsForHint =
    Number(entitlement?.monthlyCredits) ||
    Number(currentPlan?.credits) ||
    0;

async function handleSelectPlan(planKey) {
  const plan = plans.find((p) => p.key === planKey);
  if (!plan) return;

  Alert.alert(
    i18n.t("subscriptions.alert.title", { defaultValue: "Confirm" }),
    i18n.t("subscriptions.alert.body", { plan: plan.title, defaultValue: `Choose the ${plan.title} plan?` }),
    [
      { text: i18n.t("common.cancel", { defaultValue: "Cancel" }), style: "cancel" },
      {
        text: i18n.t("common.confirm", { defaultValue: "Confirm" }),
        onPress: async () => {
          const fn = httpsCallable(getFunctions(), "setPlan");
          await fn({ planKey, triggerNow: true, reason: "user_ui" });
        },
      },
    ]
  );
}

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ padding: 16, paddingBottom: 28, gap: 12 }}
    >
      {/* Header */}
      <View style={{ gap: 6 }}>
        <Text style={{ color: colors.text, fontSize: 22, fontWeight: "900" }}>
          {i18n.t("subscriptions.title", { defaultValue: "Prophetik Subscriptions" })}
        </Text>
        <Text style={{ color: colors.subtext, lineHeight: 20 }}>
          {i18n.t("subscriptions.subtitle", { defaultValue: "Choose the plan that matches your level of play." })}
        </Text>
      </View>

      {/* Current plan summary */}
      <View
        style={{
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.card2,
          borderRadius: 16,
          padding: 14,
          gap: 10,
        }}
      >
        <Text style={{ color: colors.subtext, fontWeight: "800" }}>
          {i18n.t("subscriptions.current.label", { defaultValue: "Your current plan" })}
        </Text>

        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Text style={{ color: colors.text, fontWeight: "900", fontSize: 16 }}>
            {entLoading
              ? i18n.t("common.loading", { defaultValue: "Loading…" })
              : currentPlan?.title || i18n.t("subscriptions.current.unknown", { defaultValue: "—" })}
          </Text>

          <Pill
            text={i18n.t("subscriptions.current.pill", { defaultValue: "Active" })}
            tone="success"
            colors={colors}
          />
        </View>

        <Text style={{ color: colors.subtext, lineHeight: 18 }}>
          {i18n.t("subscriptions.current.hint", { defaultValue: "You can change your plan at any time." })}
        </Text>

        {/* ✅ Next grant */}
        <View style={{ marginTop: 4, gap: 6 }}>
          <Text style={{ color: colors.subtext, fontWeight: "900", fontSize: 12 }}>
            {i18n.t("subscriptions.current.nextGrantLabel", { defaultValue: "Next credit grant" })}
          </Text>

          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <Text style={{ color: colors.text, fontWeight: "900" }}>
              {nextGrantText || "—"}
            </Text>

            {monthlyCreditsForHint > 0 ? (
              <Pill
                tone="info"
                colors={colors}
                text={i18n.t("subscriptions.current.nextGrantHint", {
                  monthlyCredits: monthlyCreditsForHint,
                  defaultValue: `+${monthlyCreditsForHint} credits on next grant`,
                })}
              />
            ) : null}
          </View>
        </View>
      </View>

      {/* Plans */}
      {plans.map((p) => (
        <PlanCard
          key={p.key}
          plan={p}
          colors={colors}
          isCurrent={p.key === currentPlanKey}
          highlight={p.key === "popular"}
          onPress={() => handleSelectPlan(p.key)}
        />
      ))}

      {/* Compare */}
      <CompareTable plans={plans} colors={colors} />

      {/* Reassurance */}
      <View
        style={{
          padding: 14,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.card2,
          gap: 8,
        }}
      >
        <FeatureRow
          ok
          colors={colors}
          label={i18n.t("subscriptions.reassure.cancelAnytime", { defaultValue: "Cancel anytime." })}
        />
        <FeatureRow
          ok
          colors={colors}
          label={i18n.t("subscriptions.reassure.secure", { defaultValue: "Secure payment via App Store / Google Play." })}
        />
        <Text style={{ color: colors.subtext, fontSize: 12, lineHeight: 18 }}>
          {i18n.t("subscriptions.reassure.note", {
            defaultValue: "Prices may vary by platform. Credits and benefits may evolve with Prophetik.",
          })}
        </Text>
      </View>
    </ScrollView>
  );
}