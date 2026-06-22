import { View } from "react-native";

export const PROPHETIK_RED = "#b91c1c";
export const PROPHETIK_RED_BOTTOM = "#991b1b";

export function prophetikCardShadow() {
  return {
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  };
}

export function prophetikSectionCardStyle(colors, accent = PROPHETIK_RED) {
  return {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 16,
    overflow: "hidden",
    padding: 14,
    borderLeftWidth: 4,
    borderLeftColor: accent,
    borderBottomWidth: 3,
    borderBottomColor: PROPHETIK_RED_BOTTOM,
  };
}

export function ProphetikProgressBar({ pct, colors, height = 12 }) {
  const safePct = Math.max(0, Math.min(100, Number(pct || 0)));

  return (
    <View
      style={{
        height,
        borderRadius: 999,
        backgroundColor: colors.card2 || colors.background,
        borderWidth: 1,
        borderColor: colors.border,
        overflow: "hidden",
      }}
    >
      <View
        style={{
          width: `${safePct}%`,
          height: "100%",
          backgroundColor: PROPHETIK_RED,
          borderRadius: 999,
        }}
      />
    </View>
  );
}
