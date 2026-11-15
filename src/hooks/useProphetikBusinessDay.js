import { useCallback, useEffect, useState } from "react";
import { AppState } from "react-native";
import {
  getProphetikBusinessYmd,
  msUntilNextProphetikBusinessDayRoll,
} from "@src/lib/prophetikBusinessDate";

/**
 * Jour Prophetik courant (rafraîchi au focus, retour foreground, et à la bascule 4h Toronto).
 * Évite les fenêtres « figées » si l'app reste ouverte toute la nuit (ex. Historique).
 */
export default function useProphetikBusinessDay({ enabled = true } = {}) {
  const [businessYmd, setBusinessYmd] = useState(() => getProphetikBusinessYmd());

  const syncBusinessDay = useCallback(() => {
    const ymd = getProphetikBusinessYmd();
    setBusinessYmd((prev) => (prev === ymd ? prev : ymd));
  }, []);

  useEffect(() => {
    if (!enabled) return;
    syncBusinessDay();

    const sub = AppState.addEventListener("change", (next) => {
      if (next === "active") syncBusinessDay();
    });

    return () => {
      try {
        sub?.remove?.();
      } catch {}
    };
  }, [enabled, syncBusinessDay]);

  useEffect(() => {
    if (!enabled) return;

    let timer = null;

    const schedule = () => {
      const ms = msUntilNextProphetikBusinessDayRoll();
      timer = setTimeout(() => {
        syncBusinessDay();
        schedule();
      }, ms);
    };

    schedule();

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [enabled, syncBusinessDay]);

  return { businessYmd, syncBusinessDay };
}