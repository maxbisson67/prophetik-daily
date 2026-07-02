/**
 * Migre app_config/mobile vers le schéma option A (minSupportedVersion par plateforme).
 *
 * Usage (depuis functions/) :
 *   node scripts/migrateAppConfigMobile.js
 *   node scripts/migrateAppConfigMobile.js --min 3.0.2
 *   node scripts/migrateAppConfigMobile.js --dry-run
 */
import admin from "firebase-admin";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function parseArgs(argv) {
  const out = { dryRun: false, min: "3.0.2" };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--dry-run") out.dryRun = true;
    if (token === "--min" && argv[i + 1]) {
      out.min = argv[i + 1];
      i += 1;
    }
  }
  return out;
}

function resolveServiceAccountPath() {
  const candidates = [
    process.env.GOOGLE_APPLICATION_CREDENTIALS,
    path.join(__dirname, "serviceAccountKey.json"),
    path.join(__dirname, "../jerseys/capitaine-firebase-adminsdk-fbsvc-0581e0ee25.json"),
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }

  throw new Error("Service account introuvable.");
}

const args = parseArgs(process.argv.slice(2));
const saPath = resolveServiceAccountPath();

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(saPath) });
}

const db = admin.firestore();
const ref = db.doc("app_config/mobile");
const snap = await ref.get();
const current = snap.exists ? snap.data() || {} : {};

const iosStoreUrl =
  current?.ios?.storeUrl || current.iosStoreUrl || "https://testflight.apple.com/join/4DAKMFcD";
const androidStoreUrl =
  current?.android?.storeUrl ||
  current.androidStoreUrl ||
  "https://play.google.com/apps/internaltest/4701072534551116370";

const next = {
  ios: {
    minSupportedVersion: args.min,
    storeUrl: iosStoreUrl,
  },
  android: {
    minSupportedVersion: args.min,
    storeUrl: androidStoreUrl,
  },
  updateMessageFr:
    current.updateMessageFr ||
    "Cette version de Prophetik n'est plus supportée. Installe la dernière version pour continuer.",
  updateMessageEn:
    current.updateMessageEn ||
    "This version of Prophetik is no longer supported. Install the latest version to continue.",
  updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  schemaVersion: 2,
};

console.log("Current doc:", JSON.stringify(current, null, 2));
console.log("\nNext doc (merge):", JSON.stringify({ ...next, updatedAt: "<serverTimestamp>" }, null, 2));

if (args.dryRun) {
  console.log("\n(dry-run — aucune écriture)");
  process.exit(0);
}

await ref.set(next, { merge: true });
console.log("\n✅ app_config/mobile migré.");

const verify = await ref.get();
console.log(JSON.stringify(verify.data(), null, 2));
