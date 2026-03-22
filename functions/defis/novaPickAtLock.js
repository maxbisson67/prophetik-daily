// functions/defis/novaPickAtLock.js
import { onSchedule } from "firebase-functions/v2/scheduler";
import { logger } from "firebase-functions";
import { db, FieldValue } from "../utils.js";

// Nova
const NOVA_UID = "ai";
const LOCK_MINUTES_BEFORE = 15;

// 🎯 Bonus cagnotte quand Nova participe (si aucun autre montant n'est défini)
const NOVA_POT_BONUS_DEFAULT = 1;

function getDefiRules(defiType) {
  switch (Number(defiType)) {
    case 1: return { picks: 1, T1: 1, T2: 0, T3: 0 };
    case 2: return { picks: 2, T1: 1, T2: 1, T3: 0 };
    case 3: return { picks: 3, T1: 1, T2: 1, T3: 1 };
    case 4: return { picks: 4, T1: 1, T2: 1, T3: 2 };
    case 5: return { picks: 5, T1: 1, T2: 2, T3: 2 };
    case 6: return { picks: 6, T1: 2, T2: 2, T3: 2 };
    case 7: return { picks: 7, T1: 2, T2: 2, T3: 3 };
    default: return { picks: 0, T1: 0, T2: 0, T3: 0 };
  }
}

function safeNum(v, fallback = 0) {
  const x = Number(v);
  return Number.isFinite(x) ? x : fallback;
}

/**
 * ✅ Strict: ne permet QUE les joueurs "active" (ou statut vide).
 * Tout autre statut => considéré blessé / non fiable => interdit.
 */
function isInjuredOrUnavailable(injury) {
  const raw = String(injury?.status || "").trim().toLowerCase();
  if (!raw) return false;          // pas d'info -> on considère ok
  if (raw === "active") return false;
  return true;                      // daytoday, out, ir, etc.
}

/**
 * Pick Nova:
 * - scoreNovaBase desc
 * - pointsPerGame desc
 * - rank asc
 * - nom
 * En évitant TOUT joueur blessé si avoidInjured=true
 */
function pickNFrom(list, n, usedSet, { avoidInjured = true } = {}) {
  const sorted = (list || []).slice().sort((a, b) => {
    const ds = safeNum(b.scoreNovaBase, 0) - safeNum(a.scoreNovaBase, 0);
    if (ds) return ds;

    const dppg = safeNum(b.pointsPerGame, 0) - safeNum(a.pointsPerGame, 0);
    if (dppg) return dppg;

    const dr = safeNum(a.rank, 999999) - safeNum(b.rank, 999999);
    if (dr) return dr;

    return String(a.fullName || "").localeCompare(String(b.fullName || ""));
  });

  const out = [];
  for (const p of sorted) {
    if (out.length >= n) break;
    const pid = String(p.playerId || "");
    if (!pid) continue;
    if (usedSet.has(pid)) continue;

    if (avoidInjured && isInjuredOrUnavailable(p.injury)) continue;

    usedSet.add(pid);
    out.push(p);
  }
  return out;
}

/**
 * Détermine combien Nova "ajoute à la cagnotte".
 * - si tu as un champ dans le defi, tu peux le prioriser (ex: defi.entryCost / defi.novaPotBonus)
 * - fallback: NOVA_POT_BONUS_DEFAULT
 */
function getNovaPotBonus(defi) {
  const t = Number(defi?.type || 0);
  // ex: 1x1 => 1, 2x2 => 2, 3x3 => 3, etc.
  if (Number.isFinite(t) && t > 0) return t;

  // fallback (si jamais type est absent)
  return NOVA_POT_BONUS_DEFAULT;
}

