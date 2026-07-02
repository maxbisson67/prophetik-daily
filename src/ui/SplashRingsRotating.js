import React, { useEffect, useRef, useState } from 'react';
import { View, Animated, Easing, Text, Image } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Svg, { Defs, LinearGradient, Stop, Circle } from 'react-native-svg';
const logoPImg = require('@src/assets/logoP.png');

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const LOGO_LETTER_MS = 100; // ~0,9 s pour « Prophetik » (9 lettres)
const RING_ROTATION_MS = 2800;
const ORBIT_ICON_SIZE = 28;

function OrbitSportIcon({ center, radius, speed, startDeg, icon, color, t }) {
  const spin = t.interpolate({
    inputRange: [0, 1],
    outputRange: [`${startDeg}deg`, `${startDeg + 360 * speed}deg`],
  });
  const upright = t.interpolate({
    inputRange: [0, 1],
    outputRange: [`${-startDeg}deg`, `${-(startDeg + 360 * speed)}deg`],
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: center,
        top: center,
        width: 0,
        height: 0,
        transform: [{ rotate: spin }],
      }}
    >
      <Animated.View
        style={{
          position: 'absolute',
          left: radius - ORBIT_ICON_SIZE / 2,
          top: -ORBIT_ICON_SIZE / 2,
          width: ORBIT_ICON_SIZE,
          height: ORBIT_ICON_SIZE,
          alignItems: 'center',
          justifyContent: 'center',
          transform: [{ rotate: upright }],
        }}
      >
        <View
          style={{
            position: 'absolute',
            width: ORBIT_ICON_SIZE + 8,
            height: ORBIT_ICON_SIZE + 8,
            borderRadius: (ORBIT_ICON_SIZE + 8) / 2,
            backgroundColor: '#fff',
            shadowColor: '#000',
            shadowOpacity: 0.12,
            shadowRadius: 3,
            shadowOffset: { width: 0, height: 1 },
            elevation: 2,
          }}
        />
        <MaterialCommunityIcons name={icon} size={ORBIT_ICON_SIZE} color={color} />
      </Animated.View>
    </Animated.View>
  );
}

export default function SplashRingsRotating({
  size = 260,
  color = '#000',
  rings = 2,
  arcPct = 0.88,
  glow = false,
  logoSize = 64,
}) {
  const r = size / 2;
  const t = useRef(new Animated.Value(0)).current;

  /* ---------- Animation rotation des anneaux ---------- */
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(t, { toValue: 1, duration: RING_ROTATION_MS, easing: Easing.linear, useNativeDriver: true })
    );
    loop.start();
    return () => loop.stop();
  }, [t]);

  /* ---------- Animation texte "Prophetik" lettre par lettre ---------- */
  const [displayText, setDisplayText] = useState('');
  const fullText = 'Prophetik';

  useEffect(() => {
    let i = 0;
    const timer = setInterval(() => {
      setDisplayText(fullText.slice(0, i + 1));
      i++;
      if (i >= fullText.length) clearInterval(timer);
    }, LOGO_LETTER_MS);
    return () => clearInterval(timer);
  }, []);

  const ringThickness = 4;
  const innerPadding = 20;
  const outerPadding = 10;
  const ringGap = 17;

  const minRadius = logoSize / 2 + innerPadding + ringThickness / 2;
  const maxRadius = r - outerPadding - ringThickness / 2;
  const ringsCount = Math.max(1, rings | 0);
  const available = Math.max(0, maxRadius - minRadius);
  const step = ringsCount > 1 ? Math.min(ringGap, available / (ringsCount - 1)) : 0;
  const radii = Array.from({ length: ringsCount }, (_, i) => minRadius + i * step);
  const widths = new Array(radii.length).fill(ringThickness);
  const speeds = [+0.55, -0.65, +0.75, -0.85, +0.95].slice(0, radii.length);

  const dash = (radius) => {
    const C = 2 * Math.PI * radius;
    return [C * arcPct, C * (1 - arcPct)];
  };
  const dashOffset = (radius, factor) => {
    const C = 2 * Math.PI * radius;
    return t.interpolate({ inputRange: [0, 1], outputRange: [0, C * factor] });
  };

  return (
    <View
      pointerEvents="none"
      style={{
        width: size,
        height: size,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#fff',
        borderRadius: r,
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {glow && (
        <View
          style={{
            position: 'absolute',
            width: size * 1.35,
            height: size * 1.35,
            borderRadius: (size * 1.35) / 2,
            backgroundColor: '#0b1d33',
            opacity: 0.25,
          }}
        />
      )}

      {/* === Titre Prophetik animé === */}
      <View
        style={{
          position: 'absolute',
          top: 18,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text
          style={{
            fontSize: 22,
            fontWeight: '900',
            letterSpacing: 2,
            color: '#111',
          }}
        >
          {displayText}
        </Text>
      </View>

      {/* === Anneaux === */}
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Defs>
          <LinearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0%" stopColor={color} />
            <Stop offset="100%" stopColor={color} />
          </LinearGradient>
        </Defs>

        {radii.map((rad, i) => (
          <AnimatedCircle
            key={i}
            cx={r}
            cy={r}
            r={rad}
            stroke="url(#ringGrad)"
            strokeWidth={widths[i]}
            fill="none"
            strokeDasharray={dash(rad)}
            strokeDashoffset={dashOffset(rad, speeds[i])}
            strokeLinecap="round"
            opacity={0.95 - i * 0.12}
          />
        ))}
      </Svg>

      {/* Balle + rondelle en orbite, synchronisées avec les anneaux */}
      {radii[0] != null ? (
        <OrbitSportIcon
          center={r}
          radius={radii[0]}
          speed={speeds[0]}
          startDeg={28}
          icon="baseball"
          color="#b91c1c"
          t={t}
        />
      ) : null}
      {radii[1] != null ? (
        <OrbitSportIcon
          center={r}
          radius={radii[1]}
          speed={speeds[1]}
          startDeg={210}
          icon="hockey-puck"
          color="#111"
          t={t}
        />
      ) : null}

      {/* === Logo P centré et ajusté === */}
      <View
        style={{
          position: 'absolute',
          alignItems: 'center',
          justifyContent: 'center',
          transform: [{ translateX: 4 }, { translateY: -2 }],
        }}
      >
        <Image
          source={logoPImg}
          style={{
            width: logoSize * 0.875, // ≈ 56 si logoSize=64
            height: logoSize * 0.875,
            resizeMode: 'contain',
          }}
        />
      </View>
    </View>
  );
}