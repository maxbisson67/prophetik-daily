// src/leaderboard/LeaderboardPaywallCard.js
import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export default function LeaderboardPaywallCard({ colors, title, body, cta, onPress }) {
  return (
    <View style={{ flex: 1, padding: 16, backgroundColor: colors.background }}>
      <View
        style={{
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 12,
          padding: 14,
          backgroundColor: colors.card,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <MaterialCommunityIcons name="lock-outline" size={20} color={colors.subtext} />
          <Text style={{ color: colors.text, fontWeight: '900', fontSize: 16, flex: 1 }}>
            {title}
          </Text>
        </View>

        <Text style={{ marginTop: 8, color: colors.subtext }}>{body}</Text>

        <TouchableOpacity
          onPress={onPress}
          activeOpacity={0.85}
          style={{
            marginTop: 12,
            backgroundColor: colors.primary,
            paddingVertical: 10,
            borderRadius: 10,
            alignItems: 'center',
          }}
        >
          <Text style={{ color: '#fff', fontWeight: '900' }}>{cta}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}