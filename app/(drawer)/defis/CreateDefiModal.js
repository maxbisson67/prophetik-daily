// src/defis/CreateDefiModal.js
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, Modal, ScrollView, TouchableOpacity, Alert } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useAuth } from "@src/auth/SafeAuthProvider";
import { useTheme } from "@src/theme/ThemeProvider";
import { createDefi } from "@src/defis/api";
import i18n from "@src/i18n/i18n";
import firestore from "@react-native-firebase/firestore";
import Analytics from "@src/services/analytics";
import { filterMlbScheduleGames } from "@src/mlb/mlbGameStatusUtils";
import { getProphetikBusinessYmd } from "@src/lib/prophetikBusinessDate";
import { filterGroupsForManualChallengeCreation } from "@src/groups/groupAutopilotUtils";

import { Ionicons } from "@expo/vector-icons";

const APP_TZ = "America/Toronto";
const SIGNUP_DEADLINE_MINUTES_BEFORE_FIRST_GAME = 15;
const TS_FORMAT = "3x3";
const TS_TYPE = 3;
const WIZARD_STEPS = 3;


function ymdToCompact(ymd) {
  return String(ymd || "").slice(0, 10).replace(/-/g, "");
}

function tsToIso(v) {
  if (!v) return null;
  const d =
    typeof v?.toDate === "function"
      ? v.toDate()
      : v instanceof Date
      ? v
      : new Date(v);
  return Number.isFinite(d?.getTime?.()) ? d.toISOString() : null;
}

function startTimeMs(v) {
  if (!v) return Number.POSITIVE_INFINITY;
  const d =
    typeof v?.toDate === "function"
      ? v.toDate()
      : v instanceof Date
      ? v
      : new Date(v);
  const ms = d?.getTime?.();
  return Number.isFinite(ms) ? ms : Number.POSITIVE_INFINITY;
}

