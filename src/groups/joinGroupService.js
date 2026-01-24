// src/groups/joinGroupService.js
import functions from "@react-native-firebase/functions";

/**
 * Rejoindre un groupe via code (cap member géré côté serveur)
 * CF: joinGroupWithCap
 * @returns {Promise<{ok: boolean, groupId: string, groupName?: string}>}
 */
export async function joinGroupService({ code, identity } = {}) {
  const callable = functions().httpsCallable("joinGroupWithCap");
  const res = await callable({ code, identity });
  return res.data;
}