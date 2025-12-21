import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Pressable,
  Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { app } from "@src/lib/firebase";
import { useTheme } from "@src/theme/ThemeProvider";
import i18n from "@src/i18n/i18n";

// ✅ Packs alignés sur le backend (functions/credits/packs.js)
const PACKS = [
  { id: "credits_25", credits: 25, bonus: 0, priceCents: 499, tagKey: "credits.wallet.packs.starter", tagFallback: "Starter" },
  { id: "credits_75", credits: 75, bonus: 5, priceCents: 999, tagKey: "credits.wallet.packs.popular", tagFallback: "Popular" },
  { id: "credits_150", credits: 150, bonus: 10, priceCents: 1499, tagKey: "credits.wallet.packs.bestValue", tagFallback: "Best value" },
];

// format CAD selon langue
const fmtPrice = (cents) => {
  const amount = (Number(cents) || 0) / 100;
  const locale = i18n?.locale || i18n?.language || "fr-CA";
  try {
    return amount.toLocaleString(locale, { style: "currency", currency: "CAD" });
  } catch {
    return amount.toLocaleString("fr-CA", { style: "currency", currency: "CAD" });
  }
};

// idempotence client (double tap)
function clientTxId() {
  const rnd =
    globalThis?.crypto?.randomUUID?.() ||
    `tx_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  return String(rnd);
}

export default function CreditsWallet({ credits }) {
  const { colors } = useTheme();

  const balance = useMemo(
    () => (typeof credits === "number" ? credits : credits?.balance ?? 0),
    [credits]
  );

  const [buying, setBuying] = useState(false);
  const [selectedPack, setSelectedPack] = useState(PACKS[0]);

  async function callPurchaseCreditsMock(payload) {
    if (Platform.OS === "web") {
      const { getFunctions, httpsCallable } = await import("firebase/functions");
      const f = getFunctions(app, "us-central1");
      const fn = httpsCallable(f, "purchaseCreditsMock");
      return fn(payload);
    } else {
      const functions = (await import("@react-native-firebase/functions")).default;
      const fn = functions().httpsCallable("purchaseCreditsMock");
      return fn(payload);
    }
  }

  const onBuy = async () => {
    try {
      if (!selectedPack?.id) return;

      setBuying(true);

      const txId = clientTxId();
      const res = await callPurchaseCreditsMock({
        packKey: selectedPack.id,
        clientTxId: txId,
      });

      const data = res?.data || {};
      const applied = data?.applied === true;
      const amount = Number(data?.amount ?? 0);

      if (!applied) {
        Alert.alert(
          i18n.t("credits.wallet.purchaseNotAppliedTitle", { defaultValue: "Purchase already processed" }),
          i18n.t("credits.wallet.purchaseNotAppliedBody", {
            defaultValue: "This purchase was already applied (idempotent).",
          })
        );
        return;
      }

      Alert.alert(
        i18n.t("credits.wallet.purchaseSuccessTitle", { defaultValue: "✅ Credits added" }),
        i18n.t("credits.wallet.purchaseSuccessBody", {
          defaultValue: "You received +{{amount}} credits.\nYour balance will update shortly.",
          amount,
        })
      );
    } catch (e) {
      console.log("[purchaseCreditsMock] error:", e);
      const code = e?.code || "";
      const message = e?.message || String(e);

      if (code === "unauthenticated") {
        Alert.alert(
          i18n.t("credits.wallet.loginRequiredTitle", { defaultValue: "Sign-in required" }),
          i18n.t("credits.wallet.loginRequiredBody", {
            defaultValue: "You must be logged in to buy credits.",
          })
        );
        return;
      }

      if (code === "permission-denied") {
        Alert.alert(
          i18n.t("credits.wallet.mockDisabledTitle", { defaultValue: "Disabled" }),
          i18n.t("credits.wallet.mockDisabledBody", {
            defaultValue: "Mock purchases are disabled in production.",
          })
        );
        return;
      }

      Alert.alert(i18n.t("common.unknownError", { defaultValue: "Unknown error" }), message);
    } finally {
      setBuying(false);
    }
  };

  const isDark = colors.background === "#111827";

  // 🎨 ajustements UI dark
  const packBgIdle = isDark ? "#0b1220" : colors.card;
  const packBgActive = isDark ? "#111827" : (colors.card2 || colors.card);

  const packBorderIdle = isDark ? "rgba(255,255,255,0.14)" : colors.border;
  const packBorderActive = isDark ? "rgba(239,68,68,0.95)" : (colors.primary || colors.text);

  const packShadow = isDark
    ? {
        shadowColor: "#000",
        shadowOpacity: 0.35,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 6 },
        elevation: 3,
      }
    : {};

  const red = "#ef4444";
  const redPressed = "#dc2626";
  const redDisabled = "#9ca3af";

  return (
    <View
      style={{
        borderRadius: 18,
        overflow: "hidden",
        shadowColor: "#000",
        shadowOpacity: 0.12,
        shadowRadius: 14,
        shadowOffset: { width: 0, height: 8 },
        elevation: 6,
        backgroundColor: colors.card,
      }}
    >
      {/* Bandeau solde */}
      <LinearGradient
        colors={["#020617", "#0f172a"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ padding: 18 }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <View
            style={{
              width: 42,
              height: 42,
              borderRadius: 12,
              backgroundColor: "rgba(255,255,255,0.08)",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <MaterialCommunityIcons name="credit-card-outline" size={26} color="#fff" />
          </View>

          <View style={{ flex: 1 }}>
            <Text
              style={{
                color: "#9CA3AF",
                fontWeight: "700",
                letterSpacing: 0.4,
              }}
            >
              {i18n.t("credits.wallet.balanceLabel", "MY BALANCE")}
            </Text>
            <Text
              style={{
                color: "#fff",
                fontWeight: "900",
                fontSize: 34,
                marginTop: 2,
              }}
            >
              {balance}
            </Text>
          </View>
        </View>
      </LinearGradient>

      {/* Corps : packs + action */}
      <View style={{ backgroundColor: colors.card, padding: 16 }}>
        <Text
          style={{
            fontWeight: "900",
            fontSize: 16,
            marginBottom: 10,
            color: colors.text,
          }}
        >
          {i18n.t("credits.wallet.buyTitle", "Buy credits")}
        </Text>

        {/* Packs */}
        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            justifyContent: "space-between",
            rowGap: 10,
            columnGap: 10,
            marginBottom: 14,
          }}
        >
          {PACKS.map((p) => {
            const active = selectedPack?.id === p.id;

            const label = `${p.credits}${p.bonus ? ` +${p.bonus}` : ""}`;

            return (
              <TouchableOpacity
                key={p.id}
                onPress={() => setSelectedPack(p)}
                style={{
                  width: "48%",
                  borderWidth: active ? 2 : 1,
                  borderColor: active ? packBorderActive : packBorderIdle,
                  backgroundColor: active ? packBgActive : packBgIdle,
                  paddingVertical: 10,
                  paddingHorizontal: 12,
                  borderRadius: 12,

                  ...(active ? packShadow : null),
                }}
              >
                <Text style={{ fontWeight: "900", color: colors.text }}>
                  {i18n.t("credits.wallet.creditsLabel", {
                    defaultValue: "{{count}} credits",
                    count: label,
                  })}
                </Text>

                <Text
                  style={{
                    color: colors.subtext,
                    fontSize: 12,
                    marginTop: 2,
                  }}
                >
                  {i18n.t(p.tagKey, p.tagFallback)}
                </Text>

                {/* petit hint "selected" en dark (optionnel mais utile) */}
                {active && isDark && (
                  <View style={{ marginTop: 6, flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <MaterialCommunityIcons name="check-circle" size={14} color={red} />
                    <Text style={{ color: "rgba(255,255,255,0.75)", fontSize: 12, fontWeight: "800" }}>
                      {i18n.t("common.selected", { defaultValue: "Selected" })}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Résumé + bouton acheter */}
        <View
          style={{
            borderWidth: 1,
            borderColor: isDark ? "rgba(255,255,255,0.12)" : colors.border,
            borderRadius: 14,
            padding: 12,
            backgroundColor: colors.card2 || (isDark ? "#0b1220" : colors.card),
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <View>
            <Text style={{ fontWeight: "900", color: colors.text }}>
              {selectedPack.bonus
                ? `${selectedPack.credits} + ${selectedPack.bonus}`
                : `${selectedPack.credits}`}{" "}
              {i18n.t("credits.wallet.creditsWord", { defaultValue: "credits" })}
            </Text>
            <Text style={{ color: colors.subtext, marginTop: 2 }}>
              {fmtPrice(selectedPack.priceCents)}
            </Text>
          </View>

          <Pressable
            onPress={onBuy}
            disabled={buying}
            style={({ pressed }) => ({
              backgroundColor: buying ? redDisabled : pressed ? redPressed : red,
              paddingVertical: 12,
              paddingHorizontal: 18,
              borderRadius: 12,
              opacity: buying ? 0.85 : 1,
            })}
          >
            {buying ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={{ color: "#fff", fontWeight: "900" }}>
                {i18n.t("credits.wallet.buyButton", "Buy")}
              </Text>
            )}
          </Pressable>
        </View>

        <Text
          style={{
            color: colors.subtext,
            fontSize: 12,
            marginTop: 10,
          }}
        >
          {i18n.t(
            "credits.wallet.footerNote",
            "Secure payments • Receipts by email • Credits delivered instantly"
          )}
        </Text>
      </View>
    </View>
  );
}