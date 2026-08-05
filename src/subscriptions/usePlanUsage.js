import { useCallback, useEffect, useState } from "react";
import functions from "@react-native-firebase/functions";
import firestore from "@react-native-firebase/firestore";
import useEntitlement from "../../app/(drawer)/subscriptions/useEntitlement";
import { getPlanLimits } from "@src/subscriptions/planLimits";
import { isParticipatingMember } from "@src/groups/participationUtils";
import { isActiveGroup } from "@src/groups/groupOwnership";

function isGroupAutopilotEnabled(data = {}) {
  return data?.autopilotEnabled !== false;
}

export default function usePlanUsage(uid) {
  const { tier, active, loading: entitlementLoading } = useEntitlement(uid);
  const effectiveTier = active === false ? "free" : tier;
  const limits = getPlanLimits(effectiveTier, active !== false);

  const [activeParticipationsCount, setActiveParticipationsCount] = useState(0);
  const [autopilotGroupsCount, setAutopilotGroupsCount] = useState(0);
  const [novaAdviceUsed, setNovaAdviceUsed] = useState(0);
  const [needsParticipationResolution, setNeedsParticipationResolution] = useState(false);
  const [needsAutopilotResolution, setNeedsAutopilotResolution] = useState(false);
  const [period, setPeriod] = useState(null);
  const [loadingUsage, setLoadingUsage] = useState(!!uid);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!uid) {
      setActiveParticipationsCount(0);
      setAutopilotGroupsCount(0);
      setNovaAdviceUsed(0);
      setNeedsParticipationResolution(false);
      setNeedsAutopilotResolution(false);
      setPeriod(null);
      setLoadingUsage(false);
      return undefined;
    }

    let rowsByUid = [];
    let rowsByUserId = [];
    let rowsByPid = [];

    const recomputeParticipationCount = () => {
      const map = new Map();
      [...rowsByUid, ...rowsByUserId, ...rowsByPid].forEach((row) => {
        if (!row?.id) return;
        map.set(row.id, row);
      });
      const rows = Array.from(map.values());
      setActiveParticipationsCount(rows.filter((m) => isParticipatingMember(m)).length);
    };

    const membershipsUnsub = firestore()
      .collection("group_memberships")
      .where("uid", "==", String(uid))
      .onSnapshot(
        (snap) => {
          rowsByUid = (snap?.docs ?? []).map((doc) => ({
            id: doc.id,
            ...(doc.data() || {}),
          }));
          recomputeParticipationCount();
        },
        () => {
          rowsByUid = [];
          recomputeParticipationCount();
        }
      );

    const membershipsUserIdUnsub = firestore()
      .collection("group_memberships")
      .where("userId", "==", String(uid))
      .onSnapshot(
        (snap) => {
          rowsByUserId = (snap?.docs ?? []).map((doc) => ({
            id: doc.id,
            ...(doc.data() || {}),
          }));
          recomputeParticipationCount();
        },
        () => {
          rowsByUserId = [];
          recomputeParticipationCount();
        }
      );

    const membershipsPidUnsub = firestore()
      .collection("group_memberships")
      .where("participantId", "==", String(uid))
      .onSnapshot(
        (snap) => {
          rowsByPid = (snap?.docs ?? []).map((doc) => ({
            id: doc.id,
            ...(doc.data() || {}),
          }));
          recomputeParticipationCount();
        },
        () => {
          rowsByPid = [];
          recomputeParticipationCount();
        }
      );

    const groupsUnsub = firestore()
      .collection("groups")
      .where("ownerId", "==", String(uid))
      .onSnapshot(
        (snap) => {
          const activeOwned = (snap?.docs ?? []).filter((doc) =>
            isActiveGroup({ id: doc.id, ...(doc.data() || {}) })
          );
          setAutopilotGroupsCount(
            activeOwned.filter((doc) => isGroupAutopilotEnabled(doc.data() || {})).length
          );
        },
        () => setAutopilotGroupsCount(0)
      );

    return () => {
      try {
        membershipsUnsub();
        membershipsUserIdUnsub();
        membershipsPidUnsub();
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
      if (data?.usage?.activeParticipationsCount != null) {
        setActiveParticipationsCount(Number(data.usage.activeParticipationsCount) || 0);
      }
      if (data?.usage?.autopilotGroupsCount != null) {
        setAutopilotGroupsCount(Number(data.usage.autopilotGroupsCount) || 0);
      }
      setNovaAdviceUsed(Number(data?.usage?.novaAdviceUsed ?? 0) || 0);
      setNeedsParticipationResolution(Boolean(data?.flags?.needsParticipationResolution));
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

  const localNeedsParticipationResolution =
    activeParticipationsCount > limits.activeGroupsLimit || needsParticipationResolution;

  const localNeedsAutopilotResolution =
    autopilotGroupsCount > limits.autopilotGroupsLimit || needsAutopilotResolution;

  const localCanJoinOrActivateParticipation =
    activeParticipationsCount < limits.activeGroupsLimit;

  return {
    tier: effectiveTier,
    limits: {
      activeGroupsLimit: limits.activeGroupsLimit,
      autopilotGroupsLimit: limits.autopilotGroupsLimit,
      novaAdviceMonthlyLimit: limits.novaAdviceMonthlyLimit,
    },
    usage: {
      activeParticipationsCount,
      autopilotGroupsCount,
      novaAdviceUsed,
    },
    flags: {
      needsParticipationResolution: localNeedsParticipationResolution,
      needsAutopilotResolution: localNeedsAutopilotResolution,
      canJoinOrActivateParticipation: localCanJoinOrActivateParticipation,
    },
    period,
    loading: entitlementLoading || loadingUsage,
    error,
    refresh: refreshNovaUsage,
    canEnableAutopilot:
      autopilotGroupsCount < limits.autopilotGroupsLimit && !localNeedsAutopilotResolution,
    novaQuotaRemaining: Math.max(0, limits.novaAdviceMonthlyLimit - novaAdviceUsed),
    novaQuotaExceeded: novaAdviceUsed >= limits.novaAdviceMonthlyLimit,
  };
}
