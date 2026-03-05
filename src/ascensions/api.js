// src/ascensions/api.js
import functions from "@react-native-firebase/functions";

function normalizeFunctionsError(e) {
  const code = e?.code || "";
  const message = e?.message || "Unknown error";

  if (code.includes("unauthenticated")) return { code, userMessage: "Vous devez être connecté." };
  if (code.includes("permission-denied")) return { code, userMessage: "Seul le propriétaire du groupe peut créer une ascension." };
  if (code.includes("failed-precondition")) return { code, userMessage: e?.message || "Condition non respectée." };
  if (code.includes("not-found")) return { code, userMessage: "Groupe introuvable." };
  if (code.includes("invalid-argument")) return { code, userMessage: "Données invalides. Veuillez réessayer." };

  return { code, userMessage: message };
}

export async function createAscension({ groupId, startDateYmd }) {
  try {
    const callable = functions().httpsCallable("ascensionsCreate");
    const res = await callable({ groupId, type: 7, startDateYmd }); // ✅ ASC7 only
    return res?.data;
  } catch (e) {
    const friendly = normalizeFunctionsError(e);
    const err = new Error(friendly.userMessage);
    err.code = friendly.code;
    err.raw = e;
    throw err;
  }
}