// src/i18n/LanguageProvider.js
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import auth from "@react-native-firebase/auth";
import i18n from "./i18n";
import { syncAppLangToFirestore } from "@src/lib/push/syncAppLang";

const LanguageContext = createContext({
  lang: "fr",
  setLang: async () => {},
});

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState("fr");
  const [ready, setReady] = useState(false);

  // Charger au démarrage
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const saved = await AsyncStorage.getItem("appLang");
        const next = saved || "fr";
        i18n.locale = next;              // ✅ i18n-js
        if (mounted) setLangState(next);
      } finally {
        if (mounted) setReady(true);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    const uid = auth().currentUser?.uid;
    if (!uid) return;
    syncAppLangToFirestore(uid).catch(() => {});
  }, [ready, lang]);

  const setLang = async (next) => {
    const v = next === "en" ? "en" : "fr";
    i18n.locale = v;                    // ✅ i18n-js
    setLangState(v);
    await AsyncStorage.setItem("appLang", v);
    const uid = auth().currentUser?.uid;
    if (uid) {
      await syncAppLangToFirestore(uid).catch(() => {});
    }
  };

  const value = useMemo(() => ({ lang, setLang, ready }), [lang, ready]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  return useContext(LanguageContext);
}