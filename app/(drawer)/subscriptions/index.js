  // app/(drawer)/subscriptions/index.js
  import React, { useMemo, useState, useCallback, useEffect } from "react";
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


  import firestore from "@react-native-firebase/firestore";

  import useEntitlement from "./useEntitlement";

  import ProphetikIcons from "@src/ui/ProphetikIcons";

  import Purchases from "react-native-purchases";

  import useAppConfig from "@src/hooks/useAppConfig";



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
    const ids = (o?.current?.availablePackages || [])
      .map((p) => p?.product?.identifier)
      .filter(Boolean);

    console.log(`[RC] offerings ${label}`, {
      currentOfferingId: o?.current?.identifier,
      availableProducts: ids,
    });
  } catch (e) {
    console.log("[RC] offerings debug error", String(e?.message || e));
  }
}

  // Option A (recommandée): prendre le package par productIdentifier

  async function findPackageById(packageId) {
    const offerings = await Purchases.getOfferings();
    const current = offerings?.current;
    const allPkgs = current?.availablePackages || [];

    const norm = (s) => String(s || "").trim().toLowerCase();
    const target = norm(packageId);

    console.log("[RC] offerings current", {
      currentOfferingId: current?.identifier,
      availablePackages: allPkgs.map((p) => ({
        pkg: p?.identifier,
        product: p?.product?.identifier,
      })),
    });

    if (!current) {
      throw new Error("Aucun offering 'current' dans RevenueCat. Vérifie l'API key (Test vs Live) et l'offering 'default'.");
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

  async function purchaseTierRc(tier) {
    const packageId = RC_PACKAGE_IDS[tier];
    if (!packageId) throw new Error(`Aucun packageId pour tier=${tier}`);

    await debugOfferingsOnce(`before purchase tier=${tier}`);

    const pkg = await findPackageById(packageId);
    const res = await Purchases.purchasePackage(pkg);

    try { await Purchases.syncPurchases(); } catch {}
    return res;
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

    return { effectiveTier, effectiveExpMs, nextTier, nextAtMs };
  }

  function formatMs(ms) {
    if (!ms) return null;
    return new Date(ms).toLocaleString();
  }

  // ======================================================
  // SubscriptionStatusBanner (complet)
  // ======================================================
  function SubscriptionStatusBanner({ colors, entitlement, billingLive, onManage }) {
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
      title = i18n.t("subscriptions.banner.vipActiveTitle", { defaultValue: "VIP actif" });
      icon = "crown-outline";

      // Downgrade planifié → message prioritaire
      if (ui.nextTier === "pro" && ui.nextAtMs) {
        const when = formatMs(ui.nextAtMs);
        const remaining = formatRemaining(ui.nextAtMs, now);

        body = i18n.t("subscriptions.banner.downgradeToProOn", {
          defaultValue: `Downgrade vers PRO le ${when}${remaining ? ` (dans ${remaining})` : ""}.`,
        });
      } else {
        // Sinon renouvellement / expiration VIP
        body = ui.effectiveExpMs
          ? i18n.t("subscriptions.banner.renewsOn", {
              defaultValue: `Prochain renouvellement : ${formatMs(ui.effectiveExpMs)}`,
            })
          : i18n.t("subscriptions.banner.activeNoDate", {
              defaultValue: "Renouvellement actif.",
            });
      }
    }

    // --- 4) PRO actif
    else if (ui.effectiveTier === "pro") {
      title = i18n.t("subscriptions.banner.proActiveTitle", { defaultValue: "PRO actif" });
      icon = "check-decagram-outline";

      body = ui.effectiveExpMs
        ? i18n.t("subscriptions.banner.renewsOn", {
            defaultValue: `Prochain renouvellement : ${formatMs(ui.effectiveExpMs)}`,
          })
        : i18n.t("subscriptions.banner.activeNoDate", {
            defaultValue: "Renouvellement actif.",
          });
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

    const { lang } = useLanguage();
    const { config } = useAppConfig();
    const billingLive = config?.billingLive === true;

    const isUpgrade = (from, to) => {
      const rank = { free: 0, pro: 1, vip: 2 };
      return (rank[to] ?? 0) > (rank[from] ?? 0);
    };

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
      
        // ✅ Achat via RevenueCat
        setPendingTier(next);

        (async () => {
          try {
             if (!rcReady) await waitForRcReady();

            await purchaseTierRc(next);

            Alert.alert(
              i18n.t("subscriptions.purchaseSuccessTitle", { defaultValue: "Abonnement activé" }),
              i18n.t("subscriptions.purchaseSuccessBody", {
                defaultValue: "Merci! Ton forfait sera mis à jour dans quelques secondes.",
              })
            );

            // 🔁 Laisse Firestore se mettre à jour via webhook + useEntitlement
          } catch (e) {
            if (isRcCancelled(e)) {
              // l'utilisateur a annulé → silencieux ou petit toast
              return;
            }
            Alert.alert(
              i18n.t("common.unknownError", { defaultValue: "Erreur" }),
              String(e?.message || e)
            );
          } finally {
            setPendingTier(null);
          }
        })();

      },
      [user?.uid, currentTier, billingLive, rcReady, waitForRcReady]
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

        <SubscriptionStatusBanner
          colors={colors}
          entitlement={ent}
          billingLive={billingLive}
          onManage={openManageSubscriptions}
        />


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