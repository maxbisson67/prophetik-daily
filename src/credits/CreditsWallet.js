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
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTheme } from "@src/theme/ThemeProvider";
import i18n from "@src/i18n/i18n";
import Purchases from "react-native-purchases";

// ✅ Packs (UI/bonus). Le prix vient de RevenueCat.
const PACKS = [
  { id: "credits_25", credits: 25, bonus: 0, tagKey: "credits.wallet.packs.starter", tagFallback: "Starter" },
  { id: "credits_75", credits: 75, bonus: 5, tagKey: "credits.wallet.packs.popular", tagFallback: "Popular" },
  { id: "credits_150", credits: 150, bonus: 10, tagKey: "credits.wallet.packs.bestValue", tagFallback: "Best value" },
];

// -----------------------------
// ✅ Animated number hook (RAF) – plus fiable que Animated.Value.addListener
// -----------------------------
export function useAnimatedNumber(
  targetNumber,
  { duration = 2600, onComplete } = {}
) {
  const [display, setDisplay] = useState(
    typeof targetNumber === "number" ? targetNumber : 0
  );

  const prevRef = useRef(typeof targetNumber === "number" ? targetNumber : 0);
  const rafRef = useRef(null);

  useEffect(() => {
    const to = typeof targetNumber === "number" ? targetNumber : 0;

    // Si pas de changement → on sync (important si parent re-render)
    if (to === prevRef.current) {
      setDisplay(to);
      return;
    }

    const from = prevRef.current;
    prevRef.current = to;

    // Annule une animation en cours
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
  const { colors } = useTheme();

  const balance = useMemo(
    () => (typeof credits === "number" ? credits : credits?.balance ?? 0),
    [credits]
  );

  const { show: showToast, ToastView } = useMiniToast();

  // ✅ On met le delta ici, et on l’affiche quand l’animation a fini.
  const toastQueueRef = useRef(null); // { delta: number } | null

  const onAnimComplete = useCallback(() => {
    const q = toastQueueRef.current;
    if (q?.delta) {
      toastQueueRef.current = null;
      showToast(`+${q.delta} credits ✅`);
    }
  }, [showToast]);

  const animatedBalance = useAnimatedNumber(balance, {
    duration: 2600,
    onComplete: onAnimComplete,
  });

  const [buying, setBuying] = useState(false);
  const [selectedPack, setSelectedPack] = useState(PACKS[0]);

  const [rcPackagesById, setRcPackagesById] = useState({});
  const [loadingRc, setLoadingRc] = useState(true);



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
        console.log(e)
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
        const ids = [];

        for (const pkg of pkgs) {
          const pid = pkg?.product?.identifier;
          if (pid) {
            map[pid] = pkg;
            ids.push(pid);
          }
        }

        if (alive) {
          setRcPackagesById(map);
        
        }
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

  // Detect delivery
  useEffect(() => {
    if (deliveryState !== "waiting") return;

    const start = pendingStartBalanceRef.current;
    if (typeof start !== "number") return;

    if (typeof balance === "number" && balance > start) {
      const delta = balance - start;

      // ✅ queue le toast → sera affiché quand le compteur a fini
      toastQueueRef.current = { delta };

      setDeliveryState("delivered");
      pendingStartBalanceRef.current = null;

      if (waitingTimerRef.current) clearTimeout(waitingTimerRef.current);
      waitingTimerRef.current = setTimeout(() => {
        setDeliveryState("idle");
      }, 2500);
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

  const isDark = colors.background === "#111827";
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

  const canBuy =
    !buying &&
    !loadingRc &&
    !!rcPackagesById?.[selectedPack?.id] &&
    Platform.OS !== "web";

  const onBuy = async () => {
    try {
      if (Platform.OS === "web") {
        Alert.alert(
          i18n.t("common.info", { defaultValue: "Info" }),
          i18n.t("credits.wallet.webNotSupported", {
            defaultValue: "In-app purchases are not available on web. Please use the mobile app.",
          })
        );
        return;
      }

      if (!selectedPack?.id) return;

      const pkg = rcPackagesById[selectedPack.id];
      if (!pkg) {
        Alert.alert(
          i18n.t("common.error", { defaultValue: "Error" }),
          i18n.t("credits.wallet.noStoreProduct", {
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
        i18n.t("credits.wallet.purchasePendingTitle", { defaultValue: "✅ Purchase successful" }),
        i18n.t("credits.wallet.purchasePendingBody", {
          defaultValue: "Your credits will be delivered shortly.",
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

      Alert.alert(
        i18n.t("common.unknownError", { defaultValue: "Unknown error" }),
        e?.message || String(e)
      );
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
            {i18n.t("credits.wallet.deliveryWaiting", { defaultValue: "Waiting for delivery…" })}
          </Text>
        </View>
      );
    }
    if (deliveryState === "delivered") {
      return (
        <View style={{ marginTop: 10, flexDirection: "row", alignItems: "center", gap: 8 }}>
          <MaterialCommunityIcons name="check-decagram" size={16} color={red} />
          <Text style={{ color: colors.subtext, fontSize: 12, fontWeight: "800" }}>
            {i18n.t("credits.wallet.deliveryDelivered", { defaultValue: "Delivered ✅" })}
          </Text>
        </View>
      );
    }
    return null;
  })();

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
            <Text style={{ color: "#9CA3AF", fontWeight: "700", letterSpacing: 0.4 }}>
              {i18n.t("credits.wallet.balanceLabel", "MY BALANCE")}
            </Text>
            <Text style={{ color: "#fff", fontWeight: "900", fontSize: 34, marginTop: 2 }}>
              {animatedBalance}
            </Text>
          </View>
        </View>
      </LinearGradient>

      {/* Corps */}
      <View style={{ backgroundColor: colors.card, padding: 16 }}>
        <Text style={{ fontWeight: "900", fontSize: 16, marginBottom: 10, color: colors.text }}>
          {i18n.t("credits.wallet.buyTitle", "Buy credits")}
        </Text>

        {loadingRc ? (
          <View style={{ paddingVertical: 12, alignItems: "center" }}>
            <ActivityIndicator />
            <Text style={{ marginTop: 8, color: colors.subtext }}>
              {i18n.t("credits.wallet.loadingStore", { defaultValue: "Loading store…" })}
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
              {i18n.t("credits.wallet.webNotSupported", {
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
            const label = `${p.credits}${p.bonus ? ` +${p.bonus}` : ""}`;
            const available = !!rcPackagesById?.[p.id];

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
                  ...(active ? packShadow : null),
                }}
              >
                <Text style={{ fontWeight: "900", color: colors.text }}>
                  {i18n.t("credits.wallet.creditsLabel", {
                    defaultValue: "{{count}} credits",
                    count: label,
                  })}
                </Text>

                <Text style={{ color: colors.subtext, fontSize: 12, marginTop: 2 }}>
                  {i18n.t(p.tagKey, p.tagFallback)}
                </Text>

                <Text style={{ color: colors.subtext, fontSize: 12, marginTop: 6 }}>
                  {priceLabelForPack(p.id)}
                </Text>

                {!available && !loadingRc ? (
                  <Text style={{ color: colors.subtext, fontSize: 11, marginTop: 6 }}>
                    {i18n.t("credits.wallet.notAvailableYet", { defaultValue: "Not available yet" })}
                  </Text>
                ) : null}

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

        {/* Résumé + bouton */}
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
              {selectedPack.bonus ? `${selectedPack.credits} + ${selectedPack.bonus}` : `${selectedPack.credits}`}{" "}
              {i18n.t("credits.wallet.creditsWord", { defaultValue: "credits" })}
            </Text>
            <Text style={{ color: colors.subtext, marginTop: 2 }}>
              {priceLabelForPack(selectedPack.id)}
            </Text>
          </View>

          <Pressable
            onPress={onBuy}
            disabled={!canBuy}
            style={({ pressed }) => ({
              backgroundColor: !canBuy ? redDisabled : pressed ? "#dc2626" : "#ef4444",
              paddingVertical: 12,
              paddingHorizontal: 18,
              borderRadius: 12,
              opacity: !canBuy ? 0.85 : 1,
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

        {deliveryLine}

        <Text style={{ color: colors.subtext, fontSize: 12, marginTop: 10 }}>
          {i18n.t("credits.wallet.footerNote", "Secure payments • Receipts by email • Credits delivered shortly")}
        </Text>

        {ToastView}
      </View>
    </View>
  );
}