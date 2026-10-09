import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { logger } from "firebase-functions";
import admin from "firebase-admin";
import {
  getNhlCurrentSeasonId,
  getNhlPreviousSeasonId,
} from "./players/seasonHelpers.js";

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

const NHL_STANDINGS_BASE = "https://api-web.nhle.com/v1/standings";

/* =========================
   Fetch NHL standings
========================= */
async function fetchStandings(dateKey = "now") {
  const key = String(dateKey || "now").trim() || "now";
  const url = `${NHL_STANDINGS_BASE}/${encodeURIComponent(key)}`;
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`NHL standings failed (${res.status}) ${text}`);
  }

  return res.json();
}

/** Date YMD du classement final régulier N-1 (snapshot API). */
export function previousSeasonFinalStandingsYmd(previousSeasonId) {
  const s = String(previousSeasonId || "");
  if (!/^\d{8}$/.test(s)) return null;
  const startYear = Number(s.slice(0, 4));
  if (!Number.isFinite(startYear)) return null;
  return `${startYear + 1}-04-17`;
}

/* =========================
   Write to Firestore
========================= */
async function writeStandings(docId, data, extra = {}) {
  const standings = Array.isArray(data?.standings) ? data.standings : [];

  await db.doc(`nhl_standings/${docId}`).set(
    {
      standings,
      source: "api-web.nhle.com/v1/standings",
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      ...extra,
    },
    { merge: true }
  );

  return standings.length;
}

async function refreshAllNhlStandingsDocs() {
  const calendarSeasonId = getNhlCurrentSeasonId();
  const previousSeasonId = getNhlPreviousSeasonId(calendarSeasonId);

  const currentPayload = await fetchStandings("now");
  const currentCount = await writeStandings("current", currentPayload, {
    seasonId: calendarSeasonId,
    asOf: "now",
  });

  let previousCount = 0;
  const asOfYmd = previousSeasonId ? previousSeasonFinalStandingsYmd(previousSeasonId) : null;
  if (asOfYmd) {
    try {
      const previousPayload = await fetchStandings(asOfYmd);
      previousCount = await writeStandings("previous", previousPayload, {
        seasonId: previousSeasonId,
        asOfYmd,
      });
    } catch (e) {
      logger.warn("[nhlStandings] previous season snapshot failed", {
        asOfYmd,
        error: e?.message || String(e),
      });
    }
  }

  return { currentCount, previousCount, calendarSeasonId, previousSeasonId, asOfYmd };
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
      const result = await refreshAllNhlStandingsDocs();
      return { ok: true, ...result };
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
      const result = await refreshAllNhlStandingsDocs();
      logger.info("[refreshNhlStandings] updated", result);
    } catch (e) {
      logger.error("[refreshNhlStandings]", e);
    }
  }
);