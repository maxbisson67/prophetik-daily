// src/ascensions/CreateAscensionModal.js
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, Modal, ScrollView, TouchableOpacity, Alert } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@src/auth/SafeAuthProvider";
import { useTheme } from "@src/theme/ThemeProvider";
import i18n from "@src/i18n/i18n";
import { useRouter } from "expo-router";
import useEntitlement from "../../app/(drawer)/subscriptions/useEntitlement";
import { Ionicons } from "@expo/vector-icons";
import { createAscension } from "@src/ascensions/api";
import NovaBubble from "@src/ui/NovaBubble";
import Analytics from "@src/services/analytics";

function pad2(n) {
  return String(n).padStart(2, "0");
}
function ymdFromLocalDate(d) {
  const y = d.getFullYear();
  const m = pad2(d.getMonth() + 1);
  const day = pad2(d.getDate());
  return `${y}-${m}-${day}`;
}
function addDaysLocalYmd(baseYmd, days) {
  const [y, m, d] = String(baseYmd).split("-").map((x) => Number(x));
  const dt = new Date(y, (m || 1) - 1, d || 1, 12, 0, 0, 0);
  dt.setDate(dt.getDate() + Number(days || 0));
  return ymdFromLocalDate(dt);
}
function todayLocalYmd() {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  return ymdFromLocalDate(d);
}
function tomorrowLocalYmd() {
  return addDaysLocalYmd(todayLocalYmd(), 1);
}

function planRank(p) {
  const s = String(p || "free").toLowerCase();
  if (s === "vip") return 3;
  if (s === "pro") return 2;
  return 1;
}

const REQUIRED_PLAN = "pro";

/* ---------------- UI helpers ---------------- */
function StepPill({ active, done, label, colors }) {
  const bg = active ? colors.primary : done ? colors.card2 : colors.card;
  const border = active ? colors.primary : colors.border;
  const textColor = active ? "#fff" : colors.text;

  return (
    <View
      style={{
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: border,
        backgroundColor: bg,
      }}
    >
      <Text style={{ color: textColor, fontWeight: "900", fontSize: 12 }}>{label}</Text>
    </View>
  );
}

function WizardHeader({ step, colors, onClose }) {
  return (
    <View style={{ gap: 10 }}>
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <Text style={{ fontSize: 18, fontWeight: "900", color: colors.text, flex: 1 }}>
          {i18n.t("ascension.create.title", { defaultValue: "Créer une Ascension" })}
        </Text>

        <TouchableOpacity
          onPress={onClose}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
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
          accessibilityRole="button"
          accessibilityLabel={i18n.t("common.close", { defaultValue: "Fermer" })}
        >
          <Ionicons name="close" size={20} color={colors.text} />
        </TouchableOpacity>
      </View>

      {/* Steps: 1 Concept, 2 Groupe, 3 Début, 4 Confirmation */}
      <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
        <StepPill
          active={step === 1}
          done={step > 1}
          colors={colors}
          label={i18n.t("ascension.create.wizard.step1", { defaultValue: "1. Concept" })}
        />
        <StepPill
          active={step === 2}
          done={step > 2}
          colors={colors}
          label={i18n.t("ascension.create.wizard.step2", { defaultValue: "2. Groupe" })}
        />
        <StepPill
          active={step === 3}
          done={step > 3}
          colors={colors}
          label={i18n.t("ascension.create.wizard.step3", { defaultValue: "3. Début" })}
        />
        <StepPill
          active={step === 4}
          done={false}
          colors={colors}
          label={i18n.t("ascension.create.wizard.step4", { defaultValue: "4. Confirmation" })}
        />
      </View>
    </View>
  );
}

