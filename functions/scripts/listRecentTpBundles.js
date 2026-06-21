/**
 * Liste les bundles TP récents (pour trouver bundleId / groupId).
 *
 * Usage:
 *   GOOGLE_APPLICATION_CREDENTIALS=... node scripts/listRecentTpBundles.js [daysBack=3]
 */
import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

if (!getApps().length) initializeApp();
const db = getFirestore();

const daysBack = Math.max(1, Number(process.argv[2] || 3) || 3);

function ymdToronto(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(d)
    .replace(/-/g, "");
}

const targets = [];
for (let i = 1; i <= daysBack; i += 1) {
  targets.push(ymdToronto(-i));
}

const snap = await db.collection("team_prediction_bundles").get();
const rows = snap.docs
  .map((d) => ({ id: d.id, ...d.data() }))
  .filter((b) => targets.includes(String(b.gameYmd || "")))
  .sort((a, b) => String(b.gameYmd).localeCompare(String(a.gameYmd)));

console.log("Recent gameYmd targets:", targets.join(", "));
console.log("Bundles found:", rows.length);
for (const b of rows) {
  const games = Array.isArray(b.games) ? b.games : [];
  const decided = games.filter((g) => String(g?.status).toLowerCase() === "decided").length;
  const paid = games.filter((g) => g?.payoutApplied === true).length;
  console.log(
    JSON.stringify({
      id: b.id,
      groupId: b.groupId,
      gameYmd: b.gameYmd,
      status: b.status,
      decidedSlots: decided,
      paidSlots: paid,
      gameCount: games.length,
    })
  );
}
