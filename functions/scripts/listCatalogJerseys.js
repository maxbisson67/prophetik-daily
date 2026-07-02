import admin from "firebase-admin";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const candidates = [
  process.env.GOOGLE_APPLICATION_CREDENTIALS,
  path.join(__dirname, "serviceAccountKey.json"),
  path.join(__dirname, "../jerseys/capitaine-firebase-adminsdk-fbsvc-0581e0ee25.json"),
].filter(Boolean);

const sa = candidates.find((p) => fs.existsSync(p));
if (!sa) {
  console.error("Service account introuvable");
  process.exit(1);
}

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(sa) });
}

const snap = await admin.firestore().collection("catalog_jerseys").get();
console.log("count", snap.size);
for (const d of snap.docs) {
  const x = d.data();
  console.log(
    JSON.stringify({
      id: d.id,
      active: x.active,
      activeType: typeof x.active,
      sport: x.sport,
      sort: x.sort,
      name: x.name,
      hasPreview: !!x.previewFrontUrl,
      dataIdField: x.id ?? null,
    })
  );
}