// ✅ toutes les 30 minutes (au lieu de chaque minute)
export const novaPickAtLock = onSchedule("every 5 minutes", async () => {
  const now = new Date();
  const nowMs = now.getTime();
  const lockMs = LOCK_MINUTES_BEFORE * 60 * 1000;

  const qs = await db
    .collection("defis")
    .where("status", "==", "open")
    .where("poolStatus", "==", "ready")
    .limit(50)
    .get();

  if (qs.empty) return;

  let processed = 0;

  for (const doc of qs.docs) {
    const defiId = doc.id;
    const defi = doc.data() || {};

    const firstGameUTC = defi.firstGameUTC || defi.firstGameAtUTC || null;
    const firstDate = firstGameUTC?.toDate?.() ? firstGameUTC.toDate() : null;
    if (!firstDate) continue;

    const lockAtMs = firstDate.getTime() - lockMs;

    // ✅ Nova pick "à partir de T-60min"
    if (nowMs < lockAtMs) continue;

    // match déjà commencé
    if (nowMs > firstDate.getTime()) continue;

    // idempotency (déjà fait)
    if (defi.novaLockedAt) continue;

    const poolSnap = await db
      .collection(`defis/${defiId}/playerPool`)
      .orderBy("rank")
      .get();

    if (poolSnap.empty) continue;

    const pool = poolSnap.docs.map((d) => d.data());
    const rules = getDefiRules(defi.type);

    if (!rules.picks) {
      await db.doc(`defis/${defiId}`).set(
        {
          novaLockedAt: FieldValue.serverTimestamp(),
          novaError: "invalid_defi_type",
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      continue;
    }

    const t1 = pool.filter((p) => p.tier === "T1");
    const t2 = pool.filter((p) => p.tier === "T2");
    const t3 = pool.filter((p) => p.tier === "T3");

    const used = new Set();

    // ✅ STRICT: on évite TOUS les statuts non-actifs.
    const picks = [
      ...pickNFrom(t1, rules.T1, used, { avoidInjured: true }),
      ...pickNFrom(t2, rules.T2, used, { avoidInjured: true }),
      ...pickNFrom(t3, rules.T3, used, { avoidInjured: true }),
    ];

    if (picks.length !== rules.picks) {
      await db.doc(`defis/${defiId}`).set(
        {
          novaLockedAt: FieldValue.serverTimestamp(),
          novaError: "not_enough_healthy_players_for_rules",
          novaErrorMeta: { need: rules.picks, got: picks.length },
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      logger.warn("[novaPickAtLock] not enough healthy players", {
        defiId,
        need: rules.picks,
        got: picks.length,
      });
      continue;
    }

    const partRef = db.doc(`defis/${defiId}/participations/${NOVA_UID}`);
    const defiRef = db.doc(`defis/${defiId}`);
    const nowTs = FieldValue.serverTimestamp();

    await db.runTransaction(async (tx) => {
      const partSnap = await tx.get(partRef);

      const potBonus = getNovaPotBonus(defi);

      const base = {
        uid: NOVA_UID,
        type: "ai",

        // Nova ne "paie" pas comme un user (mais on veut que la cagnotte augmente)
        paid: true,
        paidAmount: potBonus,
        sponsoredBy: "prophetik", // optionnel

        joinedAt: nowTs,

        picks: picks.map((p) => ({
          playerId: String(p.playerId),
          fullName: p.fullName || "",
          teamAbbr: p.teamAbbr || null,
          tier: p.tier || null,
          rank: safeNum(p.rank, 0),

          points: safeNum(p.points, 0),
          pointsPerGame: safeNum(p.pointsPerGame, 0),
          coeff: safeNum(p.coeff, 1),
          reliability: safeNum(p.reliability, 0),
          scoreNovaBase: safeNum(p.scoreNovaBase, 0),

          injury: p.injury || null,
        })),

        livePoints: 0,
        finalPoints: 0,
        updatedAt: nowTs,
      };

      // 1) participation Nova
      if (!partSnap.exists) {
        tx.set(partRef, base);

        // 2) ✅ augmente la cagnotte UNE SEULE FOIS (quand Nova join pour vrai)
        tx.set(
          defiRef,
          {
            pot: FieldValue.increment(potBonus),
            novaLockedAt: nowTs,
            updatedAt: nowTs,
          },
          { merge: true }
        );
      } else {
        // si on réécrit (au besoin), on n'incrémente pas la cagnotte
        tx.set(partRef, base, { merge: true });
        tx.set(defiRef, { novaLockedAt: nowTs, updatedAt: nowTs }, { merge: true });
      }
    });

    processed++;

    logger.info("[novaPickAtLock] nova picks saved", {
      defiId,
      picks: picks.map((p) => ({
        playerId: String(p.playerId),
        tier: p.tier,
        injured: isInjuredOrUnavailable(p.injury),
        scoreNovaBase: safeNum(p.scoreNovaBase, 0),
      })),
    });
  }

  if (processed) logger.info("[novaPickAtLock] processed", { processed });
});