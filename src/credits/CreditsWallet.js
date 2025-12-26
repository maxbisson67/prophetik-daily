import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Pressable,
  Platform,
  Animated,
  ToastAndroid,
  Image,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTheme } from "@src/theme/ThemeProvider";
import i18n from "@src/i18n/i18n";
import Purchases from "react-native-purchases";

/**
 * ✅ Token assets
 * - Bandeau (header) est sombre même en thème clair -> on FORCE la version blanche.
 * - Ailleurs: on choisit selon le thème (dark => blanc, light => noir).
 *
 * ⚠️ Assure-toi que ces fichiers existent:
 *   src/ui/prophetik_icon_512.png
 *   src/ui/prophetik_icon_512_white.png
 */
const TOKEN_BLACK = require("@src/ui/prophetik_icon_512.png");
const TOKEN_WHITE = require("@src/ui/prophetik_icon_512_white.png");

function TokenIcon({ size = 32, force = "auto" }) {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const source =
    force === "white"
      ? TOKEN_WHITE
      : force === "black"
      ? TOKEN_BLACK
      : isDark
      ? TOKEN_WHITE
      : TOKEN_BLACK;

  return (
    <Image
      source={source}
      resizeMode="contain"
      style={{ width: size, height: size }}
      fadeDuration={0}
    />
  );
}

// ✅ Packs (UI/bonus). Le prix vient de RevenueCat.
const PACKS = [
  { id: "credits_25", credits: 25, bonus: 0, tagKey: "credits.logs.wallet.packs.starter", tagFallback: "Starter" },
  { id: "credits_75", credits: 75, bonus: 5, tagKey: "credits.logs.wallet.packs.popular", tagFallback: "Popular" },
  { id: "credits_150", credits: 150, bonus: 10, tagKey: "credits.logs.wallet.packs.bestValue", tagFallback: "Best value" },
];

// -----------------------------
// ✅ Animated number hook (RAF)
// -----------------------------
export function useAnimatedNumber(targetNumber, { duration = 2600, onComplete, initialValue } = {}) {
  const initial =
    typeof initialValue === "number"
      ? initialValue
      : typeof targetNumber === "number"
      ? targetNumber
      : 0;

  const [display, setDisplay] = useState(initial);

  const prevRef = useRef(initial);
  const rafRef = useRef(null);

  useEffect(() => {
    const to = typeof targetNumber === "number" ? targetNumber : 0;

    // Si pas de changement → on sync
    if (to === prevRef.current) {
      setDisplay(to);
      return;
    }

    const from = prevRef.current;
    prevRef.current = to;

    if (rafRef.current) cancelAnimationFrame(rafRef.current);

    const startTs = Date.now();
    const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

    const tick = () => {
      const now = Date.now();
      const t = Math.min(1, (now - startTs) / Math.max(1, duration));
      const eased = easeOutCubic(t);
      const v = from + (to - from) * eased;

      setDisplay(Math.floor(v));

      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        setDisplay(to);
        rafRef.current = null;
        if (typeof onComplete === "function") onComplete(to);
      }
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [targetNumber, duration, onComplete]);

  return display;
}

// -----------------------------
// Mini toast (Android natif + iOS custom)
// -----------------------------
function useMiniToast() {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(10)).current;
  const [msg, setMsg] = useState("");
  const [visible, setVisible] = useState(false);
  const hideTimer = useRef(null);

  const show = useCallback(
    (text) => {
      if (Platform.OS === "android") {
        ToastAndroid.show(text, ToastAndroid.SHORT);
        return;
      }

      setMsg(text);
      setVisible(true);

      if (hideTimer.current) clearTimeout(hideTimer.current);

      opacity.setValue(0);
      translateY.setValue(10);

      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 0, duration: 180, useNativeDriver: true }),
      ]).start();

      hideTimer.current = setTimeout(() => {
        Animated.parallel([
          Animated.timing(opacity, { toValue: 0, duration: 180, useNativeDriver: true }),
          Animated.timing(translateY, { toValue: 10, duration: 180, useNativeDriver: true }),
        ]).start(() => setVisible(false));
      }, 2000);
    },
    [opacity, translateY]
  );

  useEffect(() => {
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, []);

  const ToastView = visible ? (
    <Animated.View
      pointerEvents="none"
      style={{
        position: "absolute",
        left: 16,
        right: 16,
        bottom: 18,
        opacity,
        transform: [{ translateY }],
        backgroundColor: "rgba(0,0,0,0.85)",
        borderRadius: 14,
        paddingVertical: 10,
        paddingHorizontal: 12,
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
      }}
    >
      <MaterialCommunityIcons name="check-circle" size={16} color="#fff" />
      <Text style={{ color: "#fff", fontWeight: "800" }}>{msg}</Text>
    </Animated.View>
  ) : null;

  return { show, ToastView };
}

