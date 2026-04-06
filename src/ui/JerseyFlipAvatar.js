import React, { useEffect, useRef, useState } from "react";
import { Animated, Image, View, Easing, Text } from "react-native";

export default function JerseyFlipAvatar({
  frontUrl,
  backUrl,
  roleBadge = null, // "C" | "A" | null
  size = 110,
  holdMs = 1600,
  fadeDurationMs = 500,
  backgroundColor = "#f3f4f6",
  badgeColor = "#ffffff",
  badgeShadowColor = "#111111",
}) {
  const progress = useRef(new Animated.Value(0)).current;
  const [showFront, setShowFront] = useState(true);

  useEffect(() => {
    if (!frontUrl || !backUrl) return;

    Image.prefetch(frontUrl).catch(() => {});
    Image.prefetch(backUrl).catch(() => {});

    let mounted = true;

    const run = () => {
      Animated.sequence([
        Animated.delay(holdMs),
        Animated.timing(progress, {
          toValue: showFront ? 1 : 0,
          duration: fadeDurationMs,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]).start(() => {
        if (!mounted) return;
        setShowFront((prev) => !prev);
      });
    };

    run();
    const interval = setInterval(run, holdMs + fadeDurationMs + 50);

    return () => {
      mounted = false;
      clearInterval(interval);
      progress.stopAnimation();
    };
  }, [frontUrl, backUrl, holdMs, fadeDurationMs, showFront, progress]);

  const frontOpacity = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0],
  });

  const backOpacity = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  const badgeFontSize = Math.round(size * 0.15);

  return (
    <View
      style={{
        width: size,
        height: size,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor,
      }}
    >
      {/* FRONT */}
      <Animated.View
        style={{
          position: "absolute",
          width: size,
          height: size,
          opacity: frontOpacity,
        }}
      >
        <Image
          source={{ uri: frontUrl }}
          style={{ width: "100%", height: "100%" }}
          resizeMode="contain"
          fadeDuration={0}
        />

        {!!roleBadge && (
          <View
            style={{
              position: "absolute",
              right: Math.round(size * 0.28),
              top: Math.round(size * 0.22),
              alignItems: "center",
              justifyContent: "center",
            }}
            pointerEvents="none"
          >
            <Text
              style={{
                fontSize: badgeFontSize,
                fontWeight: "900",
                color: badgeColor,
                textShadowColor: badgeShadowColor,
                textShadowOffset: { width: 1, height: 1 },
                textShadowRadius: 2,
              }}
            >
              {roleBadge}
            </Text>
          </View>
        )}
      </Animated.View>

      {/* BACK */}
      <Animated.View
        style={{
          position: "absolute",
          width: size,
          height: size,
          opacity: backOpacity,
        }}
      >
        <Image
          source={{ uri: backUrl }}
          style={{ width: "100%", height: "100%" }}
          resizeMode="contain"
          fadeDuration={0}
        />
      </Animated.View>
    </View>
  );
}