import { useEffect, useRef } from "react";

/**
 * Applique `groupId` depuis la route une fois par valeur de param.
 * Évite de réécraser le choix manuel quand la liste des groupes se rafraîchit.
 */
export function useApplyRouteGroupIdParam(groupIdParam, groupIds, setSelectedGroupId) {
  const appliedParamRef = useRef(null);

  useEffect(() => {
    const raw = groupIdParam;
    const gid = Array.isArray(raw) ? raw[0] : raw;
    const normalized = gid ? String(gid).trim() : "";

    if (!normalized) {
      appliedParamRef.current = null;
      return;
    }

    const ids = Array.isArray(groupIds) ? groupIds.map(String) : [];
    if (!ids.includes(normalized)) return;

    if (appliedParamRef.current === normalized) return;

    appliedParamRef.current = normalized;
    setSelectedGroupId(normalized);
  }, [groupIdParam, Array.isArray(groupIds) ? groupIds.join("|") : "", setSelectedGroupId]);
}