// -----------------------------
// Component
// -----------------------------
export default function CreditsWallet({ credits }) {
  const { colors, theme } = useTheme();
  const isDark = theme === "dark";

  const balance = useMemo(() => {
    const n = typeof credits === "number" ? credits : credits?.balance ?? 0;
    return Number(n) || 0;
  }, [credits]);

  const { show: showToast, ToastView } = useMiniToast();

  // ✅ Queue du toast (affiché quand l’animation du compteur finit)
  const toastQueueRef = useRef(null); // { delta: number } | null

  const onAnimComplete = useCallback(() => {
    const q = toastQueueRef.current;
    if (q?.delta) {
      toastQueueRef.current = null;
      showToast(`+${q.delta} ✅`);
    }
  }, [showToast]);

  const animatedBalance = useAnimatedNumber(balance, {
    duration: 2600,
    onComplete: onAnimComplete,
    initialValue: 0,
  });

  const [buying, setBuying] = useState(false);
  const [selectedPack, setSelectedPack] = useState(PACKS[0]);

  const [rcPackagesById, setRcPackagesById] = useState({});
  const [loadingRc, setLoadingRc] = useState(true);

  // (optionnel) utile pour debug RevenueCat
  const [rcUserId, setRcUserId] = useState(null);

  // UX delivery
  const [deliveryState, setDeliveryState] = useState("idle"); // idle | waiting | delivered
  const pendingStartBalanceRef = useRef(null);
  const waitingTimerRef = useRef(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const id = await Purchases.getAppUserID();
        if (alive) setRcUserId(id || "n/a");
      } catch (e) {
        console.log("[RevenueCat] getAppUserID error", e?.message || e);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // Load offerings
  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const offerings = await Purchases.getOfferings();

        const pkgs = offerings?.current?.availablePackages || [];
        const map = {};

        for (const pkg of pkgs) {
          const pid = pkg?.product?.identifier;
          if (pid) map[pid] = pkg;
        }

        if (alive) setRcPackagesById(map);
      } catch (e) {
        console.log("[RevenueCat] getOfferings error", e?.message || e);
      } finally {
        if (alive) setLoadingRc(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  // Detect delivery (solde augmenté)
  useEffect(() => {
    if (deliveryState !== "waiting") return;

    const start = pendingStartBalanceRef.current;
    if (typeof start !== "number") return;

    if (typeof balance === "number" && balance > start) {
      const delta = balance - start;

      toastQueueRef.current = { delta };

      setDeliveryState("delivered");
      pendingStartBalanceRef.current = null;

      if (waitingTimerRef.current) clearTimeout(waitingTimerRef.current);
      waitingTimerRef.current = setTimeout(() => setDeliveryState("idle"), 2500);
    }
  }, [balance, deliveryState]);

  useEffect(() => {
    return () => {
      if (waitingTimerRef.current) clearTimeout(waitingTimerRef.current);
    };
  }, []);

  function priceLabelForPack(packId) {
    const pkg = rcPackagesById?.[packId];
    return pkg?.product?.priceString || "—";
  }

  const packBgIdle = isDark ? "#0b1220" : colors.card;
  const packBgActive = isDark ? "#111827" : colors.card2 || colors.card;
  const packBorderIdle = isDark ? "rgba(255,255,255,0.14)" : colors.border;
  const packBorderActive = isDark ? "rgba(239,68,68,0.95)" : colors.primary || colors.text;

  const packShadowIdle = {
    shadowColor: "#000",
    shadowOpacity: isDark ? 0.28 : 0.10,
    shadowRadius: isDark ? 10 : 12,
    shadowOffset: { width: 0, height: isDark ? 6 : 8 },
    elevation: isDark ? 3 : 2,
  };

  const packShadowActive = {
    shadowColor: "#000",
    shadowOpacity: isDark ? 0.45 : 0.18,
    shadowRadius: isDark ? 16 : 18,
    shadowOffset: { width: 0, height: isDark ? 10 : 12 },
    elevation: isDark ? 6 : 4,
  };

  const buyCardShadow = {
  shadowColor: "#000",
  shadowOpacity: isDark ? 0.32 : 0.12,
  shadowRadius: isDark ? 14 : 16,
  shadowOffset: { width: 0, height: isDark ? 8 : 10 },
  elevation: isDark ? 4 : 3,
};

const buyCardShadowPressed = {
  shadowColor: "#000",
  shadowOpacity: isDark ? 0.22 : 0.08,
  shadowRadius: isDark ? 10 : 12,
  shadowOffset: { width: 0, height: isDark ? 5 : 6 },
  elevation: isDark ? 3 : 2,
};

  const red = "#ef4444";
  const redDisabled = "#9ca3af";

  const canBuy = !buying && !loadingRc && !!rcPackagesById?.[selectedPack?.id] && Platform.OS !== "web";

  const onBuy = async () => {
    try {
      if (Platform.OS === "web") {
        Alert.alert(
          i18n.t("common.info", "Info"),
          i18n.t("credits.logs.wallet.webNotSupported", {
            defaultValue: "In-app purchases are not available on web. Please use the mobile app.",
          })
        );
        return;
      }

      if (!selectedPack?.id) return;

      const pkg = rcPackagesById[selectedPack.id];
      if (!pkg) {
        Alert.alert(
          i18n.t("common.error", "Error"),
          i18n.t("credits.logs.wallet.noStoreProduct", {
            defaultValue: "This product is not available in the store yet. Try again in a moment.",
          })
        );
        return;
      }

      setBuying(true);

      pendingStartBalanceRef.current = typeof balance === "number" ? balance : 0;
      setDeliveryState("waiting");

      await Purchases.purchasePackage(pkg);

      Alert.alert(
        i18n.t("credits.logs.wallet.purchasePendingTitle", "✅ Purchase successful"),
        i18n.t("credits.logs.wallet.purchasePendingBody", {
          defaultValue: "Your tokens will be delivered shortly.",
        })
      );
    } catch (e) {
      if (e?.userCancelled) {
        setDeliveryState("idle");
        pendingStartBalanceRef.current = null;
        toastQueueRef.current = null;
        return;
      }

      console.log("[RevenueCat] purchase error", e);

      setDeliveryState("idle");
      pendingStartBalanceRef.current = null;
      toastQueueRef.current = null;

      Alert.alert(i18n.t("common.unknownError", "Unknown error"), e?.message || String(e));
    } finally {
      setBuying(false);
    }
  };

  const deliveryLine = (() => {
    if (deliveryState === "waiting") {
      return (
        <View style={{ marginTop: 10, flexDirection: "row", alignItems: "center", gap: 8 }}>
          <ActivityIndicator />
          <Text style={{ color: colors.subtext, fontSize: 12 }}>
            {i18n.t("credits.logs.wallet.deliveryWaiting", "Waiting for delivery…")}
          </Text>
        </View>
      );
    }
    if (deliveryState === "delivered") {
      return (
        <View style={{ marginTop: 10, flexDirection: "row", alignItems: "center", gap: 8 }}>
          <MaterialCommunityIcons name="check-decagram" size={16} color={red} />
          <Text style={{ color: colors.subtext, fontSize: 12, fontWeight: "800" }}>
            {i18n.t("credits.logs.wallet.deliveryDelivered", "Delivered ✅")}
          </Text>
        </View>
      );
    }
    return null;
  })();

  const selectedBonus = Number(selectedPack?.bonus || 0);
  const selectedTotal = Number(selectedPack?.credits || 0) + selectedBonus;

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
          <View style={{ flex: 1 }}>
            <Text style={{ color: "#9CA3AF", fontWeight: "700", letterSpacing: 0.4 }}>
              {i18n.t("credits.logs.wallet.balanceLabel", "MY TOKENS")}
            </Text>

            {/* ✅ count suivi du token (pas de 'P') */}
            <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 10, marginTop: 2 }}>
              <Text style={{ color: "#fff", fontWeight: "900", fontSize: 34, lineHeight: 38 }}>
                {animatedBalance}
              </Text>
              <View style={{ paddingBottom: 6 }}>
                <TokenIcon size={28} force="white" />
              </View>
            </View>

            {/* Optionnel debug */}
            {__DEV__ && rcUserId ? (
              <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 11, marginTop: 2 }}>
                RC: {rcUserId}
              </Text>
            ) : null}
          </View>
        </View>
      </LinearGradient>

      {/* Corps */}
      <View style={{ backgroundColor: colors.card, padding: 16 }}>
      <View style={{ marginBottom: 10 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Text style={{ fontWeight: "900", fontSize: 16, color: colors.text }}>
            {i18n.t("credits.logs.wallet.buyTitle", "Buy Prophetik Tokens")}
          </Text>
          <TokenIcon size={18} force={isDark ? "white" : "black"} />
        </View>

        <Text style={{ marginTop: 4, color: colors.subtext, fontSize: 12, fontStyle: "italic" }}>
          {i18n.t(
            "credits.logs.wallet.tokenDisclaimer",
            "Tokens are usable in-app only and cannot be exchanged for money."
          )}
        </Text>
      </View>

        {loadingRc ? (
          <View style={{ paddingVertical: 12, alignItems: "center" }}>
            <ActivityIndicator />
            <Text style={{ marginTop: 8, color: colors.subtext }}>
              {i18n.t("credits.logs.wallet.loadingStore", "Loading store…")}
            </Text>
          </View>
        ) : null}

        {Platform.OS === "web" ? (
          <View
            style={{
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 12,
              padding: 10,
              backgroundColor: colors.card2 || colors.card,
              marginBottom: 12,
            }}
          >
            <Text style={{ color: colors.subtext, fontSize: 12 }}>
              {i18n.t("credits.logs.wallet.webNotSupported", {
                defaultValue: "In-app purchases are not available on web. Please use the mobile app.",
              })}
            </Text>
          </View>
        ) : null}

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
            const available = !!rcPackagesById?.[p.id];

            const bonus = Number(p.bonus || 0);
            const total = Number(p.credits || 0) + bonus;
            const cardShadow = active ? packShadowActive : packShadowIdle;

            return (
              <TouchableOpacity
                key={p.id}
                onPress={() => setSelectedPack(p)}
                disabled={buying}
                style={{
                  width: "48%",
                  borderWidth: active ? 2 : 1,
                  borderColor: active ? packBorderActive : packBorderIdle,
                  backgroundColor: active ? packBgActive : packBgIdle,
                  paddingVertical: 10,
                  paddingHorizontal: 12,
                  borderRadius: 12,
                  opacity: available ? 1 : 0.55,
                  transform: [{ translateY: active ? -2 : 0 }], // petit lift
                   ...cardShadow,
                }}
              >

                {/* ✅ Total livré + token */}
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Text style={{ fontWeight: "900", color: colors.text }}>{total}</Text>
                  <TokenIcon size={16} force={isDark ? "white" : "black"} />
                </View>

                {/* ✅ Ligne bonus + badge */}
                {bonus ? (
                  <View style={{ marginTop: 6 }}>
                    <Text style={{ color: colors.subtext, fontSize: 12 }}>
                      {i18n.t("credits.logs.wallet.bonusLine", {
                        defaultValue: "Includes +{{bonus}} bonus",
                        bonus,
                      })}
                    </Text>

                    <View
                      style={{
                        backgroundColor: red,
                        paddingHorizontal: 8,
                        paddingVertical: 3,
                        borderRadius: 999,
                        alignSelf: "flex-start",
                        marginTop: 6,
                      }}
                    >
                      <Text style={{ color: "#fff", fontWeight: "900", fontSize: 11 }}>
                        {i18n.t("credits.logs.wallet.bonusBadge", {
                          defaultValue: "+{{bonus}} BONUS",
                          bonus,
                        })}
                      </Text>
                    </View>
                  </View>
                ) : null}

                <Text style={{ color: colors.subtext, fontSize: 12, marginTop: 8 }}>
                  {i18n.t(p.tagKey, p.tagFallback)}
                </Text>

                <Text style={{ color: colors.subtext, fontSize: 12, marginTop: 6 }}>
                  {priceLabelForPack(p.id)}
                </Text>

                {!available && !loadingRc ? (
                  <Text style={{ color: colors.subtext, fontSize: 11, marginTop: 6 }}>
                    {i18n.t("credits.logs.wallet.notAvailableYet", "Not available yet")}
                  </Text>
                ) : null}

                {active && isDark ? (
                  <View style={{ marginTop: 6, flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <MaterialCommunityIcons name="check-circle" size={14} color={red} />
                    <Text style={{ color: "rgba(255,255,255,0.75)", fontSize: 12, fontWeight: "800" }}>
                      {i18n.t("common.selected", "Selected")}
                    </Text>
                  </View>
                ) : null}
              </TouchableOpacity>
            );
          })}
        </View>

       
 {/* Résumé + bouton */}
  <Pressable
    disabled
    style={({ pressed }) => ({
      borderWidth: 1,
      borderColor: isDark ? "rgba(255,255,255,0.12)" : colors.border,
      borderRadius: 14,
      padding: 12,
      backgroundColor: colors.card2 || (isDark ? "#0b1220" : colors.card),
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",

      // 🎯 petit lift premium
      transform: [{ translateY: pressed ? -1 : -2 }],

      // 🎯 relief
      ...(pressed ? buyCardShadowPressed : buyCardShadow),
    })}
  >
    <View style={{ flex: 1, paddingRight: 12 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <Text style={{ fontWeight: "900", color: colors.text }}>{selectedTotal}</Text>
        <TokenIcon size={16} force={isDark ? "white" : "black"} />

        {selectedBonus ? (
          <View
            style={{
              backgroundColor: red,
              paddingHorizontal: 8,
              paddingVertical: 3,
              borderRadius: 999,
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "900", fontSize: 11 }}>
              {i18n.t("credits.logs.wallet.bonusBadge", {
                defaultValue: "+{{bonus}} BONUS",
                bonus: selectedBonus,
              })}
            </Text>
          </View>
        ) : null}
      </View>

      {selectedBonus ? (
        <Text style={{ color: colors.subtext, marginTop: 4 }}>
          {i18n.t("credits.logs.wallet.bonusLine", {
            defaultValue: "Includes +{{bonus}} bonus",
            bonus: selectedBonus,
          })}
        </Text>
      ) : null}

      <Text style={{ color: colors.subtext, marginTop: selectedBonus ? 6 : 4 }}>
        {priceLabelForPack(selectedPack.id)}
      </Text>
    </View>

    <Pressable
      onPress={onBuy}
      disabled={!canBuy}
      style={({ pressed }) => ({
        backgroundColor: !canBuy ? redDisabled : pressed ? "#dc2626" : red,
        paddingVertical: 12,
        paddingHorizontal: 18,
        borderRadius: 12,
        opacity: !canBuy ? 0.85 : 1,
        transform: [{ translateY: pressed ? 1 : 0 }], // micro-lift du bouton
      })}
    >
      {buying ? (
        <ActivityIndicator color="#fff" />
      ) : (
        <Text style={{ color: "#fff", fontWeight: "900" }}>
          {i18n.t("credits.logs.wallet.buyButton", "Buy")}
        </Text>
      )}
    </Pressable>
  </Pressable>
        

        {deliveryLine}

        <Text style={{ color: colors.subtext, fontSize: 12, marginTop: 10 }}>
          {i18n.t("credits.logs.wallet.footerNote", "Prophetik Tokens are used in-app only (not cash, not withdrawable).")}
        </Text>

        {ToastView}
      </View>
    </View>
  );
}