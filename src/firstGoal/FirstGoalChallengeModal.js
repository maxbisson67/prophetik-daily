import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Image,
} from "react-native";

import firestore from "@react-native-firebase/firestore";
import { Ionicons } from "@expo/vector-icons";

import { useAuth } from "@src/auth/SafeAuthProvider";
import i18n from "@src/i18n/i18n";

function isDecidedStatus(status) {
  const st = String(status || "").toLowerCase();
  return st === "decided" || st === "closed";
}

function shouldShowEntries(status) {
  const st = String(status || "").toLowerCase();
  return ["locked", "live", "pending", "decided", "closed"].includes(st);
}

function initials(name) {
  const s = String(name || "").trim();
  if (!s) return "?";
  const parts = s.split(/\s+/).filter(Boolean);
  const a = parts[0]?.[0] || "";
  const b = parts.length > 1 ? parts[parts.length - 1]?.[0] : "";
  return (a + b).toUpperCase();
}

function AvatarBubble({ uri, name, colors, size = 30 }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        overflow: "hidden",
        backgroundColor: colors.card2,
        borderWidth: 1,
        borderColor: colors.border,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {uri ? (
        <Image source={{ uri }} style={{ width: size, height: size }} resizeMode="cover" />
      ) : (
        <Text style={{ color: colors.text, fontWeight: "900", fontSize: 12 }}>
          {initials(name)}
        </Text>
      )}
    </View>
  );
}

export default function FirstGoalChallengeModal({ visible, onClose, challenge, colors }) {
  const { user } = useAuth();

  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);

  const chId = String(challenge?.id || "");
  const status = String(challenge?.status || "").toLowerCase();
  const decided = isDecidedStatus(status);

  useEffect(() => {
    if (!visible || !chId) {
      setEntries([]);
      setLoading(false);
      return;
    }

    if (!shouldShowEntries(status)) {
      setEntries([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const ref = firestore()
      .collection("first_goal_challenges")
      .doc(chId)
      .collection("entries");

    const unsub = ref.onSnapshot(
      (snap) => {
        const list = snap.docs.map((d) => ({ uid: d.id, ...d.data() }));
        // tri alpha par displayName (si présent)
        list.sort((a, b) =>
          String(a.displayName || a.uid || "").localeCompare(String(b.displayName || b.uid || ""))
        );
        setEntries(list);
        setLoading(false);
      },
      (err) => {
        console.log("[FirstGoalChallengeModal] entries error", err?.message || err);
        setEntries([]);
        setLoading(false);
      }
    );

    return () => {
      try {
        unsub();
      } catch {}
    };
  }, [visible, chId, status]);

  // winners
  const winnerUids = useMemo(() => {
    if (!decided) return [];
    const preview = Array.isArray(challenge?.winnersPreviewUids) ? challenge.winnersPreviewUids : [];
    if (preview.length) return preview.map(String);

    const firstGoalPlayerId = challenge?.firstGoal?.playerId ? String(challenge.firstGoal.playerId) : "";
    if (!firstGoalPlayerId) return [];

    return entries
      .filter((e) => String(e.playerId || "") === firstGoalPlayerId)
      .map((e) => String(e.uid));
  }, [decided, challenge?.winnersPreviewUids, challenge?.firstGoal?.playerId, entries]);

  const title = useMemo(() => {
    const n = Number(challenge?.participantsCount || entries.length || 0);
    return `🎯 ${i18n.t("firstGoal.label", { defaultValue: "Premier but" })} • ${n}`;
  }, [challenge?.participantsCount, entries.length]);

  const sub = useMemo(() => {
    if (decided) {
      const p = challenge?.firstGoal?.playerName;
      return p
        ? `✅ ${i18n.t("firstGoal.result.prefix", { defaultValue: "Premier but:" })} ${p}`
        : `✅ ${i18n.t("firstGoal.result.none", { defaultValue: "Aucun gagnant" })}`;
    }
    if (status === "pending") return `⏳ ${i18n.t("firstGoal.status.pending", { defaultValue: "En vérification" })}`;
    if (status === "locked" || status === "live") return `🔒 ${i18n.t("firstGoal.status.locked", { defaultValue: "Verrouillé" })}`;
    return `ℹ️ ${status || "—"}`;
  }, [decided, status, challenge?.firstGoal?.playerName]);

  const canClose = () => onClose?.();

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={canClose}>
      <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" }}>
        <View
          style={{
            backgroundColor: colors.background,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            padding: 16,
            maxHeight: "80%",
          }}
        >
          {/* Handle */}
          <View style={{ alignItems: "center", marginBottom: 8 }}>
            <View style={{ width: 48, height: 4, borderRadius: 2, backgroundColor: colors.border }} />
          </View>

          {/* Header */}
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 10 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text, fontWeight: "900", fontSize: 16 }} numberOfLines={1}>
                {title}
              </Text>
              <Text style={{ color: colors.subtext, fontSize: 12, marginTop: 2 }} numberOfLines={2}>
                {sub}
              </Text>
            </View>

            <TouchableOpacity
              onPress={canClose}
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: colors.card,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <Ionicons name="close" size={20} color={colors.text} />
            </TouchableOpacity>
          </View>

          {/* Body */}
          <ScrollView contentContainerStyle={{ paddingBottom: 18 }} keyboardShouldPersistTaps="handled">
            <Text style={{ color: colors.text, fontWeight: "900", marginBottom: 8 }}>
              {i18n.t("firstGoal.live.picksTitle", { defaultValue: "Participants & choix" })}
            </Text>

            {loading ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <ActivityIndicator size="small" color={colors.subtext} />
                <Text style={{ color: colors.subtext, fontSize: 13 }}>
                  {i18n.t("common.loading", { defaultValue: "Chargement…" })}
                </Text>
              </View>
            ) : entries.length === 0 ? (
              <Text style={{ color: colors.subtext, fontSize: 13 }}>
                {i18n.t("firstGoal.live.noEntriesYet", { defaultValue: "Aucune participation encore." })}
              </Text>
            ) : (
              <View style={{ gap: 8 }}>
                {entries.map((e) => {
                  const who = e.displayName || e.name || String(e.uid || "").slice(0, 6);
                  const avatar = e.photoURL || e.avatarUrl || null;
                  const pick = e.playerName || "—";
                  const isWinner = decided && winnerUids.includes(String(e.uid));
                  return (
                    <View
                      key={String(e.uid)}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 10,
                        paddingVertical: 8,
                        paddingHorizontal: 10,
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: colors.border,
                        backgroundColor: isWinner ? colors.card2 : colors.card,
                      }}
                    >
                      <AvatarBubble uri={avatar} name={who} colors={colors} size={32} />

                      <View style={{ flex: 1 }}>
                        <Text style={{ color: colors.text, fontWeight: "900" }} numberOfLines={1}>
                          {who}
                        </Text>
                        <Text style={{ color: colors.subtext, fontSize: 12 }} numberOfLines={1}>
                          {pick}
                        </Text>
                      </View>

                      {isWinner ? (
                        <View
                          style={{
                            paddingVertical: 4,
                            paddingHorizontal: 8,
                            borderRadius: 999,
                            backgroundColor: colors.card,
                            borderWidth: 1,
                            borderColor: colors.border,
                          }}
                        >
                          <Text style={{ color: colors.text, fontWeight: "900", fontSize: 12 }}>
                            🏆 {i18n.t("firstGoal.live.winnerBadge", { defaultValue: "Gagnant" })}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  );
                })}
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}