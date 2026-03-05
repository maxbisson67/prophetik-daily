import React, { useEffect, useMemo, useState } from "react";
import { View, Text, ScrollView, ActivityIndicator, TouchableOpacity } from "react-native";
import { useLocalSearchParams, Stack, useRouter } from "expo-router";
import firestore from "@react-native-firebase/firestore";
import i18n from "@src/i18n/i18n";
import { useTheme } from "@src/theme/ThemeProvider";
import { listenRNFB } from "@src/dev/fsListen"; // ✅ wrapper logs

// ---------- Helpers ----------
function toNum(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function prettyRange(startYmd, endYmd) {
  if (startYmd && endYmd) return `${startYmd} → ${endYmd}`;
  return startYmd || endYmd || "";
}

function tsMillis(v) {
  try {
    if (!v) return 0;
    if (typeof v?.toDate === "function") return v.toDate().getTime();
    const d = new Date(v);
    return Number.isFinite(d.getTime()) ? d.getTime() : 0;
  } catch {
    return 0;
  }
}

function safeArr(v) {
  return Array.isArray(v) ? v : [];
}

/**
 * Row ASC7:
 * {
 *   id, ascKey, runId, status,
 *   startYmd, endYmd,
 *   completedAt,
 *   jackpot,
 *   winnerUids,
 *   completedDefiId
 * }
 */

// ---------- Screen ----------
export default function AscensionsHistoryScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { groupId } = useLocalSearchParams();
  const gid = String(groupId || "").trim();

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [err, setErr] = useState(null);

  const headerTitle = useMemo(() => {
    return i18n.t("ascensions.history.title", { defaultValue: "Historique des ascensions" });
  }, []);

  useEffect(() => {
    setRows([]);
    setErr(null);

    if (!gid) {
      setLoading(false);
      return;
    }

    setLoading(true);

    const ascKey = "ASC7";

    const q = firestore()
      .collection("groups")
      .doc(gid)
      .collection("ascensions")
      .doc(ascKey)
      .collection("runs")
      .where("status", "==", "completed")
      .orderBy("startYmd", "desc")
      .limit(50);

    const unsub = listenRNFB(
      q,
      (snap) => {
        const items = (snap?.docs || []).map((d) => {
          const r = d.data() || {};
          return {
            id: d.id,
            ascKey,
            runId: d.id,
            status: String(r.status || "completed"),
            startYmd: r.startYmd || d.id,
            endYmd: r.endYmd || r.completedYmd || null,
            completedAt: r.completedAt || null,
            jackpot: toNum(r.jackpot, 0),
            winnerUids: safeArr(r.winnerUids),
            completedDefiId: r.completedDefiId || null,
          };
        });

        // tri: completedAt desc, sinon startYmd desc, sinon runId desc
        items.sort((a, b) => {
          const ta = tsMillis(a.completedAt);
          const tb = tsMillis(b.completedAt);
          if (tb !== ta) return tb - ta;

          const sa = String(a.startYmd || "");
          const sb = String(b.startYmd || "");
          if (sb !== sa) return sb.localeCompare(sa);

          return String(b.runId || "").localeCompare(String(a.runId || ""));
        });

        setRows(items);
        setLoading(false);
      },
      `ascHistory:runs:${gid}:ASC7`,
      (e) => {
        setErr(e);
        setRows([]);
        setLoading(false);
        console.log(e);
      }
    );

    return () => {
      try {
        unsub?.();
      } catch {}
    };
  }, [gid]);

  return (
    <>
      <Stack.Screen options={{ title: headerTitle }} />

      <View style={{ flex: 1, backgroundColor: colors.background }}>
        {loading ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24 }}>
            <ActivityIndicator />
            <Text style={{ marginTop: 8, color: colors.subtext }}>
              {i18n.t("common.loading", { defaultValue: "Chargement…" })}
            </Text>
          </View>
        ) : err ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24 }}>
            <Text style={{ color: colors.text, fontWeight: "900", textAlign: "center" }}>
              {i18n.t("common.errorLabel", { defaultValue: "Erreur :" })}{" "}
              {String(err?.message || err)}
            </Text>

            <TouchableOpacity
              onPress={() => router.back()}
              style={{
                marginTop: 14,
                paddingVertical: 10,
                paddingHorizontal: 14,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.card,
              }}
            >
              <Text style={{ color: colors.text, fontWeight: "900" }}>
                {i18n.t("common.back", { defaultValue: "Retour" })}
              </Text>
            </TouchableOpacity>
          </View>
        ) : !rows.length ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24 }}>
            <Text style={{ color: colors.subtext, textAlign: "center" }}>
              {i18n.t("ascensions.history.empty", { defaultValue: "Aucune ascension complétée pour l’instant." })}
            </Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 28 }}>
            {rows.map((c) => {
              const range = prettyRange(c.startYmd, c.endYmd);
              const winners = safeArr(c.winnerUids);
              const firstWinner = winners[0] || null;

              return (
                <TouchableOpacity
                  key={c.id}
                  activeOpacity={0.85}
                  onPress={() => {
                    // Optionnel: page détails
                    // router.push(`/(drawer)/groups/${gid}/ascensions/ASC7/runs/${c.runId}`);
                  }}
                  style={{
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                    borderWidth: 1,
                    borderRadius: 16,
                    padding: 14,
                  }}
                >
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                    <View
                      style={{
                        paddingVertical: 4,
                        paddingHorizontal: 10,
                        borderRadius: 999,
                        backgroundColor: colors.card2,
                        borderWidth: 1,
                        borderColor: colors.border,
                      }}
                    >
                      <Text style={{ color: colors.text, fontWeight: "900", fontSize: 12 }}>
                        🏔 ASC7
                      </Text>
                    </View>

                    <Text style={{ color: colors.subtext, fontWeight: "800", fontSize: 12 }}>
                      {range || c.runId}
                    </Text>
                  </View>

                  <View style={{ marginTop: 10, gap: 6 }}>
                    <Text style={{ color: colors.text, fontWeight: "900", fontSize: 14 }}>
                      {i18n.t("ascensions.history.winner", { defaultValue: "Gagnant" })} :
                      <Text style={{ color: colors.subtext, fontWeight: "800" }}>
                        {" "}
                        {firstWinner
                          ? String(firstWinner).slice(0, 8) + "…"
                          : i18n.t("common.none", { defaultValue: "Aucun" })}
                      </Text>
                      {winners.length > 1 ? (
                        <Text style={{ color: colors.subtext, fontWeight: "800" }}>
                          {" "}
                          (+{winners.length - 1})
                        </Text>
                      ) : null}
                    </Text>

                    <Text style={{ color: colors.subtext }}>
                      {i18n.t("ascensions.labels.jackpot", { defaultValue: "Jackpot" })}:{" "}
                      <Text style={{ color: colors.text, fontWeight: "900" }}>
                        {toNum(c.jackpot, 0)}
                      </Text>
                    </Text>

                    {c.completedDefiId ? (
                      <Text style={{ color: colors.subtext }}>
                        {i18n.t("ascensions.history.completedBy", { defaultValue: "Défi final" })}:{" "}
                        <Text style={{ color: colors.text, fontWeight: "900" }}>
                          {String(c.completedDefiId).slice(0, 8)}…
                        </Text>
                      </Text>
                    ) : null}
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}
      </View>
    </>
  );
}