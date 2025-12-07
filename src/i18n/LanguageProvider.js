import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import i18n from './i18n';

const LanguageContext = createContext({
  lang: 'fr',
  setLang: () => {},
});

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState('fr');

  // Charger au démarrage
  useEffect(() => {
    (async () => {
      const saved = await AsyncStorage.getItem('appLang');
      if (saved) {
        setLangState(saved);
        i18n.locale = saved;
      }
    })();
  }, []);

  const setLang = async (newLang) => {
    setLangState(newLang);
    i18n.locale = newLang;
    await AsyncStorage.setItem('appLang', newLang);
  };

  return (
    <LanguageContext.Provider value={{ lang, setLang }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}