// src/ui/SplashRingsAnimated.js
import React, { useEffect, useRef } from 'react';
import { View, Animated, Easing, Platform } from 'react-native';
import LogoP from './LogoP'; // ton logo P existant

function Ring({ size, color, duration = 1400, delay = 0, borderWidth = 2 }) {
  const scale = useRef(new Animated.Value(0.6)).current;
  const opacity = useRef(new Animated.Value(0.7)).current;

  useEffect(() => {
    const seq = Animated.sequence([
      Animated.delay(delay),
      Animated.parallel([
        Animated.timing(scale, {
          toValue: 1.12,
          duration,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      ]),
      // reset instantané pour boucler proprement
      Animated.timing(scale, { toValue: 0.6, duration: 0, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0.7, duration: 0, useNativeDriver: true }),
    ]);

    const loop = Animated.loop(seq);
    loop.start();
    return () => loop.stop();
  }, [delay, duration, opacity, scale]);

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth,
        borderColor: color,
        opacity,
        transform: [{ scale }],
      }}
    />
  );
}

export default function SplashRingsAnimated({
  size = 220,
  color = '#2F81F7',
  ringCount = 3,
  ringGap = 12,
}) {
  // backplate léger pour le contraste (très discret)
  const backplate = (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: 'rgba(255,255,255,0.06)',
      }}
    />
  );

  const rings = Array.from({ length: ringCount }).map((_, i) => (
    <Ring
      key={i}
      size={size - i * ringGap}
      color={color}
      duration={1400}
      delay={i * 350}
      borderWidth={2}
    />
  ));

  return (
    <View
      pointerEvents="none"
      style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}
    >
      {backplate}
      {rings}
      {/* Logo au centre */}
      <View style={{ alignItems: 'center', justifyContent: 'center' }}>
        <LogoP size={64} color="#fff" bg="#2F81F7" />
      </View>
    </View>
  );
}