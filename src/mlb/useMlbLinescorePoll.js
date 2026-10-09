import { useEffect, useMemo, useRef, useState } from "react";
import { AppState } from "react-native";
import {
  fetchMlbLinescoreGamePatch,
  MLB_LINESCORE_POLL_MS,
} from "@src/mlb/mlbLinescoreClient";

const MAX_BACKOFF_MS = 120000;

function normalizeGamePks(gamePks = []) {
  return [...new Set(gamePks.map((pk) => String(pk || "").trim()).filter(Boolean))];
}

/**
 * Poll léger `/linescore` pour matchs live (écran ouvert uniquement).
 * Retourne une map gamePk → patch à fusionner sur le doc Firestore.
 */
export default function useMlbLinescorePoll({
  gamePks = [],
  enabled = false,
  intervalMs = MLB_LINESCORE_POLL_MS,
} = {}) {
  const keys = useMemo(() => normalizeGamePks(gamePks), [gamePks]);
  const keysKey = keys.join(",");
  const [overlays, setOverlays] = useState({});
  const backoffMsRef = useRef(0);
  const inFlightRef = useRef(false);

  useEffect(() => {
    if (!enabled || !keys.length) {
      setOverlays({});
      backoffMsRef.current = 0;
      return undefined;
    }

    let cancelled = false;
    let timer = null;

    const scheduleNext = (delayMs) => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        tick().catch(() => {});
      }, delayMs);
    };

    const tick = async () => {
      if (cancelled || inFlightRef.current) return;
      if (AppState.currentState !== "active") {
        scheduleNext(intervalMs);
        return;
      }

      inFlightRef.current = true;
      try {
        const results = await Promise.all(
          keys.map(async (pk) => {
            try {
              const patch = await fetchMlbLinescoreGamePatch(pk);
              return patch ? [pk, patch] : null;
            } catch {
              return null;
            }
          })
        );

        if (cancelled) return;

        setOverlays((prev) => {
          const next = { ...prev };
          keys.forEach((pk, index) => {
            const entry = results[index];
            if (entry) next[pk] = entry[1];
            else delete next[pk];
          });
          return next;
        });

        backoffMsRef.current = 0;
        scheduleNext(intervalMs);
      } catch {
        backoffMsRef.current = Math.min(
          backoffMsRef.current ? backoffMsRef.current * 2 : intervalMs * 2,
          MAX_BACKOFF_MS
        );
        scheduleNext(backoffMsRef.current);
      } finally {
        inFlightRef.current = false;
      }
    };

    tick().catch(() => {});

    const appSub = AppState.addEventListener("change", (state) => {
      if (state === "active" && !cancelled) {
        tick().catch(() => {});
      }
    });

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      appSub.remove();
    };
  }, [enabled, keysKey, intervalMs]);

  return overlays;
}
