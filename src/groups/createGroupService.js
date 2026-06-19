// src/groups/createGroupService.js
import functions from "@react-native-firebase/functions";
import { normalizeGroupFavoriteTeam } from "@src/groups/normalizeGroupFavoriteTeam";

/**
 * ✅ Crée un groupe via Cloud Function.
 *
 * Cloud function attend:
 *  - data.name
 *  - data.description
 *  - data.sport: "NHL" | "MLB"
 *  - data.autopilotEnabled: boolean (optionnel, default true)
 *  - data.favoriteTeam: null | { sport, teamId, abbreviation, name }
 */
export async function createGroupService({
  name,
  description = "",
  sport = "NHL",
  autopilotEnabled = true,
  favoriteTeam = null,
}) {
  const cleanName = String(name || "").trim();
  const cleanDesc = String(description || "").trim();

  const cleanSport = String(sport || "NHL").trim().toUpperCase();
  const normalizedSport = cleanSport === "MLB" ? "MLB" : "NHL";

  if (!cleanName) {
    throw new Error("Nom requis");
  }

  const normalizedFavoriteTeam = normalizeGroupFavoriteTeam(normalizedSport, favoriteTeam);

  const payload = {
    name: cleanName,
    description: cleanDesc,
    sport: normalizedSport,
    autopilotEnabled: autopilotEnabled !== false,
    favoriteTeam: normalizedFavoriteTeam,
  };

  if (__DEV__) {
    console.log("[createGroupService] payload", payload);
  }

  try {
    const callable = functions().httpsCallable("createGroupWithCap");

    const res = await callable(payload);

    const data = res?.data || {};
    const groupId = String(data.groupId || "");
    const codeInvitation = String(data.codeInvitation || "");

    if (!groupId) {
      throw new Error("createGroupWithCap: groupId manquant");
    }

    return {
      groupId,
      codeInvitation,
      sport: String(data.sport || normalizedSport).toUpperCase(),
    };
  } catch (e) {
    const code = e?.code || "";
    const message = e?.message || String(e);

    if (code === "functions/failed-precondition") {
      throw new Error(message);
    }

    throw new Error(message);
  }
}
