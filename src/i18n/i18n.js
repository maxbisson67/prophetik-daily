import * as Localization from 'expo-localization';
import { I18n } from 'i18n-js';

import en from './en.json';
import fr from './fr.json';

const i18n = new I18n({
  en,
  fr,
});

// Active fallback (si une clé manque dans une langue)
i18n.enableFallback = true;

// 🔐 Sécurisé : évite le crash "split of undefined"
const rawLocale = Localization.locale ?? Localization.locales?.[0] ?? 'fr';
const shortLocale = rawLocale.split?.('-')?.[0] ?? 'fr';

i18n.locale = shortLocale;

export default i18n;