import functions from "@react-native-firebase/functions";
import { PARTICIPATION } from "@src/groups/participationUtils";

/**
 * Active ou désactive la participation aux défis dans un groupe.
 * CF: setMembershipParticipation
 */
export async function setMembershipParticipationService({
  groupId,
  participation = PARTICIPATION.ACTIVE,
} = {}) {
  const callable = functions().httpsCallable("setMembershipParticipation");
  const res = await callable({ groupId, participation });
  return res.data;
}
