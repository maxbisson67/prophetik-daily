import { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import i18n from "@src/i18n/i18n";
import { useAuth } from "@src/auth/SafeAuthProvider";
import { useGroupChat } from "@src/groupChat/useGroupChat";
import { useGroupUnreadCount } from "@src/groupChat/useGroupUnreadCount";
import GroupChatPanel from "@src/groupChat/GroupChatPanel";
import usePublicProfilesFor from "@src/leaderboard/hooks/usePublicProfilesFor";

export default function GroupChatSection({ groupId, groupName, colors, onInputFocus }) {
  const { user } = useAuth();
  const [collapsed, setCollapsed] = useState(true);

  const { messages, send, busy, markRead, canSend } = useGroupChat(groupId, {
    pageSize: 50,
  });
  const unread = useGroupUnreadCount(groupId, user?.uid);

  const messageUids = useMemo(
    () => Array.from(new Set(messages.map((m) => m.uid).filter(Boolean))),
    [messages]
  );
  const profiles = usePublicProfilesFor(messageUids);

  const { namesMap, participantInfoMap } = useMemo(() => {
    const names = {};
    const info = {};
    for (const [uid, p] of Object.entries(profiles || {})) {
      if (p?.displayName) names[uid] = p.displayName;
      info[uid] = {
        photoURL: p?.avatarUrl || p?.jerseyFrontUrl || null,
        jerseyFrontUrl: p?.jerseyFrontUrl || null,
        jerseyBackUrl: p?.jerseyBackUrl || null,
        avatarKind: p?.avatarKind || null,
        version: p?.updatedAt?.toMillis?.() ? p.updatedAt.toMillis() : undefined,
      };
    }
    return { namesMap: names, participantInfoMap: info };
  }, [profiles]);

  useFocusEffect(
    useCallback(() => {
      if (!collapsed && groupId) markRead();
    }, [collapsed, groupId, markRead])
  );

  useEffect(() => {
    if (!collapsed && groupId) markRead();
  }, [collapsed, groupId, markRead, messages.length]);

  const toggle = useCallback(() => {
    setCollapsed((v) => {
      const next = !v;
      if (!next && groupId) markRead();
      return next;
    });
  }, [groupId, markRead]);

  if (!groupId) return null;

  return (
    <View style={{ overflow: "hidden" }}>
      <TouchableOpacity
        onPress={toggle}
        style={{
          paddingHorizontal: 12,
          paddingVertical: 10,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}>
          <Ionicons name="chatbubble-ellipses" size={16} color={colors.text} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontWeight: "800", color: colors.text }}>
              {i18n.t("home.groupChatTitle", { defaultValue: "Chat du groupe" })}
            </Text>
            {groupName ? (
              <Text style={{ color: colors.subtext, fontSize: 12, marginTop: 2 }} numberOfLines={1}>
                {groupName}
              </Text>
            ) : null}
          </View>
          <Text style={{ color: colors.subtext, fontSize: 12 }}>
            {i18n.t("defi.results.chat.count", {
              count: messages.length,
              defaultValue: "{{count}} messages",
            })}
          </Text>
          {unread > 0 ? (
            <View
              style={{
                minWidth: 18,
                height: 18,
                borderRadius: 9,
                backgroundColor: "#ef4444",
                alignItems: "center",
                justifyContent: "center",
                paddingHorizontal: 4,
              }}
            >
              <Text style={{ color: "#fff", fontSize: 11, fontWeight: "800" }}>
                {unread > 99 ? "99+" : unread}
              </Text>
            </View>
          ) : null}
        </View>
        <Ionicons
          name={collapsed ? "chevron-down" : "chevron-up"}
          size={18}
          color={colors.text}
          style={{ marginLeft: 8 }}
        />
      </TouchableOpacity>

      {!collapsed ? (
        <GroupChatPanel
          colors={colors}
          messages={messages}
          busy={busy}
          onSend={send}
          canSend={canSend}
          namesMap={namesMap}
          participantInfoMap={participantInfoMap}
          onInputFocus={onInputFocus}
        />
      ) : null}
    </View>
  );
}
