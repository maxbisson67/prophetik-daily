import { useEffect, useMemo, useState } from "react";
import { snapshotExists, snapshotData, snapshotId } from "@src/lib/safeSnapshot";
import { Platform } from "react-native";
import firestore from "@react-native-firebase/firestore";
import * as Application from "expo-application";
import i18n from "@src/i18n/i18n";
import { useLanguage } from "@src/i18n/LanguageProvider";
import {
  isVersionBelow,
  resolvePlatformMobileConfig,
} from "@src/lib/appVersion";

/** Désactiver le gate (ex. dev local) via EXPO_PUBLIC_APP_UPDATE_CHECK=false */
export const APP_UPDATE_CHECK_ENABLED =
  String(process.env.EXPO_PUBLIC_APP_UPDATE_CHECK ?? "true").toLowerCase() !== "false";

export default function useAppUpdateCheck() {
  const [loading, setLoading] = useState(APP_UPDATE_CHECK_ENABLED);
  const [config, setConfig] = useState(null);
  const { lang } = useLanguage();

  useEffect(() => {
    if (!APP_UPDATE_CHECK_ENABLED || Platform.OS === "web") {
      setLoading(false);
      setConfig(null);
      return undefined;
    }

    const ref = firestore().doc("app_config/mobile");

    const unsub = ref.onSnapshot(
      (snap) => {
        setConfig(snapshotExists(snap) ? snapshotData(snap) || null : null);
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

  const currentVersion = String(Application.nativeApplicationVersion || "0.0.0");

  const platformConfig = useMemo(
    () => resolvePlatformMobileConfig(config, Platform.OS),
    [config]
  );

  const minSupportedVersion = platformConfig.minSupportedVersion;
  const storeUrl = platformConfig.storeUrl;

  const updateRequired = useMemo(() => {
    if (!APP_UPDATE_CHECK_ENABLED || Platform.OS === "web") return false;
    return isVersionBelow(currentVersion, minSupportedVersion);
  }, [currentVersion, minSupportedVersion]);

  const message = useMemo(() => {
    const isFr = String(lang || "fr").toLowerCase().startsWith("fr");
    if (isFr) {
      return config?.updateMessageFr || i18n.t("appUpdate.requiredBody");
    }
    return config?.updateMessageEn || i18n.t("appUpdate.requiredBody");
  }, [config?.updateMessageFr, config?.updateMessageEn, lang]);

  return {
    loading,
    config,
    currentVersion,
    minSupportedVersion,
    updateRequired,
    message,
    storeUrl,
  };
}
