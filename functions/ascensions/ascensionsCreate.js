// functions/ascensions/ascensionsCreate.js
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { db, logger } from "../utils.js";
import { APP_TZ, toYmdInTz, addDaysToYmd } from "../ProphetikDate.js";
import { getAsc4TypeForYmd } from "./ascensionUtils.js";
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
  return 1; // free, gratuit
}

function dowInTz(date = new Date(), tz = APP_TZ) {
  const wd = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short" }).format(date);
  const map = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return map[wd] ?? 0;
}

function nextDowYmdInTz(targetDow, tz = APP_TZ, now = new Date()) {
  const todayYmd = toYmdInTz(now, tz);
  const dow = dowInTz(now, tz);
  let delta = (targetDow - dow + 7) % 7;
  if (delta === 0) delta = 7;
  return addDaysToYmd(todayYmd, delta);
}

function forcedStartYmdForAscType(ascType) {
  return ascType === 7
    ? nextDowYmdInTz(0, APP_TZ) // dimanche
    : nextDowYmdInTz(3, APP_TZ); // mercredi
}

function dowInTzFromYmd(ymd, tz = APP_TZ) {
  const date = new Date(`${ymd}T12:00:00`);
  const wd = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short" }).format(date);
  const map = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return map[wd] ?? 0;
}

function getAsc7TypeForYmd(gameYmd) {
  return dowInTzFromYmd(gameYmd, APP_TZ) + 1; // 1..7
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

  return { gRef, group };
}

/* ---------------- Callable ---------------- */
export const ascensionsCreate = onCall(
  { region: "us-central1" },
  async (req) => {
    const uid = assertAuth(req);

    const groupId = String(req.data?.groupId || "");
    const ascType = Number(req.data?.type || 0);
    const startDateYmd = forcedStartYmdForAscType(ascType);
    const startStrategy = "nextStartDay";

    if (!groupId) throw new HttpsError("invalid-argument", "Missing groupId");
    if (![4, 7].includes(ascType)) throw new HttpsError("invalid-argument", "Invalid ascension type");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDateYmd)) {
      throw new HttpsError("invalid-argument", "Invalid startDate format (YYYY-MM-DD)");
    }

    const { gRef } = await assertCanManageGroup(uid, groupId);

    const { tier, active } = await getUserTier(uid);

    if (ascType === 7) {
      if (active === false) {
        throw new HttpsError("failed-precondition", "Active subscription required for Ascension 7");
      }
      if (planRank(tier) < planRank("pro")) {
        throw new HttpsError("failed-precondition", "Pro subscription required for Ascension 7");
      }
    }

    const ascKey = ascType === 7 ? "ASC7" : "ASC4";
    const defiType =
      ascKey === "ASC7"
        ? getAsc7TypeForYmd(startDateYmd)
        : getAsc4TypeForYmd(startDateYmd);

    if (!defiType) {
      throw new HttpsError("failed-precondition", "Start date is outside ascension window for this format");
    }

    // 1) update group config
    const cfgPath = ascKey === "ASC7" ? "questAsc7" : "questAsc4";
    await gRef.set(
      {
        [cfgPath]: {
          enabled: true,
          startStrategy,
          startDateYmd,
          defiTypeStart: defiType,
          activatedAt: new Date(),
          activatedBy: uid,
          updatedAt: new Date(),
        },
      },
      { merge: true }
    );

    // 2) notify group: Ascension created (but defis JIT)
    try {
      const title = ascType === 7 ? "Ascension 7 activée" : "Ascension 4 activée";
      const body =
        ascType === 7
          ? "Une Ascension 7 vient d’être lancée. Les défis seront créés juste à temps (48h avant)."
          : "Une Ascension 4 vient d’être lancée. Les défis seront créés juste à temps (48h avant).";

      logger.info("[ascensionsCreate] about to sendPushToGroup", { groupId, uid });


      const res = await sendPushToGroup({
        groupId,
        createdBy: uid,
        includeCreator: true,
        includeAi: false,
        title,
        body,
        data: {
          action: "OPEN_ASCENSION",
          groupId,
          ascKey,
        },
        channelId: "challenges_v2",
        logTag: "ascensionsCreate",
      });

      logger.info("[ascensionsCreate] sendPushToGroup result", { groupId, res });

    } catch (e) {
      logger.warn("[ascensionsCreate] push failed (non-blocking)", { error: e?.message || String(e) });
    }

    logger.info("[ascensionsCreate] enabled (JIT)", {
      uid,
      groupId,
      ascKey,
      startDateYmd,
      defiType,
      tier,
      active,
    });

    return {
      ok: true,
      groupId,
      ascKey,
      type: ascType,
      startDate: startDateYmd,
      defiType,
      tier,
      active,
      jit: true,
      message: "Ascension enabled. Defis will be created just-in-time by scheduled tick.",
    };
  }
);