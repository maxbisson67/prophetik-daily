// src/defis/CreateDefiModal.js
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, Modal, ScrollView, TouchableOpacity, Alert } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useAuth } from "@src/auth/SafeAuthProvider";
import { useTheme } from "@src/theme/ThemeProvider";
import { createDefi } from "@src/defis/api";
import i18n from "@src/i18n/i18n";
import ProphetikIcons from "@src/ui/ProphetikIcons";
import { useRouter } from "expo-router";
import useEntitlement from "../subscriptions/useEntitlement";
import NovaBubble from "@src/ui/NovaBubble";

import { Ionicons } from "@expo/vector-icons";

const APP_TZ = "America/Toronto";

/* ----------------------- NHL helpers ----------------------- */
async function fetchNhlDaySummary(gameDateYmd) {
  if (!gameDateYmd) return { count: 0, firstISO: null };

  const safeToInt = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };

  try {
    const res = await fetch(`https://api-web.nhle.com/v1/schedule/${encodeURIComponent(gameDateYmd)}`);
    if (!res.ok) return { count: 0, firstISO: null };

    const data = await res.json();

    const day = Array.isArray(data?.gameWeek)
      ? data.gameWeek.find((d) => d?.date === gameDateYmd)
      : null;

    let games = [];
    if (day) games = Array.isArray(day.games) ? day.games : [];
    else if (Array.isArray(data?.games)) games = data.games;

    const directCount =
      safeToInt(day?.numberOfGames) ??
      safeToInt(day?.totalGames) ??
      safeToInt(data?.numberOfGames) ??
      safeToInt(data?.totalGames);

    const count = directCount ?? games.length ?? 0;
    if (!count || games.length === 0) return { count: 0, firstISO: null };

    const isoList = games
      .map((g) => g?.startTimeUTC || g?.startTimeUTCDate || g?.gameDate || null)
      .filter(Boolean)
      .sort();

    const firstISO = isoList[0] ?? null;
    return { count, firstISO };
  } catch {
    return { count: 0, firstISO: null };
  }
}

function fmtLocalHHmmFromISO(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

/* ----------------------- YMD helpers (timezone-proof) ----------------------- */
function pad2(n) {
  return String(n).padStart(2, "0");
}

function ymdFromLocalDate(d) {
  const y = d.getFullYear();
  const m = pad2(d.getMonth() + 1);
  const day = pad2(d.getDate());
  return `${y}-${m}-${day}`;
}

function dateForPickerFromYmd(ymd) {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d, 12, 0, 0); // midi local
}

function ymdFromPickerDate(d) {
  const fixed = new Date(d);
  fixed.setHours(12, 0, 0, 0);
  return ymdFromLocalDate(fixed);
}

function humanCreateDefiError(err) {
  switch (err?.reason) {
    case "PLAN_NOT_ALLOWED":
      return i18n.t("defi.errors.planNotAllowed");
    case "CREATE_LIMIT_REACHED":
      return i18n.t("defi.errors.createLimitReached", { max: err?.max });
    case "JOIN_LIMIT_REACHED":
      return i18n.t("defi.errors.joinLimitReached", { max: err?.max });
    default:
      return i18n.t("common.genericError");
  }
}

/* ----------------------- UI small helpers ----------------------- */
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
          {i18n.t("defi.create.title", { defaultValue: "Créer un défi" })}
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
        <StepPill
          active={step === 1}
          done={step > 1}
          colors={colors}
          label={i18n.t("defi.create.wizard.step1", { defaultValue: "1. Groupe" })}
        />
        <StepPill
          active={step === 2}
          done={step > 2}
          colors={colors}
          label={i18n.t("defi.create.wizard.step2", { defaultValue: "2. Format" })}
        />
        <StepPill
          active={step === 3}
          done={step > 3}
          colors={colors}
          label={i18n.t("defi.create.wizard.step3", { defaultValue: "3. Date" })}
        />
        <StepPill
          active={step === 4}
          done={false}
          colors={colors}
          label={i18n.t("defi.create.wizard.step4", { defaultValue: "4. Confirmation" })}
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

