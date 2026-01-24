// src/ascensions/api.js
import functions from "@react-native-firebase/functions";

function normalizeFunctionsError(e) {
  const code = e?.code || ""; // ex: "functions/failed-precondition"
  const message = e?.message || "Unknown error";

  // Tu peux affiner selon tes messages serveur
  if (code.includes("unauthenticated")) {
    return { code, userMessage: "Vous devez être connecté." };
  }
  if (code.includes("permission-denied")) {
    return { code, userMessage: "Seul le propriétaire du groupe peut créer une ascension." };
  }
  if (code.includes("failed-precondition")) {
    return { code, userMessage: "Abonnement Pro requis pour Ascension 7." };
  }
  if (code.includes("not-found")) {
    return { code, userMessage: "Groupe introuvable." };
  }
  if (code.includes("invalid-argument")) {
    return { code, userMessage: "Données invalides. Veuillez réessayer." };
  }

  return { code, userMessage: message };
}

export async function createAscension({ groupId, type }) {
  try {
    const callable = functions().httpsCallable("ascensionsCreate");
    const res = await callable({ groupId, type }); // ✅ startDate/startStrategy retirés
    return res?.data;
  } catch (e) {
    const friendly = normalizeFunctionsError(e);
    // On relance une erreur “UI-friendly”
    const err = new Error(friendly.userMessage);
    err.code = friendly.code;
    err.raw = e;
    throw err;
  }
}