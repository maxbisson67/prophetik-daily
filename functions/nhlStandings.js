import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { logger } from "firebase-functions";
import admin from "firebase-admin";

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

const NHL_STANDINGS_URL = "https://api-web.nhle.com/v1/standings/now";

/* =========================
   Fetch NHL standings
========================= */
async function fetchStandings() {
  const res = await fetch(NHL_STANDINGS_URL, {
    headers: { Accept: "application/json" },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`NHL standings failed (${res.status}) ${text}`);
  }

  return res.json();
}

/* =========================
   Write to Firestore
========================= */
async function writeStandings(data) {
  const standings = Array.isArray(data?.standings) ? data.standings : [];

  await db.doc("nhl_standings/current").set(
    {
      standings,
      source: "api-web.nhle.com/v1/standings",
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  return standings.length;
}

/* =========================
   Callable (manual refresh)
========================= */
export const updateNhlStandingsNow = onCall(
  { region: "us-central1" },
  async (req) => {
    if (!req.auth) {
      throw new HttpsError("unauthenticated", "Login required");
    }

    try {
      const data = await fetchStandings();
      const count = await writeStandings(data);
      return { ok: true, count };
    } catch (e) {
      logger.error("[updateNhlStandingsNow]", e);
      throw new HttpsError("internal", String(e?.message || e));
    }
  }
);

/* =========================
   Scheduled refresh
========================= */
export const refreshNhlStandings = onSchedule(
  { schedule: "every 30 minutes", region: "us-central1" },
  async () => {
    try {
      const data = await fetchStandings();
      const count = await writeStandings(data);
      logger.info("[refreshNhlStandings] updated", { count });
    } catch (e) {
      logger.error("[refreshNhlStandings]", e);
    }
  }
);