// functions/ascensions/ascensionsTick.js
import { onSchedule } from "firebase-functions/v2/scheduler";
import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { logger } from "firebase-functions";

import { APP_TZ, toYmdInTz, addDaysToYmd } from "../ProphetikDate.js";
import {
  createAscensionDefiIfMissing,
  getFirstEligibleGameUtcForGameYmd,
} from "./ascensionUtils.js";

if (!getApps().length) initializeApp();
const db = getFirestore();

const JIT_HOURS = 48;
const MINUTES_BEFORE_FIRST_GAME = 60; // ✅ sécurité: ne pas créer si < 60 min avant 1er match

/* ---------------- helpers ---------------- */
function ymdFromDateInTz(date, tz = APP_TZ) {
  return toYmdInTz(date, tz);
}

function dowInTz(date = new Date(), tz = APP_TZ) {
  const wd = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short" }).format(date);
  const map = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return map[wd] ?? 0;
}

// ASC7: Sun..Sat => 1..7
function asc7TypeForYmd(gameYmd) {
  const date = new Date(`${gameYmd}T12:00:00`);
  const dow = dowInTz(date, APP_TZ);
  return dow + 1;
}

function ascTitle(stepType) {
  return `Ascension 7 — ${stepType}x${stepType}`;
}

function ascDescription() {
  return "Quête Ascension 7 : la semaine dicte le format (Dim→Sam). Gagne 1x1..7x7 au moins une fois pour remporter le jackpot.";
}

function clampStartYmd({ cfgStartYmd, tomorrowYmd }) {
  const s = String(cfgStartYmd || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return tomorrowYmd;

  // ✅ On force "demain seulement" pour les nouvelles runs:
  // si quelqu’un a mis une date passée/aujourd’hui par erreur, on remonte à demain.
  return s < tomorrowYmd ? tomorrowYmd : s;
}

async function canCreateWithinJit(gameYmd, now, jitHours) {
  const fg = await getFirstEligibleGameUtcForGameYmd(gameYmd);
  if (!fg.ok) return { ok: false, reason: fg.reason || "NO_MATCHUPS" };

  const firstGameUTC = fg.firstGameUTC;
  const diffMs = firstGameUTC.getTime() - now.getTime();
  const hoursAhead = diffMs / (1000 * 60 * 60);
  const minutesAhead = diffMs / (1000 * 60);

  // ✅ Trop tard (match déjà commencé / trop proche)
  if (minutesAhead < MINUTES_BEFORE_FIRST_GAME) {
    return { ok: false, reason: "TOO_LATE", minutesAhead, firstGameUTC };
  }

  // ✅ Trop tôt (JIT)
  if (hoursAhead > jitHours) return { ok: false, reason: "TOO_EARLY", hoursAhead, firstGameUTC };

  return { ok: true, firstGameUTC, hoursAhead, minutesAhead };
}

async function listGroupsWithAsc7Enabled() {
  const snap = await db
    .collection("groups")
    .where("questAsc7.enabled", "==", true)
    .get()
    .catch(() => null);

  if (!snap || snap.empty) return [];
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() || {}) }));
}

