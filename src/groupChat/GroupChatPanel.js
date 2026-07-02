import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Image,
} from "react-native";
import i18n from "@src/i18n/i18n";

const AVATAR_PLACEHOLDER = require("@src/assets/avatar-placeholder.png");

function withCacheBust(url, tsMillis) {
  if (!url) return null;
  const v = Number.isFinite(tsMillis) ? tsMillis : Date.now();
  return url.includes("?") ? `${url}&_cb=${v}` : `${url}?_cb=${v}`;
}

export default function GroupChatPanel({
  colors,
  messages,
  onSend,
  busy,
  canSend,
  namesMap = {},
  participantInfoMap = {},
  maxHeight = 360,
  onInputFocus,
}) {
  const [text, setText] = useState("");
  const INPUT_BAR_HEIGHT = 56;

  const data = useMemo(() => {
    const millis = (v) =>
      v?.toMillis?.()
        ? v.toMillis()
        : v?.toDate?.()
          ? v.toDate().getTime()
          : typeof v === "number"
            ? v
            : 0;
    return [...messages].sort((a, b) => millis(a?.createdAt) - millis(b?.createdAt));
  }, [messages]);

  const scrollRef = useRef(null);
  const atBottomRef = useRef(true);
  const [autoStick, setAutoStick] = useState(true);

  const handleScroll = useCallback((e) => {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    const dist = contentSize.height - (contentOffset.y + layoutMeasurement.height);
    const next = dist < 80;
    if (atBottomRef.current !== next) {
      atBottomRef.current = next;
      setAutoStick(next);
    }
  }, []);

  const scrollToEnd = useCallback((animated = true) => {
    scrollRef.current?.scrollToEnd?.({ animated });
  }, []);

  const handleContentSizeChange = useCallback(() => {
    if (autoStick) requestAnimationFrame(() => scrollToEnd(true));
  }, [autoStick, scrollToEnd]);

  const submit = useCallback(() => {
    const t = text.trim();
    if (!t || busy || !canSend) return;
    setText("");
    onSend(t);
    requestAnimationFrame(() => scrollToEnd(true));
  }, [text, busy, canSend, onSend, scrollToEnd]);

  return (
    <View
      style={{
        borderTopWidth: 1,
        borderTopColor: colors.border,
        backgroundColor: colors.card,
      }}
    >
      <View style={{ height: maxHeight - INPUT_BAR_HEIGHT }}>
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={{ padding: 12 }}
          keyboardShouldPersistTaps="always"
          keyboardDismissMode="interactive"
          nestedScrollEnabled
          showsVerticalScrollIndicator
          onScroll={handleScroll}
          onContentSizeChange={handleContentSizeChange}
          scrollEventThrottle={16}
        >
          {data.length === 0 ? (
            <Text style={{ color: colors.subtext }}>
              {i18n.t("defi.results.chat.empty", { defaultValue: "Aucun message." })}
            </Text>
          ) : (
            <View>
              {data.map((item) => {
                if (!item || typeof item !== "object") return null;

                const uid = String(item.uid || "");
                const name = namesMap?.[uid] || item.displayName || uid;
                const info = participantInfoMap?.[uid] || {};
                const uri = info.photoURL
                  ? withCacheBust(info.photoURL, info.version)
                  : item.photoURL || null;
                const imgKey = `${uid}:${info.version || item._ver || 0}`;

                return (
                  <View key={item.id} style={{ marginBottom: 10 }}>
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        marginBottom: 2,
                      }}
                    >
                      <Image
                        key={imgKey}
                        source={uri ? { uri } : AVATAR_PLACEHOLDER}
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: 12,
                          backgroundColor: colors.border,
                          marginRight: 6,
                        }}
                      />
                      <Text style={{ fontWeight: "700", color: colors.text }}>{name}</Text>
                    </View>
                    <Text style={{ color: colors.text }}>{String(item.text ?? "")}</Text>
                  </View>
                );
              })}
            </View>
          )}
        </ScrollView>
      </View>

      <View
        style={{
          flexDirection: "row",
          padding: 8,
          gap: 8,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          height: INPUT_BAR_HEIGHT,
          backgroundColor: colors.card,
        }}
      >
        <TextInput
          value={text}
          onChangeText={setText}
          onFocus={() => {
            onInputFocus?.();
            requestAnimationFrame(() => scrollToEnd(true));
          }}
          placeholder={i18n.t("defi.results.chat.inputPlaceholder", {
            defaultValue: "Écrire un message…",
          })}
          placeholderTextColor={colors.subtext}
          style={{
            flex: 1,
            padding: 12,
            backgroundColor: colors.card2,
            color: colors.text,
            borderRadius: 10,
          }}
          textAlignVertical="center"
          returnKeyType="send"
          underlineColorAndroid="transparent"
          onSubmitEditing={submit}
        />
        <TouchableOpacity
          onPress={submit}
          disabled={busy || !text.trim() || !canSend}
          style={{
            paddingHorizontal: 14,
            justifyContent: "center",
            borderRadius: 10,
            backgroundColor: busy || !text.trim() || !canSend ? colors.border : colors.primary,
          }}
        >
          <Text style={{ color: "#fff", fontWeight: "800" }}>
            {i18n.t("defi.results.chat.send", { defaultValue: "Envoyer" })}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
