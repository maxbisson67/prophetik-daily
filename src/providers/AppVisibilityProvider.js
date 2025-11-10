// src/providers/AppVisibilityProvider.js
import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AppState, Platform } from "react-native";

/**
 * Contexte
 */
const Ctx = createContext(null);

/**
 * Paramètres anti-rafale
 */
const READY_DELAY_MS = 400;             // petite latence au boot
const CONFIRM_DELAY_MS = 180;           // debounce: on ne confirme un changement qu'après ce délai
const MIN_INTERVAL_BETWEEN_CONFIRMED = 1000; // throttle: >=1s entre 2 transitions confirmées
const FLOOD_WINDOW_MS = 2000;           // fenêtre d'observation pour détecter un déluge
const FLOOD_MAX_TRANSITIONS = 5;        // seuil de transitions dans la fenêtre pour déclencher le flood-gate
const FLOOD_FREEZE_MS = 3000;           // durée pendant laquelle on fige en "active" si flood

/**
 * Provider
 */
function ProviderImpl({ children, readyDelayMs = READY_DELAY_MS }) {
  const appState = useRef(AppState.currentState); // "active" | "background" | "inactive"
  const [status, setStatus] = useState("active");
  const [isActive, setIsActive] = useState(true);
  const [readySince, setReadySince] = useState(null);

  // horloges / protections
  const lastConfirmedTsRef = useRef(0);
  const pendingTimerRef = useRef(null);
  const pendingNextStateRef = useRef(null);
  const floodEventsRef = useRef([]); // timestamps des transitions non confirmées
  const floodFreezeUntilRef = useRef(0);

  // prêt (petite latence au boot)
  useEffect(() => {
    const t = setTimeout(() => setReadySince(Date.now()), readyDelayMs);
    return () => clearTimeout(t);
  }, [readyDelayMs]);

  // util: confirme vraiment un changement (une seule fois par seconde)
  const confirmTransition = (next) => {
    const now = Date.now();

    // flood-gate actif ? -> on fige en "active"
    if (now < floodFreezeUntilRef.current) {
      if (status !== "active") {
        setStatus("active");
        setIsActive(true);
      }
      return;
    }

    // throttle entre transitions confirmées
    const dt = now - lastConfirmedTsRef.current;
    if (dt < MIN_INTERVAL_BETWEEN_CONFIRMED) {
      // Trop rapproché: on ignore
      return;
    }

    lastConfirmedTsRef.current = now;

    const active = next === "active";
    setStatus(active ? "active" : "background");
    setIsActive(active);
  };

  // util: planifie une confirmation (debounce)
  const scheduleConfirm = (next) => {
    // enregistre la rafale pour détection flood
    const now = Date.now();
    floodEventsRef.current.push(now);

    // purge la fenêtre d’observation
    const cutoff = now - FLOOD_WINDOW_MS;
    floodEventsRef.current = floodEventsRef.current.filter((t) => t >= cutoff);

    // détection du déluge de transitions
    if (floodEventsRef.current.length >= FLOOD_MAX_TRANSITIONS) {
      // active le freeze
      floodFreezeUntilRef.current = now + FLOOD_FREEZE_MS;
      floodEventsRef.current = []; // reset pour repartir proprement
      // fige immédiatement en active
      confirmTransition("active");
      return;
    }

    // si un debounce est déjà en cours, on remplace simplement la cible
    pendingNextStateRef.current = next;

    if (pendingTimerRef.current) return;
    pendingTimerRef.current = setTimeout(() => {
      const target = pendingNextStateRef.current || "active";
      pendingTimerRef.current = null;
      pendingNextStateRef.current = null;

      // iOS: "inactive" arrive souvent avant "background" → on lisse en "background"
      const normalized =
        Platform.OS === "ios" && target === "inactive" ? "background" : target;

      confirmTransition(normalized);
    }, CONFIRM_DELAY_MS);
  };

  // écoute AppState
  useEffect(() => {
    const sub = AppState.addEventListener("change", (next) => {
      appState.current = next;

      // En dev, certains overlays (Performance Monitor / Inspector) spamment les transitions.
      // On passe TOUJOURS par le scheduler/debounce + flood-gate.
      scheduleConfirm(next);
    });

    return () => {
      sub?.remove?.();
      if (pendingTimerRef.current) {
        clearTimeout(pendingTimerRef.current);
        pendingTimerRef.current = null;
      }
    };
  }, []);

  // Indication supplémentaire : peut-on lancer des tâches lourdes maintenant ?
  // -> Active, prêt, pas en période de freeze
  const canRunHeavy = useMemo(() => {
    const now = Date.now();
    const notFrozen = now >= floodFreezeUntilRef.current;
    return isActive && !!readySince && notFrozen;
  }, [isActive, readySince, status]);

  const value = useMemo(
    () => ({
      status,
      isActive,
      readySince,
      canRunHeavy,
      // exposer le moment jusqu'auquel un freeze est actif peut aider au debug
      freezeUntil: floodFreezeUntilRef.current,
    }),
    [status, isActive, readySince, canRunHeavy]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/**
 * Exports
 */
export const AppVisibilityProvider = ProviderImpl; // named
export default AppVisibilityProvider;              // default

export function useAppVisibility() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAppVisibility must be used within <AppVisibilityProvider>");
  return ctx;
}

export function useAppVisibilitySafe() {
  try {
    return useAppVisibility();
  } catch {
    const now = Date.now();
    return {
      status: "active",
      isActive: true,
      readySince: now,
      canRunHeavy: true,
      freezeUntil: now,
    };
  }
}