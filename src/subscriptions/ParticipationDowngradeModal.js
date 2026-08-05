import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Alert,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import firestore from "@react-native-firebase/firestore";
import { useAuth } from "@src/auth/SafeAuthProvider";
import { useTheme } from "@src/theme/ThemeProvider";
import i18n from "@src/i18n/i18n";
import usePlanUsage from "@src/subscriptions/usePlanUsage";
import { resolveActiveGroupsService } from "@src/subscriptions/resolveActiveGroupsService";
import { isParticipatingMember } from "@src/groups/participationUtils";
import GroupAvatar from "@src/groups/components/GroupAvatar";

export default function ParticipationDowngradeModal({
  visible,
  onResolved,
  planUsage,
  participatingGroups,
}) {
  const { colors } = useTheme();
  const max = planUsage?.limits?.activeGroupsLimit ?? 1;
  const [selectedIds, setSelectedIds] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const didInitSelectionRef = useRef(false);

  useEffect(() => {
    if (!visible) {
      didInitSelectionRef.current = false;
      setSelectedIds([]);
      return;
    }

    if (didInitSelectionRef.current) return;
    if (!(participatingGroups || []).length) return;

    didInitSelectionRef.current = true;
    const preselected = participatingGroups.slice(0, max).map((g) => g.id);
    setSelectedIds(preselected);
  }, [visible, participatingGroups, max]);

  const toggleGroup = useCallback(
    (groupId) => {
      setSelectedIds((prev) => {
        if (prev.includes(groupId)) {
          if (max === 1) return prev;
          return prev.filter((id) => id !== groupId);
        }
        if (max === 1) return [groupId];
        if (prev.length >= max) {
          return [...prev.slice(1), groupId];
        }
        return [...prev, groupId];
      });
    },
    [max]
  );

  const onConfirm = useCallback(async () => {
    if (selectedIds.length === 0) {
      Alert.alert(
        i18n.t("subscriptions.participationDowngrade.selectRequiredTitle", {
          defaultValue: "Sélection requise",
        }),
        i18n.t("subscriptions.participationDowngrade.selectRequiredBody", {
          max,
          defaultValue:
            "Choisis au moins un groupe (maximum {{max}}) où tu veux continuer à jouer.",
        })
      );
      return;
    }

    try {
      setSubmitting(true);
      await resolveActiveGroupsService({ keepActiveGroupIds: selectedIds });
      await planUsage?.refresh?.();
      onResolved?.();
    } catch (e) {
      Alert.alert(
        i18n.t("common.unknownError", { defaultValue: "Erreur" }),
        String(e?.message || e)
      );
    } finally {
      setSubmitting(false);
    }
  }, [selectedIds, max, planUsage, onResolved]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={() => {}}>
      <View
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.55)",
          justifyContent: "flex-end",
        }}
      >
        <View
          style={{
            backgroundColor: colors.background,
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            maxHeight: "88%",
            paddingTop: 16,
            paddingHorizontal: 16,
            paddingBottom: 24,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <Text style={{ color: colors.text, fontWeight: "900", fontSize: 20 }}>
            {i18n.t("subscriptions.participationDowngrade.title", {
              defaultValue: "Groupes actifs",
            })}
          </Text>
          <Text style={{ color: colors.subtext, marginTop: 8, lineHeight: 20 }}>
            {i18n.t("subscriptions.participationDowngrade.body", {
              max,
              defaultValue:
                "Ton forfait permet de jouer dans {{max}} groupe(s) à la fois. Choisis où tu veux continuer à participer aux défis.",
            })}
          </Text>

          <Text style={{ color: colors.subtext, marginTop: 8, fontSize: 12, fontWeight: "700" }}>
            {i18n.t("subscriptions.participationDowngrade.selectedCount", {
              count: selectedIds.length,
              max,
              defaultValue: "{{count}} / {{max}} sélectionné(s)",
            })}
          </Text>

          <ScrollView style={{ marginTop: 12, maxHeight: 360 }} contentContainerStyle={{ gap: 8 }}>
            {(participatingGroups || []).map((group) => {
              const selected = selectedIds.includes(group.id);
              const iconName =
                max === 1
                  ? selected
                    ? "radiobox-marked"
                    : "radiobox-blank"
                  : selected
                    ? "checkbox-marked-circle"
                    : "checkbox-blank-circle-outline";

              return (
                <TouchableOpacity
                  key={group.id}
                  onPress={() => toggleGroup(group.id)}
                  disabled={submitting}
                  activeOpacity={0.85}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 10,
                    padding: 12,
                    borderRadius: 14,
                    borderWidth: 1,
                    borderColor: selected ? colors.primary : colors.border,
                    backgroundColor: selected ? colors.card2 : colors.card,
                  }}
                >
                  <MaterialCommunityIcons
                    name={iconName}
                    size={22}
                    color={selected ? colors.primary : colors.subtext}
                  />
                  <GroupAvatar group={group} size={36} colors={colors} />
                  <Text
                    style={{ flex: 1, color: colors.text, fontWeight: "700" }}
                    numberOfLines={1}
                  >
                    {group.name || group.id}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <TouchableOpacity
            onPress={onConfirm}
            disabled={submitting || selectedIds.length === 0}
            style={{
              marginTop: 16,
              backgroundColor: colors.primary,
              paddingVertical: 14,
              borderRadius: 12,
              alignItems: "center",
              opacity: submitting || selectedIds.length === 0 ? 0.6 : 1,
            }}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={{ color: "#fff", fontWeight: "900" }}>
                {i18n.t("subscriptions.participationDowngrade.confirm", {
                  defaultValue: "Confirmer mon choix",
                })}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

export function ParticipationDowngradeGate() {
  const { user } = useAuth();
  const planUsage = usePlanUsage(user?.uid);
  const [participatingGroups, setParticipatingGroups] = useState([]);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!user?.uid) {
      setParticipatingGroups([]);
      return undefined;
    }

    const uid = String(user.uid);
    let rowsByUid = [];
    let rowsByPid = [];

    const mergeRows = () => {
      const map = new Map();
      [...rowsByUid, ...rowsByPid].forEach((row) => {
        if (!row?.id) return;
        map.set(row.id, row);
      });
      return Array.from(map.values()).filter(isParticipatingMember);
    };

    const loadGroupMeta = async (rows) => {
      const groups = await Promise.all(
        rows.map(async (row) => {
          const groupId = String(row.groupId || row.id.split("_")[0] || "");
          if (!groupId) return null;
          try {
            const gSnap = await firestore().doc(`groups/${groupId}`).get();
            const data = gSnap.exists ? gSnap.data() || {} : {};
            return {
              id: groupId,
              name: String(data.name || data.title || "").trim() || groupId,
              sport: data.sport || data.league || "NHL",
              favoriteTeam: data.favoriteTeam ?? null,
            };
          } catch {
            return { id: groupId, name: groupId, sport: "NHL", favoriteTeam: null };
          }
        })
      );
      setParticipatingGroups(groups.filter(Boolean));
    };

    const unsubUid = firestore()
      .collection("group_memberships")
      .where("uid", "==", uid)
      .onSnapshot(
        (snap) => {
          rowsByUid = (snap?.docs ?? []).map((d) => ({
            id: d.id,
            ...(d.data() || {}),
            groupId: String(d.data()?.groupId || d.id.split("_")[0] || ""),
          }));
          loadGroupMeta(mergeRows());
        },
        () => setParticipatingGroups([])
      );

    const unsubPid = firestore()
      .collection("group_memberships")
      .where("participantId", "==", uid)
      .onSnapshot(
        (snap) => {
          rowsByPid = (snap?.docs ?? []).map((d) => ({
            id: d.id,
            ...(d.data() || {}),
            groupId: String(d.data()?.groupId || d.id.split("_")[0] || ""),
          }));
          loadGroupMeta(mergeRows());
        },
        () => {}
      );

    return () => {
      try {
        unsubUid();
        unsubPid();
      } catch {}
    };
  }, [user?.uid]);

  useEffect(() => {
    if (planUsage.flags?.needsParticipationResolution) {
      setDismissed(false);
    }
  }, [planUsage.flags?.needsParticipationResolution, planUsage.tier]);

  const visible = Boolean(
    user?.uid &&
      planUsage.flags?.needsParticipationResolution &&
      !planUsage.loading &&
      !dismissed
  );

  return (
    <ParticipationDowngradeModal
      visible={visible}
      planUsage={planUsage}
      participatingGroups={participatingGroups}
      onResolved={() => setDismissed(true)}
    />
  );
}
