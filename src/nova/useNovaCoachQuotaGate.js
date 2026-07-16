import { useCallback, useRef, useState } from "react";
import { getNovaErrorKey } from "@src/nova/novaCoachService";
import { mapNovaCoachError } from "@src/nova/novaCoachShared";

/**
 * Quota Nova + masquage indicateurs (FGC, TS, TP via modales partagées).
 */
export default function useNovaCoachQuotaGate({ showIndicatorToggle = false } = {}) {
  const quotaBlockedRef = useRef(false);
  const [error, setError] = useState(null);
  const [errorKey, setErrorKey] = useState(null);

  const quotaExceeded = errorKey === "QUOTA_EXCEEDED";
  const showIndicatorUi = showIndicatorToggle && !quotaExceeded;
  const askDisabled = quotaExceeded;

  const resetQuotaGate = useCallback(() => {
    quotaBlockedRef.current = false;
    setError(null);
    setErrorKey(null);
  }, []);

  const canStartAsk = useCallback(() => !quotaBlockedRef.current, []);

  const clearAskError = useCallback(() => {
    setError(null);
    setErrorKey(null);
  }, []);

  const handleAskError = useCallback(
    (e, { indicatorsReceived = false, onQuotaExceeded = null } = {}) => {
      const errKey = getNovaErrorKey(e);
      if (!indicatorsReceived && errKey !== "QUOTA_EXCEEDED") {
        return false;
      }

      if (errKey === "QUOTA_EXCEEDED") {
        quotaBlockedRef.current = true;
        onQuotaExceeded?.();
      }

      setError(mapNovaCoachError(e));
      setErrorKey(errKey);
      return true;
    },
    []
  );

  const shouldFetchIndicators = useCallback(
    () => showIndicatorToggle && !quotaBlockedRef.current,
    [showIndicatorToggle]
  );

  return {
    error,
    errorKey,
    quotaExceeded,
    showIndicatorUi,
    askDisabled,
    quotaBlockedRef,
    resetQuotaGate,
    canStartAsk,
    clearAskError,
    handleAskError,
    shouldFetchIndicators,
  };
}
