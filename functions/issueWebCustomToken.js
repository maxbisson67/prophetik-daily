// functions/issueWebCustomToken.js
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

initializeApp();

export const issueWebCustomToken = onCall({ region: "us-central1" }, async (req) => {
  try {
    const idToken = req.data?.idToken ?? null;

    let uid = null;
    if (idToken) {
      // ✅ Trust the native ID token
      const decoded = await getAuth().verifyIdToken(idToken);
      uid = decoded.uid;
    } else if (req.auth?.uid) {
      // Fallback: if the callable *is* authenticated already
      uid = req.auth.uid;
    } else {
      throw new HttpsError("unauthenticated", "Provide idToken or call as an authenticated user.");
    }

    const token = await getAuth().createCustomToken(uid, { bridge: "rnfb->web" });
    return { token };
  } catch (err) {
    console.error("[issueWebCustomToken] createCustomToken error:", err);
    throw new HttpsError("internal", "Could not create a custom token for this user.");
  }
});