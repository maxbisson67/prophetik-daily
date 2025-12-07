// app/(drawer)/defis/[defiId]/chat.js (par exemple)
import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  TextInput,
  FlatList,
  Text,
  Image,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useTheme } from '@src/theme/ThemeProvider';
import { useDefiChat } from '@src/defiChat/useDefiChat';
import i18n from '@src/i18n/i18n';

const AVATAR = require('@src/assets/avatar-placeholder.png');

export default function DefiChatScreen() {
  const { colors } = useTheme();
  const { defiId } = useLocalSearchParams();
  const { messages, send, busy, markRead } = useDefiChat(defiId);
  const [text, setText] = useState('');

  // Marquer lu quand on arrive sur l’écran (et quand defiId change)
  useEffect(() => {
    if (defiId) markRead();
  }, [defiId, markRead]);

  const handleSend = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    setText('');
    send(trimmed);
  }, [text, busy, send]);

  return (
    <>
      <Stack.Screen
        options={{
          title: i18n.t('defi.results.chat.title'),
        }}
      />

      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: colors.background }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
      >
        {/* Liste des messages */}
        <FlatList
          style={{ flex: 1 }}
          inverted
          data={messages}
          keyExtractor={(m) => m.id}
          keyboardShouldPersistTaps="always"
          contentContainerStyle={{
            padding: 12,
            backgroundColor: colors.card,
          }}
          ListEmptyComponent={
            <Text
              style={{
                textAlign: 'center',
                color: colors.subtext,
                marginVertical: 16,
              }}
            >
              {i18n.t('defi.results.chat.empty')}
            </Text>
          }
          renderItem={({ item }) => (
            <View
              style={{
                flexDirection: 'row',
                paddingVertical: 6,
                paddingHorizontal: 4,
                gap: 8,
              }}
            >
              <Image
                source={item.photoURL ? { uri: item.photoURL } : AVATAR}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  backgroundColor: colors.border,
                }}
              />
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontWeight: '700',
                    color: colors.text,
                    marginBottom: 2,
                  }}
                >
                  {item.displayName || item.uid}
                </Text>
                <Text style={{ color: colors.text }}>
                  {String(item.text ?? '')}
                </Text>
              </View>
            </View>
          )}
        />

        {/* Barre d’entrée */}
        <View
          style={{
            flexDirection: 'row',
            padding: 8,
            gap: 8,
            borderTopWidth: 1,
            borderTopColor: colors.border,
            backgroundColor: colors.card,
          }}
        >
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder={i18n.t('defi.results.chat.inputPlaceholder')}
            placeholderTextColor={colors.subtext}
            style={{
              flex: 1,
              padding: 12,
              backgroundColor: colors.card2,
              color: colors.text,
              borderRadius: 10,
            }}
            returnKeyType="send"
            onSubmitEditing={handleSend}
          />
          <TouchableOpacity
            onPress={handleSend}
            disabled={busy || !text.trim()}
            style={{
              paddingHorizontal: 14,
              justifyContent: 'center',
              borderRadius: 10,
              backgroundColor:
                busy || !text.trim() ? colors.border : colors.primary,
            }}
          >
            <Text
              style={{
                color: '#fff',
                fontWeight: '800',
              }}
            >
              {i18n.t('defi.results.chat.send')}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </>
  );
}