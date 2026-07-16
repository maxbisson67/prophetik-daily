import { Alert } from "react-native";
import auth from "@react-native-firebase/auth";
import i18n from "@src/i18n/i18n";
import { initAppCheck } from "@src/lib/initAppCheck";

export const DEFAULT_COUNTRY = "+1";
export const E164 = /^\+\d{8,15}$/;

export function normalizePhone(input) {
  if (!input) return "";
  const raw = String(input).trim();

  if (raw.startsWith("+")) {
    const digits = raw.replace(/[^\d+]/g, "");
    return digits.replace(/\+(?=\+)/g, "");
  }

  const digitsOnly = raw.replace(/\D+/g, "");
  if (digitsOnly.length === 10) return `${DEFAULT_COUNTRY}${digitsOnly}`;
  if (digitsOnly.length > 0) return `+${digitsOnly}`;
  return "";
}

export function isSignedInForPhone(expectedPhone) {
  const user = auth().currentUser;
  if (!user?.phoneNumber) return false;
  const expected = normalizePhone(expectedPhone);
  const actual = normalizePhone(user.phoneNumber);
  return !!expected && expected === actual;
}

export function isSessionExpiredError(e) {
  const code = String(e?.code || "");
  const msg = String(e?.message || e).toLowerCase();
  return (
    code === "auth/session-expired" ||
    code === "auth/code-expired" ||
    msg.includes("session-expired") ||
    msg.includes("code-expired")
  );
}

/** Android auto-verify can sign in slightly after confirm() throws session-expired. */
export async function waitForSignedInPhone(
  expectedPhone,
  { timeoutMs = 8000, stepMs = 250 } = {}
) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    try {
      await auth().currentUser?.reload?.();
    } catch {}

    if (isSignedInForPhone(expectedPhone)) return true;
    await new Promise((resolve) => setTimeout(resolve, stepMs));
  }

  return isSignedInForPhone(expectedPhone);
}

/**
 * Ensures App Check is ready and clears a conflicting auth session before SMS.
 * Returns { alreadySignedIn: true } when the user is already verified for this phone.
 */
export async function prepareForPhoneVerification(expectedPhone) {
  await initAppCheck();

  const user = auth().currentUser;
  if (!user) return { alreadySignedIn: false };

  if (isSignedInForPhone(expectedPhone)) {
    return { alreadySignedIn: true };
  }

  try {
    await auth().signOut();
  } catch (e) {
    console.log("[phoneAuth] signOut before SMS failed:", e?.code, e?.message);
  }

  return { alreadySignedIn: false };
}

export async function sendPhoneVerification(phone, { forceResend = false, displayName = null } = {}) {
  const normalized = normalizePhone(phone);
  stashPendingPhoneVerification(normalized, null, displayName);
  try {
    const confirmation = await auth().signInWithPhoneNumber(normalized, forceResend);
    stashPendingPhoneVerification(normalized, confirmation, displayName);
    return confirmation;
  } catch (e) {
    clearPendingPhoneVerification(normalized);
    throw e;
  }
}

/** Persiste l'état SMS entre reCAPTCHA iOS (Safari) et retour dans l'app. */
let pendingPhoneVerification = null;

export function stashPendingPhoneVerification(phone, confirmation = null, displayName = null) {
  const prev = pendingPhoneVerification;
  const normalizedPhone = normalizePhone(phone) || prev?.phone || "";

  pendingPhoneVerification = {
    phone: normalizedPhone,
    confirmation: confirmation ?? prev?.confirmation ?? null,
    displayName:
      displayName != null && String(displayName).trim()
        ? String(displayName).trim()
        : prev?.displayName ?? null,
    updatedAt: Date.now(),
  };
}

export function consumePendingPhoneVerification(expectedPhone = null) {
  const pending = pendingPhoneVerification;
  if (!pending?.phone) return null;

  const expected = expectedPhone ? normalizePhone(expectedPhone) : null;
  if (expected && pending.phone !== expected) return null;

  pendingPhoneVerification = null;
  return pending;
}

export function peekPendingPhoneVerification(expectedPhone = null) {
  const pending = pendingPhoneVerification;
  if (!pending?.phone) return null;

  const expected = expectedPhone ? normalizePhone(expectedPhone) : null;
  if (expected && pending.phone !== expected) return null;

  return pending;
}

export function clearPendingPhoneVerification(expectedPhone = null) {
  if (!pendingPhoneVerification) return;
  if (!expectedPhone) {
    pendingPhoneVerification = null;
    return;
  }
  if (pendingPhoneVerification.phone === normalizePhone(expectedPhone)) {
    pendingPhoneVerification = null;
  }
}

export function alertForPhoneSendError(errCode, errMessage) {
  const code = String(errCode || "");

  if (code === "auth/invalid-phone-number") {
    Alert.alert(
      i18n.t("auth.phoneLogin.invalidPhoneTitle", { defaultValue: "Invalid phone number" }),
      i18n.t("auth.phoneLogin.invalidPhoneBody", {
        defaultValue: "Enter a valid number (e.g., 5145551234).",
      })
    );
    return;
  }

  if (code === "auth/too-many-requests" || code === "auth/quota-exceeded") {
    Alert.alert(
      i18n.t("auth.phoneLogin.tooManyRequestsTitle", { defaultValue: "Too many attempts" }),
      i18n.t("auth.phoneLogin.tooManyRequestsBody", {
        defaultValue: "Wait a few minutes before requesting another code.",
      })
    );
    return;
  }

  if (
    code === "auth/missing-app-credential" ||
    code === "auth/app-not-authorized" ||
    code === "auth/captcha-check-failed"
  ) {
    Alert.alert(
      i18n.t("auth.phoneLogin.appCheckTitle", { defaultValue: "Verification blocked" }),
      i18n.t("auth.phoneLogin.appCheckBody", {
        defaultValue:
          "The app could not verify this device. Update the app or try again later.",
      })
    );
    return;
  }

  if (code === "auth/network-request-failed") {
    Alert.alert(
      i18n.t("auth.phoneLogin.networkErrorTitle", { defaultValue: "Network error" }),
      i18n.t("auth.phoneLogin.networkErrorBody", {
        defaultValue: "Check your connection and try again.",
      })
    );
    return;
  }

  const detail = __DEV__ && (code || errMessage) ? `\n\n(${code || errMessage})` : "";
  Alert.alert(
    i18n.t("auth.phoneLogin.smsErrorTitle", { defaultValue: "SMS error" }),
    i18n.t("auth.phoneLogin.smsErrorBody", {
      defaultValue: "Couldn't send the code.",
    }) + detail
  );
}
