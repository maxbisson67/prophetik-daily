// src/ui/LogoP.js
import React from 'react';
import Svg, { Circle, Path, G } from 'react-native-svg';

export default function LogoP({ size = 120, variant = 'badge', color = '#2563eb' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 1000 1000">
      {variant === 'badge' && (
        <Circle cx={500} cy={500} r={500} fill={color} />
      )}

      <G fill={variant === 'badge' ? '#ffffff' : color}>
        {/* Tige du P */}
        <Path d="M300 200 L420 200 L420 800 L300 800 Z" />

        {/* Boucle du P */}
        <Path d="M420 200 L560 200 C740 200, 740 420, 560 420 L420 420 Z" />

        {/* Trou intérieur */}
        <Path
          d="M500 280 C620 280, 620 340, 500 340 L420 340 L420 280 Z"
          fill={variant === 'badge' ? '#2563eb' : 'transparent'}
        />
      </G>
    </Svg>
  );
}