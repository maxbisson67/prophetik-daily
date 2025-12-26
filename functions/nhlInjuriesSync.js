// functions/nhlInjuriesSync.js
import { onSchedule } from "firebase-functions/v2/scheduler";
import { db, FieldValue, logger } from "./utils.js";
import { defineSecret } from "firebase-functions/params";

// ✅ Sportradar endpoint (league injuries)
const SPORTRADAR_URL =
  "https://api.sportradar.com/nhl/trial/v7/en/league/injuries.json";

const SPORTRADAR_API_KEY = defineSecret("SPORTRADAR_API_KEY");

function normalizeStr(v) {
  const s = typeof v === "string" ? v.trim() : "";
  return s ? s : null;
}

// Normalisation légère des statuts Sportradar -> ce que ton UI attend
function normalizeStatus(srStatus) {
  const s = String(srStatus || "").trim().toLowerCase();
  if (!s) return null;

  // Sportradar renvoie souvent: "Day To Day", "Out", etc.
  if (s.includes("day")) return "DayToDay";
  if (s === "out" || s.includes("out")) return "Out";
  if (s.includes("question")) return "Questionable";
  if (s.includes("prob")) return "Probable";
  return "Unknown";
}

// Construit le snapshot "injury" dans ton format app
function mapInjuryFromSportradar(player) {
  const injuries = Array.isArray(player?.injuries) ? player.injuries : [];
  if (!injuries.length) return null;

  // ✅ MVP: on prend la plus récente (par update_date si présent)
  const sorted = injuries
    .slice()
    .sort((a, b) => String(b?.update_date || "").localeCompare(String(a?.update_date || "")));

  const inj = sorted[0] || null;
  if (!inj) return null;

  const status = normalizeStatus(inj?.status);
  // Si status absent mais injury existe, on garde Unknown
  const safeStatus = status || "Unknown";

  const short = normalizeStr(inj?.desc);          // ex: "Illness"
  const description = normalizeStr(inj?.comment); // ex: "did not play..."

  return {
    status: safeStatus,
    short,
    description,
    startDate: normalizeStr(inj?.start_date) ?? null,
    expectedReturn: null, // Sportradar "league injuries" n'a pas toujours expected return
    updatedDate: normalizeStr(inj?.update_date) ?? null,
    source: "sportradar",
    updatedAt: FieldValue.serverTimestamp(),
  };
}

export const syncNhlInjuries = onSchedule(
  {
    schedule: "0 9 * * *",
    timeZone: "America/Toronto",
    region: "us-central1",
    secrets: [SPORTRADAR_API_KEY],
  },
  async () => {
   const apiKey = SPORTRADAR_API_KEY.value();
    if (!apiKey) {
      logger.error("Missing SPORTRADAR_API_KEY env var");
      return;
    }

    const res = await fetch(SPORTRADAR_URL, {
      headers: {
        accept: "application/json",
        "x-api-key": apiKey,
      },
    });

    if (!res.ok) {
      const txt = await res.text();
      logger.error(`[injuries] Sportradar error ${res.status}`, {
        body: txt?.slice?.(0, 300),
      });
      return;
    }

    const payload = await res.json();

    // Selon Sportradar: payload.teams[].players[]
    const teams = Array.isArray(payload?.teams) ? payload.teams : [];
    if (!teams.length) {
      logger.error("[injuries] Invalid payload (no teams[])");
      return;
    }

    let batch = db.batch();
    let batchCount = 0;

    let playersSeen = 0;
    let playersUpdated = 0;
    let skippedNoReference = 0;

    for (const team of teams) {
      const players = Array.isArray(team?.players) ? team.players : [];
      for (const p of players) {
        playersSeen++;

        // ✅ Ton Firestore id = NHL playerId, et Sportradar le donne via "reference"
        const nhlPlayerId = String(p?.reference ?? "").trim();
        if (!nhlPlayerId) {
          skippedNoReference++;
          continue;
        }

        const injurySnapshot = mapInjuryFromSportradar(p);
        const ref = db.collection("nhl_players").doc(nhlPlayerId);

        // ✅ IMPORTANT: set+merge pour ne pas écraser les autres champs
        // et pour éviter l'erreur "No document to update"
        if (injurySnapshot) {
          batch.set(ref, { injury: injurySnapshot }, { merge: true });
        } else {
          batch.set(ref, { injury: FieldValue.delete() }, { merge: true });
        }

        batchCount++;
        playersUpdated++;

        // limite batch Firestore
        if (batchCount >= 450) {
          await batch.commit();
          batch = db.batch();
          batchCount = 0;
        }
      }
    }

    if (batchCount > 0) await batch.commit();

    logger.info("[injuries] Sync completed (Sportradar)", {
      playersSeen,
      playersUpdated,
      skippedNoReference,
    });
  }
);