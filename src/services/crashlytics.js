import crashlytics from "@react-native-firebase/crashlytics";

export async function setCrashUser(uid) {
  try {
    await crashlytics().setUserId(uid || "anonymous");
  } catch {}
}

export async function setCrashContext(context = {}) {
  try {
    const entries = Object.entries(context).filter(([, v]) => v !== undefined && v !== null);
    for (const [key, value] of entries) {
      await crashlytics().setAttribute(String(key), String(value));
    }
  } catch {}
}

export function crashLog(message) {
  try {
    crashlytics().log(String(message));
  } catch {}
}

export function recordNonFatal(error, context = {}) {
  try {
    Object.entries(context).forEach(([key, value]) => {
      crashlytics().setAttribute(String(key), String(value ?? ""));
    });
    crashlytics().recordError(error instanceof Error ? error : new Error(String(error)));
  } catch {}
}

export function forceTestCrash() {
  crashlytics().crash();
}