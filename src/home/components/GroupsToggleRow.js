// src/home/components/GroupsToggleRow.js
import React, { useMemo, useState } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Feather } from "@expo/vector-icons";
import GroupAvatar from "@src/groups/components/GroupAvatar";
import i18n from "@src/i18n/i18n";

export default function GroupsToggleRow({
  colors,
  groups = [], // [{ id, name, avatarUrl, favoriteTeam }]
  value,       // currentGroupId
  onChange,    // (groupId) => void
  hintKey = "home.selectGroupLabel",
  compact = false,
}) {
  const [open, setOpen] = useState(false);

  const selected = useMemo(
    () => groups.find((g) => String(g.id) === String(value)) || groups[0] || null,
    [groups, value]
  );

  if (!groups?.length) return null;

  return (
    <View style={{ marginTop: compact ? 0 : 12, marginBottom: compact ? 12 : 0 }}>
      <TouchableOpacity
        onPress={() => setOpen((v) => !v)}
        activeOpacity={0.85}
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingVertical: compact ? 12 : 10,
          paddingHorizontal: 12,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.card2,
          minHeight: 44,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1, paddingRight: 10 }}>
          <GroupAvatar group={selected} size={compact ? 28 : 26} colors={colors} />
          <View style={{ flex: 1 }}>
            {!compact ? (
              <Text style={{ color: colors.subtext, fontSize: 11, fontWeight: "800" }}>
                {i18n.t(hintKey, {
                  defaultValue: "Sélectionne un groupe",
                })}
              </Text>
            ) : null}
            <Text
              numberOfLines={1}
              style={{
                color: colors.text,
                fontSize: compact ? 16 : 14,
                fontWeight: "900",
                marginTop: compact ? 0 : 2,
              }}
            >
              {selected?.name || selected?.id || "—"}
            </Text>
          </View>
        </View>

        <Feather name={open ? "chevron-up" : "chevron-down"} size={18} color={colors.subtext} />
      </TouchableOpacity>

      {/* Dropdown */}
      {open ? (
        <View
          style={{
            marginTop: 8,
            borderWidth: 2,
            borderColor: colors.border,
            borderRadius: 12,
            overflow: "hidden",
            backgroundColor: colors.card,
          }}
        >
          {groups.map((g) => {
            const active = String(g.id) === String(value);

            return (
              <TouchableOpacity
                key={g.id}
                onPress={() => {
                  onChange?.(g.id);
                  setOpen(false);
                }}
                activeOpacity={0.85}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 10,
                  paddingVertical: 12,
                  paddingHorizontal: 12,
                  borderTopWidth: 1,
                  borderTopColor: colors.border,
                  backgroundColor: active ? colors.card2 : colors.card,
                  minHeight: 44,
                }}
              >
                <GroupAvatar group={g} size={28} colors={colors} />

                <Text
                  numberOfLines={1}
                  style={{
                    flex: 1,
                    color: colors.text,
                    fontWeight: active ? "900" : "700",
                    fontSize: 14,
                  }}
                >
                  {g.name || g.id}
                </Text>

                {active ? <Text style={{ fontSize: 14 }}>✅</Text> : null}
              </TouchableOpacity>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}