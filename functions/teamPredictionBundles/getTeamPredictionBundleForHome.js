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

function shouldKeepVisibleBundle(bundle, businessYmdCompact) {
  const status = String(bundle?.status || "open").toLowerCase();
  if (["decided", "closed"].includes(status)) return false;
  if (String(bundle?.gameYmd || "").trim() === businessYmdCompact) return true;
  if (["open", "partial", "locked", "pending"].includes(status)) return true;
  return false;
}

function pickBestBundle(candidates, businessYmdCompact, league) {
  return (
    candidates
      .filter((b) => shouldKeepVisibleBundle(b, businessYmdCompact))
      .filter((b) => normalizeLeague(b?.league || league) === normalizeLeague(league))
      .sort((a, b) => String(b?.gameYmd || "").localeCompare(String(a?.gameYmd || "")))[0] ||
    null
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

    const bundle = pickBestBundle(Array.from(byId.values()), businessToday, league);

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