/* ---------------- scheduler ---------------- */
export const ascensionsTick = onSchedule(
  {
    schedule: "5 3-6 * * *",// à 3:05, 4:05, 5:05 et 6:05 AM chaque nuit
    //schedule: "*/1 * * * *", // test chaque minute
    timeZone: APP_TZ,
    region: "us-central1",
  },
  async () => {
    const now = new Date();
    const nowYmd = ymdFromDateInTz(now);
    const tomorrowYmd = addDaysToYmd(nowYmd, 1);

    const groups = await listGroupsWithAsc7Enabled();
    if (!groups.length) {
      logger.info("[ascensionsTick] no ASC7-enabled groups");
      return;
    }

    for (const g of groups) {
      const groupId = String(g.id);
      const ownerId = g.ownerId || g.createdBy || null;

      const cfg = g.questAsc7 || {};
      const ascRootRef = db.doc(`groups/${groupId}/ascensions/ASC7`);
      const ascRootSnap = await ascRootRef.get().catch(() => null);
      const ascRoot = ascRootSnap?.exists ? ascRootSnap.data() || {} : {};

      if (ascRoot.enabled === false) continue;

      // ✅ Active run?
      let activeRunId = ascRoot.activeRunId ? String(ascRoot.activeRunId) : null;

      // ✅ If none, create/select run using cfg.startRunYmd/cfg.startDateYmd
      // ✅ IMPORTANT: on force "demain minimum" pour une nouvelle run (ton choix produit).
      if (!activeRunId) {
        const cfgStart = cfg.startRunYmd || cfg.startDateYmd || null;
        const startRunYmd = clampStartYmd({ cfgStartYmd: cfgStart, tomorrowYmd });

        activeRunId = startRunYmd;

        const runRef = db.doc(`groups/${groupId}/ascensions/ASC7/runs/${activeRunId}`);

        await db.runTransaction(async (tx) => {
          const rSnap = await tx.get(runRef);

          if (!rSnap.exists) {
            tx.set(runRef, {
              groupId,
              ascKey: "ASC7",
              runId: activeRunId,
              startYmd: startRunYmd,
              status: "active",
              ownerId: ownerId || null,
              jackpot: 0,
              createdAt: FieldValue.serverTimestamp(),
              updatedAt: FieldValue.serverTimestamp(),
            });
          } else {
            // si existe déjà, on touche seulement updatedAt
            tx.set(runRef, { updatedAt: FieldValue.serverTimestamp() }, { merge: true });
          }

          tx.set(
            ascRootRef,
            {
              enabled: true,
              status: "active",
              activeRunId,
              updatedAt: FieldValue.serverTimestamp(),
              lastTickAt: FieldValue.serverTimestamp(),
              lastTickNote: `ensure-active-run:${startRunYmd}`,
            },
            { merge: true }
          );
        });

        logger.info("[ascensionsTick] ASC7 run created/selected", { groupId, activeRunId, startRunYmd });
      }

      const runRef = db.doc(`groups/${groupId}/ascensions/ASC7/runs/${activeRunId}`);
      const runSnap = await runRef.get().catch(() => null);
      const run = runSnap?.exists ? runSnap.data() || {} : {};

      if (String(run.status || "").toLowerCase() === "completed") {
        await ascRootRef.set(
          {
            activeRunId: null,
            updatedAt: FieldValue.serverTimestamp(),
            lastTickAt: FieldValue.serverTimestamp(),
            lastTickNote: "run-already-completed-cleared",
          },
          { merge: true }
        );
        continue;
      }

      // ✅ Create only today's defi (weekly mapping)
      const gameYmd = nowYmd;

      // ✅ Start gate: si la run commence demain, on NE crée rien aujourd’hui.
      const startYmd = String(run.startYmd || activeRunId || tomorrowYmd);
      if (gameYmd < startYmd) {
        await ascRootRef.set(
          {
            activeRunId,
            lastTickAt: FieldValue.serverTimestamp(),
            lastTickNote: `wait:run-start:${startYmd}`,
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
        continue;
      }

      // ✅ JIT + "pas trop tard"
      const jit = await canCreateWithinJit(gameYmd, now, JIT_HOURS);
      if (!jit.ok) {
        await ascRootRef.set(
          {
            activeRunId,
            lastTickAt: FieldValue.serverTimestamp(),
            lastTickNote: `skip:${jit.reason || "unknown"}${
              jit.hoursAhead != null ? `:${Math.round(jit.hoursAhead)}h` : ""
            }${
              jit.minutesAhead != null ? `:${Math.round(jit.minutesAhead)}m` : ""
            }`,
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
        continue;
      }

      const stepType = asc7TypeForYmd(gameYmd);

      const res = await createAscensionDefiIfMissing({
        ascKey: "ASC7",
        groupId,
        createdBy: ownerId,
        gameYmd,
        type: stepType,
        title: ascTitle(stepType),
        description: ascDescription(),
        runId: activeRunId,
      });

      if (!res?.ok) {
        await ascRootRef.set(
          {
            activeRunId,
            lastTickAt: FieldValue.serverTimestamp(),
            lastTickNote: `create-refused:${res?.reason || "unknown"}`,
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
        continue;
      }

      const defiId = res.defiId;

      // ✅ Normalize: ascension meta (runProcessed=false)
      await db.doc(`defis/${defiId}`).set(
        {
          groupId,
          ascension: {
            ...(res.ascension || {}),
            key: "ASC7",
            runId: activeRunId,
            stepType,
            runProcessed: false,
            runProcessedAt: null,
          },
        },
        { merge: true }
      );

      await ascRootRef.set(
        {
          enabled: true,
          status: "active",
          activeRunId,
          updatedAt: FieldValue.serverTimestamp(),
          lastTickAt: FieldValue.serverTimestamp(),
          lastTickNote: "created/confirmed",
          lastDefiId: defiId,
          lastDefiGameYmd: gameYmd,
          lastDefiStepType: stepType,
        },
        { merge: true }
      );

      logger.info("[ascensionsTick] ASC7 created/confirmed", {
        groupId,
        runId: activeRunId,
        defiId,
        gameYmd,
        stepType,
      });
    }
  }
);