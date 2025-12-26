// src/theme/ThemeProvider.js
import React, { createContext, useContext, useMemo, useState } from "react";
import { useColorScheme } from "react-native";

const LightColors = {
  background: "#f8fafc",
  card: "#fff",
  text: "#111827",
  subtext: "#6b7280",
  border: "#e5e7eb",
  primary: "#ef4444",
  tabbar: "rgba(255,255,255,0.95)",
};

const DarkColors = {
  background: "#0b0f13",
  card: "#121820",
  text: "#e5e7eb",
  subtext: "#9ca3af",
  border: "#1f2937",
  primary: "#ef4444",
  tabbar: "#0b0f13",
};

const ThemeCtx = createContext(null);

export function ThemeProvider({ children, defaultMode = "system" }) {
  const [mode, setMode] = useState(defaultMode); // 'system' | 'light' | 'dark'
  const system = useColorScheme(); // 'light' | 'dark' | null

  // ✅ Mode réellement appliqué
  const resolvedMode = mode === "system" ? (system === "dark" ? "dark" : "light") : mode;

  // ✅ Flag fiable
  const isDark = resolvedMode === "dark";

  // ✅ Palette
  const colors = isDark ? DarkColors : LightColors;

  const value = useMemo(
    () => ({
      // Compat (si tu utilisais "theme" ailleurs)
      theme: resolvedMode,

      // API principale
      mode,
      setMode,
      resolvedMode,
      isDark,
      colors,
    }),
    [mode, resolvedMode, isDark]
  );

  return <ThemeCtx.Provider value={value}>{children}</ThemeCtx.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeCtx);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}