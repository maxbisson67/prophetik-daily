// functions/ascensions/ascensionsTick.js
import { onSchedule } from "firebase-functions/v2/scheduler";
import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { logger } from "firebase-functions";

import { APP_TZ, toYmdInTz, addDaysToYmd } from "../ProphetikDate.js";
import {
  createAscensionDefiIfMissing,
  getAsc4TypeForYmd,
  getFirstGameUtcForGameYmd,
} from "./ascensionUtils.js";

// init admin
if (!getApps().length) initializeApp();
const db = getFirestore();

const JIT_HOURS = 48;

// -------- helpers --------
function ymdFromDateInTz(date, tz = APP_TZ) {
  return toYmdInTz(date, tz);
}

function dowInTz(date = new Date(), tz = APP_TZ) {
  const wd = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short" }).format(date);
  const map = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return map[wd] ?? 0;
}

function nextDowYmdInTz(targetDow, tz = APP_TZ, now = new Date()) {
  const todayYmd = toYmdInTz(now, tz);
  const dow = dowInTz(now, tz);
  let delta = (targetDow - dow + 7) % 7;
  if (delta === 0) delta = 7;
  return addDaysToYmd(todayYmd, delta);
}

// ASC4: Wed..Sat => 1..4
function nextAsc4StepFromYmd(gameYmd, now = new Date()) {
  const t = getAsc4TypeForYmd(gameYmd);
  if (t) return { gameYmd, type: t };

  // si pas Wed..Sat, on va au prochain mercredi
  const nextWed = nextDowYmdInTz(3, APP_TZ, now);
  return { gameYmd: nextWed, type: 1 };
}

// ASC7: Sun..Sat => 1..7
function asc7TypeForYmd(gameYmd) {
  const date = new Date(`${gameYmd}T12:00:00`);
  const dow = dowInTz(date, APP_TZ);
  return dow + 1; // 1..7
}
function nextAsc7StepFromYmd(gameYmd) {
  const t = asc7TypeForYmd(gameYmd);
  return { gameYmd, type: t || 1 };
}

function ascTitle(ascKey, t) {
  const n = ascKey === "ASC7" ? 7 : 4;
  return `Ascension ${n} — ${t}x${t}`;
}
function ascDescription(ascKey) {
  if (ascKey === "ASC7") {
    return "Quête Ascension 7 : sur 7 jours (Dim→Sam), gagne chaque format pour compléter la quête.";
  }
  return "Quête Ascension 4 : sur 4 jours (Mer→Sam), gagne chaque format pour compléter la quête.";
}

async function listGroupsWithAscEnabled() {
  const out = new Map();

  const q4 = await db.collection("groups").where("questAsc4.enabled", "==", true).get().catch(() => null);
  const q7 = await db.collection("groups").where("questAsc7.enabled", "==", true).get().catch(() => null);

  [q4, q7].forEach((snap) => {
    if (!snap || snap.empty) return;
    snap.forEach((d) => out.set(d.id, { id: d.id, ...(d.data() || {}) }));
  });

  return Array.from(out.values());
}

function computeCycleStartYmd(ascKey, now = new Date()) {
  return ascKey === "ASC7"
    ? nextDowYmdInTz(0, APP_TZ, now) // prochain dimanche
    : nextDowYmdInTz(3, APP_TZ, now); // prochain mercredi
}

function computeCycleEndYmd(ascKey, cycleStartYmd) {
  const days = ascKey === "ASC7" ? 6 : 3;
  return addDaysToYmd(String(cycleStartYmd), days);
}

function cycleIdFor(ascKey, cycleStartYmd) {
  // ✅ stable (on réutilise le pattern existant)
  return `${String(ascKey).toUpperCase()}_${String(cycleStartYmd)}`;
}

function cycleRefFor(groupId, cycleId) {
  // ✅ collection sœur
  return db.doc(`groups/${String(groupId)}/ascension_cycles/${String(cycleId)}`);
}

