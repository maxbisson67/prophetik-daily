import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from "react";
import { useAuth } from "@src/auth/SafeAuthProvider";
import useMeDoc from "@src/home/hooks/useMeDoc";
import { useMyGroups } from "@src/groups/MyGroupsProvider";
import i18n from "@src/i18n/i18n";

const SelectedGroupContext = createContext(null);

function msUntilNextLocalMidnight() {
  const now = new Date();
  const next = new Date(now);
  next.setHours(24, 0, 0, 0);
  return Math.max(1000, next.getTime() - now.getTime());
}

export function pickDefaultGroupId(favoriteGroupId, groupIds = []) {
  const fav = String(favoriteGroupId || "").trim();
  if (fav && groupIds.includes(fav)) return fav;
  if (groupIds.length >= 1) return String(groupIds[0]);
  return null;
}

export function resolveLiveTabTitle(selectedGroupId, selectedSport) {
  if (!selectedGroupId) {
    return i18n.t("tabs.matchLive", { defaultValue: "En direct" });
  }
  return selectedSport === "MLB"
    ? i18n.t("drawer.mlbLive", { defaultValue: "MLB Live" })
    : i18n.t("drawer.nhlLive", { defaultValue: "NHL Live" });
}

/**
 * Groupe sélectionné dans le dropdown Accueil — partagé entre onglets (ex. Live).
 * Init : groupe favori, sinon premier groupe accessible.
 */
export function SelectedGroupProvider({ children }) {
  const { user, authReady } = useAuth();
  const { groupIds, groupsMeta } = useMyGroups();
  const { meDoc } = useMeDoc({ authReady, uid: user?.uid, dayTick: 0 });

  const [selectedGroupId, setSelectedGroupIdState] = useState(null);
  const [dayTick, setDayTick] = useState(0);
  const userPickedRef = useRef(false);

  const defaultGroupId = useMemo(
    () => pickDefaultGroupId(meDoc?.favoriteGroupId, groupIds),
    [meDoc?.favoriteGroupId, groupIds.join("|")]
  );

  useEffect(() => {
    const t = setTimeout(() => setDayTick((x) => x + 1), msUntilNextLocalMidnight());
    return () => clearTimeout(t);
  }, [dayTick]);

  useEffect(() => {
    if (!authReady || !user?.uid) {
      setSelectedGroupIdState(null);
      userPickedRef.current = false;
    }
  }, [authReady, user?.uid]);

  useEffect(() => {
    if (!authReady || !user?.uid) return;
    setSelectedGroupIdState(null);
    userPickedRef.current = false;
  }, [authReady, user?.uid, dayTick]);

  useEffect(() => {
    if (!authReady || !user?.uid) return;

    if (!groupIds.length) {
      if (selectedGroupId !== null) setSelectedGroupIdState(null);
      return;
    }

    const defaultId = pickDefaultGroupId(meDoc?.favoriteGroupId, groupIds);
    const current = String(selectedGroupId || "").trim();

    if (userPickedRef.current) {
      if (current && groupIds.includes(current)) return;
      setSelectedGroupIdState(defaultId);
      return;
    }

    if (String(defaultId || "") !== current) {
      setSelectedGroupIdState(defaultId);
    }
  }, [authReady, user?.uid, meDoc?.favoriteGroupId, groupIds.join("|"), selectedGroupId]);

  const setSelectedGroupId = useCallback((gid) => {
    userPickedRef.current = true;
    setSelectedGroupIdState(gid ? String(gid) : null);
  }, []);

  const activeGroupId = selectedGroupId || defaultGroupId;
  const activeGroupMeta = activeGroupId ? groupsMeta[activeGroupId] || null : null;
  const selectedSport = String(activeGroupMeta?.sport || "NHL").toUpperCase();

  const value = useMemo(
    () => ({
      selectedGroupId: activeGroupId,
      setSelectedGroupId,
      selectedGroupMeta: activeGroupMeta,
      selectedSport,
      explicitGroupId: selectedGroupId,
    }),
    [activeGroupId, selectedGroupId, activeGroupMeta, selectedSport]
  );

  return (
    <SelectedGroupContext.Provider value={value}>{children}</SelectedGroupContext.Provider>
  );
}

export function useSelectedGroup() {
  const ctx = useContext(SelectedGroupContext);
  if (!ctx) {
    throw new Error("useSelectedGroup must be used within <SelectedGroupProvider>");
  }
  return ctx;
}
