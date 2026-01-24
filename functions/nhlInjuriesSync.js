// functions/nhlInjuriesSync.js
import { onSchedule } from "firebase-functions/v2/scheduler";
import { db, FieldValue, logger } from "./utils.js";
import { defineSecret } from "firebase-functions/params";
import { FieldPath } from "firebase-admin/firestore";

const SPORTRADAR_URL =
  "https://api.sportradar.com/nhl/trial/v7/en/league/injuries.json";

const SPORTRADAR_API_KEY = defineSecret("SPORTRADAR_API_KEY");

function normalizeStr(v) {
  const s = typeof v === "string" ? v.trim() : "";
  return s ? s : null;
}

function ymdUTC(date = new Date()) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function normalizeStatus(srStatus) {
  const s = String(srStatus || "").trim().toLowerCase();
  if (!s) return null;
  if (s.includes("day")) return "DayToDay";
  if (s === "out" || s.includes("out")) return "Out";
  if (s.includes("question")) return "Questionable";
  if (s.includes("prob")) return "Probable";
  return "Unknown";
}

function mapInjuryFromSportradar(player) {
  const injuries = Array.isArray(player?.injuries) ? player.injuries : [];
  if (!injuries.length) return null;

  const sorted = injuries
    .slice()
    .sort((a, b) =>
      String(b?.update_date || "").localeCompare(String(a?.update_date || ""))
    );

  const inj = sorted[0] || null;
  if (!inj) return null;

  const status = normalizeStatus(inj?.status);
  const safeStatus = status || "Unknown";

  return {
    status: safeStatus,
    short: normalizeStr(inj?.desc),
    description: normalizeStr(inj?.comment),
    startDate: normalizeStr(inj?.start_date) ?? null,
    expectedReturn: null,
    updatedDate: normalizeStr(inj?.update_date) ?? null,
    source: "sportradar",
    updatedAt: FieldValue.serverTimestamp(),
  };
}

async function commitBatch(batch, count) {
  if (count > 0) await batch.commit();
}

async function clearDocsBySnaps(docs, reason) {
  if (!docs?.length) return 0;

  let b = db.batch();
  let c = 0;
  let cleared = 0;

  for (const docSnap of docs) {
    if (docSnap.id === "8478403") {
      logger.info("[injuries] clearing EICHEL", { reason, docId: docSnap.id });
    }

    b.set(
      docSnap.ref,
      {
        injury: FieldValue.delete(),
        injuryClearedAt: FieldValue.serverTimestamp(),
        injuryClearReason: reason,
      },
      { merge: true }
    );

    c++;
    cleared++;

    if (c >= 450) {
      await commitBatch(b, c);
      b = db.batch();
      c = 0;
    }
  }

  await commitBatch(b, c);
  return cleared;
}

/**
 * ✅ Purge robuste:
 * - scan tous les docs ayant injury.source == "sportradar"
 * - clear si injuryRunId !== runId (inclut: champ manquant)
 */
async function purgeStaleByScan({ runId }) {
  let scanned = 0;
  let cleared = 0;

  let last = null;

  while (true) {
    let q = db
      .collection("nhl_players")
      .where("injury.source", "==", "sportradar")
      .orderBy(FieldPath.documentId())
      .limit(400);

    if (last) q = q.startAfter(last);

    const snap = await q.get();
    if (snap.empty) break;

    scanned += snap.size;

    const toClear = [];
    for (const docSnap of snap.docs) {
      const d = docSnap.data() || {};
      const docRunId = d.injuryRunId; // peut être undefined
      if (docRunId !== runId) toClear.push(docSnap);
    }

    if (toClear.length) {
      cleared += await clearDocsBySnaps(toClear, "stale_injuryRunId_or_missing");
    }

    last = snap.docs[snap.docs.length - 1];
    if (snap.size < 400) break;
  }

  return { scanned, cleared };
}

export const syncNhlInjuries = onSchedule(
  {
    //schedule: "*/2 * * * *", // test
    schedule: "0 9 * * *",
    timeZone: "America/Toronto",
    region: "us-central1",
    secrets: [SPORTRADAR_API_KEY],
  },
  async () => {
    const apiKey = SPORTRADAR_API_KEY.value();
    if (!apiKey) {
      logger.error("Missing SPORTRADAR_API_KEY");
      return;
    }

    const runId = String(Date.now());
    const runYmd = ymdUTC(new Date());
    logger.info("[injuries] sync start", { runId, runYmd });

    const res = await fetch(SPORTRADAR_URL, {
      headers: { accept: "application/json", "x-api-key": apiKey },
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      logger.error(`[injuries] Sportradar error ${res.status}`, {
        body: txt?.slice?.(0, 300),
      });
      return;
    }

    const payload = await res.json();
    const teams = Array.isArray(payload?.teams) ? payload.teams : [];
    if (!teams.length) {
      logger.error("[injuries] Invalid payload (no teams[])");
      return;
    }

    let batch = db.batch();
    let batchCount = 0;

    let playersSeen = 0;
    let playersTouched = 0;
    let injuredCount = 0;
    let clearedInline = 0;
    let skippedNoReference = 0;

    // 1) Upsert joueurs blessés (payload Sportradar = blessés)
    for (const team of teams) {
      const players = Array.isArray(team?.players) ? team.players : [];
      for (const p of players) {
        playersSeen++;

        const nhlPlayerId = String(p?.reference ?? "").trim();
        if (!nhlPlayerId) {
          skippedNoReference++;
          continue;
        }

        if (nhlPlayerId === "8478403") {
          logger.info("[injuries] EICHEL in payload", {
            reference: nhlPlayerId,
            rawInjuriesCount: Array.isArray(p?.injuries) ? p.injuries.length : 0,
            latestUpdate: p?.injuries?.[0]?.update_date || null,
            status: p?.injuries?.[0]?.status || null,
            desc: p?.injuries?.[0]?.desc || null,
          });
        }

        const injurySnapshot = mapInjuryFromSportradar(p);
        const ref = db.collection("nhl_players").doc(nhlPlayerId);

        if (injurySnapshot) {
          injuredCount++;
          batch.set(
            ref,
            {
              injury: injurySnapshot,
              injurySyncYmd: runYmd,
              injuryRunId: runId,
            },
            { merge: true }
          );
        } else {
          // (rare) si un joueur est présent sans injuries[]
          clearedInline++;
          batch.set(
            ref,
            {
              injury: FieldValue.delete(),
              injurySyncYmd: runYmd,
              injuryRunId: runId,
            },
            { merge: true }
          );
        }

        batchCount++;
        playersTouched++;

        if (batchCount >= 450) {
          await batch.commit();
          batch = db.batch();
          batchCount = 0;
        }
      }
    }

    await commitBatch(batch, batchCount);

    // 2) Purge robuste des stale (inclut champs manquants)
    const purge = await purgeStaleByScan({ runId });

    logger.info("[injuries] Sync completed (Sportradar)", {
      runId,
      runYmd,
      playersSeen,
      playersTouched,
      injuredCount,
      clearedInline,
      skippedNoReference,
      staleScanned: purge.scanned,
      staleCleared: purge.cleared,
    });
  }
);