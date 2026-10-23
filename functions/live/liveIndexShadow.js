import { FieldValue } from "firebase-admin/firestore";
import { getFirestoreCostFlags } from "../shared/firestoreCostFlags.js";

function dayRef(db, ymdDashed) {
  const ymd = String(ymdDashed || "").slice(0, 10);
  return db.doc(`internal/live_index/days/${ymd}`);
}

function entryRef(db, ymdDashed, kind, docId) {
  const ymd = String(ymdDashed || "").slice(0, 10);
  const id = `${String(kind || "unknown")}_${String(docId || "").trim()}`;
  return db.doc(`internal/live_index/days/${ymd}/entries/${id}`);
}

/**
 * Shadow write only (Pack A lundi) — crons continuent les queries legacy.
 */
export async function shadowWriteLiveIndexEntry(
  db,
  { ymd, kind, docId, groupId, status, sport = null, extra = {} } = {}
) {
  const { liveIndexShadowWrite } = getFirestoreCostFlags();
  if (!liveIndexShadowWrite) return;

  const ymdDashed = String(ymd || "").slice(0, 10);
  const gid = String(groupId || "").trim();
  const challengeId = String(docId || "").trim();
  if (!ymdDashed || !kind || !challengeId) return;

  const payload = {
    ymd: ymdDashed,
    kind: String(kind),
    docId: challengeId,
    groupId: gid || null,
    status: status != null ? String(status) : null,
    sport: sport != null ? String(sport).toUpperCase() : null,
    updatedAt: FieldValue.serverTimestamp(),
    ...extra,
  };

  await Promise.all([
    entryRef(db, ymdDashed, kind, challengeId).set(payload, { merge: true }),
    dayRef(db, ymdDashed).set(
      {
        ymd: ymdDashed,
        lastShadowWriteAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    ),
  ]);
}

export async function shadowRemoveLiveIndexEntry(db, { ymd, kind, docId } = {}) {
  const { liveIndexShadowWrite } = getFirestoreCostFlags();
  if (!liveIndexShadowWrite) return;
  const ref = entryRef(db, ymd, kind, docId);
  await ref.delete().catch(() => {});
}
