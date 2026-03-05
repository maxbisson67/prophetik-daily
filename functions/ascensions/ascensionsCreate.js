// functions/ascensions/ascensionsCreate.js
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { db, logger } from "../utils.js";
import { FieldValue } from "firebase-admin/firestore";
import { APP_TZ, toYmdInTz, addDaysToYmd } from "../ProphetikDate.js";
import { sendPushToGroup } from "../utils/pushUtils.js";

/* ---------------- Helpers ---------------- */
function assertAuth(req) {
  if (!req.auth?.uid) throw new HttpsError("unauthenticated", "Authentication required");
  return req.auth.uid;
}

function planRank(p) {
  const s = String(p || "free").toLowerCase();
  if (s === "vip") return 3;
  if (s === "pro") return 2;
  return 1;
}

function isValidYmd(s) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(s || ""));
}

function todayYmdInAppTz(now = new Date()) {
  return toYmdInTz(now, APP_TZ);
}

function tomorrowYmdInAppTz(now = new Date()) {
  const today = todayYmdInAppTz(now);
  return addDaysToYmd(today, 1);
}

async function getUserTier(uid) {
  const a = await db.doc(`entitlements/${uid}`).get();
  if (a.exists) {
    const d = a.data() || {};
    return { tier: String(d.tier || "free").toLowerCase(), active: d.active !== false };
  }

  const b = await db.doc(`participants/${uid}`).get();
  if (b.exists) {
    const d = b.data() || {};
    return { tier: String(d.tier || "free").toLowerCase(), active: d.subscriptionActive !== false };
  }

  return { tier: "free", active: true };
}

async function assertCanManageGroup(uid, groupId) {
  const gRef = db.collection("groups").doc(String(groupId));
  const gSnap = await gRef.get();
  if (!gSnap.exists) throw new HttpsError("not-found", "Group not found");

  const group = gSnap.data() || {};
  const ownerId = group.ownerId || group.createdBy || null;

  if (!ownerId || ownerId !== uid) {
    throw new HttpsError("permission-denied", "Only the group owner can create an ascension");
  }

  return { gRef, group, ownerId };
}

/**
 * ✅ Demain seulement (APP_TZ)
 * - accepte req.data.startDateYmd (UI) ou startYmd (legacy)
 * - si absent => demain
 * - si invalide => demain
 * - si < demain => REFUS (invalid-argument)
 */
function computeStartDateYmd(reqData, now = new Date()) {
  const tomorrow = tomorrowYmdInAppTz(now);

  const raw =
    (reqData?.startDateYmd != null ? String(reqData.startDateYmd) : null) ||
    (reqData?.startYmd != null ? String(reqData.startYmd) : null);

  const candidate = raw && isValidYmd(raw) ? raw : tomorrow;

  // force "demain" minimum
  if (candidate < tomorrow) {
    throw new HttpsError(
      "invalid-argument",
      `startDateYmd must be >= ${tomorrow} (tomorrow only).`
    );
  }

  return { startDateYmd: candidate, tomorrow, rawProvided: !!raw };
}

/* ---------------- Callable ---------------- */
export const ascensionsCreate = onCall({ region: "us-central1" }, async (req) => {
  const uid = assertAuth(req);

  const groupId = String(req.data?.groupId || "");
  if (!groupId) throw new HttpsError("invalid-argument", "Missing groupId");

  // ✅ ASC7 only
  const ascKey = "ASC7";
  const ascType = 7;

  // ✅ startDateYmd = demain minimum
  const { startDateYmd, rawProvided } = computeStartDateYmd(req.data, new Date());
  const startStrategy = rawProvided ? "custom" : "tomorrow";

  const { gRef, ownerId } = await assertCanManageGroup(uid, groupId);

  const { tier, active } = await getUserTier(uid);

  // ✅ gating ASC7 (Pro+)
  if (tier !== "free" && active === false) {
    throw new HttpsError("failed-precondition", "Active subscription required for Ascension 7");
  }
  if (planRank(tier) < planRank("pro")) {
    throw new HttpsError("failed-precondition", "Pro subscription required for Ascension 7");
  }

  // ✅ run-based: runId = startDateYmd
  const runId = startDateYmd;

  const ascRootRef = db.doc(`groups/${groupId}/ascensions/${ascKey}`);
  const runRef = db.doc(`groups/${groupId}/ascensions/${ascKey}/runs/${runId}`);

  await db.runTransaction(async (tx) => {
    const rootSnap = await tx.get(ascRootRef);
    const root = rootSnap.exists ? rootSnap.data() || {} : {};

    // S'il y a déjà un activeRunId, on bloque si ce run est actif
    const existingRunId = root.activeRunId ? String(root.activeRunId) : null;
    if (existingRunId) {
      const existingRunRef = db.doc(`groups/${groupId}/ascensions/${ascKey}/runs/${existingRunId}`);
      const exSnap = await tx.get(existingRunRef);
      const ex = exSnap.exists ? exSnap.data() || {} : {};
      const exStatus = String(ex.status || "active").toLowerCase();

      if (exStatus !== "completed") {
        throw new HttpsError(
          "failed-precondition",
          `An ${ascKey} run is already active (${existingRunId}). Complete it before creating a new one.`
        );
      }
    }

    // Crée le run si missing (ou merge si déjà là)
    const rSnap = await tx.get(runRef);
    if (!rSnap.exists) {
      tx.set(runRef, {
        groupId,
        ascKey,
        runId,
        startYmd: runId,
        status: "active",
        ownerId: ownerId || uid,
        jackpot: 0,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    } else {
      tx.set(runRef, { status: "active", updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    }

    // Root: pointe sur le run actif
    tx.set(
      ascRootRef,
      {
        enabled: true,
        status: "active",
        activeRunId: runId,
        startStrategy,
        startDateYmd: runId,
        activatedAt: FieldValue.serverTimestamp(),
        activatedBy: uid,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  });

  // ✅ garder la config dans groups.questAsc7 (tick fallback)
  await gRef.set(
    {
      questAsc7: {
        enabled: true,
        startStrategy,
        startRunYmd: startDateYmd, // ✅ toujours >= demain
        activatedAt: FieldValue.serverTimestamp(),
        activatedBy: uid,
        updatedAt: FieldValue.serverTimestamp(),
      },
    },
    { merge: true }
  );

  // Push
  try {
    const title = "Ascension 7 activée";
    const body = `Une Ascension 7 vient d’être lancée. Début: ${startDateYmd}.`;

    const res = await sendPushToGroup({
      groupId,
      createdBy: uid,
      includeCreator: true,
      includeAi: false,
      title,
      body,
      data: { action: "OPEN_ASCENSION", groupId, ascKey, runId: startDateYmd },
      channelId: "challenges_v2",
      logTag: "ascensionsCreate",
    });

    logger.info("[ascensionsCreate] sendPushToGroup result", { groupId, res });
  } catch (e) {
    logger.warn("[ascensionsCreate] push failed (non-blocking)", { error: e?.message || String(e) });
  }

  logger.info("[ascensionsCreate] ASC7 run enabled", {
    uid,
    groupId,
    ascKey,
    runId: startDateYmd,
    tier,
    active,
  });

  return {
    ok: true,
    groupId,
    ascKey,
    type: ascType,
    runId: startDateYmd,
    startDateYmd,
    tier,
    active,
    jit: true,
    message: "ASC7 run created/enabled. Defis will be created just-in-time by scheduled tick.",
  };
});