async function ensureCycleDoc({
  groupId,
  ascKey,
  cycleId,
  cycleIndex,
  cycleStartYmd,
  cycleEndYmd,
  stepsTotal,
  ownerId,
  note,
}) {
  const ref = cycleRefFor(groupId, cycleId);

  await ref.set(
    {
      groupId: String(groupId),
      ascKey: String(ascKey).toUpperCase(),
      cycleId: String(cycleId),
      cycleIndex: Number(cycleIndex || 1),
      cycleStartYmd: String(cycleStartYmd),
      cycleEndYmd: String(cycleEndYmd),
      stepsTotal: Number(stepsTotal),
      ownerId: ownerId || null,
      status: "active",
      lastTickNote: note || null,
      updatedAt: FieldValue.serverTimestamp(),
      createdAt: FieldValue.serverTimestamp(), // merge => garde si déjà présent
    },
    { merge: true }
  );

  return ref;
}

async function advanceAscensionCycleKeepProgress({
  groupId,
  ascRef,
  ascKey,
  cycleStartYmd,
  cycleIndex,
  ownerId,
}) {
  const cycleId = cycleIdFor(ascKey, cycleStartYmd);
  const cycleEndYmd = computeCycleEndYmd(ascKey, cycleStartYmd);
  const stepsTotal = ascKey === "ASC7" ? 7 : 4;

  // ✅ crée/merge doc cycle (historique)
  await ensureCycleDoc({
    groupId,
    ascKey,
    cycleId,
    cycleIndex,
    cycleStartYmd,
    cycleEndYmd,
    stepsTotal,
    ownerId,
    note: "cycle-advance-keep-progress",
  });

  // ✅ met à jour l’état courant
  await ascRef.set(
    {
      enabled: true,
      activeCycleId: cycleId, // ✅ nouveau pointeur
      cycleId,                // garde compat si déjà utilisé ailleurs
      cycleIndex: Number(cycleIndex || 1),
      cycleStartYmd: String(cycleStartYmd),
      cycleEndYmd,

      nextGameYmd: String(cycleStartYmd),

      lastCreatedGameYmd: null,
      lastDefiIdByStep: {},

      updatedAt: FieldValue.serverTimestamp(),
      lastTickAt: FieldValue.serverTimestamp(),
      lastTickNote: "cycle-advance-keep-progress",
    },
    { merge: true }
  );

  return { ok: true, cycleId, cycleEndYmd, stepsTotal };
}

async function canCreateWithinJit(gameYmd, now, jitHours) {
  const firstGameUTC = await getFirstGameUtcForGameYmd(gameYmd);
  if (!firstGameUTC) return { ok: false, reason: "NO_MATCHUPS" };

  const hoursAhead = (firstGameUTC.getTime() - now.getTime()) / (1000 * 60 * 60);
  if (hoursAhead > jitHours) return { ok: false, reason: "TOO_EARLY", hoursAhead };

  return { ok: true, firstGameUTC, hoursAhead };
}

