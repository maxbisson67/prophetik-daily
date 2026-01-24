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

function pad2(n) {
  return String(n).padStart(2, "0");
}

function ymdFromLocalDate(d) {
  const y = d.getFullYear();
  const m = pad2(d.getMonth() + 1);
  const day = pad2(d.getDate());
  return `${y}-${m}-${day}`;
}

// 0=dim, 1=lun ... 6=sam
function nextDowYmd(targetDow, now = new Date()) {
  const base = new Date(now);
  base.setHours(12, 0, 0, 0);
  const dow = base.getDay();
  let delta = (targetDow - dow + 7) % 7;
  // si aujourd'hui est le bon jour, on préfère la semaine prochaine (évite “commencer aujourd'hui”)
  if (delta === 0) delta = 7;
  const out = new Date(base);
  out.setDate(out.getDate() + delta);
  return ymdFromLocalDate(out);
}

function planRank(p) {
  if (p === "vip") return 3;
  if (p === "pro") return 2;
  return 1; // free
}

function requiredPlanForAscension(asc) {
  // Ajuste selon ton modèle business :
  // - FREE: Ascension 4 OK
  // - PRO/VIP: Ascension 7 (ou juste VIP si tu veux)
  if (asc === 7) return "pro"; // ou "vip" si tu veux plus strict
  return null; // asc 4 free
}

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
      {/* Row titre + X */}
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

      {/* Steps */}
      <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
        <StepPill active={step === 1} done={step > 1} colors={colors}
          label={i18n.t("ascension.create.wizard.step1", { defaultValue: "1. Concept" })} />
        <StepPill active={step === 2} done={step > 2} colors={colors}
          label={i18n.t("ascension.create.wizard.step2", { defaultValue: "2. Groupe" })} />
        <StepPill active={step === 3} done={step > 3} colors={colors}
          label={i18n.t("ascension.create.wizard.step3", { defaultValue: "3. Format" })} />
        <StepPill active={step === 4} done={step > 4} colors={colors}
          label={i18n.t("ascension.create.wizard.step4", { defaultValue: "4. Début" })} />
        <StepPill active={step === 5} done={false} colors={colors}
          label={i18n.t("ascension.create.wizard.step5", { defaultValue: "5. Confirmation" })} />
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
  const [ascensionType, setAscensionType] = useState(4); // 4 ou 7
  const [startDateYmd, setStartDateYmd] = useState(() => nextDowYmd(3)); // mercredi par défaut (A4)
  const [creating, setCreating] = useState(false);

  // reset à l'ouverture
  useEffect(() => {
    if (!visible) return;
    setStep(1);
    setAscensionType(4);
    setStartDateYmd(nextDowYmd(3)); // mercredi
    setCreating(false);
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

  // si on change ascensionType, ajuster suggestion date
  useEffect(() => {
    if (!visible) return;
    setStartDateYmd(ascensionType === 7 ? nextDowYmd(0) : nextDowYmd(3));
  }, [ascensionType, visible]);

  const selectedGroup = useMemo(
    () => selectableGroups.find((g) => g.id === selectedGroupId) || null,
    [selectableGroups, selectedGroupId]
  );

  const requiredPlan = useMemo(() => requiredPlanForAscension(ascensionType), [ascensionType]);

  const isPlanAllowed = useMemo(() => {
    if (loadingTier) return true;
    if (!requiredPlan) return true;
    return planRank(userPlan) >= planRank(requiredPlan);
  }, [loadingTier, requiredPlan, userPlan]);

  const noGroupAvailable = selectableGroups.length === 0;

  const onGoToSubscriptions = useCallback(() => {
    onClose?.();
    router.push("/(drawer)/subscriptions");
  }, [router, onClose]);

  const canGoNextFromStep1 = true; // juste lecture
  const canGoNextFromStep2 = !!selectedGroupId && !noGroupAvailable;
  const canGoNextFromStep3 = !!ascensionType; // choix fait
  const canGoNextFromStep4 = !!startDateYmd && isPlanAllowed;

  const canCreate = canGoNextFromStep2 && canGoNextFromStep3 && canGoNextFromStep4;

  const goNext = useCallback(() => setStep((s) => Math.min(5, s + 1)), []);
  const goBack = useCallback(() => setStep((s) => Math.max(1, s - 1)), []);

  const renderStep1 = () => (
    <View style={{ gap: 10 }}>
      <Text style={{ fontWeight: "900", color: colors.text, fontSize: 16 }}>
        {i18n.t("ascension.create.concept.title", { defaultValue: "C’est quoi une Ascension?" })}
      </Text>

      <Text style={{ color: colors.text }}>
        {i18n.t("ascension.create.concept.body1", {
          defaultValue:
            "Une Ascension est un défi “sur plusieurs jours”. Tu démarres à une date précise, tu progresses dans des paliers, et tu compares ta performance aux autres participants du groupe.",
        })}
      </Text>

      <View
        style={{
          padding: 12,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.card2,
          gap: 8,
        }}
      >
        <Text style={{ color: colors.text, fontWeight: "900" }}>
          {i18n.t("ascension.create.concept.quickTitle", { defaultValue: "En bref" })}
        </Text>
        <Text style={{ color: colors.text }}>
          {i18n.t("ascension.create.concept.quick1", { defaultValue: "• Ascension 4 : format plus court (début recommandé mercredi)." })}
        </Text>
        <Text style={{ color: colors.text }}>
          {i18n.t("ascension.create.concept.quick2", { defaultValue: "• Ascension 7 : format complet (début recommandé dimanche)." })}
        </Text>
      </View>
    </View>
  );

  const renderStep2 = () => (
    <View style={{ gap: 10 }}>
    <NovaBubble
        variant="ascension"
        title={i18n.t("nova.ascension.step1.title")}
        body={i18n.t("nova.ascension.step1.body")}
    />
      <Text style={{ fontWeight: "800", color: colors.text }}>
        {i18n.t("ascension.create.wizard.pickGroup", { defaultValue: "Choix du groupe" })}
      </Text>

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

          {selectableGroups.map((g) => {
            const active = g.id === selectedGroupId;
            return (
              <TouchableOpacity
                key={g.id}
                onPress={() => setSelectedGroupId(g.id)}
                style={{
                  paddingVertical: 10,
                  paddingHorizontal: 12,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: active ? colors.primary : colors.border,
                  backgroundColor: active ? colors.primary : colors.card,
                }}
              >
                <Text style={{ color: active ? "#fff" : colors.text, fontWeight: "800" }}>
                  {g.name || g.id}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );

  const renderAscButton = (val, { locked = false } = {}) => {
    const active = ascensionType === val;
    const disabled = locked;

    return (
      <TouchableOpacity
        onPress={() => {
          if (disabled) return;
          setAscensionType(val);
        }}
        activeOpacity={disabled ? 1 : 0.85}
        style={{
          paddingVertical: 12,
          paddingHorizontal: 14,
          borderWidth: 2,
          borderRadius: 14,
          borderColor: active ? colors.primary : colors.border,
          backgroundColor: active ? colors.primary : colors.card,
          opacity: disabled ? 0.35 : 1,
          minWidth: 140,
          alignItems: "center",
        }}
      >
        <Text style={{ color: active ? "#fff" : colors.text, fontWeight: "900" }}>
          {i18n.t("ascension.create.type.label", { defaultValue: "Ascension {{n}}", n: val })}
        </Text>
      </TouchableOpacity>
    );
  };

  const renderStep3 = () => {
    const req7 = requiredPlanForAscension(7);
    const can7 = !req7 || planRank(userPlan) >= planRank(req7);

    return (
      <View style={{ gap: 12 }}>
        <Text style={{ fontWeight: "800", color: colors.text }}>
          {i18n.t("ascension.create.wizard.pickType", { defaultValue: "Choix du format" })}
        </Text>

        <View style={{ flexDirection: "row", justifyContent: "center", gap: 10, flexWrap: "wrap" }}>
          {renderAscButton(4, { locked: false })}
          {renderAscButton(7, { locked: !can7 })}
        </View>

        {!can7 && (
          <View style={{ alignItems: "center", gap: 10 }}>
            <Text style={{ color: colors.subtext, textAlign: "center" }}>
              {i18n.t("ascension.create.type.lockedHint", {
                defaultValue: "Ascension 7 est réservé aux abonnés.",
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
              }}
            >
              <Text style={{ color: "#fff", fontWeight: "900" }}>
                {i18n.t("ascension.create.unlockOther", { defaultValue: "Débloquer Ascension 7" })}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

    const renderStep4 = () => {
    const isA7 = ascensionType === 7;

    return (
        <View style={{ gap: 12 }}>
        <Text style={{ fontWeight: "800", color: colors.text }}>
            {i18n.t("ascension.create.wizard.pickStartDate", { defaultValue: "Date de début" })}
        </Text>

        <Text style={{ color: colors.subtext }}>
            {isA7
            ? i18n.t("ascension.create.startDate.forcedA7", { defaultValue: "Ascension 7 commence toujours un dimanche." })
            : i18n.t("ascension.create.startDate.forcedA4", { defaultValue: "Ascension 4 commence toujours un mercredi." })}
        </Text>

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
            {i18n.t("ascension.create.startDate.planned", { defaultValue: "Début prévu" })}
            </Text>
            <Text style={{ fontWeight: "900", color: colors.text, fontSize: 16 }}>
            {startDateYmd}
            </Text>
        </View>

        {!isPlanAllowed && (
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
                {i18n.t("ascension.create.planLocked", { defaultValue: "Ton abonnement ne permet pas ce format." })}
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
        )}
        </View>
    );
    };

  const renderStep5 = () => {
    const groupLabel = selectedGroup?.name || selectedGroup?.id || selectedGroupId || "-";
    const typeLabel = i18n.t("ascension.create.type.label", { defaultValue: "Ascension {{n}}", n: ascensionType });
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
            label={i18n.t("ascension.create.confirm.type", { defaultValue: "Format" })}
            value={typeLabel}
            onEdit={() => setStep(3)}
          />
          <SummaryRow
            colors={colors}
            label={i18n.t("ascension.create.confirm.startDate", { defaultValue: "Début" })}
            value={dateLabel}
            onEdit={() => setStep(4)}
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
                defaultValue: "Tu pourras inviter les membres du groupe à participer dès la création.",
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
    (step === 3 && !canGoNextFromStep3) ||
    (step === 4 && !canGoNextFromStep4);

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
        type: ascensionType,        // 4 ou 7
        });

        if (!res?.ok) {
        Alert.alert(
            i18n.t("ascension.create.alert.error.title", { defaultValue: "Création impossible" }),
            i18n.t("common.genericError", { defaultValue: "Une erreur est survenue. Veuillez réessayer." })
        );
        return;
        }

        // ✅ tu peux router direct vers le défi créé si tu veux
        if (res.defiId) {
        onClose?.();
        onCreated?.(res);
        router.push(`/(drawer)/defis/${res.defiId}`);
        return;
        }

        onCreated?.(res);
        onClose?.();
    } catch (e) {
        Alert.alert(
            i18n.t("ascension.create.alert.error.title", { defaultValue: "Création impossible" }),
            e?.message || i18n.t("common.genericError", { defaultValue: "Une erreur est survenue. Veuillez réessayer." })
        );
          console.warn("[createAscension] err", {
    code: e?.code,
    message: e?.message,
    details: e?.details,
    raw: e,
  });
  Alert.alert("Création impossible", e?.message || "Erreur");
    } finally {
      setCreating(false);
    }
  }

  const handleClose = useCallback(() => {
    setStep(1);
    setAscensionType(4);
    setStartDateYmd(nextDowYmd(3));
    setCreating(false);
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
            {step === 5 ? renderStep5() : null}
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

            {step < 5 ? (
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