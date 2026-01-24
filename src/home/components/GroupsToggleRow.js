// src/home/components/GroupsToggleRow.js
import React, { useMemo, useState } from "react";
import { View, Text, TouchableOpacity, Image } from "react-native";
import { Feather } from "@expo/vector-icons";
import { withCacheBust } from "@src/home/homeUtils";

const AVATAR_PLACEHOLDER = require("../../../assets/avatar-placeholder.png");

export default function GroupsToggleRow({
  colors,
  groups = [], // [{ id, name, avatarUrl }]
  value,       // currentGroupId
  onChange,    // (groupId) => void
}) {
  const [open, setOpen] = useState(false);

  const selected = useMemo(
    () => groups.find((g) => String(g.id) === String(value)) || groups[0] || null,
    [groups, value]
  );

  if (!groups?.length) return null;

  return (
    <View style={{ marginTop: 10 }}>
      {/* Ligne compacte */}
      <TouchableOpacity
        onPress={() => setOpen((v) => !v)}
        activeOpacity={0.85}
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingVertical: 10,
          paddingHorizontal: 12,
          borderRadius: 12,
          borderWidth: 3,
          borderColor: colors.border,
          backgroundColor: colors.card2,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1, paddingRight: 10 }}>
          <Image
            source={
              selected?.avatarUrl
                ? { uri: withCacheBust(selected.avatarUrl) }
                : AVATAR_PLACEHOLDER
            }
            style={{ width: 26, height: 26, borderRadius: 999, backgroundColor: colors.card }}
          />
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.subtext, fontSize: 11, fontWeight: "800" }}>
              Groupe
            </Text>
            <Text numberOfLines={1} style={{ color: colors.text, fontSize: 14, fontWeight: "900" }}>
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
                      // 🔴 bordure rouge fine
                  borderWidth: 1,
                  borderColor: "rgba(185, 28, 28, 0.55)", // #b91c1c avec opacité

   
                  backgroundColor: active ? colors.card2 : colors.card,
                }}
              >
                <Image
                  source={g.avatarUrl ? { uri: withCacheBust(g.avatarUrl) } : AVATAR_PLACEHOLDER}
                  style={{ width: 28, height: 28, borderRadius: 999, backgroundColor: colors.card2 }}
                />

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