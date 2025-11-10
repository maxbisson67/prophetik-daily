// src/components/GroupMembersList.js
import React from "react";
import { View, Text, Image, FlatList } from "react-native";
import useGroupMembers from "@src/groups/useGroupMembers"; // <-- IMPORTANT

const FALLBACK_AVATAR =
  "https://ui-avatars.com/api/?name=User&background=EEE&color=555&bold=true";

function Row({ m }) {
  const avatar = m.avatarUrl || FALLBACK_AVATAR;
  const roleLabel =
    m.role === "owner"
      ? "Propriétaire"
      : m.role === "admin"
      ? "Admin"
      : "Membre";

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 10,
        paddingHorizontal: 12,
      }}
    >
      {/* Avatar */}
      <Image
        source={{ uri: avatar }}
        style={{
          width: 40,
          height: 40,
          borderRadius: 999,
          marginRight: 12,
          backgroundColor: "#ddd",
        }}
      />

      {/* Nom */}
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 16, fontWeight: "600" }}>{m.name}</Text>
      </View>

      {/* Rôle aligné à droite */}
      <View style={{ alignItems: "flex-end", minWidth: 90 }}>
        <Text
          style={{
            fontSize: 13,
            color: m.role === "owner" ? "#0A84FF" : "#666",
            fontWeight: m.role === "owner" ? "700" : "500",
          }}
        >
          {roleLabel}
        </Text>
      </View>
    </View>
  );
}

export default function GroupMembersList(props) {
  const {
    groupId,
    header,
    footer,
    nonVirtualized = false, // si tu gardes un ScrollView parent
    ...rest
  } = props;

  const { members, loading, error } = useGroupMembers(groupId);

  if (loading) return <Text style={{ padding: 12 }}>Chargement…</Text>;
  if (error) return <Text style={{ padding: 12, color: "red" }}>{String(error?.message || error)}</Text>;
  if (!members.length) return <Text style={{ padding: 12 }}>Aucun membre.</Text>;

  if (nonVirtualized) {
    // Pour éviter l’imbrication de VirtualizedList si parent = ScrollView
    return (
      <View style={{ paddingVertical: 8 }}>
        {header || null}
        {members.map((m) => (
          <View key={m.id}>
            <Row m={m} />
            <View style={{ height: 1, backgroundColor: "#eee" }} />
          </View>
        ))}
        {footer || null}
      </View>
    );
  }

  // Version virtualisée (idéale si le parent n'est PAS un ScrollView)
  return (
    <FlatList
      data={members}
      keyExtractor={(m) => m.id}
      renderItem={({ item }) => <Row m={item} />}
      ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: "#eee" }} />}
      contentContainerStyle={{ paddingVertical: 8 }}
      ListHeaderComponent={header ?? null}
      ListFooterComponent={footer ?? null}
      {...rest}
    />
  );
}