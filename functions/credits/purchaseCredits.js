// functions/credits/purchaseCredits.js  (DEV ONLY / MOCK)
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { db, logger } from "../utils.js";
import { grantCreditsTx } from "./grantCredits.js";
import { getPack, isValidPackKey } from "./packs.js";
import { CREDIT_SOURCES } from "./creditSources.js";

function isEmulator() {
  return (
    process.env.FUNCTIONS_EMULATOR === "true" ||
    !!process.env.FIREBASE_EMULATOR_HUB
  );
}

// 🔐 Allowlist temporaire pour tests manuels (DEV ONLY)
const ALLOWED_TEST_UIDS = new Set([
  "45I3FZACt8OTLN39KeSKq7n545G3",
]);

export const purchaseCredits = onCall(
  {
    region: "us-central1",
    cors: true,
  },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError("unauthenticated", "Auth required.");

    // ✅ DEV ONLY: autorisé seulement sur émulateur, ou admin token, ou allowlist
    const isAdmin = request.auth?.token?.admin === true;
    const isAllowedTester = ALLOWED_TEST_UIDS.has(uid);

    if (!isEmulator() && !isAdmin && !isAllowedTester) {
      throw new HttpsError(
        "permission-denied",
        "purchaseCredits is disabled in production (DEV ONLY)."
      );
    }

    const data = request.data || {};
    const packKey = String(data.packKey || "").trim();
    const clientTxId = String(data.clientTxId || "").trim(); // idempotence côté client

    if (!isValidPackKey(packKey)) {
      throw new HttpsError("invalid-argument", "Invalid packKey.");
    }
    if (!clientTxId || clientTxId.length < 10) {
      throw new HttpsError("invalid-argument", "clientTxId is required (uuid).");
    }

    const pack = getPack(packKey);
    const amount = Number(pack.credits || 0) + Number(pack.bonus || 0);

    const grantId = `mock_${uid}_${clientTxId}`; // ✅ idempotence solide
    const source = CREDIT_SOURCES.PURCHASE_PACK;

    const result = await db.runTransaction(async (tx) => {
      return grantCreditsTx(tx, {
        uid,
        amount,
        grantId,
        source,
        meta: { packKey, credits: pack.credits, bonus: pack.bonus, devOnly: true },
      });
    });

    logger.info("[DEV] purchaseCredits mock applied", { uid, packKey, grantId, result });

    return {
      ok: true,
      packKey,
      amount,
      grantId,
      applied: result.applied === true,
      fromBalance: result.fromBalance ?? null,
      toBalance: result.toBalance ?? null,
      reason: result.reason ?? null,
    };
  }
);