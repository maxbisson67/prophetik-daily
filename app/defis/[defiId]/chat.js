import React, { useEffect, useState } from 'react';
import { View, TextInput, FlatList, Text, Image, TouchableOpacity } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useTheme } from '@src/theme/ThemeProvider';
import { useDefiChat } from '@src/defiChat/useDefiChat';

const AVATAR = require('@src/assets/avatar-placeholder.png');

export default function DefiChatScreen() {
  const { colors } = useTheme();
  const { defiId } = useLocalSearchParams();
  const { messages, send, busy, markRead } = useDefiChat(defiId);
  const [text, setText] = useState('');

  // Marquer lu quand on arrive sur l’écran
  useEffect(() => {
    markRead();
  }, [markRead]);

  return (
    <>
      <Stack.Screen options={{ title: 'Chat du défi' }} />
      <FlatList
        inverted
        data={messages}
        keyExtractor={(m) => m.id}
        renderItem={({ item }) => (
          <View style={{ flexDirection: 'row', padding: 8, gap: 8 }}>
            <Image source={item.photoURL ? { uri: item.photoURL } : AVATAR}
                   style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: colors.border }} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: '700', color: colors.text }}>
                {item.displayName || item.uid}
              </Text>
              <Text style={{ color: colors.text }}>{item.text}</Text>
            </View>
          </View>
        )}
        contentContainerStyle={{ padding: 12, backgroundColor: colors.card }}
      />
      <View style={{ flexDirection: 'row', padding: 8, gap: 8, borderTopWidth: 1, borderTopColor: colors.border }}>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="Écrire un message…"
          placeholderTextColor={colors.subtext}
          style={{ flex: 1, padding: 12, backgroundColor: colors.card2, color: colors.text, borderRadius: 10 }}
        />
        <TouchableOpacity
          onPress={() => { const t = text; setText(''); send(t); }}
          disabled={busy || !text.trim()}
          style={{
            paddingHorizontal: 14, justifyContent: 'center', borderRadius: 10,
            backgroundColor: busy || !text.trim() ? colors.border : colors.primary
          }}
        >
          <Text style={{ color: '#fff', fontWeight: '800' }}>Envoyer</Text>
        </TouchableOpacity>
      </View>
    </>
  );
}