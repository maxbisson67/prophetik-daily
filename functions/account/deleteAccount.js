import { onCall, HttpsError } from "firebase-functions/v2/https";
import { deleteUserAccount } from "./accountDeletionCore.js";

export const deleteAccount = onCall(
  {
    region: "us-central1",
    cors: true,
  },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
      throw new HttpsError("unauthenticated", "Authentification requise.");
    }

    if (request.data?.confirm !== true) {
      throw new HttpsError("invalid-argument", "CONFIRMATION_REQUIRED");
    }

    try {
      const result = await deleteUserAccount(uid);
      return {
        ok: true,
        deletedAt: Date.now(),
        summary: {
          groups: result.groups,
          anonymizedParticipations: result.anonymizedParticipations,
          anonymizedEntries: result.anonymizedEntries,
          authDeleted: result.authDeleted === true,
        },
      };
    } catch (e) {
      throw new HttpsError(
        "internal",
        String(e?.message || e || "DELETE_ACCOUNT_FAILED")
      );
    }
  }
);
