import { useEffect, useMemo, useState } from "react";
import { Platform } from "react-native";
import firestore from "@react-native-firebase/firestore";
import * as Application from "expo-application";
import i18n from "@src/i18n/i18n";

function normalizeVersion(v) {
  return String(v || "")
    .trim()
    .split(".")
    .map((x) => Number(x) || 0);
}

function compareVersions(a, b) {
  const va = normalizeVersion(a);
  const vb = normalizeVersion(b);
  const len = Math.max(va.length, vb.length);

  for (let i = 0; i < len; i++) {
    const na = va[i] || 0;
    const nb = vb[i] || 0;
    if (na > nb) return 1;
    if (na < nb) return -1;
  }
  return 0;
}

export default function useAppUpdateCheck() {
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState(null);

  useEffect(() => {
    const ref = firestore().doc("app_config/mobile");

    const unsub = ref.onSnapshot(
      (snap) => {
        setConfig(snap.exists ? snap.data() || null : null);
        setLoading(false);
      },
      (err) => {
        console.log("[useAppUpdateCheck] error", err?.message || err);
        setConfig(null);
        setLoading(false);
      }
    );

    return () => {
      try {
        unsub();
      } catch {}
    };
  }, []);

  // Version visible par l'usager
  const currentVersion = String(Application.nativeApplicationVersion || "0.0.0");

  // Version interne à comparer avec Firestore
  const currentBuildVersion = String(Application.nativeBuildVersion || "0");

  const latestVersion = String(config?.latestVersion || "");
  const minVersion = String(config?.minVersion || "");

  const updateAvailable = useMemo(() => {
    if (!latestVersion) return false;
    return compareVersions(currentBuildVersion, latestVersion) < 0;
  }, [currentBuildVersion, latestVersion]);

  const forceUpdate = useMemo(() => {
    if (!minVersion) return false;
    return config?.forceUpdate === true || compareVersions(currentBuildVersion, minVersion) < 0;
  }, [config?.forceUpdate, currentBuildVersion, minVersion]);

  const message = useMemo(() => {
    const lang = String(i18n.language || i18n.locale || "fr").toLowerCase();
    if (lang.startsWith("fr")) {
      return (
        config?.updateMessageFr ||
        "Une nouvelle version de Prophetik est disponible 🚀"
      );
    }
    return (
      config?.updateMessageEn ||
      "A new version of Prophetik is available 🚀"
    );
  }, [config?.updateMessageFr, config?.updateMessageEn]);

  const storeUrl = useMemo(() => {
    if (Platform.OS === "ios") return config?.iosStoreUrl || null;
    if (Platform.OS === "android") return config?.androidStoreUrl || null;
    return null;
  }, [config?.iosStoreUrl, config?.androidStoreUrl]);

  return {
    loading,
    config,
    currentVersion,
    currentBuildVersion,
    latestVersion,
    minVersion,
    updateAvailable,
    forceUpdate,
    message,
    storeUrl,
  };
}