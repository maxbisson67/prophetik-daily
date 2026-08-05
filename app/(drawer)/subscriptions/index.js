  // app/(drawer)/subscriptions/index.js
  import React, { useMemo, useState, useCallback, useRef } from "react";
  import {
    View,
    Text,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
    ScrollView,
    Linking
  } from "react-native";
  import { MaterialCommunityIcons } from "@expo/vector-icons";
  import { useTheme } from "@src/theme/ThemeProvider";
  import { useAuth } from "@src/auth/SafeAuthProvider";
  import i18n from "@src/i18n/i18n";
  import { useLanguage } from "@src/i18n/LanguageProvider";
  import { NOVA_COACH_MONTHLY_LIMITS } from "@src/nova/novaQuotaLimits";
  import { PLAN_LIMITS } from "@src/subscriptions/planLimits";
  import PlanUsageCard from "@src/subscriptions/PlanUsageCard";
  import usePlanUsage from "@src/subscriptions/usePlanUsage";


  import firestore from "@react-native-firebase/firestore";

  import useEntitlement from "./useEntitlement";

  import ProphetikIcons from "@src/ui/ProphetikIcons";

  import Purchases from "react-native-purchases";

  import useAppConfig from "@src/hooks/useAppConfig";
  import { syncSubscriptionEntitlement } from "@src/subscriptions/syncSubscriptionService";
  import { privacyUrlForLang, termsUrlForLang } from "@src/constants/legalUrls";



  function SubscriptionLegalFooter({ colors, privacyUrl, termsUrl }) {
    const open = (url) => {
      Linking.openURL(url).catch(() => {});
    };

    return (
      <View
        style={{
          marginTop: 8,
          padding: 12,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.card,
          gap: 8,
        }}
      >
        <Text style={{ color: colors.text, fontWeight: "800" }}>
          {i18n.t("subscriptions.legal.title", { defaultValue: "Informations légales" })}
        </Text>
        <Text style={{ color: colors.subtext, fontSize: 12, lineHeight: 18 }}>
          {i18n.t("subscriptions.legal.autoRenew", {
            defaultValue:
              "Les abonnements Pro et Vip se renouvellent automatiquement chaque mois jusqu'à annulation dans les réglages de ton compte App Store ou Google Play.",
          })}
        </Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
          <TouchableOpacity onPress={() => open(termsUrl)}>
            <Text style={{ color: colors.primary, fontWeight: "700", fontSize: 12, textDecorationLine: "underline" }}>
              {i18n.t("settings.legal.terms", { defaultValue: "Conditions d'utilisation" })}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => open(privacyUrl)}>
            <Text style={{ color: colors.primary, fontWeight: "700", fontSize: 12, textDecorationLine: "underline" }}>
              {i18n.t("settings.legal.privacy", { defaultValue: "Politique de confidentialité" })}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Revenue Cat

  function isRcCancelled(e) {
    // RevenueCat expose souvent userCancelled
    return !!(e?.userCancelled || e?.code === "1" || String(e?.message || "").toLowerCase().includes("cancel"));
  }

  // Map ton plan -> productId RevenueCat (exactement comme dans RC)
  // ⚠️ Mets les vrais product_id ici
  const RC_PACKAGE_IDS = {
    pro: "pro",
    vip: "vip",
  };

  async function debugOfferingsOnce(label = "") {
  try {
    const o = await Purchases.getOfferings();
    const current = resolveRcOffering(o);
    const ids = (current?.availablePackages || [])
      .map((p) => p?.product?.identifier)
      .filter(Boolean);

    console.log(`[RC] offerings ${label}`, {
      currentOfferingId: current?.identifier,
      rcCurrentFlag: o?.current?.identifier || null,
      availableProducts: ids,
    });
  } catch (e) {
    console.log("[RC] offerings debug error", String(e?.message || e));
  }
}

  function resolveRcOffering(offerings) {
    if (offerings?.current) return offerings.current;
    const all = offerings?.all || {};
    if (all.default) return all.default;
    const keys = Object.keys(all);
    if (keys.length === 1) return all[keys[0]];
    return null;
  }

  // Option A (recommandée): prendre le package par productIdentifier

  async function findPackageById(packageId) {
    const offerings = await Purchases.getOfferings();
    const current = resolveRcOffering(offerings);
    const allPkgs = current?.availablePackages || [];
    const offeringKeys = Object.keys(offerings?.all || {});

    const norm = (s) => String(s || "").trim().toLowerCase();
    const target = norm(packageId);

    console.log("[RC] offerings current", {
      currentOfferingId: current?.identifier,
      rcCurrentFlag: offerings?.current?.identifier || null,
      allOfferingIds: offeringKeys,
      availablePackages: allPkgs.map((p) => ({
        pkg: p?.identifier,
        product: p?.product?.identifier,
      })),
    });

    if (!current) {
      throw new Error(
        offeringKeys.length
          ? `Aucun offering 'current' dans RevenueCat. Offerings trouvés: ${offeringKeys.join(", ")}. Marque 'default' comme Current dans le dashboard RC.`
          : "Aucun offering dans RevenueCat. Vérifie l'API key (Test vs Live) et le projet Prophetik."
      );
    }

    const pkg = allPkgs.find((p) => norm(p?.identifier) === target);

    if (!pkg) {
      const available = allPkgs.map((p) => p?.identifier).filter(Boolean);
      throw new Error(`Package introuvable (${packageId}). Dispo: ${available.join(", ")}`);
    }

    return pkg;
  }


  // "dans 3 j 4 h" (simple, lisible)
  function formatRemaining(ms, now = Date.now()) {
    if (!ms || ms <= now) return null;

    let diff = Math.floor((ms - now) / 1000); // seconds
    const days = Math.floor(diff / 86400);
    diff -= days * 86400;
    const hours = Math.floor(diff / 3600);
    diff -= hours * 3600;
    const mins = Math.floor(diff / 60);

    const parts = [];
    if (days > 0) parts.push(`${days} j`);
    if (hours > 0) parts.push(`${hours} h`);
    if (days === 0 && mins > 0) parts.push(`${mins} min`); // montre minutes surtout si < 1 jour

    return parts.length ? parts.join(" ") : "moins d'une minute";
  }

  function msFromTimestampOrMs(v) {
    if (!v) return null;
    if (typeof v === "number") return Number.isFinite(v) ? v : null;
    if (v?.toDate) return v.toDate().getTime(); // Firestore Timestamp
    const d = new Date(v);
    const n = d.getTime();
    return Number.isFinite(n) ? n : null;
  }

  function hasActiveRcEntitlement(customerInfo) {
    const active = customerInfo?.entitlements?.active || {};
    return !!(active.pro?.isActive || active.vip?.isActive);
  }

  async function purchaseTierRc(tier) {
    const packageId = RC_PACKAGE_IDS[tier];
    if (!packageId) throw new Error(`Aucun packageId pour tier=${tier}`);

    await debugOfferingsOnce(`before purchase tier=${tier}`);

    const pkg = await findPackageById(packageId);
    // Ne pas appeler syncPurchases() après : sur iOS ça rouvre la feuille Apple.
    return Purchases.purchasePackage(pkg);
  }

  async function restorePurchasesRc() {
    return Purchases.restorePurchases();
  }

  async function openManageSubscriptions() {
    // ✅ 1) RevenueCat helper (ouvre Store manage subscriptions quand dispo)
    try {
      await Purchases.showManageSubscriptions();
      return;
    } catch {}

    // ✅ 2) fallback Web (Google Play)
    const pkg = "com.prophetik";
    const url = `https://play.google.com/store/account/subscriptions?package=${pkg}`;
    await Linking.openURL(url);
  }


  function computeUiStatus(ent) {
    const now = Date.now();

    const vipExpMs = msFromTimestampOrMs(ent?.tiers?.vip?.expiresAtMs) ?? null;
    const proExpMs = msFromTimestampOrMs(ent?.tiers?.pro?.expiresAtMs) ?? null;

    // fallback si tiers absent: utilise expiresAt + tier
    const topTierExpMs =
      vipExpMs ?? proExpMs ?? msFromTimestampOrMs(ent?.expiresAt) ?? null;

    const vipHas = (vipExpMs != null && vipExpMs > now) || (ent?.tier === "vip" && topTierExpMs > now);
    const proHas = (proExpMs != null && proExpMs > now) || (ent?.tier === "pro" && topTierExpMs > now);

    const effectiveTier = vipHas ? "vip" : proHas ? "pro" : "free";
    const effectiveExpMs = vipHas ? (vipExpMs ?? topTierExpMs) : proHas ? (proExpMs ?? topTierExpMs) : null;

    const nextTier = vipHas && proHas ? "pro" : null;
    const nextAtMs = vipHas && proHas ? (vipExpMs ?? null) : null;

    const cancelledTier =
      effectiveTier === "vip" || effectiveTier === "pro" ? effectiveTier : null;
    const cancelledEvent = cancelledTier
      ? String(ent?.tiers?.[cancelledTier]?.lastEventType || ent?.lastEventType || "").toUpperCase()
      : "";
    const cancelledButActive =
      cancelledEvent === "CANCELLATION" &&
      effectiveTier !== "free" &&
      effectiveExpMs != null &&
      effectiveExpMs > now;

    return {
      effectiveTier,
      effectiveExpMs,
      nextTier,
      nextAtMs,
      cancelledButActive,
    };
  }

  function formatMs(ms) {
    if (!ms) return null;
    return new Date(ms).toLocaleString();
  }

  // ======================================================
  // SubscriptionStatusBanner (complet)
  // ======================================================
  function SubscriptionStatusBanner({ colors, entitlement, billingLive, onManage }) {
    const { lang } = useLanguage();
    const ui = computeUiStatus(entitlement);
    const now = Date.now();

    const showManage = billingLive === true;

    let title = "";
    let body = "";
    let icon = "information-outline";

    // --- 1) Mode test
    if (!billingLive) {
      title = i18n.t("subscriptions.banner.betaTitle", {
        defaultValue: "Mode test (billing désactivé)",
      });
      body = i18n.t("subscriptions.banner.betaBody", {
        defaultValue: "Les forfaits peuvent être modifiés sans facturation.",
      });
      icon = "flask-outline";
    }

    // --- 2) Gratuit
    else if (ui.effectiveTier === "free") {
      title = i18n.t("subscriptions.banner.freeTitle", { defaultValue: "Forfait Gratuit" });
      body = i18n.t("subscriptions.banner.freeBody", { defaultValue: "Aucun abonnement actif." });
      icon = "information-outline";
    }

    // --- 3) VIP actif (avec ou sans downgrade)
    else if (ui.effectiveTier === "vip") {
      title = ui.cancelledButActive
        ? i18n.t("subscriptions.banner.vipCancelledTitle", {
            defaultValue: "VIP actif (non renouvelé)",
          })
        : i18n.t("subscriptions.banner.vipActiveTitle", { defaultValue: "VIP actif" });
      icon = "crown-outline";

      if (ui.cancelledButActive && ui.effectiveExpMs) {
        const when = formatMs(ui.effectiveExpMs);
        const remaining = formatRemaining(ui.effectiveExpMs, now);
        body = i18n.t("subscriptions.banner.cancelledAccessUntil", {
          date: when,
          remaining: remaining
            ? i18n.t("subscriptions.banner.remainingIn", {
                time: remaining,
                defaultValue: ` (dans ${remaining})`,
              })
            : "",
          defaultValue: `Abonnement annulé. Tu gardes l'accès VIP jusqu'au ${when}${remaining ? ` (dans ${remaining})` : ""}, puis retour au forfait Gratuit.`,
        });
      }
      // Downgrade planifié → message prioritaire
      else if (ui.nextTier === "pro" && ui.nextAtMs) {
        const when = formatMs(ui.nextAtMs);
        const remaining = formatRemaining(ui.nextAtMs, now);

        body = i18n.t("subscriptions.banner.downgradeToProOn", {
          date: when,
          remaining: remaining
            ? i18n.t("subscriptions.banner.remainingIn", {
                time: remaining,
                defaultValue: ` (dans ${remaining})`,
              })
            : "",
          defaultValue: `Passage à PRO le ${when}${remaining ? ` (dans ${remaining})` : ""}.`,
        });
      } else {
        // Sinon renouvellement / expiration VIP
        body = ui.effectiveExpMs
          ? i18n.t("subscriptions.banner.renewsOn", {
              date: formatMs(ui.effectiveExpMs),
              defaultValue: `Prochain renouvellement : ${formatMs(ui.effectiveExpMs)}`,
            })
          : i18n.t("subscriptions.banner.activeNoDate", {
              defaultValue: "Renouvellement actif.",
            });
      }
    }

    // --- 4) PRO actif
    else if (ui.effectiveTier === "pro") {
      title = ui.cancelledButActive
        ? i18n.t("subscriptions.banner.proCancelledTitle", {
            defaultValue: "PRO actif (non renouvelé)",
          })
        : i18n.t("subscriptions.banner.proActiveTitle", { defaultValue: "PRO actif" });
      icon = "check-decagram-outline";

      if (ui.cancelledButActive && ui.effectiveExpMs) {
        const when = formatMs(ui.effectiveExpMs);
        const remaining = formatRemaining(ui.effectiveExpMs, now);
        body = i18n.t("subscriptions.banner.cancelledAccessUntil", {
          date: when,
          remaining: remaining
            ? i18n.t("subscriptions.banner.remainingIn", {
                time: remaining,
                defaultValue: ` (dans ${remaining})`,
              })
            : "",
          defaultValue: `Abonnement annulé. Tu gardes l'accès PRO jusqu'au ${when}${remaining ? ` (dans ${remaining})` : ""}, puis retour au forfait Gratuit.`,
        });
      } else {
        body = ui.effectiveExpMs
          ? i18n.t("subscriptions.banner.renewsOn", {
              date: formatMs(ui.effectiveExpMs),
              defaultValue: `Prochain renouvellement : ${formatMs(ui.effectiveExpMs)}`,
            })
          : i18n.t("subscriptions.banner.activeNoDate", {
              defaultValue: "Renouvellement actif.",
            });
      }
    }

    // --- 5) Fallback
    else {
      title = i18n.t("subscriptions.banner.unknownTitle", { defaultValue: "Statut abonnement" });
      body = i18n.t("subscriptions.banner.unknownBody", {
        defaultValue: "Impossible de déterminer le statut pour le moment.",
      });
      icon = "alert-circle-outline";
    }

    return (
      <View
        key={`banner-${lang}`}
        style={{
          backgroundColor: colors.card,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 14,
          padding: 12,
          flexDirection: "row",
          gap: 10,
          alignItems: "flex-start",
        }}
      >
        <MaterialCommunityIcons name={icon} size={22} color={colors.text} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.text, fontWeight: "900" }}>{title}</Text>
          <Text style={{ color: colors.subtext, marginTop: 2 }}>{body}</Text>

          {showManage ? (
            <ManageSubscriptionButton colors={colors} onPress={onManage} />
          ) : null}
        </View>
      </View>
    );
  }

  function ManageSubscriptionButton({ colors, onPress }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.9}
      style={{
        marginTop: 10,
        alignSelf: "flex-start",
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.card2,
      }}
    >
      <MaterialCommunityIcons name="open-in-new" size={18} color={colors.text} />
      <Text style={{ color: colors.text, fontWeight: "900" }}>
        {i18n.t("subscriptions.manageBtn", { defaultValue: "Gérer mon abonnement" })}
      </Text>
    </TouchableOpacity>
  );
}
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

  function PlanCard({ plan, isCurrent, onSelect, loading, disabled, colors }) {
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
          disabled={loading || disabled || isCurrent}
          onPress={onSelect}
          activeOpacity={0.9}
          style={{
            marginTop: 14,
            backgroundColor: isCurrent ? colors.card2 : plan.ctaBg || colors.primary,
            paddingVertical: 12,
            borderRadius: 12,
            alignItems: "center",
            opacity: loading || disabled ? 0.6 : 1,
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

      const ref = firestore().collection("entitlements").doc(String(uid));
      const nextTier = String(tier || "free").toLowerCase();
      const nextActive = nextTier !== "free";
      const payload = {
        tier: nextTier,
        active: nextActive,
        updatedAt: firestore.FieldValue.serverTimestamp(),
      };

      try {
        await ref.update(payload);         // ✅ si le doc existe
      } catch (e) {
        // ✅ si le doc n'existe pas encore
        if (String(e?.code) === "not-found" || String(e?.message || "").includes("No document")) {
          await ref.set(payload, { merge: true });
          return;
        }
        throw e; // autre erreur: on remonte (permissions, etc.)
      }
    }

  /* =========================================================
    Screen
  ========================================================= */

  export default function SubscriptionsScreen() {
    const { colors } = useTheme();
    const { user, rcReady, waitForRcReady } = useAuth();

    const { tier, active, expiresAt, tiers, source, lastEventType, loading } =
      useEntitlement(user?.uid);

    const ent = { tier, active, expiresAt, tiers, source, lastEventType };
    const ui = computeUiStatus(ent);
    const currentTier = ui.effectiveTier;

    const [pendingTier, setPendingTier] = useState(null);
    const [restoring, setRestoring] = useState(false);
    const purchaseInFlightRef = useRef(false);

    const { lang } = useLanguage();
    const privacyUrl = privacyUrlForLang(lang);
    const termsUrl = termsUrlForLang(lang);
    const { config } = useAppConfig();
    const billingLive = config?.billingLive === true;

    const isUpgrade = (from, to) => {
      const rank = { free: 0, pro: 1, vip: 2 };
      return (rank[to] ?? 0) > (rank[from] ?? 0);
    };

    const applyPostPurchaseSync = useCallback(async (customerInfo) => {
      try {
        const result = await syncSubscriptionEntitlement(customerInfo);
        return result;
      } catch (e) {
        console.log("[RC] syncSubscriptionEntitlement error:", e?.message || e);
        return null;
      }
    }, []);

    const handleRestorePurchases = useCallback(async () => {
      if (!user?.uid || restoring) return;

      setRestoring(true);
      try {
        if (!rcReady) await waitForRcReady();
        const info = await restorePurchasesRc();
        const sync = await applyPostPurchaseSync(info);

        Alert.alert(
          i18n.t("subscriptions.restoreTitle", { defaultValue: "Achats restaurés" }),
          sync?.tier && sync.tier !== "free"
            ? i18n.t("subscriptions.restoreSuccessBody", {
                tier: sync.tier.toUpperCase(),
                defaultValue: "Ton forfait {{tier}} est actif.",
              })
            : i18n.t("subscriptions.restoreEmptyBody", {
                defaultValue: "Aucun abonnement actif trouvé pour ce compte.",
              })
        );
      } catch (e) {
        if (isRcCancelled(e)) return;
        Alert.alert(
          i18n.t("common.unknownError", { defaultValue: "Erreur" }),
          String(e?.message || e)
        );
      } finally {
        setRestoring(false);
      }
    }, [user?.uid, restoring, rcReady, waitForRcReady, applyPostPurchaseSync]);

    const now = Date.now();
    const expMs = expiresAt?.toDate
      ? expiresAt.toDate().getTime()
      : (expiresAt ? new Date(expiresAt).getTime() : null);


    const plans = useMemo(() => {
      return [
        {
          id: "free",
          title: i18n.t("subscriptions.plans.free.title", { defaultValue: "Gratuit" }),
          subtitle: i18n.t("subscriptions.plans.free.subtitle", {
            defaultValue: "Un groupe d'essai",
          }),
          price: "0 $",
          priceNote: "",
          badge: null,
          accent: colors.subtext,
          highlights: [
            i18n.t("subscriptions.highlights.free.activeGroups", {
              count: PLAN_LIMITS.free.activeGroupsLimit,
              defaultValue: "{{count}} groupe actif · création illimitée",
            }),
            i18n.t("subscriptions.highlights.autopilotGroups", {
              count: PLAN_LIMITS.free.autopilotGroupsLimit,
              defaultValue: "{{count}} groupe en défis automatiques",
            }),
            i18n.t("subscriptions.highlights.novaCoach", {
              count: NOVA_COACH_MONTHLY_LIMITS.free,
              defaultValue: "{{count}} conseils Nova Coach / mois",
            }),
          ],
          cta: i18n.t("subscriptions.chooseFree", { defaultValue: "Choisir Gratuit" }),
          ctaBg: colors.subtext,
        },
        {
          id: "pro",
          title: i18n.t("subscriptions.plans.pro.title", { defaultValue: "Pro" }),
          subtitle: i18n.t("subscriptions.plans.pro.subtitle", {
            defaultValue: "Jouer entre parents et amis",
          }),
          price: "5,99 $",
          priceNote: i18n.t("subscriptions.perMonth", { defaultValue: " / mois" }),
          badge: i18n.t("subscriptions.badge.popular", { defaultValue: "Populaire" }),
          accent: "#f59e0b",
          highlights: [
            i18n.t("subscriptions.highlights.pro.activeGroups", {
              count: PLAN_LIMITS.pro.activeGroupsLimit,
              defaultValue: "{{count}} groupes actifs · création illimitée",
            }),
            i18n.t("subscriptions.highlights.autopilotGroups", {
              count: PLAN_LIMITS.pro.autopilotGroupsLimit,
              defaultValue: "{{count}} groupes en défis automatiques",
            }),
            i18n.t("subscriptions.highlights.novaCoach", {
              count: NOVA_COACH_MONTHLY_LIMITS.pro,
              defaultValue: "{{count}} conseils Nova Coach / mois",
            }),
          ],
          cta: i18n.t("subscriptions.upgradePro", { defaultValue: "Passer à Pro" }),
          ctaBg: isUpgrade(currentTier, "pro") ? colors.primary : colors.subtext,
        },
        {
          id: "vip",
          title: i18n.t("subscriptions.plans.vip.title", { defaultValue: "Vip" }),
          subtitle: i18n.t("subscriptions.plans.vip.subtitle", {
            defaultValue: "Un vrai ambassadeur de Prophetik!",
          }),
          price: "10,99 $",
          priceNote: i18n.t("subscriptions.perMonth", { defaultValue: " / mois" }),
          badge: i18n.t("subscriptions.badge.best", { defaultValue: "Meilleur" }),
          accent: "#60a5fa",
          highlights: [
            i18n.t("subscriptions.highlights.vip.activeGroups", {
              count: PLAN_LIMITS.vip.activeGroupsLimit,
              defaultValue: "{{count}} groupes actifs · création illimitée",
            }),
            i18n.t("subscriptions.highlights.autopilotGroups", {
              count: PLAN_LIMITS.vip.autopilotGroupsLimit,
              defaultValue: "{{count}} groupes en défis automatiques",
            }),
            i18n.t("subscriptions.highlights.novaCoach", {
              count: NOVA_COACH_MONTHLY_LIMITS.vip,
              defaultValue: "{{count}} conseils Nova Coach / mois",
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
          key: "activeGroups",
          label: i18n.t("subscriptions.compare.activeGroups", {
            defaultValue: "Groupes actifs (jeu)",
          }),
          free: String(PLAN_LIMITS.free.activeGroupsLimit),
          pro: String(PLAN_LIMITS.pro.activeGroupsLimit),
          vip: String(PLAN_LIMITS.vip.activeGroupsLimit),
        },
        {
          key: "createGroups",
          label: i18n.t("subscriptions.compare.createGroups", {
            defaultValue: "Création de groupes",
          }),
          free: i18n.t("subscriptions.compare.unlimited", { defaultValue: "Illimité" }),
          pro: i18n.t("subscriptions.compare.unlimited", { defaultValue: "Illimité" }),
          vip: i18n.t("subscriptions.compare.unlimited", { defaultValue: "Illimité" }),
        },
        {
          key: "autopilotGroups",
          label: i18n.t("subscriptions.compare.autopilotGroups", {
            defaultValue: "Groupes en défis automatiques",
          }),
          free: String(PLAN_LIMITS.free.autopilotGroupsLimit),
          pro: String(PLAN_LIMITS.pro.autopilotGroupsLimit),
          vip: String(PLAN_LIMITS.vip.autopilotGroupsLimit),
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
          key: "novaCoach",
          label: i18n.t("subscriptions.compare.novaCoachLimit", {
            defaultValue: "Conseils Nova Coach / mois",
          }),
          free: i18n.t("subscriptions.compare.novaCoachLimitValue", {
            count: NOVA_COACH_MONTHLY_LIMITS.free,
            defaultValue: "{{count}} / mois",
          }),
          pro: i18n.t("subscriptions.compare.novaCoachLimitValue", {
            count: NOVA_COACH_MONTHLY_LIMITS.pro,
            defaultValue: "{{count}} / mois",
          }),
          vip: i18n.t("subscriptions.compare.novaCoachLimitValue", {
            count: NOVA_COACH_MONTHLY_LIMITS.vip,
            defaultValue: "{{count}} / mois",
          }),
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
          pro: "5,99 $ / mois",
          vip: "10,99 $ / mois",
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
          // ✅ BETA: on peut encore écrire le tier manuellement
          if (!billingLive) {
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
                        i18n.t("common.unknownError", { defaultValue: "Erreur" }),
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

          // ✅ PROD: on redirige vers le store (pas d’écriture Firestore)
          Alert.alert(
            i18n.t("subscriptions.manageTitle", { defaultValue: "Gérer ton abonnement" }),
            i18n.t("subscriptions.manageBody", {
              defaultValue:
                "Pour revenir au forfait Gratuit, tu dois annuler ton abonnement dans le Store. Prophetik se mettra à jour automatiquement après.",
            }),
            [
              { text: i18n.t("common.cancel", { defaultValue: "Annuler" }), style: "cancel" },
              {
                text: i18n.t("subscriptions.openStore", { defaultValue: "Ouvrir le Store" }),
                onPress: () => openManageSubscriptions(),
              },
            ]
          );
          return;
        }
      
        // ✅ BETA: écriture directe Firestore (sans Apple/RC)
        if (!billingLive && next !== "free") {
          Alert.alert(
            i18n.t("subscriptions.upgradeTitle", { defaultValue: "Changer de forfait ?" }),
            i18n.t("subscriptions.upgradeBetaBody", {
              defaultValue: "Mode test : le forfait sera activé sans facturation.",
            }),
            [
              { text: i18n.t("common.cancel", { defaultValue: "Annuler" }), style: "cancel" },
              {
                text: i18n.t("common.continue", { defaultValue: "Continuer" }),
                onPress: async () => {
                  try {
                    setPendingTier(next);
                    await writeEntitlementTier(user.uid, next);
                  } catch (e) {
                    Alert.alert(
                      i18n.t("common.unknownError", { defaultValue: "Erreur" }),
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

        // ✅ Achat via RevenueCat (garde anti double-tap / double flux)
        if (purchaseInFlightRef.current || pendingTier) return;

        purchaseInFlightRef.current = true;
        setPendingTier(next);

        (async () => {
          try {
            if (!rcReady) await waitForRcReady();

            const purchaseResult = await purchaseTierRc(next);
            const customerInfo = purchaseResult?.customerInfo || null;

            let sync = await applyPostPurchaseSync(customerInfo);

            if (!sync?.applied && !hasActiveRcEntitlement(customerInfo)) {
              await new Promise((r) => setTimeout(r, 1500));
              try {
                const retryInfo = await Purchases.getCustomerInfo();
                sync = await applyPostPurchaseSync(retryInfo);
              } catch {}
            }

            if (sync?.applied || hasActiveRcEntitlement(customerInfo)) {
              Alert.alert(
                i18n.t("subscriptions.purchaseSuccessTitle", { defaultValue: "Abonnement activé" }),
                i18n.t("subscriptions.purchaseSuccessBody", {
                  defaultValue: "Merci! Ton forfait a été mis à jour.",
                })
              );
            }
          } catch (e) {
            if (isRcCancelled(e)) {
              return;
            }
            Alert.alert(
              i18n.t("common.unknownError", { defaultValue: "Erreur" }),
              String(e?.message || e)
            );
          } finally {
            purchaseInFlightRef.current = false;
            setPendingTier(null);
          }
        })();

      },
      [user?.uid, currentTier, billingLive, pendingTier, rcReady, waitForRcReady, applyPostPurchaseSync]
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

    const planUsage = usePlanUsage(user?.uid);

    return (
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 28 }}
      >

        <SubscriptionStatusBanner
          colors={colors}
          entitlement={ent}
          billingLive={billingLive}
          onManage={openManageSubscriptions}
        />

        <PlanUsageCard planUsage={planUsage} colors={colors} />


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
            disabled={!!pendingTier}
            onSelect={() => selectTier(p.id)}
          />
        ))}

        {billingLive ? (
          <TouchableOpacity
            onPress={handleRestorePurchases}
            disabled={restoring || !!pendingTier}
            activeOpacity={0.9}
            style={{
              alignItems: "center",
              paddingVertical: 12,
              opacity: restoring || pendingTier ? 0.6 : 1,
            }}
          >
            {restoring ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <Text style={{ color: colors.primary, fontWeight: "800" }}>
                {i18n.t("subscriptions.restorePurchases", {
                  defaultValue: "Restaurer mes achats",
                })}
              </Text>
            )}
          </TouchableOpacity>
        ) : null}

        <SubscriptionLegalFooter colors={colors} privacyUrl={privacyUrl} termsUrl={termsUrl} />

      </ScrollView>
    );
  }