/* ----------------------- Component ----------------------- */
export default function CreateDefiModal({
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

  // Wizard step
  const [step, setStep] = useState(1);

  // Selection
  const [selectedGroupId, setSelectedGroupId] = useState(initialGroupId);
  const [size, setSize] = useState("1x1");

  // ✅ Source de vérité unique: date NHL sous forme YYYY-MM-DD
  const [gameDateYmd, setGameDateYmd] = useState(() => ymdFromLocalDate(new Date()));
  const [showDayPicker, setShowDayPicker] = useState(false);

  // Verify NHL date
  const [verifying, setVerifying] = useState(false);
  const [verifyCount, setVerifyCount] = useState(null);
  const [verifyFirstISO, setVerifyFirstISO] = useState(null);
  const [verifyStatus, setVerifyStatus] = useState("idle");
  const [verifyMsg, setVerifyMsg] = useState("");

  const [creating, setCreating] = useState(false);

  // Reset wizard when opening
  useEffect(() => {
    if (!visible) return;
    setStep(1);
    setSize("1x1");
    setGameDateYmd(ymdFromLocalDate(new Date()));
    setVerifyStatus("idle");
    setVerifyMsg("");
    setVerifyCount(null);
    setVerifyFirstISO(null);
  }, [visible]);

  // Default group logic
  useEffect(() => {
    if (!visible) return;

    setSelectedGroupId((prev) => {
      if (prev && selectableGroups.some((g) => g.id === prev)) return prev;
      if (initialGroupId && selectableGroups.some((g) => g.id === initialGroupId)) return initialGroupId;
      return selectableGroups[0]?.id ?? null;
    });
  }, [visible, initialGroupId, selectableGroups]);

  // Format groups (two lines)
  const LINE1 = ["1x1", "2x2", "3x3", "4x4"];
  const LINE2 = ["5x5", "6x6", "7x7"];

  const requiredPlanForSize = useMemo(() => {
    if (size === "5x5" || size === "6x6" || size === "7x7") return "pro";
    return null; // free (1..4)
  }, [size]);

  function planRank(p) {
    if (p === "vip") return 3;
    if (p === "pro") return 2;
    return 1;
  }

  const isPlanAllowed = useMemo(() => {
    if (loadingTier) return true;
    const req = requiredPlanForSize;
    if (!req) return true;
    return planRank(userPlan) >= planRank(req);
  }, [requiredPlanForSize, userPlan, loadingTier]);

  const requiredPlanForAnySize = useCallback((s) => {
    if (s === "5x5" || s === "6x6" || s === "7x7") return "pro";
    return null;
  }, []);

const nova = useMemo(() => {
  // Step 1
  if (step === 1) {
    if (!selectedGroupId) {
      return {
        variant: "groups",
        titleKey: "defi.nova.groups.title",
        bodyKey: "defi.nova.groups.body",
      };
    }
    return {
      variant: "groups",
      titleKey: "defi.nova.groupsOk.title",
      bodyKey: "defi.nova.groupsOk.body",
    };
  }

  // Step 2
  if (step === 2) {
    if (!isPlanAllowed) {
      return {
        variant: "format",
        titleKey: "defi.nova.locked.title",
        bodyKey: "defi.nova.locked.body",
      };
    }
    return {
      variant: "format",
      titleKey: "defi.nova.format.title",
      bodyKey: "defi.nova.format.body",
    };
  }

  // Step 3
  if (step === 3) {
    if (verifying) {
      return {
        variant: "calendar",
        titleKey: "defi.nova.verifying.title",
        bodyKey: "defi.nova.verifying.body",
      };
    }
    if (verifyStatus === "none") {
      return {
        variant: "calendar",
        titleKey: "defi.nova.noGames.title",
        bodyKey: "defi.nova.noGames.body",
        bodyVars: { date: gameDateYmd },
      };
    }
    if (verifyStatus === "ok") {
      return {
        variant: "calendar",
        titleKey: "defi.nova.dateOk.title",
        bodyKey: "defi.nova.dateOk.body",
        bodyVars: { count: verifyCount },
      };
    }
    return {
      variant: "calendar",
      titleKey: "defi.nova.date.title",
      bodyKey: "defi.nova.date.body",
    };
  }

  // Step 4 (confirm)
  if (step === 4) {
    return {
      variant: "thumbsUp",
      titleKey: "defi.nova.confirm.title",
      bodyKey: "defi.nova.confirm.body",
    };
  }

  return { variant: "neutral", titleKey: "defi.nova.default.title", bodyKey: "defi.nova.default.body" };
}, [step, selectedGroupId, isPlanAllowed, verifying, verifyStatus, gameDateYmd, verifyCount]);

  const isSizeAllowed = useCallback(
    (s) => {
      const req = requiredPlanForAnySize(s);
      if (!req) return true;
      return planRank(userPlan) >= planRank(req);
    },
    [userPlan, requiredPlanForAnySize]
  );

  const nType = useMemo(() => {
    const n = parseInt(String(size).split("x")[0], 10);
    return Number.isFinite(n) ? n : 0;
  }, [size]);

  const participationCost = nType;

  const computedTitle = useMemo(() => {
    return i18n.t("defi.create.autoTitle", { format: size, defaultValue: `Défi ${size}` });
  }, [size]);

  const signupDeadlineLocal = useMemo(() => {
    if (!verifyFirstISO) return null;
    const first = new Date(verifyFirstISO);
    return new Date(first.getTime() - 60 * 60 * 1000);
  }, [verifyFirstISO]);

  const verifyDate = useCallback(async () => {
    if (!gameDateYmd) return;

    setVerifying(true);
    setVerifyStatus("idle");
    setVerifyMsg("");

    try {
      const { count, firstISO } = await fetchNhlDaySummary(gameDateYmd);

      setVerifyCount(count);
      setVerifyFirstISO(firstISO);

      if (!count) {
        setVerifyStatus("none");
        setVerifyMsg(
          i18n.t("defi.create.verify.noGames", {
            date: gameDateYmd,
            defaultValue: `Aucun match NHL trouvé pour ${gameDateYmd}.`,
          })
        );
        return;
      }

      const timeMsg = firstISO
        ? i18n.t("defi.create.verify.okWithTime", {
            count,
            time: fmtLocalHHmmFromISO(firstISO),
            defaultValue: `${count} matchs trouvés. Premier à ${fmtLocalHHmmFromISO(firstISO)}.`,
          })
        : i18n.t("defi.create.verify.okNoTime", {
            count,
            defaultValue: `${count} matchs trouvés.`,
          });

      setVerifyStatus("ok");
      setVerifyMsg(timeMsg);
    } catch (e) {
      setVerifyStatus("error");
      setVerifyMsg(
        i18n.t("defi.create.verify.error", {
          message: String(e?.message || e),
          defaultValue: `Erreur: ${String(e?.message || e)}`,
        })
      );
      setVerifyCount(0);
      setVerifyFirstISO(null);
    } finally {
      setVerifying(false);
    }
  }, [gameDateYmd]);

  // Auto-verify only when step 3 visible
  useEffect(() => {
    if (!visible) return;
    if (step !== 3) return;
    verifyDate();
  }, [visible, step, verifyDate]);

  useEffect(() => {
    if (!visible) return;
    if (step !== 3) return;
    verifyDate();
  }, [gameDateYmd, visible, step, verifyDate]);

  const onGoToSubscriptions = useCallback(() => {
    onClose?.();
    router.push("/(drawer)/subscriptions");
  }, [router, onClose]);

  const noGroupAvailable = selectableGroups.length === 0;

  // Step guards
  const canGoNextFromStep1 = !!selectedGroupId && !noGroupAvailable;
  const canGoNextFromStep2 = !!size;
  const canGoNextFromStep3 = useMemo(() => {
    if (!isPlanAllowed) return false;
    if (!verifyCount || !signupDeadlineLocal) return false;
    return new Date() < signupDeadlineLocal;
  }, [isPlanAllowed, verifyCount, signupDeadlineLocal]);

  const canCreate = canGoNextFromStep3; // même condition (date valide + plan ok)

  const goNext = useCallback(() => {
    setStep((s) => Math.min(4, s + 1));
  }, []);

  const goBack = useCallback(() => {
    setStep((s) => Math.max(1, s - 1));
  }, []);

  async function handleCreate() {
    if (!user?.uid) return;
    if (!selectedGroupId) return;

    if (!verifyCount) {
      Alert.alert(
        i18n.t("defi.create.alert.noGames.title", { defaultValue: "Aucun match NHL" }),
        i18n.t("defi.create.alert.noGames.body", {
          date: gameDateYmd,
          defaultValue: `Aucun match NHL pour ${gameDateYmd}.`,
        })
      );
      return;
    }

    setCreating(true);

    try {
      let firstISO = verifyFirstISO;
      if (!firstISO) {
        const { count, firstISO: fromApi } = await fetchNhlDaySummary(gameDateYmd);
        if (!count) {
          Alert.alert(
            i18n.t("defi.create.alert.noGames.title", { defaultValue: "Aucun match NHL" }),
            i18n.t("defi.create.alert.noGames.body", {
              date: gameDateYmd,
              defaultValue: `Aucun match NHL pour ${gameDateYmd}.`,
            })
          );
          return;
        }
        firstISO = fromApi;
      }

      const firstGameDate = new Date(firstISO);
      const signupDeadline = signupDeadlineLocal || new Date(firstGameDate.getTime() - 60 * 60 * 1000);

      if (new Date() >= signupDeadline) {
        const hh = pad2(signupDeadline.getHours());
        const mm = pad2(signupDeadline.getMinutes());
        Alert.alert(
          i18n.t("defi.create.alert.deadlinePassed.title", { defaultValue: "Date limite dépassée" }),
          i18n.t("defi.create.alert.deadlinePassed.body", {
            date: gameDateYmd,
            time: `${hh}:${mm}`,
            defaultValue: `La date limite est passée (${gameDateYmd} à ${hh}:${mm}).`,
          })
        );
        return;
      }

      const payload = {
        groupId: selectedGroupId,
        title: computedTitle,
        type: nType,
        gameDate: gameDateYmd,
        createdBy: user.uid,
        participationCost,
        status: "open",
        pot: 0,
        firstGameUTC: firstGameDate,
        signupDeadline,
        ...(__DEV__ ? { debugNotifyCreator: true } : {}),
      };

      const res = await createDefi(payload);

      if (!res?.ok) {
        const msg = humanCreateDefiError(res?.error);
        Alert.alert(
          i18n.t("defi.create.alert.error.title", { defaultValue: "Création impossible" }),
          i18n.t("defi.create.alert.error.body", {
            message: msg,
            defaultValue: `Une erreur s’est produite lors de la création du défi : ${msg}`,
          })
        );
        return;
      }

      const created = res?.data;
      onCreated?.({ defiId: created?.id || null, groupId: selectedGroupId });
      onClose?.();
    } catch (e) {
      Alert.alert(
        i18n.t("defi.create.alert.error.title", { defaultValue: "Création impossible" }),
        i18n.t("common.genericError", { defaultValue: "Une erreur est survenue. Veuillez réessayer." })
      );
      console.warn("[CreateDefiModal] unexpected error", e);
    } finally {
      setCreating(false);
    }
  }

  const handleClose = useCallback(() => {
    setStep(1);
    setShowDayPicker(false);
    onClose?.();
  }, [onClose]);

  const selectedGroup = useMemo(
    () => selectableGroups.find((g) => g.id === selectedGroupId) || null,
    [selectableGroups, selectedGroupId]
  );

  const renderStep1 = () => {
    return (
      <View style={{ gap: 10 }}>
      {/* 🧠 Nova */}
      <NovaBubble
        variant="groups"
        title={i18n.t("nova.defi.step1.title")}
        body={i18n.t("nova.defi.step1.body")}
      />



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
              {i18n.t("defi.create.group.noneBody", {
                defaultValue: "Crée un groupe pour pouvoir créer un défi.",
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
  };

  const renderSizeButton = (s, { locked = false } = {}) => {
    const active = s === size;
    const disabled = locked;

    return (
      <TouchableOpacity
        key={s}
        onPress={() => {
          if (disabled) return;
          setSize(s);
        }}
        activeOpacity={disabled ? 1 : 0.85}
        style={{
          paddingVertical: 10,
          paddingHorizontal: 14,
          borderWidth: 2,
          borderRadius: 14,
          borderColor: active ? colors.primary : colors.border,
          backgroundColor: active ? colors.primary : colors.card,
          opacity: disabled ? 0.35 : 1,
        }}
      >
        <Text style={{ color: active ? "#fff" : colors.text, fontWeight: "900", fontSize: 14 }}>
          {s}
        </Text>
      </TouchableOpacity>
    );
  };

  const renderStep2 = () => {
    const line2Locked = planRank(userPlan) < planRank("pro");

    return (
      <View style={{ gap: 12 }}>
        <NovaBubble
          variant="format"
          title={i18n.t("nova.defi.step2.title")}
          body={i18n.t("nova.defi.step2.body")}
        />
        <Text style={{ fontWeight: "800", color: colors.text }}>
          {i18n.t("defi.create.wizard.pickFormat", { defaultValue: "Choix du format" })}
        </Text>

        <View style={{ flexDirection: "row", justifyContent: "center", gap: 8, flexWrap: "wrap" }}>
          {LINE1.map((s) => renderSizeButton(s))}
        </View>

        <View style={{ alignItems: "center", gap: 8 }}>
          <View style={{ flexDirection: "row", justifyContent: "center", gap: 8, flexWrap: "wrap" }}>
            {LINE2.map((s) => {
              const allowed = isSizeAllowed(s);
              return renderSizeButton(s, { locked: !allowed });
            })}
          </View>

          {line2Locked && (
            <TouchableOpacity
              onPress={onGoToSubscriptions}
              style={{
                marginTop: 2,
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
                {i18n.t("defi.create.unlockOther", { defaultValue: "Débloquer les autres défis" })}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {!isPlanAllowed && (
          <View
            style={{
              padding: 12,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: "#b91c1c",
              backgroundColor: colors.card2,
              gap: 8,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <View style={{ width: 44, alignItems: "center", justifyContent: "center", marginRight: 10 }}>
                <ProphetikIcons mode="badge" variant={requiredPlanForSize} iconOnly size="xl" />
              </View>

              <Text style={{ color: colors.text, fontWeight: "900", flex: 1 }} numberOfLines={2}>
                {i18n.t("defi.create.planLocked.title", {
                  plan: requiredPlanForSize?.toUpperCase?.() ?? "",
                  defaultValue: `Défi ${requiredPlanForSize?.toUpperCase?.() ?? ""} — non disponible`,
                })}
              </Text>
            </View>

            <Text style={{ color: colors.subtext, fontSize: 12 }}>
              {i18n.t("defi.create.planLocked.body", {
                size,
                defaultValue: `Abonne-toi pour débloquer ${size} et accéder aux défis premium.`,
              })}
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
                {i18n.t("defi.create.planLocked.cta", { defaultValue: "Voir les abonnements" })}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  const renderStep3 = () => {
    const meta =
      verifyCount != null
        ? ` (${verifyCount} ${i18n.t("defi.create.date.matchesShort", { defaultValue: "match(s)" })}${
            verifyFirstISO
              ? ` – ${i18n.t("defi.create.date.firstAt", {
                  time: fmtLocalHHmmFromISO(verifyFirstISO),
                  defaultValue: `1er à ${fmtLocalHHmmFromISO(verifyFirstISO)}`,
                })}`
              : ""
          }${
            signupDeadlineLocal
              ? ` – ${i18n.t("defi.create.date.deadlineAt", {
                  time: `${pad2(signupDeadlineLocal.getHours())}:${pad2(signupDeadlineLocal.getMinutes())}`,
                  defaultValue: `limite ${pad2(signupDeadlineLocal.getHours())}:${pad2(
                    signupDeadlineLocal.getMinutes()
                  )}`,
                })}`
              : ""
          })`
        : "";

    return (
      <View style={{ gap: 12 }}>
        <NovaBubble
          variant="calendar"
          title={i18n.t("nova.defi.step3.title")}
          body={i18n.t("nova.defi.step3.body")}
        />
        <Text style={{ fontWeight: "800", color: colors.text }}>
          {i18n.t("defi.create.wizard.pickDate", { defaultValue: "Choix de la date" })}
        </Text>

        <Text style={{ fontWeight: "700", color: colors.text }}>
          {i18n.t("defi.create.date.labelBase", { defaultValue: "Date NHL{{meta}}", meta })}
        </Text>

        {verifyMsg ? (
          <Text
            style={{
              fontSize: 12,
              marginTop: 2,
              color:
                verifyStatus === "ok"
                  ? "#0a7"
                  : verifyStatus === "none" || verifyStatus === "error"
                  ? "#b00020"
                  : colors.subtext,
            }}
          >
            {verifying ? i18n.t("defi.create.verify.loading", { defaultValue: "Vérification…" }) : verifyMsg}
          </Text>
        ) : null}

        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <View
            style={{
              flex: 1,
              padding: 12,
              borderWidth: 1,
              borderRadius: 12,
              borderColor: colors.border,
              backgroundColor: colors.card2,
            }}
          >
            <Text style={{ fontWeight: "900", color: colors.text }}>{gameDateYmd}</Text>
          </View>

          <TouchableOpacity
            onPress={() => setShowDayPicker(true)}
            style={{
              paddingVertical: 10,
              paddingHorizontal: 12,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.card,
            }}
          >
            <Text style={{ color: colors.text, fontWeight: "800" }}>
              {i18n.t("defi.create.date.change", { defaultValue: "Changer" })}
            </Text>
          </TouchableOpacity>
        </View>

        {showDayPicker && (
          <DateTimePicker
            value={dateForPickerFromYmd(gameDateYmd)}
            mode="date"
            onChange={(e, d) => {
              setShowDayPicker(false);
              if (d) setGameDateYmd(ymdFromPickerDate(d));
            }}
          />
        )}

        <Text style={{ color: colors.subtext, fontSize: 12 }}>
          {i18n.t("defi.create.hint.signupDeadline", {
            defaultValue: "Tu peux t'inscrire jusqu'à 1h avant le premier match.",
          })}
        </Text>
      </View>
    );
  };

  const renderStep4 = () => {
    const groupLabel = selectedGroup?.name || selectedGroup?.id || selectedGroupId || "-";
    const formatLabel = size || "-";
    const dateLabel = gameDateYmd || "-";

    const gamesLabel =
      verifyCount != null
        ? i18n.t("defi.create.wizard.confirm.gamesValue", {
            count: verifyCount,
            defaultValue: "{{count}} match(s)",
          })
        : "-";

    const firstGameLabel = verifyFirstISO ? fmtLocalHHmmFromISO(verifyFirstISO) : "-";
    const deadlineLabel = signupDeadlineLocal
      ? `${pad2(signupDeadlineLocal.getHours())}:${pad2(signupDeadlineLocal.getMinutes())}`
      : "-";

    return (
      <View style={{ gap: 14 }}>
        <NovaBubble
          variant="thumbsUp"
          title={i18n.t("nova.defi.confirm.title")}
          body={i18n.t("nova.defi.confirm.body")}
        />
        <Text style={{ fontWeight: "900", color: colors.text, fontSize: 16 }}>
          {i18n.t("defi.create.wizard.confirmTitle", { defaultValue: "Confirmer le défi" })}
        </Text>

        <View style={{ gap: 12 }}>
          <SummaryRow
            colors={colors}
            label={i18n.t("defi.create.wizard.summary.group", { defaultValue: "Groupe" })}
            value={groupLabel}
            onEdit={() => setStep(1)}
          />
          <SummaryRow
            colors={colors}
            label={i18n.t("defi.create.wizard.summary.format", { defaultValue: "Format" })}
            value={formatLabel}
            onEdit={() => setStep(2)}
          />
          <SummaryRow
            colors={colors}
            label={i18n.t("defi.create.wizard.summary.date", { defaultValue: "Date" })}
            value={dateLabel}
            onEdit={() => setStep(3)}
          />

          <View
            style={{
              marginTop: 4,
              padding: 12,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.card2,
              gap: 10,
            }}
          >
            <SummaryRow
              colors={colors}
              label={i18n.t("defi.create.wizard.summary.games", { defaultValue: "Matchs" })}
              value={gamesLabel}
            />
            <SummaryRow
              colors={colors}
              label={i18n.t("defi.create.wizard.summary.firstGame", { defaultValue: "Premier match" })}
              value={firstGameLabel}
            />
            <SummaryRow
              colors={colors}
              label={i18n.t("defi.create.wizard.summary.deadline", { defaultValue: "Date limite" })}
              value={deadlineLabel}
            />
          </View>

          {!isPlanAllowed && (
            <View
              style={{
                padding: 12,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: "#b91c1c",
                backgroundColor: colors.card2,
              }}
            >
              <Text style={{ color: colors.text, fontWeight: "900" }}>
                {i18n.t("defi.errors.planNotAllowed", { defaultValue: "Ton abonnement ne permet pas ce défi." })}
              </Text>

              <TouchableOpacity
                onPress={onGoToSubscriptions}
                style={{
                  marginTop: 10,
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
                  {i18n.t("defi.create.unlockOther", { defaultValue: "Débloquer les autres défis" })}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    );
  };

  if (!visible) return null;

  // Next button disabled logic per step
  const nextDisabled =
    creating ||
    (step === 1 && !canGoNextFromStep1) ||
    (step === 2 && !canGoNextFromStep2) ||
    (step === 3 && !canGoNextFromStep3);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} presentationStyle="pageSheet">
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

          {/* STEP BODY */}
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

          {/* ACTIONS */}
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
                onPress={handleCreate}
                disabled={creating || !canCreate || !isPlanAllowed}
                style={{
                  flex: 1,
                  padding: 12,
                  borderRadius: 12,
                  alignItems: "center",
                  backgroundColor: creating || !canCreate || !isPlanAllowed ? colors.subtext : "#b91c1c",
                  opacity: !isPlanAllowed ? 0.75 : 1,
                }}
              >
                <Text style={{ color: "#fff", fontWeight: "900" }}>
                  {creating
                    ? i18n.t("defi.create.actions.creating", { defaultValue: "Création…" })
                    : i18n.t("defi.create.actions.createNow", { defaultValue: "Créer le défi" })}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}