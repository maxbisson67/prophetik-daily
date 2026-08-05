export function getParticipantPredictionFrameStyle(
  colors,
  isDark,
  { accentColor = null, backgroundColor = null } = {}
) {
  return {
    borderWidth: isDark ? 1 : 1.5,
    borderColor: isDark ? colors.border : "#cbd5e1",
    borderLeftWidth: 4,
    borderLeftColor: accentColor || colors.primary,
    borderRadius: 10,
    backgroundColor: backgroundColor ?? (isDark ? colors.card2 : "#eef2f6"),
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  };
}

export function getParticipantPredictionDividerColor(colors, isDark) {
  return isDark ? colors.border : "#e2e8f0";
}
