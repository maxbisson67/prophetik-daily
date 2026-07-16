import functions from "@react-native-firebase/functions";

export async function deleteAccountCallable() {
  const callable = functions().httpsCallable("deleteAccount");
  const res = await callable({ confirm: true });
  return res?.data || {};
}
