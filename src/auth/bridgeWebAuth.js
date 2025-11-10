// src/auth/bridgeWebAuth.js
import { httpsCallable } from "firebase/functions";
import { signInWithCustomToken } from "firebase/auth";
import RNFBAuth from "@react-native-firebase/auth";
import { webAuth, functions } from "@src/lib/firebase";

export async function bridgeWebAuthOnce() {
  const native = RNFBAuth().currentUser;
  if (!native) {
    // ensure web signed out if native is out
    try { await webAuth.signOut(); } catch {}
    return false;
  }

  // Already bridged for this UID?
  const w = webAuth.currentUser;
  if (w && w.uid === native.uid) return true;

  // Get a *native* ID token and ask backend for a custom token
  const idToken = await native.getIdToken(true);
  const callable = httpsCallable(functions, "issueWebCustomToken");
  const res = await callable({ idToken });
  const token = res?.data?.token;
  if (!token) throw new Error("No token returned by issueWebCustomToken");

  await signInWithCustomToken(webAuth, token);
  return true;
}