// -------- scheduler --------
export const ascensionsTick = onSchedule(
  {
    schedule: "0 * * * *", // chaque heure
    timeZone: APP_TZ,
    region: "us-central1",
  },
  async () => {
    const now = new Date();
    const nowYmd = ymdFromDateInTz(now);

    const groups = await listGroupsWithAscEnabled();
    if (!groups.length) {
      logger.info("[ascensionsTick] no groups");
      return;
    }

    logger.info("[ascensionsTick] scanning", { count: groups.length, nowYmd });

    for (const g of groups) {
      const groupId = String(g.id);
      const ownerId = g.ownerId || g.createdBy || null;

      const configs = [
        { ascKey: "ASC4", cfg: g.questAsc4 },
        { ascKey: "ASC7", cfg: g.questAsc7 },
      ];

      for (const { ascKey, cfg } of configs) {
        if (!cfg?.enabled) continue;

        const ascRef = db.doc(`groups/${groupId}/ascensions/${ascKey}`);
        const ascSnap = await ascRef.get();
        const ascState = ascSnap.exists ? (ascSnap.data() || {}) : {};

        const stepsTotal = ascKey === "ASC7" ? 7 : 4;

        // init / defaults
        const enabled = ascState.enabled !== false;
        if (!enabled) continue;

        const completed = Array.isArray(ascState.completedWinners) ? ascState.completedWinners : [];
        if (completed.length > 0) continue;

        // ----- cycle handling -----
        let cycleIndex = Number(ascState.cycleIndex || 1);
        let cycleStartYmd = String(
          ascState.cycleStartYmd || cfg.startDateYmd || computeCycleStartYmd(ascKey, now)
        );
        let cycleEndYmd = String(ascState.cycleEndYmd || computeCycleEndYmd(ascKey, cycleStartYmd));

        // ✅ reset hebdo si on a dépassé la fin de cycle ET pas de gagnant
        if (nowYmd > cycleEndYmd) {
          cycleIndex += 1;
          cycleStartYmd = computeCycleStartYmd(ascKey, now);
          cycleEndYmd = computeCycleEndYmd(ascKey, cycleStartYmd);

          const rr = await advanceAscensionCycleKeepProgress({
            groupId,
            ascRef,
            ascKey,
            cycleStartYmd,
            cycleIndex,
            ownerId,
          });

          logger.info("[ascensionsTick] cycle advanced", { groupId, ascKey, ...rr });
        }

        const activeCycleId = String(
          ascState.activeCycleId || ascState.cycleId || cycleIdFor(ascKey, cycleStartYmd)
        );

        // ✅ s’assure que le doc cycle existe (même si on n’a pas “advance”)
        await ensureCycleDoc({
          groupId,
          ascKey,
          cycleId: activeCycleId,
          cycleIndex,
          cycleStartYmd,
          cycleEndYmd,
          stepsTotal,
          ownerId,
          note: "ensure-cycle-doc",
        });

        // Déterminer nextGameYmd (dans le cycle courant)
        const baseYmd = String(ascState.nextGameYmd || cfg.startDateYmd || cycleStartYmd || nowYmd);
        const baseSafe = baseYmd < cycleStartYmd ? cycleStartYmd : baseYmd;

        if (baseSafe > cycleEndYmd) {
          await ascRef.set(
            {
              cycleStartYmd,
              cycleEndYmd,
              activeCycleId,
              nextGameYmd: baseSafe,
              updatedAt: FieldValue.serverTimestamp(),
              lastTickAt: FieldValue.serverTimestamp(),
              lastTickNote: "out-of-cycle-wait-reset",
            },
            { merge: true }
          );
          continue;
        }

        const next = ascKey === "ASC7" ? nextAsc7StepFromYmd(baseSafe) : nextAsc4StepFromYmd(baseSafe, now);
        const { gameYmd, type } = next;

        if (gameYmd > cycleEndYmd) {
          await ascRef.set(
            {
              cycleStartYmd,
              cycleEndYmd,
              activeCycleId,
              nextGameYmd: gameYmd,
              updatedAt: FieldValue.serverTimestamp(),
              lastTickAt: FieldValue.serverTimestamp(),
              lastTickNote: "next-out-of-cycle",
            },
            { merge: true }
          );
          continue;
        }

        // ✅ Ne crée pas à l'avance : seulement le défi du jour (APP_TZ)
        if (String(gameYmd) > String(nowYmd)) {
          await ascRef.set(
            {
              enabled: true,
              stepsTotal,
              cycleIndex,
              cycleStartYmd,
              cycleEndYmd,
              activeCycleId,
              updatedAt: FieldValue.serverTimestamp(),
              lastTickAt: FieldValue.serverTimestamp(),
              lastTickNote: `wait:future_gameYmd:${gameYmd}`,
            },
            { merge: true }
          );
          continue;
        }

        // ✅ JIT
        const jit = await canCreateWithinJit(gameYmd, now, JIT_HOURS);
        if (!jit.ok) {
          if (jit.reason === "NO_MATCHUPS") {
            const bump = addDaysToYmd(gameYmd, 1);

            await ascRef.set(
              {
                enabled: true,
                stepsTotal,
                cycleIndex,
                cycleStartYmd,
                cycleEndYmd,
                activeCycleId,
                nextGameYmd: bump,
                updatedAt: FieldValue.serverTimestamp(),
                lastTickAt: FieldValue.serverTimestamp(),
                lastTickNote: "skip:NO_MATCHUPS",
              },
              { merge: true }
            );

            await cycleRefFor(groupId, activeCycleId).set(
              {
                nextGameYmd: bump,
                updatedAt: FieldValue.serverTimestamp(),
                lastTickNote: "skip:NO_MATCHUPS",
              },
              { merge: true }
            );

            continue;
          }

          if (jit.reason === "TOO_EARLY") {
            await ascRef.set(
              {
                enabled: true,
                stepsTotal,
                cycleIndex,
                cycleStartYmd,
                cycleEndYmd,
                activeCycleId,
                updatedAt: FieldValue.serverTimestamp(),
                lastTickAt: FieldValue.serverTimestamp(),
                lastTickNote: `skip:TOO_EARLY:${Math.round(jit.hoursAhead)}h`,
              },
              { merge: true }
            );
            await cycleRefFor(groupId, activeCycleId).set(
              {
                updatedAt: FieldValue.serverTimestamp(),
                lastTickNote: `skip:TOO_EARLY:${Math.round(jit.hoursAhead)}h`,
              },
              { merge: true }
            );
            continue;
          }
        }

        // 2) create defi (idempotent)
        const res = await createAscensionDefiIfMissing({
          ascKey,
          groupId,
          createdBy: ownerId,
          gameYmd,
          type,
          title: ascTitle(ascKey, type),
          description: ascDescription(ascKey),
        });

        if (!res?.ok) {
          const bump = addDaysToYmd(gameYmd, 1);

          await ascRef.set(
            {
              enabled: true,
              stepsTotal,
              cycleIndex,
              cycleStartYmd,
              cycleEndYmd,
              activeCycleId,
              nextGameYmd: bump,
              updatedAt: FieldValue.serverTimestamp(),
              lastTickAt: FieldValue.serverTimestamp(),
              lastTickNote: `skip:${res?.reason || "unknown"}`,
            },
            { merge: true }
          );

          await cycleRefFor(groupId, activeCycleId).set(
            {
              nextGameYmd: bump,
              updatedAt: FieldValue.serverTimestamp(),
              lastTickNote: `skip:${res?.reason || "unknown"}`,
            },
            { merge: true }
          );

          logger.warn("[ascensionsTick] create refused", { groupId, ascKey, gameYmd, type, res });
          continue;
        }

        const defiId = res.defiId;

        // ✅ attache cycleId dans le défi (utile pour finalize/historique)
        await db.doc(`defis/${defiId}`).set(
          {
            ascension: {
              ...(res.ascension || {}), // si createAscensionDefiIfMissing retourne qqchose
              key: String(ascKey).toUpperCase(),
              stepType: Number(type),
              cycleId: String(activeCycleId),
            },
          },
          { merge: true }
        ).catch(() => {});

        const nextGameYmd = addDaysToYmd(gameYmd, 1);

        // ✅ état courant
        await ascRef.set(
          {
            enabled: true,
            stepsTotal,
            cycleIndex,
            cycleStartYmd,
            cycleEndYmd,
            activeCycleId,
            lastDefiIdByStep: { [String(type)]: defiId },
            lastCreatedGameYmd: gameYmd,
            nextGameYmd,
            updatedAt: FieldValue.serverTimestamp(),
            lastTickAt: FieldValue.serverTimestamp(),
            lastTickNote: "created",
          },
          { merge: true }
        );

        // ✅ historique (cycle)
        await cycleRefFor(groupId, activeCycleId).set(
          {
            lastDefiIdByStep: { [String(type)]: defiId },
            lastCreatedGameYmd: gameYmd,
            nextGameYmd,
            updatedAt: FieldValue.serverTimestamp(),
            lastTickNote: "created",
          },
          { merge: true }
        );

        logger.info("[ascensionsTick] created/confirmed", { groupId, ascKey, defiId, gameYmd, type, activeCycleId });
      }
    }
  }
);