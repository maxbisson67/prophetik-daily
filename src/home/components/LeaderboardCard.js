import React, { useMemo } from "react";
import { View, Text, ActivityIndicator, TouchableOpacity, Image } from "react-native";
import i18n from "@src/i18n/i18n";
import ProphetikIcons from "@src/ui/ProphetikIcons";
import { shortUid, withCacheBust } from "@src/home/homeUtils";

const AVATAR_PLACEHOLDER = require("@src/assets/avatar-placeholder.png");

export default function LeaderboardCard({
  colors,
  redDark = "#b91c1c",
  defaultGroupName,
  loadingHeader, // bool : season/tier/leaderboard/points loading
  defaultGroupPoints,
  leaderboardRows,
  publicProfiles, // map uid -> { displayName, avatarUrl, updatedAt }
  onOpenLeaderboard,
}) {
  const topRows = useMemo(() => (leaderboardRows || []).slice(0, 5), [leaderboardRows]);

  return (
    <View
      style={{
        padding: 12,
        borderWidth: 1,
        borderRadius: 12,
        backgroundColor: colors.card,
        borderColor: colors.border,
        elevation: 3,
        shadowColor: "#000",
        shadowOpacity: 0.08,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 3 },
      }}
    >
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <View style={{ flex: 1, paddingRight: 10 }}>
          <Text style={{ fontWeight: "900", fontSize: 16, color: colors.text }}>
            {i18n.t("home.leaderboardTitle", { defaultValue: "Classement" })}
          </Text>
          <Text style={{ marginTop: 2, color: colors.subtext }} numberOfLines={1}>
            {defaultGroupName}
          </Text>
        </View>

        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          {loadingHeader ? (
            <ActivityIndicator />
          ) : (
            <ProphetikIcons amount={Number(defaultGroupPoints || 0)} size="sm" iconPosition="after" />
          )}
        </View>
      </View>

      <View style={{ marginTop: 10, gap: 8 }}>
        {topRows.map((row, idx) => {
          const uid = String(row?.uid || row?.id || "");
          const prof = publicProfiles?.[uid] || {};
          const version = prof?.updatedAt?.toMillis?.() ? prof.updatedAt.toMillis() : 0;

          const avatarUri = prof?.avatarUrl ? withCacheBust(prof.avatarUrl, version) : null;
          const label = row?.displayName || prof?.displayName || shortUid(uid);

          return (
            <View
              key={row.id || uid || String(idx)}
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                paddingVertical: 6,
                borderBottomWidth: idx === 4 ? 0 : 1,
                borderColor: colors.border,
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                  flex: 1,
                  paddingRight: 10,
                }}
              >
                <Image
                  source={avatarUri ? { uri: avatarUri } : AVATAR_PLACEHOLDER}
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: 13,
                    backgroundColor: colors.border,
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}
                />

                <Text
                  style={{
                    color: colors.text,
                    fontWeight: idx === 0 ? "900" : "700",
                  }}
                  numberOfLines={1}
                >
                  {label}
                </Text>
              </View>

              <ProphetikIcons
                amount={Number(row?.points || 0)}
                size="sm"
                iconPosition="after"
              />
            </View>
          );
        })}

        <TouchableOpacity
          onPress={onOpenLeaderboard}
          style={{
            marginTop: 6,
            alignSelf: "flex-end",
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
          }}
        >
          <Text style={{ color: redDark, fontWeight: "900" }}>
            {i18n.t("home.viewLeaderboard", { defaultValue: "Classement détaillé" })}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}