function SummaryRow({ label, value, onEdit, colors }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 12, color: colors.subtext, fontWeight: "700" }}>{label}</Text>
        <Text style={{ marginTop: 2, color: colors.text, fontWeight: "900" }}>{value}</Text>
      </View>

      {onEdit ? (
        <TouchableOpacity
          onPress={onEdit}
          style={{
            paddingVertical: 8,
            paddingHorizontal: 10,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.card2,
          }}
        >
          <Text style={{ color: colors.text, fontWeight: "900", fontSize: 12 }}>
            {i18n.t("common.edit", { defaultValue: "Modifier" })}
          </Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

/* ---------------- Component ---------------- */
export default function CreateAscensionModal({
  visible,
  onClose,
  groups = [],
  initialGroupId = null,
  onCreated,
}) {
  const { user } = useAuth();
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const { tier, loading: loadingTier } = useEntitlement(user?.uid);
  const userPlan = (tier || "free").toLowerCase();

  const selectableGroups = useMemo(
    () =>
      (groups || []).filter((g) => {
        if (!g) return false;
        const st = String(g.status || "").toLowerCase();
        return !["archived", "deleted"].includes(st);
      }),
    [groups]
  );

  const [step, setStep] = useState(1);
  const [selectedGroupId, setSelectedGroupId] = useState(initialGroupId);

  // ✅ ASC7 only — commence demain
  const [startDateYmd, setStartDateYmd] = useState(() => tomorrowLocalYmd());

  const [creating, setCreating] = useState(false);
  const [groupDropdownOpen, setGroupDropdownOpen] = useState(false);

  const [successVisible, setSuccessVisible] = useState(false);
  const [successPayload, setSuccessPayload] = useState(null); // { groupId, ascKey, runId, defiId? }

  // reset à l'ouverture
  useEffect(() => {
    if (!visible) return;
    setStep(1);
    setCreating(false);
    setGroupDropdownOpen(false);
    setStartDateYmd(tomorrowLocalYmd());
  }, [visible]);

  // default group
  useEffect(() => {
    if (!visible) return;
    setSelectedGroupId((prev) => {
      if (prev && selectableGroups.some((g) => g.id === prev)) return prev;
      if (initialGroupId && selectableGroups.some((g) => g.id === initialGroupId)) return initialGroupId;
      return selectableGroups[0]?.id ?? null;
    });
  }, [visible, initialGroupId, selectableGroups]);

  const selectedGroup = useMemo(
    () => selectableGroups.find((g) => g.id === selectedGroupId) || null,
    [selectableGroups, selectedGroupId]
  );

  const isPlanAllowed = useMemo(() => {
    if (loadingTier) return true;
    return planRank(userPlan) >= planRank(REQUIRED_PLAN);
  }, [loadingTier, userPlan]);

  const noGroupAvailable = selectableGroups.length === 0;

  const onGoToSubscriptions = useCallback(() => {
    onClose?.();
    router.push("/(drawer)/subscriptions");
  }, [router, onClose]);

  const canGoNextFromStep1 = true;
  const canGoNextFromStep2 = !!selectedGroupId && !noGroupAvailable;
  const canGoNextFromStep3 = !!startDateYmd && isPlanAllowed;

  const canCreate = canGoNextFromStep2 && canGoNextFromStep3;

  const goNext = useCallback(() => setStep((s) => Math.min(4, s + 1)), []);
  const goBack = useCallback(() => setStep((s) => Math.max(1, s - 1)), []);

  const renderStep1 = () => (
    <View style={{ gap: 10 }}>
      <Text style={{ fontWeight: "900", color: colors.text, fontSize: 16 }}>
        {i18n.t("ascension.create.concept.title", { defaultValue: "C’est quoi l’Ascension 7?" })}
      </Text>

      <Text style={{ color: colors.text }}>
        {i18n.t("ascension.create.concept.body1", {
          defaultValue:
            "L’Ascension 7 est une course entre amis. Chaque jour, un format différent (1 à 7 joueurs). Le premier à gagner les 7 formats (non consécutifs) remporte le jackpot.",
        })}
      </Text>

      {!isPlanAllowed && !loadingTier ? (
        <View style={{ gap: 10, marginTop: 6 }}>
          <Text style={{ color: colors.subtext, textAlign: "center" }}>
            {i18n.t("ascension.create.type.lockedHint", {
              defaultValue: "Ascension 7 est réservé aux abonnés Pro/VIP.",
            })}
          </Text>

          <TouchableOpacity
            onPress={onGoToSubscriptions}
            style={{
              paddingVertical: 10,
              paddingHorizontal: 14,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: "#b91c1c",
              backgroundColor: "#b91c1c",
              minWidth: 240,
              alignItems: "center",
              alignSelf: "center",
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "900" }}>
              {i18n.t("ascension.create.unlockOther", { defaultValue: "Débloquer Ascension 7" })}
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );

  const renderStep2 = () => (
    <View style={{ gap: 10 }}>
      {noGroupAvailable ? (
        <View
          style={{
            marginTop: 4,
            padding: 12,
            borderWidth: 1,
            borderRadius: 12,
            borderColor: colors.border,
            backgroundColor: colors.card2,
          }}
        >
          <Text style={{ fontSize: 12, color: colors.subtext }}>
            {i18n.t("create.group.noneHint", { defaultValue: "Aucun groupe disponible" })}
          </Text>
          <Text style={{ marginTop: 6, color: colors.text }}>
            {i18n.t("ascension.create.group.noneBody", {
              defaultValue: "Crée un groupe pour pouvoir lancer une Ascension.",
            })}
          </Text>
        </View>
      ) : selectableGroups.length <= 1 && selectedGroup ? (
        <View
          style={{
            padding: 12,
            borderWidth: 1,
            borderRadius: 12,
            borderColor: colors.border,
            backgroundColor: colors.card2,
          }}
        >
          <Text style={{ fontSize: 12, color: colors.subtext }}>
            {i18n.t("defi.create.group.label", { defaultValue: "Groupe" })}
          </Text>
          <Text style={{ fontWeight: "900", fontSize: 16, marginTop: 2, color: colors.text }}>
            {selectedGroup.name || selectedGroup.id}
          </Text>
        </View>
      ) : (
        <View style={{ gap: 8 }}>
          <Text style={{ fontSize: 12, color: colors.subtext }}>
            {i18n.t("defi.create.group.choose", { defaultValue: "Choisir un groupe" })}
          </Text>

          <TouchableOpacity
            onPress={() => setGroupDropdownOpen((v) => !v)}
            activeOpacity={0.85}
            style={{
              paddingVertical: 12,
              paddingHorizontal: 12,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.card2,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Text style={{ color: colors.text, fontWeight: "900" }} numberOfLines={1}>
              {selectedGroup?.name ||
                selectedGroup?.id ||
                i18n.t("common.choose", { defaultValue: "Choisir…" })}
            </Text>

            <Ionicons name={groupDropdownOpen ? "chevron-up" : "chevron-down"} size={18} color={colors.text} />
          </TouchableOpacity>

          {groupDropdownOpen ? (
            <View
              style={{
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 12,
                backgroundColor: colors.card,
                overflow: "hidden",
              }}
            >
              <ScrollView style={{ maxHeight: 220 }}>
                {selectableGroups.map((g, idx) => {
                  const active = g.id === selectedGroupId;
                  return (
                    <TouchableOpacity
                      key={g.id}
                      onPress={() => {
                        setSelectedGroupId(g.id);
                        setGroupDropdownOpen(false);
                      }}
                      style={{
                        paddingVertical: 12,
                        paddingHorizontal: 12,
                        borderTopWidth: idx === 0 ? 0 : 1,
                        borderTopColor: colors.border,
                        backgroundColor: active ? colors.card2 : colors.card,
                      }}
                    >
                      <Text style={{ color: colors.text, fontWeight: active ? "900" : "800" }}>
                        {g.name || g.id}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          ) : null}
        </View>
      )}
    </View>
  );

  const renderStep3 = () => (
    <View style={{ gap: 12 }}>


      <View
        style={{
          padding: 12,
          borderWidth: 1,
          borderRadius: 12,
          borderColor: colors.border,
          backgroundColor: colors.card2,
          alignItems: "center",
          gap: 6,
        }}
      >
        <Text style={{ color: colors.subtext, fontWeight: "800" }}>
          {i18n.t("ascension.create.startDatePlanned", { defaultValue: "Début prévu" })}
        </Text>
        <Text style={{ fontWeight: "900", color: colors.text, fontSize: 16 }}>{startDateYmd}</Text>
      </View>

      {!isPlanAllowed && !loadingTier ? (
        <View
          style={{
            padding: 12,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: "#b91c1c",
            backgroundColor: colors.card2,
            gap: 10,
          }}
        >
          <Text style={{ color: colors.text, fontWeight: "900" }}>
            {i18n.t("ascension.create.planLocked", { defaultValue: "Ton abonnement ne permet pas l’Ascension 7." })}
          </Text>

          <TouchableOpacity
            onPress={onGoToSubscriptions}
            style={{
              paddingVertical: 10,
              paddingHorizontal: 14,
              borderRadius: 10,
              backgroundColor: "#b91c1c",
              alignSelf: "center",
              minWidth: 220,
              alignItems: "center",
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "900" }}>
              {i18n.t("ascension.create.unlockOther", { defaultValue: "Débloquer Ascension 7" })}
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );

  const renderStep4 = () => {
    const groupLabel = selectedGroup?.name || selectedGroup?.id || selectedGroupId || "-";
    const dateLabel = startDateYmd || "-";

    return (
      <View style={{ gap: 14 }}>
        <Text style={{ fontWeight: "900", color: colors.text, fontSize: 16 }}>
          {i18n.t("ascension.create.confirm.title", { defaultValue: "Confirmation" })}
        </Text>

        <View style={{ gap: 12 }}>
          <SummaryRow
            colors={colors}
            label={i18n.t("ascension.create.confirm.group", { defaultValue: "Groupe" })}
            value={groupLabel}
            onEdit={() => setStep(2)}
          />

          <SummaryRow
            colors={colors}
            label={i18n.t("ascension.create.confirm.startDate", { defaultValue: "Début" })}
            value={dateLabel}
            onEdit={() => setStep(3)}
          />

          <View
            style={{
              padding: 12,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.card2,
            }}
          >
            <Text style={{ color: colors.text }}>
              {i18n.t("ascension.create.confirm.note", {
                defaultValue: "Un défi sera créé automatiquement après ta confirmation.",
              })}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  const nextDisabled =
    creating ||
    (step === 1 && !canGoNextFromStep1) ||
    (step === 2 && !canGoNextFromStep2) ||
    (step === 3 && !canGoNextFromStep3);


  async function handleCreateAscension() {
      if (!user?.uid) return;
      if (!selectedGroupId) return;

      if (!canCreate) {
        Alert.alert(
          i18n.t("ascension.create.alert.cannot.title", { defaultValue: "Impossible de créer" }),
          i18n.t("ascension.create.alert.cannot.body", { defaultValue: "Vérifie les étapes et réessaie." })
        );
        return;
      }

      setCreating(true);

      try {
        const res = await createAscension({
          groupId: selectedGroupId,
          startDateYmd,
        });

        if (!res?.ok) {
          Alert.alert(
            i18n.t("ascension.create.alert.error.title", { defaultValue: "Création impossible" }),
            i18n.t("common.genericError", { defaultValue: "Une erreur est survenue. Veuillez réessayer." })
          );
          return;
        }

        Analytics.createChallenge({
          type: "ascension",
          groupId: String(selectedGroupId),
          startDate: String(startDateYmd),
          ascKey: String(res?.ascKey || "ASC7"),
        });

        setSuccessPayload(res);
        setSuccessVisible(true);

        Alert.alert(
          "Ascension créée ✅",
          `Ton ascension ${res.ascKey} a été créée avec succès et démarrera le (${res.runId}).`,
          [
            {
              text: "OK",
              onPress: () => {
                setSuccessVisible(false);
                onCreated?.(res?.defiId || null, { justCreatedAsc: true, ...res });
              },
            },
          ]
        );

        onClose?.();
      
      } catch (e) {
        Alert.alert(
          i18n.t("ascension.create.alert.error.title", { defaultValue: "Création impossible" }),
          e?.message || i18n.t("common.genericError", { defaultValue: "Une erreur est survenue. Veuillez réessayer." })
        );
        console.warn("[createAscension] err", { code: e?.code, message: e?.message, raw: e });
      } finally {
        setCreating(false);
      }
    }

  const handleClose = useCallback(() => {
    setStep(1);
    setCreating(false);
    setGroupDropdownOpen(false);
    setStartDateYmd(tomorrowLocalYmd());
    onClose?.();
  }, [onClose]);

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={handleClose} presentationStyle="pageSheet">
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={{
            padding: 16,
            gap: 14,
            paddingTop: 16,
            paddingBottom: 16 + insets.bottom,
          }}
        >
          <WizardHeader step={step} colors={colors} onClose={handleClose} />

          <View
            style={{
              padding: 14,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.card,
            }}
          >
            {step === 1 ? renderStep1() : null}
            {step === 2 ? renderStep2() : null}
            {step === 3 ? renderStep3() : null}
            {step === 4 ? renderStep4() : null}
          </View>

          <View style={{ flexDirection: "row", gap: 10, marginTop: 4 }}>
            <TouchableOpacity
              onPress={step === 1 ? onClose : goBack}
              style={{
                flex: 1,
                padding: 12,
                borderRadius: 12,
                borderWidth: 1,
                alignItems: "center",
                borderColor: colors.border,
                backgroundColor: colors.card,
              }}
              disabled={creating}
            >
              <Text style={{ color: colors.text, fontWeight: "800" }}>
                {step === 1
                  ? i18n.t("common.cancel", { defaultValue: "Annuler" })
                  : i18n.t("common.back", { defaultValue: "Retour" })}
              </Text>
            </TouchableOpacity>

            {step < 4 ? (
              <TouchableOpacity
                onPress={goNext}
                disabled={nextDisabled}
                style={{
                  flex: 1,
                  padding: 12,
                  borderRadius: 12,
                  alignItems: "center",
                  backgroundColor: nextDisabled ? colors.subtext : "#b91c1c",
                }}
              >
                <Text style={{ color: "#fff", fontWeight: "900" }}>
                  {i18n.t("common.next", { defaultValue: "Suivant" })}
                </Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                onPress={handleCreateAscension}
                disabled={creating || !canCreate}
                style={{
                  flex: 1,
                  padding: 12,
                  borderRadius: 12,
                  alignItems: "center",
                  backgroundColor: creating || !canCreate ? colors.subtext : "#b91c1c",
                }}
              >
                <Text style={{ color: "#fff", fontWeight: "900" }}> 
                  {creating
                    ? i18n.t("ascension.create.actions.creating", { defaultValue: "Création…" })
                    : i18n.t("ascension.create.actions.createNow", { defaultValue: "Créer l’Ascension" })}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}