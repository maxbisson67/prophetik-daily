import { useMemo } from "react";
import { useRootNavigationState, useSegments } from "expo-router";

/**
 * Nom de l'écran tab focus (AccueilScreen, ClassementScreen, …).
 * Fonctionne depuis tabs/_layout.js (hors contexte Tab navigator).
 */
export default function useFocusedTabRouteName() {
  const rootState = useRootNavigationState();
  const segments = useSegments();

  return useMemo(() => {
    if (rootState?.routes?.length) {
      let state = rootState;
      let route = state.routes[state.index ?? 0];

      while (route?.state?.routes?.length) {
        state = route.state;
        route = state.routes[state.index ?? 0];
      }

      const name = route?.name;
      if (name && name !== "(tabs)" && name !== "(drawer)") {
        return name;
      }
    }

    const last = segments[segments.length - 1];
    if (last && last !== "(tabs)" && last !== "(drawer)") {
      return last;
    }

    return "AccueilScreen";
  }, [rootState, segments]);
}
