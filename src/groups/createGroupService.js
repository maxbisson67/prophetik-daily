// src/groups/createGroupService.js
import functions from "@react-native-firebase/functions";

/**
 * ✅ Crée un groupe via Cloud Function (cap + création group + membership owner).
 * Cloud function attend:
 *  - data.name (string)
 *  - data.description (string)
 * Retour:
 *  - { groupId, codeInvitation }
 *
 * IMPORTANT:
 * - Le uid est pris depuis req.auth.uid (donc l'utilisateur doit être connecté)
 * - On ne génère plus codeInvitation côté client
 */
export async function createGroupService({ name, description = "" }) {
  const cleanName = String(name || "").trim();
  const cleanDesc = String(description || "").trim();

  if (!cleanName) {
    throw new Error("Nom requis");
  }

  try {
    // Optionnel: si tu utilises plusieurs régions, ajuste ici.
    // ex: functions().httpsCallable("createGroupWithCap") si même région par défaut
    const callable = functions().httpsCallable("createGroupWithCap");

    const res = await callable({
      name: cleanName,
      description: cleanDesc,
    });

    const data = res?.data || {};
    const groupId = String(data.groupId || "");
    const codeInvitation = String(data.codeInvitation || "");

    if (!groupId) throw new Error("createGroupWithCap: groupId manquant");

    return { groupId, codeInvitation };
  } catch (e) {
    // Firebase callable errors
    const code = e?.code || "";
    const message = e?.message || String(e);

    // Tu peux spécialiser les messages selon tes HttpsError
    if (code === "functions/failed-precondition") {
      // ex: OWNER_GROUP_LIMIT_REACHED
      throw new Error(message);
    }

    throw new Error(message);
  }
}