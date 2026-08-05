import { useCallback, useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import useActiveCompetition from "@src/hooks/useActiveCompetition";
import { PARTICIPATION } from "@src/groups/participationUtils";
import { normalizeSport } from "@src/season/seasonCompetitionCore";

const DISMISS_MS = 7 * 24 * 60 * 60 * 1000;

function dismissStorageKey(groupId) {
  return `home.sportSwitchBanner.dismissedUntil.${String(groupId || "")}`;
}

async function readDismissedUntil(groupId) {
  try {
    const raw = await AsyncStorage.getItem(dismissStorageKey(groupId));
    const ts = Number(raw);
    return Number.isFinite(ts) ? ts : 0;
  } catch {
    return 0;
  }
}

export default function useSportSeasonSwitchPrompt({ userGroups = [], enabled = true } = {}) {
  const [dismissedUntil, setDismissedUntil] = useState(0);
  const [dismissLoaded, setDismissLoaded] = useState(false);

  const activeGroup = useMemo(
    () =>
      userGroups.find(
        (g) =>
          g?.canParticipateInChallenges &&
          String(g?.participation || "").toLowerCase() === PARTICIPATION.ACTIVE
      ) || null,
    [userGroups]
  );

  const inactiveOtherSportGroups = useMemo(() => {
    if (!activeGroup) return [];
    const activeSport = normalizeSport(activeGroup.sport);
    return userGroups.filter((g) => {
      if (String(g?.participation || "").toLowerCase() !== PARTICIPATION.INACTIVE) return false;
      return normalizeSport(g.sport) !== activeSport;
    });
  }, [userGroups, activeGroup]);

  const needsNhlComp = inactiveOtherSportGroups.some((g) => normalizeSport(g.sport) === "nhl");
  const needsMlbComp = inactiveOtherSportGroups.some((g) => normalizeSport(g.sport) === "mlb");

  const nhlComp = useActiveCompetition({ sport: "NHL", enabled: enabled && needsNhlComp });
  const mlbComp = useActiveCompetition({ sport: "MLB", enabled: enabled && needsMlbComp });

  const candidate = useMemo(() => {
    if (!activeGroup || !inactiveOtherSportGroups.length) return null;

    for (const inactiveGroup of inactiveOtherSportGroups) {
      const sportNorm = normalizeSport(inactiveGroup.sport);
      const comp = sportNorm === "mlb" ? mlbComp : nhlComp;
      if (!comp?.competitionKey || !comp?.phase) continue;

      return {
        inactiveGroup,
        activeGroup,
        sportLabel: sportNorm === "mlb" ? "MLB" : "NHL",
        phase: comp.phase,
        competitionLabel: comp.label,
      };
    }

    return null;
  }, [activeGroup, inactiveOtherSportGroups, nhlComp, mlbComp]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!candidate?.inactiveGroup?.id) {
        if (!cancelled) {
          setDismissedUntil(0);
          setDismissLoaded(true);
        }
        return;
      }

      const until = await readDismissedUntil(candidate.inactiveGroup.id);
      if (!cancelled) {
        setDismissedUntil(until);
        setDismissLoaded(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [candidate?.inactiveGroup?.id]);

  const dismiss = useCallback(async () => {
    if (!candidate?.inactiveGroup?.id) return;
    const until = Date.now() + DISMISS_MS;
    setDismissedUntil(until);
    try {
      await AsyncStorage.setItem(dismissStorageKey(candidate.inactiveGroup.id), String(until));
    } catch {}
  }, [candidate?.inactiveGroup?.id]);

  const prompt = useMemo(() => {
    if (!candidate || !dismissLoaded) return null;
    if (dismissedUntil > Date.now()) return null;
    return candidate;
  }, [candidate, dismissedUntil, dismissLoaded]);

  const loading = (needsNhlComp && nhlComp.loading) || (needsMlbComp && mlbComp.loading) || !dismissLoaded;

  return { prompt, loading, dismiss };
};
