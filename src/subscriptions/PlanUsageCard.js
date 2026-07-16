import React from "react";
import { View, Text, ActivityIndicator } from "react-native";
import i18n from "@src/i18n/i18n";
import { planTierLabel } from "@src/subscriptions/planLimits";

function UsageRow({ label, value, colors }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
      <Text style={{ color: colors.subtext, fontWeight: "600", flex: 1 }}>{label}</Text>
      <Text style={{ color: colors.text, fontWeight: "900" }}>{value}</Text>
    </View>
  );
}

export default function PlanUsageCard({ planUsage, colors }) {
  if (!planUsage) return null;

  const { tier, limits, usage, loading } = planUsage;

  return (
    <View
      style={{
        backgroundColor: colors.card,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        gap: 10,
      }}
    >
      <Text style={{ color: colors.text, fontWeight: "900", fontSize: 18 }}>
        {i18n.t("subscriptions.myPlan.title", { defaultValue: "Mon forfait" })}
      </Text>

      {loading ? (
        <ActivityIndicator color={colors.primary} />
      ) : (
        <>
          <UsageRow
            label={i18n.t("subscriptions.myPlan.currentPlan", { defaultValue: "Plan actuel" })}
            value={planTierLabel(tier, i18n.t.bind(i18n))}
            colors={colors}
          />
          <UsageRow
            label={i18n.t("subscriptions.myPlan.ownedGroups", {
              defaultValue: "Groupes possédés",
            })}
            value={`${usage.ownedGroupsCount} / ${limits.ownedGroupsLimit}`}
            colors={colors}
          />
          <UsageRow
            label={i18n.t("subscriptions.myPlan.autopilotGroups", {
              defaultValue: "Groupes automatisés",
            })}
            value={`${usage.autopilotGroupsCount} / ${limits.autopilotGroupsLimit}`}
            colors={colors}
          />
          <UsageRow
            label={i18n.t("subscriptions.myPlan.novaAdvice", {
              defaultValue: "Nova Advice",
            })}
            value={`${usage.novaAdviceUsed} / ${limits.novaAdviceMonthlyLimit}`}
            colors={colors}
          />
          <Text style={{ color: colors.subtext, fontSize: 12, lineHeight: 18 }}>
            {i18n.t("subscriptions.myPlan.joinUnlimitedHint", {
              defaultValue:
                "Tu peux rejoindre autant de groupes que tu veux. Seuls les groupes que tu possèdes comptent dans ton forfait.",
            })}
          </Text>
        </>
      )}
    </View>
  );
}
