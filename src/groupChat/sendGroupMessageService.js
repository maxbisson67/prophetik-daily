import functions from "@react-native-firebase/functions";

function normalizeCallableError(e) {
  const code = e?.code || e?.details?.code || null;
  const message = e?.message || String(e);
  const details = e?.details ?? null;
  return { code, message, details, raw: e };
}

function getErrorKey(err) {
  const msg = String(err?.message || "");
  const candidates = [
    "RATE_LIMIT_FAST",
    "RATE_LIMIT_MINUTE",
    "MESSAGE_TOO_LONG",
  ];
  return candidates.find((k) => msg.includes(k)) || null;
}

/**
 * Envoie un message dans le chat d'un groupe via Cloud Function.
 */
export async function sendGroupMessageService({ groupId, text }) {
  if (!groupId) throw new Error("groupId manquant");

  const clean = String(text || "").trim();
  if (!clean) throw new Error("Message vide");

  try {
    const callable = functions().httpsCallable("sendGroupMessage");
    const res = await callable({ groupId: String(groupId), text: clean });
    return res?.data;
  } catch (e) {
    const err = normalizeCallableError(e);
    err.key = getErrorKey(err);
    throw err;
  }
}
