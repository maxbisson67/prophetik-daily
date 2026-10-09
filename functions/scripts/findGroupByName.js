import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const q = String(process.argv[2] || "").trim();

function resolveServiceAccountPath() {
  const candidates = [
    process.env.GOOGLE_APPLICATION_CREDENTIALS,
    path.join(__dirname, "serviceAccountKey.json"),
    path.join(__dirname, "../../capitaine-firebase-adminsdk-fbsvc-a0066fa0df.json"),
  ].filter(Boolean);
  for (const candidate of candidates) {
    if (candidate && fs.existsSync(candidate)) return candidate;
  }
  return null;
}

if (!getApps().length) {
  const saPath = resolveServiceAccountPath();
  initializeApp(
    saPath ? { credential: cert(JSON.parse(fs.readFileSync(saPath, "utf8"))) } : undefined
  );
}

const db = getFirestore();
const snap = await db.collection("groups").get();
for (const d of snap.docs) {
  const name = String(d.data()?.name || "");
  if (!q || name.toLowerCase().includes(q.toLowerCase())) {
    console.log(d.id, name);
  }
}
