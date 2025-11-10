// app/(drawer)/defis/[defiId]/WinnerSurprise.js
import React, { useEffect, useState } from 'react';
import { View, Image, Text, Platform } from 'react-native';
import ConfettiCannon from 'react-native-confetti-cannon';
import LottieView from 'lottie-react-native';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Animated, { useSharedValue, withTiming, useAnimatedStyle, Easing } from 'react-native-reanimated';

const FIREWORKS_JSON = 'https://assets10.lottiefiles.com/packages/lf20_qp1q7mct.json';

export default function WinnerSurprise({
  defiId,
  show,                // bool: lancer l'animation ?
  avatarUri,           // image du gagnant
  onDone,              // callback à la fin
}) {
  const [playing, setPlaying] = useState(false);
  const savedKey = `celebrated:${defiId}`;

  // Anim couronne
  const crownY = useSharedValue(-120);
  const crownScale = useSharedValue(0.6);
  const fadeOut = useSharedValue(1);

  const crownStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: crownY.value },
      { scale: crownScale.value },
    ],
    opacity: fadeOut.value,
  }));

  useEffect(() => {
    (async () => {
      if (!show) return;
      const doneBefore = await AsyncStorage.getItem(savedKey);
      if (doneBefore) { onDone?.(); return; }

      setPlaying(true);

      // Haptique légère
      try { await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch {}

      // Couronne descend + petit rebond
      crownY.value = withTiming(16, { duration: 600, easing: Easing.out(Easing.cubic) }, () => {
        crownScale.value = withTiming(1.0, { duration: 260, easing: Easing.out(Easing.back(2)) });
      });

      // Fin douce (fade)
      setTimeout(() => {
        fadeOut.value = withTiming(0, { duration: 800, easing: Easing.inOut(Easing.quad) });
      }, 3200);

      // Arrêt complet après ~4,5 s
      setTimeout(async () => {
        try { await AsyncStorage.setItem(savedKey, '1'); } catch {}
        setPlaying(false);
        onDone?.();
      }, 4500);
    })();
  }, [show]);

  if (!playing) return null;

  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        inset: 0,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {/* 🎊 Confettis plus lents */}
      <ConfettiCannon
        count={Platform.select({ ios: 160, android: 120 })}
        origin={{ x: 0, y: 0 }}
        fadeOut
        autoStart
        explosionSpeed={550}
        fallSpeed={3000}
      />

      {/* 💥 Feux d’artifice Lottie */}
      <LottieView
        source={{ uri: FIREWORKS_JSON }}
        autoPlay
        loop
        style={{
          position: 'absolute',
          width: '120%',
          height: '120%',
          opacity: 0.6,
        }}
      />

      {/* 👑 Couronne + avatar */}
      <Animated.View style={[crownStyle, { alignItems: 'center', justifyContent: 'center' }]}>
        <View style={{ alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 64 }}>👑</Text>

          {avatarUri ? (
            <Image
              source={{ uri: avatarUri }}
              style={{
                width: 96,
                height: 96,
                borderRadius: 48,
                backgroundColor: '#eee',
                marginTop: 4,
              }}
            />
          ) : null}

          <View
            style={{
              marginTop: 12,
              paddingHorizontal: 14,
              paddingVertical: 8,
              borderRadius: 999,
              backgroundColor: 'rgba(0,0,0,0.75)',
            }}
          >
            <Text style={{ color: '#fff', fontWeight: '900', fontSize: 16 }}>Champion !</Text>
          </View>
        </View>
      </Animated.View>
    </View>
  );
}