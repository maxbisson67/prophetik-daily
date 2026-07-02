import functions from "@react-native-firebase/functions";

function stringifyDetails(details) {
  if (!details) return "";
  if (typeof details === "string") return details;
  try {
    return JSON.stringify(details);
  } catch {
    return String(details);
  }
}

export function normalizeNovaCallableError(e) {
  const code = e?.code || e?.details?.code || null;
  const message = e?.message || String(e);
  const details = e?.details ?? null;
  const detailsText = stringifyDetails(details);
  const reason =
    details?.reason ||
    (typeof details === "object" && details !== null && "reason" in details ? details.reason : null) ||
    null;

  return {
    code,
    message,
    details,
    detailsText,
    reason,
    raw: e,
  };
}

export function getNovaErrorKey(err) {
  const blob = `${err?.reason || ""} ${err?.message || ""} ${err?.detailsText || ""}`;
  const keys = [
    "QUOTA_EXCEEDED",
    "OPENAI_NOT_CONFIGURED",
    "OPENAI_KEY_INVALID_FORMAT",
    "OPENAI_QUOTA_EXCEEDED",
    "MODEL_ERROR",
    "INVALID_JSON",
    "MISSING_COACH_FIELDS",
    "MISSING_EXPLAIN_FIELDS",
    "CHALLENGE_NOT_FOUND",
    "NOVA_UNHANDLED",
    "EMPTY_NOVA_RESPONSE",
  ];
  return keys.find((k) => blob.includes(k)) || null;
}

/**
 * Appelle la Cloud Function novaCoach.
 */
export async function novaCoachService({
  capability = "coach",
  message,
  lang,
  context,
}) {
  const clean = String(message || "").trim();
  if (!clean) throw new Error("Message requis");

  try {
    const callable = functions().httpsCallable("novaCoach");
    const res = await callable({
      capability,
      message: clean,
      lang,
      context,
    });
    return res?.data;
  } catch (e) {
    const err = normalizeNovaCallableError(e);
    err.key = getNovaErrorKey(err);
    throw err;
  }
}
