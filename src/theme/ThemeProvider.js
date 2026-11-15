// src/theme/ThemeProvider.js
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useColorScheme } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

const THEME_STORAGE_KEY = "appThemeMode";
const THEME_MODES = new Set(["system", "light", "dark"]);

function normalizeThemeMode(value, fallback = "system") {
  const v = String(value || "").trim().toLowerCase();
  return THEME_MODES.has(v) ? v : fallback;
}

const LightColors = {
  background: "#f8fafc",
  card: "#fff",
  card2: "#f1f5f9",
  text: "#111827",
  subtext: "#6b7280",
  border: "#e5e7eb",
  primary: "#ef4444",
  tabbar: "rgba(255,255,255,0.95)",
};

const DarkColors = {
  background: "#0b0f13",
  card: "#121820",
  card2: "#1a2230",
  text: "#e5e7eb",
  subtext: "#9ca3af",
  border: "#1f2937",
  primary: "#ef4444",
  tabbar: "#0b0f13",
};

const ThemeCtx = createContext(null);

export function ThemeProvider({ children, defaultMode = "system" }) {
  const [mode, setModeState] = useState(() => normalizeThemeMode(defaultMode));
  const system = useColorScheme(); // 'light' | 'dark' | null

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(THEME_STORAGE_KEY);
        const next = saved ? normalizeThemeMode(saved, normalizeThemeMode(defaultMode)) : null;
        if (mounted && next) setModeState(next);
      } catch {
        // ignore
      }
    })();
    return () => {
      mounted = false;
    };
  }, [defaultMode]);

  const setMode = useCallback(async (next) => {
    const v = normalizeThemeMode(next);
    setModeState(v);
    try {
      await AsyncStorage.setItem(THEME_STORAGE_KEY, v);
    } catch {
      // ignore
    }
  }, []);

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
    [mode, resolvedMode, isDark, setMode]
  );

  return <ThemeCtx.Provider value={value}>{children}</ThemeCtx.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeCtx);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}