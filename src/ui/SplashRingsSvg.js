// src/ui/SplashRingsSvg.js
import React, { useEffect, useRef } from 'react';
import { View, Animated, Easing } from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Circle, Path } from 'react-native-svg';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const P_PATH =
  'M110 45c22 0 40 18 40 40 0 22-18 40-40 40H85v60h-20V45h45zm0 60c11 0 20-9 20-20s-9-20-20-20H85v40h25z';

export default function SplashRingsSvg({
  size = 260,
  bg = '#ffffff',        // white background
   glow = false,          // no blue glow by default
   color1 = '#ff3b30',    // red gradient
   color2 = '#b00020',
}) {
  const r = size / 2;

  // radii (outer -> inner) and stroke widths
  const radii  = [r - 8, r - 26, r - 44, r - 62, r - 80];
  const widths = [3, 3, 3, 3, 3];

  // base animated driver 0..1
  const t = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(t, {
        toValue: 1,
        duration: 2600,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [t]);

  // subtle “breathing”
  const pulse = t.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.985, 1.0, 0.985],
  });

  // 90% arc per ring
  const arcDash = (radius) => {
    const C = 2 * Math.PI * radius;
    return [C * 0.9, C * 0.1];
  };

  // dash offset anim per ring (alternate directions + different speeds)
  const speedFactors = [+0.8, -1.0, +1.25, -1.5, +1.9];
  const dashOffsetFor = (radius, factor) => {
    const C = 2 * Math.PI * radius;
    return t.interpolate({
      inputRange: [0, 1],
      outputRange: [0, C * factor],
    });
  };

  // “P” placement (designed for 200x200)
  const pScale = (size * 0.40) / 200;
  const pTx = r - (200 * pScale) / 2;
  const pTy = r - (200 * pScale) / 2;

  return (
    <View
      pointerEvents="none"
      style={{
        width: size,
        height: size,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: bg,
        borderRadius: r,
        overflow: 'hidden',
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
            opacity: 0.35,
          }}
        />
      )}

      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Defs>
          <LinearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0%" stopColor={color1} />
            <Stop offset="100%" stopColor={color2} />
          </LinearGradient>
          <LinearGradient id="pGrad" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0%" stopColor={color1} />
            <Stop offset="100%" stopColor={color2} />
          </LinearGradient>
        </Defs>

        {/* Rings (stationary, animated dash offset) */}
        {radii.map((rad, i) => {
          const dash = arcDash(rad);
          return (
            <AnimatedCircle
              key={i}
              cx={r}
              cy={r}
              r={rad}
              stroke="url(#ringGrad)"
              strokeWidth={widths[i]}
              fill="none"
              strokeDasharray={dash}
              strokeDashoffset={dashOffsetFor(rad, speedFactors[i])}
              strokeLinecap="round"
              opacity={0.92 - i * 0.10}
            />
          );
        })}

        {/* Central P */}
        <Path
          d={P_PATH}
          fill="url(#pGrad)"
          transform={`translate(${pTx}, ${pTy}) scale(${pScale})`}
          opacity={0.98}
        />
      </Svg>
    </View>
  );
}