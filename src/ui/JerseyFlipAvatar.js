import React, { useEffect, useRef, useState } from "react";
import { Animated, Easing, Platform, View } from "react-native";
import JerseyImage, { prefetchJerseyUrl } from "@src/ui/JerseyImage";
import { normalizeJerseyUrl } from "@src/ui/jerseyImageUtils";

function JerseyFlipStatic({ front, back, size, holdMs, backgroundColor }) {
  const [showFront, setShowFront] = useState(true);

  useEffect(() => {
    setShowFront(true);
    const timer = setInterval(() => {
      setShowFront((prev) => !prev);
    }, Math.max(holdMs * 2, 1200));
    return () => clearInterval(timer);
  }, [front, back, holdMs]);

  return (
    <View
      style={{
        width: size,
        height: size,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor,
      }}
      collapsable={false}
    >
      <JerseyImage
        uri={showFront ? front : back}
        size={size}
        accessibilityLabel={showFront ? "Maillot avant" : "Maillot arrière"}
      />
    </View>
  );
}

function JerseyFlipAnimated({
  front,
  back,
  size,
  holdMs,
  fadeDurationMs,
  backgroundColor,
}) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let mounted = true;
    let delayTimer;
    let activeAnim;

    const clearTimers = () => {
      if (delayTimer) clearTimeout(delayTimer);
      activeAnim?.stop?.();
      progress.stopAnimation();
    };

    const animateTo = (toValue) =>
      new Promise((resolve) => {
        activeAnim = Animated.timing(progress, {
          toValue,
          duration: fadeDurationMs,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        });
        activeAnim.start(({ finished }) => resolve(finished));
      });

    const loop = async () => {
      while (mounted) {
        await new Promise((resolve) => {
          delayTimer = setTimeout(resolve, holdMs);
        });
        if (!mounted) break;
        await animateTo(1);
        if (!mounted) break;
        await new Promise((resolve) => {
          delayTimer = setTimeout(resolve, holdMs);
        });
        if (!mounted) break;
        await animateTo(0);
      }
    };

    progress.setValue(0);
    loop();

    return () => {
      mounted = false;
      clearTimers();
    };
  }, [front, back, holdMs, fadeDurationMs, progress]);

  const frontOpacity = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0],
  });

  const backOpacity = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  return (
    <View
      style={{
        width: size,
        height: size,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor,
      }}
      collapsable={false}
    >
      <Animated.View
        style={{
          position: "absolute",
          width: size,
          height: size,
          opacity: frontOpacity,
        }}
      >
        <JerseyImage uri={front} size={size} accessibilityLabel="Maillot avant" />
      </Animated.View>
      <Animated.View
        style={{
          position: "absolute",
          width: size,
          height: size,
          opacity: backOpacity,
        }}
      >
        <JerseyImage uri={back} size={size} accessibilityLabel="Maillot arrière" />
      </Animated.View>
    </View>
  );
}

export default function JerseyFlipAvatar({
  frontUrl,
  backUrl,
  size = 110,
  holdMs = 1600,
  fadeDurationMs = 500,
  backgroundColor = "#f3f4f6",
}) {
  const front = normalizeJerseyUrl(frontUrl);
  const back = normalizeJerseyUrl(backUrl);

  useEffect(() => {
    if (!front || !back) return;
    prefetchJerseyUrl(front);
    prefetchJerseyUrl(back);
  }, [front, back]);

  if (!front || !back) return null;

  if (Platform.OS === "ios") {
    return (
      <JerseyFlipStatic
        front={front}
        back={back}
        size={size}
        holdMs={holdMs}
        backgroundColor={backgroundColor}
      />
    );
  }

  return (
    <JerseyFlipAnimated
      front={front}
      back={back}
      size={size}
      holdMs={holdMs}
      fadeDurationMs={fadeDurationMs}
      backgroundColor={backgroundColor}
    />
  );
}
