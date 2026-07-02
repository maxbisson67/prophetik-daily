/** Accent visuel de l’onglet Mes résultats (vert — distinct de l’Accueil rouge). */
export const RESULTS_ACCENT = "#16a34a";
export const RESULTS_ACCENT_DARK = "#15803d";
export const RESULTS_ACCENT_MUTED = "rgba(22, 163, 74, 0.22)";
export const RESULTS_ACCENT_DIVIDER = "rgba(22, 163, 74, 0.24)";
export const RESULTS_ACCENT_DIVIDER_STRONG = "rgba(22, 163, 74, 0.32)";

export function getResultsIntroBandStyle(isDark) {
  return {
    backgroundColor: isDark ? "#14291a" : "#dcfce7",
    borderBottomWidth: 1,
    borderBottomColor: isDark ? "rgba(74, 222, 128, 0.35)" : "#bbf7d0",
  };
}
