import { useCallback, useEffect, useState } from "react";
import functions from "@react-native-firebase/functions";
import firestore from "@react-native-firebase/firestore";
import useEntitlement from "../../app/(drawer)/subscriptions/useEntitlement";
import { getPlanLimits } from "@src/subscriptions/planLimits";

function isActiveOwnedGroup(data = {}) {
  if (data.active === false) return false;
  const status = String(data.status || "active").toLowerCase();
  return status !== "archived" && status !== "deleted";
}

function isGroupAutopilotEnabled(data = {}) {
  return data?.autopilotEnabled !== false;
}

export default function usePlanUsage(uid) {
  const { tier, active, loading: entitlementLoading } = useEntitlement(uid);
  const effectiveTier = active === false ? "free" : tier;
  const limits = getPlanLimits(effectiveTier, active !== false);

  const [ownedGroupsCount, setOwnedGroupsCount] = useState(0);
  const [autopilotGroupsCount, setAutopilotGroupsCount] = useState(0);
  const [novaAdviceUsed, setNovaAdviceUsed] = useState(0);
  const [needsAutopilotResolution, setNeedsAutopilotResolution] = useState(false);
  const [period, setPeriod] = useState(null);
  const [loadingUsage, setLoadingUsage] = useState(!!uid);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!uid) {
      setOwnedGroupsCount(0);
      setAutopilotGroupsCount(0);
      setNovaAdviceUsed(0);
      setNeedsAutopilotResolution(false);
      setPeriod(null);
      setLoadingUsage(false);
      return undefined;
    }

    const groupsUnsub = firestore()
      .collection("groups")
      .where("ownerId", "==", String(uid))
      .onSnapshot(
        (snap) => {
          const activeOwned = (snap?.docs ?? []).filter((doc) =>
            isActiveOwnedGroup(doc.data() || {})
          );
          setOwnedGroupsCount(activeOwned.length);
          setAutopilotGroupsCount(
            activeOwned.filter((doc) => isGroupAutopilotEnabled(doc.data() || {})).length
          );
        },
        () => {
          setOwnedGroupsCount(0);
          setAutopilotGroupsCount(0);
        }
      );

    return () => {
      try {
        groupsUnsub();
      } catch {}
    };
  }, [uid]);

  const refreshNovaUsage = useCallback(async () => {
    if (!uid) return;
    setLoadingUsage(true);
    setError(null);

    try {
      const callable = functions().httpsCallable("getUserPlanUsage");
      const res = await callable({});
      const data = res?.data || {};
      if (data?.usage?.ownedGroupsCount != null) {
        setOwnedGroupsCount(Number(data.usage.ownedGroupsCount) || 0);
      }
      if (data?.usage?.autopilotGroupsCount != null) {
        setAutopilotGroupsCount(Number(data.usage.autopilotGroupsCount) || 0);
      }
      setNovaAdviceUsed(Number(data?.usage?.novaAdviceUsed ?? 0) || 0);
      setNeedsAutopilotResolution(Boolean(data?.flags?.needsAutopilotResolution));
      setPeriod(data?.period || null);
    } catch (e) {
      setError(e);
    } finally {
      setLoadingUsage(false);
    }
  }, [uid]);

  useEffect(() => {
    refreshNovaUsage();
  }, [refreshNovaUsage, effectiveTier]);

  const localNeedsResolution =
    autopilotGroupsCount > limits.autopilotGroupsLimit || needsAutopilotResolution;

  return {
    tier: effectiveTier,
    limits: {
      ownedGroupsLimit: limits.ownedGroupsLimit,
      autopilotGroupsLimit: limits.autopilotGroupsLimit,
      novaAdviceMonthlyLimit: limits.novaAdviceMonthlyLimit,
    },
    usage: {
      ownedGroupsCount,
      autopilotGroupsCount,
      novaAdviceUsed,
    },
    flags: {
      needsAutopilotResolution: localNeedsResolution,
    },
    period,
    loading: entitlementLoading || loadingUsage,
    error,
    refresh: refreshNovaUsage,
    canCreateOwnedGroup: ownedGroupsCount < limits.ownedGroupsLimit,
    canEnableAutopilot: autopilotGroupsCount < limits.autopilotGroupsLimit && !localNeedsResolution,
    novaQuotaRemaining: Math.max(0, limits.novaAdviceMonthlyLimit - novaAdviceUsed),
    novaQuotaExceeded: novaAdviceUsed >= limits.novaAdviceMonthlyLimit,
  };
}
