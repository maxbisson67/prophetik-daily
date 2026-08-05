import React, { useMemo } from "react";
import { View, Text, ActivityIndicator } from "react-native";

import i18n from "@src/i18n/i18n";
import { countTpPickStatsForEntry } from "@src/defis/tpBundleDisplayHelpers";

function entryDisplayName(entry) {
  return entry?.displayName || entry?.name || String(entry?.uid || "").slice(0, 6);
}

function entryTotalPoints(entry) {
  return Number(entry?.totalPoints ?? 0) || 0;
}

export default function TpParticipantsList({
  bundle = {},
  entries = [],
  loading = false,
  currentUid = "",
  colors,
  title = null,
}) {
  const uid = String(currentUid || "");
  const gameCount = Number(bundle?.gameCount || bundle?.games?.length || 0);

  const sorted = useMemo(() => {
    return [...entries].sort((a, b) => {
      const diff = entryTotalPoints(b) - entryTotalPoints(a);
      if (diff !== 0) return diff;
      return entryDisplayName(a).localeCompare(entryDisplayName(b));
    });
  }, [entries]);

  return (
    <View style={{ marginTop: 12 }}>
      <Text style={{ color: colors.text, fontWeight: "800", marginBottom: 8 }}>
        {title ||
          i18n.t("firstGoal.live.picksTitle", { defaultValue: "Participants & choix" })}
        {!loading && sorted.length > 0 ? ` (${sorted.length})` : ""}
      </Text>

      {loading ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <ActivityIndicator size="small" color={colors.subtext} />
          <Text style={{ color: colors.subtext, fontSize: 13 }}>
            {i18n.t("common.loading", { defaultValue: "Chargement…" })}
          </Text>
        </View>
      ) : sorted.length === 0 ? (
        <Text style={{ color: colors.subtext, fontSize: 13 }}>
          {i18n.t("firstGoal.live.noEntriesYet", { defaultValue: "Aucune participation encore." })}
        </Text>
      ) : (
        <View style={{ gap: 6 }}>
          {sorted.map((entry, index) => {
            const who = entryDisplayName(entry);
            const points = entryTotalPoints(entry);
            const isMe = String(entry.uid) === uid;
            const { winnersCorrect, exactScores } = countTpPickStatsForEntry(entry, bundle);

            return (
              <View
                key={String(entry.uid)}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  paddingVertical: 10,
                  paddingHorizontal: 10,
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: isMe ? "rgba(22,163,74,0.35)" : colors.border,
                  backgroundColor: isMe ? colors.card2 : colors.card,
                }}
              >
                <Text
                  style={{
                    color: colors.subtext,
                    fontWeight: "900",
                    width: 24,
                    fontSize: 13,
                  }}
                >
                  {index + 1}.
                </Text>

                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ color: colors.text, fontWeight: "900" }} numberOfLines={1}>
                    {who}
                    {isMe
                      ? ` ${i18n.t("challenges.youSuffix", { defaultValue: "(toi)" })}`
                      : ""}
                  </Text>
                  {gameCount > 0 ? (
                    <Text style={{ color: colors.subtext, fontSize: 12 }}>
                      {i18n.t("tp.results.participantStats", {
                        defaultValue:
                          "{{winners}} bon(s) choix(s) · {{exact}} pointage(s) exact(s)",
                        winners: winnersCorrect,
                        exact: exactScores,
                      })}
                    </Text>
                  ) : null}
                </View>

                <Text style={{ color: colors.text, fontWeight: "900", fontSize: 14 }}>
                  {points}{" "}
                  <Text style={{ color: colors.subtext, fontWeight: "700", fontSize: 12 }}>
                    {i18n.t("challenges.pointsShort", { defaultValue: "pt(s)" })}
                  </Text>
                </Text>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}
