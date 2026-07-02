import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import {
  getFirestoreListenStats,
  resetFirestoreListenStats,
} from "@src/lib/firestoreListenRegistry";
import useFocusedTabRouteName from "@src/navigation/useFocusedTabRouteName";

export default function FirestoreListenStats() {
  const [stats, setStats] = useState(getFirestoreListenStats());
  const [expanded, setExpanded] = useState(false);
  const focusedTab = useFocusedTabRouteName();

  useEffect(() => {
    const id = setInterval(() => setStats(getFirestoreListenStats()), 2000);
    return () => clearInterval(id);
  }, []);

  if (!__DEV__) return null;

  const topTags = Object.entries(stats.byTag || {}).slice(0, 4);

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: "absolute",
        bottom: 88,
        right: 8,
        zIndex: 9999,
        maxWidth: 220,
      }}
    >
      <TouchableOpacity
        onPress={() => setExpanded((v) => !v)}
        activeOpacity={0.85}
        style={{
          backgroundColor: "rgba(17,24,39,0.92)",
          borderRadius: 10,
          paddingHorizontal: 10,
          paddingVertical: 8,
        }}
      >
        <Text style={{ color: "#f9fafb", fontWeight: "900", fontSize: 11 }}>
          FS listeners: {stats.activeListeners}
        </Text>
        <Text style={{ color: "#d1d5db", fontSize: 10, marginTop: 2 }}>
          reads≈{stats.estimatedDocumentReads} · snaps={stats.snapshotEvents}
        </Text>
        {focusedTab ? (
          <Text style={{ color: "#9ca3af", fontSize: 9, marginTop: 2 }}>
            tab={focusedTab}
          </Text>
        ) : null}
      </TouchableOpacity>

      {expanded ? (
        <View
          style={{
            marginTop: 6,
            backgroundColor: "rgba(17,24,39,0.95)",
            borderRadius: 10,
            padding: 10,
            gap: 4,
          }}
        >
          {topTags.map(([tag, count]) => (
            <Text key={tag} style={{ color: "#e5e7eb", fontSize: 10 }}>
              {tag}: {count}
            </Text>
          ))}

          <TouchableOpacity
            onPress={() => {
              resetFirestoreListenStats();
              setStats(getFirestoreListenStats());
            }}
            style={{ marginTop: 6 }}
          >
            <Text style={{ color: "#fca5a5", fontWeight: "800", fontSize: 10 }}>
              Reset compteur
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
}
