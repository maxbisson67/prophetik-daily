import React, { useCallback, useEffect, useMemo, useState } from "react";
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
import { resolveAutopilotGroupsService } from "@src/subscriptions/resolveAutopilotService";
import GroupAvatar from "@src/groups/components/GroupAvatar";

function isActiveOwnedGroup(data = {}) {
  if (data.active === false) return false;
  const status = String(data.status || "active").toLowerCase();
  return status !== "archived" && status !== "deleted";
}

export default function AutopilotDowngradeModal({ visible, onResolved, planUsage, ownedGroups }) {
  const { colors } = useTheme();
  const max = planUsage?.limits?.autopilotGroupsLimit ?? 1;
  const [selectedIds, setSelectedIds] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  const autopilotGroups = useMemo(
    () => (ownedGroups || []).filter((g) => g.autopilotEnabled !== false),
    [ownedGroups]
  );

  useEffect(() => {
    if (!visible) {
      setSelectedIds([]);
      return;
    }

    const preselected = autopilotGroups.slice(0, max).map((g) => g.id);
    setSelectedIds(preselected);
  }, [visible, autopilotGroups, max]);

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
        i18n.t("subscriptions.autopilotDowngrade.selectRequiredTitle", {
          defaultValue: "Sélection requise",
        }),
        i18n.t("subscriptions.autopilotDowngrade.selectRequiredBody", {
          max,
          defaultValue:
            "Choisis au moins un groupe (maximum {{max}}) pour conserver les défis automatiques.",
        })
      );
      return;
    }

    try {
      setSubmitting(true);
      await resolveAutopilotGroupsService({ keepGroupIds: selectedIds });
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
            {i18n.t("subscriptions.autopilotDowngrade.title", {
              defaultValue: "Défis automatiques",
            })}
          </Text>
          <Text style={{ color: colors.subtext, marginTop: 8, lineHeight: 20 }}>
            {i18n.t("subscriptions.autopilotDowngrade.body", {
              max,
              defaultValue:
                "Votre nouveau forfait permet {{max}} groupe(s) en défis automatiques. Choisissez le(s) groupe(s) qui conservera(ont) ce mode.",
            })}
          </Text>

          <Text style={{ color: colors.subtext, marginTop: 8, fontSize: 12, fontWeight: "700" }}>
            {i18n.t("subscriptions.autopilotDowngrade.selectedCount", {
              count: selectedIds.length,
              max,
              defaultValue: "{{count}} / {{max}} sélectionné(s)",
            })}
          </Text>

          <ScrollView style={{ marginTop: 12, maxHeight: 360 }} contentContainerStyle={{ gap: 8 }}>
            {autopilotGroups.map((group) => {
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
                {i18n.t("subscriptions.autopilotDowngrade.confirm", {
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

export function AutopilotDowngradeGate() {
  const { user } = useAuth();
  const planUsage = usePlanUsage(user?.uid);
  const [ownedGroups, setOwnedGroups] = useState([]);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!user?.uid) {
      setOwnedGroups([]);
      return undefined;
    }

    const unsub = firestore()
      .collection("groups")
      .where("ownerId", "==", String(user.uid))
      .onSnapshot((snap) => {
        const groups = (snap?.docs ?? [])
          .map((doc) => {
            const data = doc.data() || {};
            if (!isActiveOwnedGroup(data)) return null;
            return {
              id: doc.id,
              name: String(data.name || data.title || "").trim() || doc.id,
              autopilotEnabled: data.autopilotEnabled !== false,
              sport: data.sport || data.league || "NHL",
              favoriteTeam: data.favoriteTeam ?? null,
            };
          })
          .filter(Boolean);
        setOwnedGroups(groups);
      });

    return () => {
      try {
        unsub();
      } catch {}
    };
  }, [user?.uid]);

  useEffect(() => {
    if (planUsage.flags?.needsAutopilotResolution) {
      setDismissed(false);
    }
  }, [planUsage.flags?.needsAutopilotResolution, planUsage.tier]);

  const visible = Boolean(
    user?.uid &&
      planUsage.flags?.needsAutopilotResolution &&
      !planUsage.loading &&
      !dismissed
  );

  return (
    <AutopilotDowngradeModal
      visible={visible}
      planUsage={planUsage}
      ownedGroups={ownedGroups}
      onResolved={() => setDismissed(true)}
    />
  );
}
