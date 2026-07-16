export const SUPPORT_EMAIL = "info@prophetik.ca";

const BASE = "https://capitaine.web.app";

export function privacyUrlForLang(lang) {
  return `${BASE}/${lang === "en" ? "en" : "fr"}/privacy`;
}

export function termsUrlForLang(lang) {
  return `${BASE}/${lang === "en" ? "en" : "fr"}/terms`;
}

export function supportUrlForLang(lang) {
  return `${BASE}/${lang === "en" ? "en" : "fr"}/support`;
}

export function homeUrlForLang(lang) {
  return `${BASE}/${lang === "en" ? "en" : "fr"}/`;
}

/** @deprecated use privacyUrlForLang(lang) */
export const LEGAL_PRIVACY_URL = `${BASE}/fr/privacy`;

/** @deprecated use termsUrlForLang(lang) */
export const LEGAL_TERMS_URL = `${BASE}/fr/terms`;
