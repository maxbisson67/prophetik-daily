/**
 * Remplace les URLs GCS signées (403) par des URLs Firebase Storage avec token.
 *
 * Usage (depuis functions/) :
 *   node scripts/backfillJerseyDownloadUrls.js --dry-run
 *   node scripts/backfillJerseyDownloadUrls.js --commit
 *   node scripts/backfillJerseyDownloadUrls.js --commit --uids uid1,uid2
 *
 * Credentials : GOOGLE_APPLICATION_CREDENTIALS ou scripts/serviceAccountKey.json
 */

import admin from "firebase-admin";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  ensureFirebaseDownloadUrl,
  isFirebaseDownloadUrl,
  JERSEY_STORAGE_BUCKET,
  parseJerseyStoragePath,
} from "../jerseys/jerseyStorageUrls.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { FieldValue } = admin.firestore;

function parseArgs(argv) {
  const args = {
    dryRun: true,
    uids: null,
  };

  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--commit") args.dryRun = false;
    else if (arg === "--dry-run") args.dryRun = true;
    else if (arg === "--uids") {
      args.uids = String(argv[i + 1] || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      i += 1;
    }
  }

  return args;
}

function initAdmin() {
  const keyPath = path.join(__dirname, "serviceAccountKey.json");
  if (fs.existsSync(keyPath)) {
    admin.initializeApp({
      credential: admin.credential.cert(keyPath),
      storageBucket: JERSEY_STORAGE_BUCKET,
    });
    return;
  }

  admin.initializeApp({
    storageBucket: JERSEY_STORAGE_BUCKET,
  });
}

async function loadJerseyParticipants(db, uids) {
  if (uids?.length) {
    const snaps = await Promise.all(
      uids.map((uid) => db.doc(`participants/${uid}`).get())
    );
    return snaps
      .filter((snap) => snap.exists)
      .map((snap) => ({ uid: snap.id, data: snap.data() || {} }));
  }

  const snap = await db.collection("participants").where("avatarKind", "==", "jersey").get();
  return snap.docs.map((doc) => ({ uid: doc.id, data: doc.data() || {} }));
}

async function resolveSideUrl(bucket, currentUrl, fallbackPath) {
  if (isFirebaseDownloadUrl(currentUrl)) {
    return { url: currentUrl, changed: false, path: parseJerseyStoragePath(currentUrl) };
  }

  const pathFromUrl = parseJerseyStoragePath(currentUrl);
  const filePath = pathFromUrl || fallbackPath;
  const url = await ensureFirebaseDownloadUrl(bucket, filePath);
  return { url, changed: true, path: filePath };
}

async function backfillParticipant({ db, bucket, uid, data, dryRun }) {
  const version = String(data.jerseyVersion || "").trim();
  if (!version) {
    console.log(`[skip] ${uid}: jerseyVersion manquant`);
    return { uid, skipped: true };
  }

  const basePath = `jerseys/generated/${uid}/${version}`;
  const sides = [
    ["jerseyFrontUrl", `${basePath}/front.png`],
    ["jerseyBackUrl", `${basePath}/back.png`],
    ["jerseyProfileUrl", `${basePath}/profile.png`],
  ];

  const updates = {};
  let anyChanged = false;

  for (const [field, fallbackPath] of sides) {
    const current = data[field];
    if (!current && field !== "jerseyProfileUrl") {
      console.log(`[warn] ${uid}: ${field} absent`);
      continue;
    }
    if (!current) continue;

    const { url, changed, path: resolvedPath } = await resolveSideUrl(
      bucket,
      current,
      fallbackPath
    );

    if (changed) anyChanged = true;
    updates[field] = url;
    console.log(`[${dryRun ? "dry" : "ok"}] ${uid} ${field}`, {
      path: resolvedPath,
      changed,
    });
  }

  if (!anyChanged) {
    console.log(`[skip] ${uid}: URLs déjà au format Firebase`);
    return { uid, skipped: true };
  }

  updates.avatarUrl = updates.jerseyFrontUrl || data.avatarUrl;
  updates.photoURL = updates.jerseyFrontUrl || data.photoURL;
  updates.updatedAt = FieldValue.serverTimestamp();

  if (!dryRun) {
    await Promise.all([
      db.doc(`participants/${uid}`).set(updates, { merge: true }),
      db.doc(`profiles_public/${uid}`).set(updates, { merge: true }),
    ]);
  }

  return { uid, updated: true, updates };
}

async function main() {
  const args = parseArgs(process.argv);
  initAdmin();

  const db = admin.firestore();
  const bucket = admin.storage().bucket(JERSEY_STORAGE_BUCKET);
  const participants = await loadJerseyParticipants(db, args.uids);

  console.log(
    `[backfillJerseyDownloadUrls] participants=${participants.length} dryRun=${args.dryRun}`
  );

  let updated = 0;
  let skipped = 0;

  for (const { uid, data } of participants) {
    const result = await backfillParticipant({
      db,
      bucket,
      uid,
      data,
      dryRun: args.dryRun,
    });
    if (result.updated) updated += 1;
    if (result.skipped) skipped += 1;
  }

  console.log(`[done] updated=${updated} skipped=${skipped} dryRun=${args.dryRun}`);
}

main().catch((err) => {
  console.error("[backfillJerseyDownloadUrls] failed", err);
  process.exit(1);
});
