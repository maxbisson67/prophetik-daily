// @src/nhl/nhlAssets.js

import React from 'react';
import { Image, View, Text } from 'react-native';

export const NHL_LOGOS = {
  ANA: require('../../assets/nhl-logos/ANA.png'),
  ARI: require('../../assets/nhl-logos/ARI.png'),
  BOS: require('../../assets/nhl-logos/BOS.png'),
  BUF: require('../../assets/nhl-logos/BUF.png'),
  CAR: require('../../assets/nhl-logos/CAR.png'),
  CBJ: require('../../assets/nhl-logos/CBJ.png'),
  CGY: require('../../assets/nhl-logos/CGY.png'),
  CHI: require('../../assets/nhl-logos/CHI.png'),
  COL: require('../../assets/nhl-logos/COL.png'),
  DAL: require('../../assets/nhl-logos/DAL.png'),
  DET: require('../../assets/nhl-logos/DET.png'),
  EDM: require('../../assets/nhl-logos/EDM.png'),
  FLA: require('../../assets/nhl-logos/FLA.png'),
  LAK: require('../../assets/nhl-logos/LAK.png'),
  MIN: require('../../assets/nhl-logos/MIN.png'),
  MTL: require('../../assets/nhl-logos/MTL.png'),
  NJD: require('../../assets/nhl-logos/NJD.png'),
  NSH: require('../../assets/nhl-logos/NSH.png'),
  NYI: require('../../assets/nhl-logos/NYI.png'),
  NYR: require('../../assets/nhl-logos/NYR.png'),
  OTT: require('../../assets/nhl-logos/OTT.png'),
  PHI: require('../../assets/nhl-logos/PHI.png'),
  PIT: require('../../assets/nhl-logos/PIT.png'),
  SEA: require('../../assets/nhl-logos/SEA.png'),
  SJS: require('../../assets/nhl-logos/SJS.png'),
  STL: require('../../assets/nhl-logos/STL.png'),
  TBL: require('../../assets/nhl-logos/TBL.png'),
  TOR: require('../../assets/nhl-logos/TOR.png'),
  UTA: require('../../assets/nhl-logos/UTA.png'),
  VAN: require('../../assets/nhl-logos/VAN.png'),
  VGK: require('../../assets/nhl-logos/VGK.png'),
  WPG: require('../../assets/nhl-logos/WPG.png'),
  WSH: require('../../assets/nhl-logos/WSH.png'),
};

export function getLocalTeamLogo(abbr) {
  if (!abbr) return null;
  const key = String(abbr).toUpperCase();
  return NHL_LOGOS[key] || null;
}

// Fallback visuel compact si le logo est manquant (dev)
export function TeamInitials({ abbr, size = 24, style }) {
  const A = (abbr || '').toUpperCase();
  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: '#eee',
          alignItems: 'center',
          justifyContent: 'center',
        },
        style,
      ]}
    >
      <Text style={{ fontSize: size * 0.42, fontWeight: '700' }}>{A}</Text>
    </View>
  );
}

// Composant pratique
export function TeamLogo({ abbr, size = 24, style }) {
  const src = getLocalTeamLogo(abbr);
  if (!src) return <TeamInitials abbr={abbr} size={size} style={style} />;
  return <Image source={src} style={[{ width: size, height: size }, style]} resizeMode="contain" />;
}