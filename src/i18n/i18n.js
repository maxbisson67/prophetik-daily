import * as Localization from "expo-localization";
import { I18n } from "i18n-js";

import enRaw from "./en.json";
import frRaw from "./fr.json";

const en = enRaw?.default ?? enRaw;
const fr = frRaw?.default ?? frRaw;

const i18n = new I18n({ en, fr });
i18n.enableFallback = true;

const rawLocale = Localization.locale ?? Localization.locales?.[0] ?? "fr";
const shortLocale = rawLocale.split?.("-")?.[0] ?? "fr";
i18n.locale = shortLocale;

console.log("EN groups keys:", Object.keys(en?.groups ?? {}));
console.log("EN groups.defi keys:", Object.keys(en?.groups?.defi ?? {}));
console.log("EN groups.defi.errors:", en?.groups?.defi?.errors);

console.log("FR groups keys:", Object.keys(fr?.groups ?? {}));
console.log("FR groups.defi keys:", Object.keys(fr?.groups?.defi ?? {}));
console.log("FR groups.defi.errors:", fr?.groups?.defi?.errors);

export default i18n;