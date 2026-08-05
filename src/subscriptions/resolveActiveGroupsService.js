import functions from "@react-native-firebase/functions";

export async function resolveActiveGroupsService({ keepActiveGroupIds }) {
  const ids = Array.isArray(keepActiveGroupIds)
    ? keepActiveGroupIds.map(String).filter(Boolean)
    : [];

  const callable = functions().httpsCallable("resolveActiveGroups");
  const res = await callable({ keepActiveGroupIds: ids });
  return res?.data;
}
