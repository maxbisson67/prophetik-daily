import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { normalizeLeague, pickString } from "../teamPredictionChallenges/tpGameSources.js";
import {
  addDays,
  buildTeamPredictionBundleId,
  getBusinessDate,
  ymdFromBusinessDate,
} from "./tpBundleUtils.js";

if (!getApps().length) initializeApp();

const db = getFirestore();

function ymdCompactFromDate(d) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}${mm}${dd}`;
}

function listBusinessYmdWindow(daysBefore = 2, daysAfter = 7, now = new Date()) {
  const out = [];

  for (let offset = -daysBefore; offset <= daysAfter; offset += 1) {
    out.push(ymdCompactFromDate(addDays(getBusinessDate(now), offset)));
  }

  return [...new Set(out)];
}

function isTodayTpBundleForHome(bundle, businessYmdCompact) {
  return String(bundle?.gameYmd || "").trim() === String(businessYmdCompact || "").trim();
}

function compareTpBundles(a, b) {
  const statusPriority = {
    open: 0,
    partial: 1,
    locked: 2,
    pending: 3,
    decided: 4,
    closed: 5,
  };

  const aPri = statusPriority[String(a?.status || "").toLowerCase()] ?? 9;
  const bPri = statusPriority[String(b?.status || "").toLowerCase()] ?? 9;
  if (aPri !== bPri) return aPri - bPri;

  return String(b?.gameYmd || "").localeCompare(String(a?.gameYmd || ""));
}

function pickTodayHomeBundle(candidates, businessYmdCompact, league) {
  return (
    candidates
      .filter((b) => normalizeLeague(b?.league || league) === normalizeLeague(league))
      .filter((b) => isTodayTpBundleForHome(b, businessYmdCompact))
      .sort((a, b) => compareTpBundles(a, b))[0] || null
  );
}

export const getTeamPredictionBundleForHome = onCall(
  { region: "us-central1", timeoutSeconds: 30, memory: "256MiB" },
  async (req) => {
    const uid = req.auth?.uid || null;
    if (!uid) {
      throw new HttpsError("unauthenticated", "Auth requise.");
    }

    const groupId = pickString(req.data?.groupId);
    const league = normalizeLeague(req.data?.league);
    const hintBundleId = pickString(req.data?.hintBundleId);

    if (!groupId) {
      throw new HttpsError("invalid-argument", "groupId requis.");
    }

    const membershipSnap = await db.doc(`group_memberships/${groupId}_${uid}`).get();
    if (!membershipSnap.exists) {
      throw new HttpsError("permission-denied", "Tu n'es pas membre de ce groupe.");
    }

    const businessToday = ymdFromBusinessDate(new Date());
    const byId = new Map();

    for (const gameYmd of listBusinessYmdWindow(2, 7)) {
      const bundleId = buildTeamPredictionBundleId({ league, groupId, gameYmd });
      const snap = await db.doc(`team_prediction_bundles/${bundleId}`).get();
      if (snap.exists) {
        byId.set(snap.id, { id: snap.id, ...snap.data() });
      }
    }

    if (hintBundleId) {
      const hintSnap = await db.doc(`team_prediction_bundles/${hintBundleId}`).get();
      if (hintSnap.exists) {
        const data = hintSnap.data() || {};
        if (String(data.groupId || "") === groupId) {
          byId.set(hintSnap.id, { id: hintSnap.id, ...data });
        }
      }
    }

    const querySnap = await db
      .collection("team_prediction_bundles")
      .where("groupId", "==", groupId)
      .limit(20)
      .get();

    querySnap.docs.forEach((docSnap) => {
      byId.set(docSnap.id, { id: docSnap.id, ...docSnap.data() });
    });

    const bundle = pickTodayHomeBundle(Array.from(byId.values()), businessToday, league);

    let entry = null;
    if (bundle?.id) {
      const entrySnap = await db
        .doc(`team_prediction_bundles/${bundle.id}/entries/${uid}`)
        .get();
      if (entrySnap.exists) {
        entry = entrySnap.data() || null;
      }
    }

    return {
      ok: true,
      bundle,
      entry,
    };
  }
);