async function fetchEligibleDaySummaryFromFirestore(gameDateYmd, sport = "NHL") {
  if (!gameDateYmd) return { status: "none", count: 0, firstISO: null };

  const league = String(sport || "NHL").toUpperCase();
  const dayId = ymdToCompact(gameDateYmd);

  try {
    if (league === "MLB") {
      const dayDocRef = firestore().doc(`mlb_schedule_daily/${dayId}`);
      const snap = await dayDocRef.collection("games").limit(50).get();

      if (snap.empty) {
        const daySnap = await dayDocRef.get();
        if (!daySnap.exists) {
          return { status: "not_ready", count: 0, firstISO: null };
        }
        return { status: "none", count: 0, firstISO: null };
      }

      const eligible = filterMlbScheduleGames(snap.docs);
      const count = eligible.length;
      const nowMs = Date.now();
      const upcoming = eligible.filter(
        (g) => startTimeMs(g.startTimeUTC) > nowMs
      );
      const firstGame = upcoming[0] || eligible[0] || null;
      const firstISO = firstGame ? tsToIso(firstGame.startTimeUTC) : null;

      return { status: count ? "ok" : "none", count, firstISO };
    }

    const dayDocRef = firestore().doc(`nhl_matchups_daily/${dayId}`);
    const daySnap = await dayDocRef.get();

    if (!daySnap.exists) {
      return { status: "not_ready", count: 0, firstISO: null };
    }

    const snap = await dayDocRef
      .collection("games")
      .where("eligibleForProphetik", "==", true)
      .orderBy("startTimeUTC", "asc")
      .limit(50)
      .get();

    const count = snap.size || 0;
    const firstISO = count ? tsToIso(snap.docs[0]?.data()?.startTimeUTC) : null;

    return { status: count ? "ok" : "none", count, firstISO };
  } catch (e) {
    console.warn("[fetchEligibleDaySummaryFromFirestore]", e?.code || e?.message || e);
    return { status: "error", count: 0, firstISO: null };
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
    case "DEFI_TOO_EARLY": {
      const max = err?.maxAheadHours ?? 72;
      const ahead = err?.aheadHours;
      // Optionnel: arrondir pour message propre
      const aheadRounded = Number.isFinite(Number(ahead)) ? Math.ceil(Number(ahead)) : null;

      return i18n.t("defi.errors.defiTooEarly", {
        max,
        aheadHours: aheadRounded,
        defaultValue: aheadRounded
          ? `Ce défi est trop loin dans le futur (${aheadRounded}h). Tu peux créer un défi au maximum ${max}h à l’avance.`
          : `Ce défi est trop loin dans le futur. Tu peux créer un défi au maximum ${max}h à l’avance.`,
      });
    }
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
  const steps = [
    i18n.t("defi.create.wizard.step1", { defaultValue: "1. Groupe" }),
    i18n.t("defi.create.wizard.stepDate", { defaultValue: "2. Date" }),
    i18n.t("defi.create.wizard.stepConfirm", { defaultValue: "3. Confirmation" }),
  ];

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

      <Text style={{ color: colors.subtext, fontSize: 13, fontWeight: "700" }}>
        {i18n.t("defi.create.formatFixed", {
          defaultValue: "Format : Top scoreurs {{format}}",
          format: TS_FORMAT,
        })}
      </Text>

      {/* Steps */}
      <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
        {steps.map((label, idx) => {
          const n = idx + 1;
          return (
            <StepPill
              key={label}
              active={step === n}
              done={step > n}
              colors={colors}
              label={label}
            />
          );
        })}
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
  const insets = useSafeAreaInsets();

  const selectableGroups = useMemo(
    () =>
      filterGroupsForManualChallengeCreation(groups).filter((g) => {
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

  const [gameDateYmd, setGameDateYmd] = useState(() => getProphetikBusinessYmd());
  const [showDayPicker, setShowDayPicker] = useState(false);

  // Verify NHL date
  const [verifying, setVerifying] = useState(false);
  const [verifyCount, setVerifyCount] = useState(null);
  const [verifyFirstISO, setVerifyFirstISO] = useState(null);
  const [verifyStatus, setVerifyStatus] = useState("idle");
  const [verifyMsg, setVerifyMsg] = useState("");

  const [creating, setCreating] = useState(false);

  const [groupDropdownOpen, setGroupDropdownOpen] = useState(false);

  // Reset wizard when opening
  useEffect(() => {
    if (!visible) return;
    setStep(1);
    setGameDateYmd(getProphetikBusinessYmd());
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

  useEffect(() => {
    if (!visible) return;
    setStep(1);
    setGameDateYmd(getProphetikBusinessYmd());
    setVerifyStatus("idle");
    setVerifyMsg("");
    setVerifyCount(null);
    setVerifyFirstISO(null);
    setGroupDropdownOpen(false);
  }, [visible]);

  const nType = TS_TYPE;
  const size = TS_FORMAT;
  const participationCost = TS_TYPE;

  const computedTitle = useMemo(() => {
    return i18n.t("defi.create.autoTitle", { format: size, defaultValue: `Défi ${size}` });
  }, [size]);

const nova = useMemo(() => {
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

  if (step === 2) {
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

  if (step === 3) {
    return {
      variant: "thumbsUp",
      titleKey: "defi.nova.confirm.title",
      bodyKey: "defi.nova.confirm.body",
    };
  }

  return { variant: "neutral", titleKey: "defi.nova.default.title", bodyKey: "defi.nova.default.body" };
}, [step, selectedGroupId, verifying, verifyStatus, gameDateYmd, verifyCount]);

  const signupDeadlineLocal = useMemo(() => {
    if (!verifyFirstISO) return null;
    const first = new Date(verifyFirstISO);
    return new Date(first.getTime() - SIGNUP_DEADLINE_MINUTES_BEFORE_FIRST_GAME * 60 * 1000);
  }, [verifyFirstISO]);

  const selectedGroup = useMemo(
    () => selectableGroups.find((g) => g.id === selectedGroupId) || null,
    [selectableGroups, selectedGroupId]
  );

  const groupSport = useMemo(
    () => String(selectedGroup?.sport || "NHL").toUpperCase(),
    [selectedGroup?.sport]
  );

  const verifyDate = useCallback(async () => {
    if (!gameDateYmd) return;

    setVerifying(true);
    setVerifyStatus("idle");
    setVerifyMsg("");

    try {
      const { status, count, firstISO } = await fetchEligibleDaySummaryFromFirestore(
        gameDateYmd,
        groupSport
      );
      setVerifyCount(count);
      setVerifyFirstISO(firstISO);

     if (status === "not_ready") {
        setVerifyStatus("idle");
        setVerifyMsg(
          i18n.t("defi.create.verify.notReady", {
            date: gameDateYmd,
            defaultValue: `Horaire en préparation pour ${gameDateYmd}. Réessaie dans un instant.`,
          })
        );
        return;
      }

      if (!count) {
        setVerifyStatus("none");
        setVerifyMsg(
          i18n.t("defi.create.verify.noEligibleGames", {
            date: gameDateYmd,
            defaultValue: `Aucun match éligible pour ${gameDateYmd}.`,
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
  }, [gameDateYmd, groupSport]);

  // Auto-verify when date step visible
  useEffect(() => {
    if (!visible) return;
    if (step !== 2) return;
    verifyDate();
  }, [visible, step, verifyDate]);

  useEffect(() => {
    if (!visible) return;
    if (step !== 2) return;
    verifyDate();
  }, [gameDateYmd, groupSport, visible, step, verifyDate]);

  const noGroupAvailable = selectableGroups.length === 0;

  // Step guards
  const canGoNextFromStep1 = !!selectedGroupId && !noGroupAvailable;
  const canGoNextFromStep2 = useMemo(() => {
    if (!verifyCount || !signupDeadlineLocal) return false;
    return new Date() < signupDeadlineLocal;
  }, [verifyCount, signupDeadlineLocal]);

  const canCreate = canGoNextFromStep2;

  const goNext = useCallback(() => {
    setStep((s) => Math.min(WIZARD_STEPS, s + 1));
  }, []);

  const goBack = useCallback(() => {
    setStep((s) => Math.max(1, s - 1));
  }, []);

  async function handleCreate() {
    if (!user?.uid) return;
    if (!selectedGroupId) return;

    if (!verifyCount) {
      Alert.alert(
        i18n.t("defi.create.alert.noGames.title", {
          defaultValue: groupSport === "MLB" ? "Aucun match MLB" : "Aucun match NHL",
        }),
        i18n.t("defi.create.alert.noGames.body", {
          date: gameDateYmd,
          defaultValue: `Aucun match éligible pour ${gameDateYmd}.`,
        })
      );
      return;
    }

    setCreating(true);

    try {
      let firstISO = verifyFirstISO;

      if (!firstISO) {
        const { status, count, firstISO: fsFirstISO } =
          await fetchEligibleDaySummaryFromFirestore(gameDateYmd, groupSport);

        if (status === "not_ready") {
          Alert.alert(
            i18n.t("defi.create.alert.notReady.title", { defaultValue: "Horaire en préparation" }),
            i18n.t("defi.create.alert.notReady.body", {
              date: gameDateYmd,
              defaultValue: `Les matchs ne sont pas encore disponibles pour ${gameDateYmd}. Réessaie dans un instant.`,
            })
          );
          return;
        }

        if (!count) {
          Alert.alert(
            i18n.t("defi.create.alert.noGames.title", { defaultValue: "Aucun match éligible" }),
            i18n.t("defi.create.alert.noGames.body", {
              date: gameDateYmd,
              defaultValue: `Aucun match éligible pour ${gameDateYmd}.`,
            })
          );
          return;
        }

        firstISO = fsFirstISO;
      }

      const firstGameDate = new Date(firstISO);
      const signupDeadline = signupDeadlineLocal || new Date(firstGameDate.getTime() - SIGNUP_DEADLINE_MINUTES_BEFORE_FIRST_GAME * 60 * 1000);

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

      Analytics.createChallenge({
        type: "standard",
        groupId: String(selectedGroupId),
        format: String(size),
        gameDate: String(gameDateYmd),
      });

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

  const renderStep1 = () => {
    return (
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

<View style={{ gap: 8 }}>

  {/* Bouton dropdown */}
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
      {selectedGroup?.name || selectedGroup?.id || i18n.t("common.choose", { defaultValue: "Choisir…" })}
    </Text>

    <Ionicons
      name={groupDropdownOpen ? "chevron-up" : "chevron-down"}
      size={18}
      color={colors.text}
    />
  </TouchableOpacity>

    {/* Liste déroulante */}
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
          {selectableGroups.map((g) => {
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
                  borderTopWidth: 1,
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

          </View>
        )}
      </View>
    );
  };

  const renderStep2Date = () => {
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

        <Text style={{ fontWeight: "800", color: colors.text }}>
          {i18n.t("defi.create.wizard.pickDate", { defaultValue: "Choix de la date" })}
        </Text>

        <Text style={{ fontWeight: "700", color: colors.text }}>
          {groupSport === "MLB"
            ? i18n.t("defi.create.date.labelMlb", {
                defaultValue: "Date MLB{{meta}}",
                meta,
              })
            : i18n.t("defi.create.date.labelBase", { defaultValue: "Date NHL{{meta}}", meta })}
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
            defaultValue: "Tu peux t'inscrire jusqu'à 15 minutes avant le premier match.",
          })}
        </Text>
      </View>
    );
  };

  const renderStep3Confirm = () => {
    const groupLabel = selectedGroup?.name || selectedGroup?.id || selectedGroupId || "-";
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
            label={i18n.t("defi.create.wizard.summary.date", { defaultValue: "Date" })}
            value={dateLabel}
            onEdit={() => setStep(2)}
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
        </View>
      </View>
    );
  };

  if (!visible) return null;

  const nextDisabled =
    creating ||
    (step === 1 && !canGoNextFromStep1) ||
    (step === 2 && !canGoNextFromStep2);

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
            {step === 2 ? renderStep2Date() : null}
            {step === 3 ? renderStep3Confirm() : null}
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

            {step < WIZARD_STEPS ? (
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