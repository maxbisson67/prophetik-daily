import { useEffect, useState } from "react";
import { getProphetikBusinessYmd } from "@src/lib/prophetikBusinessDate";

const TICK_MS = 30_000;

/**
 * Jour Prophetik courant (YYYY-MM-DD), rafraîchi périodiquement pour les sessions longues.
 */
export function useProphetikBusinessYmd() {
  const [ymd, setYmd] = useState(() => getProphetikBusinessYmd());

  useEffect(() => {
    const sync = () => {
      const next = getProphetikBusinessYmd();
      setYmd((prev) => (prev !== next ? next : prev));
    };
    sync();
    const id = setInterval(sync, TICK_MS);
    return () => clearInterval(id);
  }, []);

  return ymd;
}

/** Format YYYYMMDD — bundles TP. */
export function useProphetikBusinessYmdCompact() {
  const ymd = useProphetikBusinessYmd();
  return ymd.replace(/-/g, "");
}
