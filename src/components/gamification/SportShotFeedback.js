// src/components/gamification/SportShotFeedback.js
import React, { forwardRef, useImperativeHandle, useMemo, useRef, useState } from "react";
import { View, Animated, Easing, StyleSheet } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

/**
 * SportShotFeedback
 * - Overlay visuel non bloquant (pointerEvents none)
 * - 4 icônes en orbite qui tournent ensemble + pulse + fade
 *
 * Usage:
 * const shotFxRef = useRef(null);
 * <SportShotFeedback ref={shotFxRef} />
 * shotFxRef.current?.play();
 */
const DEFAULT_ICONS = ["hockey-puck", "baseball", "basketball", "football"];

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

const SportShotFeedback = forwardRef(function SportShotFeedback(
  {
    icons = DEFAULT_ICONS,
    size = 22,              // taille des icônes
    radius = 34,            // rayon de l'orbite
    durationMs = 520,       // durée totale
    fadeInMs = 90,
    fadeOutMs = 140,
    rotations = 1.25,       // nombre de tours pendant l'anim
    backdrop = false,       // si true => léger voile derrière
    style,
  },
  ref
) {
  const [visible, setVisible] = useState(false);

  const opacity = useRef(new Animated.Value(0)).current;
  const spin = useRef(new Animated.Value(0)).current;
  const pop = useRef(new Animated.Value(0)).current;

  const playingRef = useRef(false);
  const hideTimerRef = useRef(null);

  const safeIcons = useMemo(() => {
    const arr = Array.isArray(icons) ? icons.filter(Boolean) : [];
    return arr.length ? arr.slice(0, 8) : DEFAULT_ICONS; // garde ça raisonnable
  }, [icons]);

  useImperativeHandle(ref, () => ({
    play: () => {
      if (playingRef.current) {
        // si on rejoue rapidement, on relance proprement
        try {
          opacity.stopAnimation();
          spin.stopAnimation();
          pop.stopAnimation();
        } catch {}
      }

      playingRef.current = true;
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);

      setVisible(true);

      // reset anim values
      opacity.setValue(0);
      spin.setValue(0);
      pop.setValue(0);

      const total = clamp(durationMs, 220, 1400);

      Animated.parallel([
        // Fade in/out
        Animated.sequence([
          Animated.timing(opacity, {
            toValue: 1,
            duration: clamp(fadeInMs, 60, 220),
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.delay(Math.max(0, total - fadeInMs - fadeOutMs)),
          Animated.timing(opacity, {
            toValue: 0,
            duration: clamp(fadeOutMs, 90, 320),
            easing: Easing.in(Easing.quad),
            useNativeDriver: true,
          }),
        ]),

        // Rotation collective
        Animated.timing(spin, {
          toValue: 1,
          duration: total,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),

        // Petit "pop" (scale)
        Animated.sequence([
          Animated.timing(pop, {
            toValue: 1,
            duration: Math.round(total * 0.38),
            easing: Easing.out(Easing.back(2.2)),
            useNativeDriver: true,
          }),
          Animated.timing(pop, {
            toValue: 0,
            duration: Math.round(total * 0.62),
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ]),
      ]).start(({ finished }) => {
        playingRef.current = false;
        // on laisse le fade out finir et on cache
        hideTimerRef.current = setTimeout(() => {
          setVisible(false);
        }, 40);
      });
    },
  }));

  const spinDeg = spin.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", `${360 * rotations}deg`],
  });

  const scale = pop.interpolate({
    inputRange: [0, 1],
    outputRange: [0.85, 1.12],
  });

  if (!visible) return null;

  return (
    <View pointerEvents="none" style={[styles.overlay, style]}>
      {backdrop ? <View style={styles.backdrop} /> : null}

      <Animated.View
        style={[
          styles.centerWrap,
          {
            opacity,
            transform: [{ scale }],
          },
        ]}
      >
        {/* Group container qui tourne */}
        <Animated.View style={{ transform: [{ rotate: spinDeg }] }}>
          <View style={styles.ring}>
            {safeIcons.map((name, idx) => {
              // répartir les icônes uniformément
              const angle = (idx / safeIcons.length) * Math.PI * 2;
              const x = Math.cos(angle) * radius;
              const y = Math.sin(angle) * radius;

              // petite contre-rotation pour que les icônes restent "droites"
              // (si tu veux qu'elles tournent elles-mêmes, enlève ce bloc)
              const counterSpinDeg = spin.interpolate({
                inputRange: [0, 1],
                outputRange: ["0deg", `${-360 * rotations}deg`],
              });

              return (
                <Animated.View
                  key={`${name}-${idx}`}
                  style={[
                    styles.iconBubble,
                    {
                      transform: [
                        { translateX: x },
                        { translateY: y },
                        { rotate: counterSpinDeg },
                      ],
                    },
                  ]}
                >
                  <MaterialCommunityIcons name={name} size={size} color="#ffffff" />
                </Animated.View>
              );
            })}
          </View>
        </Animated.View>

        {/* Petit "flash" au centre */}
        <Animated.View
          style={[
            styles.centerPulse,
            {
              opacity: opacity.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 0.9],
              }),
              transform: [
                {
                  scale: pop.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.6, 1.0],
                  }),
                },
              ],
            },
          ]}
        />
      </Animated.View>
    </View>
  );
});

export default SportShotFeedback;

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 9999,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.10)",
  },
  centerWrap: {
    width: 140,
    height: 140,
    alignItems: "center",
    justifyContent: "center",
  },
  ring: {
    width: 140,
    height: 140,
    alignItems: "center",
    justifyContent: "center",
  },
  iconBubble: {
    position: "absolute",
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "rgba(17, 24, 39, 0.92)", // dark bubble
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
  },
  centerPulse: {
    position: "absolute",
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "rgba(239, 68, 68, 0.95)", // rouge Prophetik vibe
  },
});