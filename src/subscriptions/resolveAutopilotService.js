import functions from "@react-native-firebase/functions";

export async function resolveAutopilotGroupsService({ keepGroupIds }) {
  const ids = Array.isArray(keepGroupIds)
    ? keepGroupIds.map(String).filter(Boolean)
    : [];

  const callable = functions().httpsCallable("resolveAutopilotGroups");
  const res = await callable({ keepGroupIds: ids });
  return res?.data;
}
