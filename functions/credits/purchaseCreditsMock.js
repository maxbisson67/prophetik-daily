// functions/credits/purchaseCreditsMock.js
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { db, logger } from "../utils.js";
import { grantCreditsTx } from "./grantCredits.js";
import { getPack, isValidPackKey } from "./packs.js";
import { CREDIT_SOURCES } from "./creditSources.js";



function isEmulator() {
  return process.env.FUNCTIONS_EMULATOR === "true";
}

// 🔐 Allowlist temporaire pour tests manuels (DEV ONLY)
const ALLOWED_TEST_UIDS = new Set([
  "45I3FZACt8OTLN39KeSKq7n545G3",
]);

export const purchaseCreditsMock = onCall(
  {
    region: "us-central1",
    cors: true,
  },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError("unauthenticated", "Auth required.");

    // ✅ Sécurité: mock autorisé seulement sur l’émulateur, ou admin token
    const isAdmin = request.auth?.token?.admin === true;
    const isAllowedTester = ALLOWED_TEST_UIDS.has(uid);

    if (!isEmulator() && !isAdmin && !isAllowedTester) {
    throw new HttpsError(
        "permission-denied",
        "Mock purchase is disabled in production."
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
      const r = await grantCreditsTx(tx, {
        uid,
        amount,
        grantId,
        source,
        meta: { packKey, credits: pack.credits, bonus: pack.bonus },
      });
      return r;
    });

    logger.info("purchaseCreditsMock", { uid, packKey, grantId, result });

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