// functions/index.js
import { setTimeout as delay } from "node:timers/promises";
// --- Admin SDK (v13+) ---
import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

// --- Firebase Functions v2 ---
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { logger } from "firebase-functions";

// Init Admin (éviter double init en emu)
if (getApps().length === 0) {
  initializeApp();
}
const db = getFirestore();

/**
 * Déclenché à la création de participants/{uid}
 * - Initialise les crédits si absents
 * - Positionne betaEligible à true si absent
 */
export const onParticipantCreate = onDocumentCreated(
  "participants/{uid}",
  async (event) => {
    const snap = event.data;
    if (!snap) return;
    const data = snap.data() || {};

    const updates = {};

    // normaliser le champ "credits"
    const hasFlatCredits = typeof data.credits === "number";
    const hasObjCredits = typeof data.credits?.balance === "number";

    if (!hasFlatCredits && !hasObjCredits) {
      updates.credits = { balance: 25, updatedAt: FieldValue.serverTimestamp() };
    }

    if (data.betaEligible === undefined) {
      updates.betaEligible = true;
    }

    if (Object.keys(updates).length > 0) {
      await snap.ref.set(updates, { merge: true });
    }
  }
);

/**
 * Callable: freeTopUp
 * Ajoute +25 crédits si l’utilisateur est éligible et n’a pas >25 crédits
 */
export const freeTopUp = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError("unauthenticated", "Tu dois être connecté.");
  }

  const pRef = db.collection("participants").doc(uid);
  const pSnap = await pRef.get();
  if (!pSnap.exists) {
    throw new HttpsError("not-found", "Participant inexistant.");
  }

  const p = pSnap.data() || {};
  if (p.betaEligible !== true) {
    throw new HttpsError("permission-denied", "Tu n’es pas éligible pour le bonus gratuit.");
  }

  // lire le solde quel que soit le modèle actuel
  let balance =
    typeof p.credits === "number"
      ? p.credits
      : typeof p.credits?.balance === "number"
      ? p.credits.balance
      : typeof p.balance === "number"
      ? p.balance
      : 0;

  if (balance > 25) {
    throw new HttpsError(
      "failed-precondition",
      "Top-up refusé : ton solde est déjà supérieur à 25 crédits."
    );
  }

  const newBalance = balance + 25;

  await pRef.set(
    {
      credits: { balance: newBalance, updatedAt: FieldValue.serverTimestamp() },
      lastFreeTopUpAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  return { ok: true, newBalance };
});

/**
 * Callable: joinGroupByCode
 * data: { code: string }  // 8 caractères alphanum, O exclus
 * return: { groupId }
 */
export const joinGroupByCode = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Connexion requise.");

  const raw = request.data?.code;
  const code = String(raw || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .replace(/O/g, ""); // retirer 'O' si tu l’exclus de ta génération
  if (code.length !== 8) {
    throw new HttpsError("invalid-argument", "Code invalide.");
  }

  // chercher le groupe
  const gSnap = await db
    .collection("groups")
    .where("codeInvitation", "==", code)
    .limit(1)
    .get();

  if (gSnap.empty) {
    throw new HttpsError("not-found", "Aucun groupe trouvé avec ce code.");
  }

  const groupDoc = gSnap.docs[0];
  const groupId = groupDoc.id;

  const membershipId = `${groupId}_${uid}`;
  const mRef = db.collection("group_memberships").doc(membershipId);

  await db.runTransaction(async (tx) => {
    const mSnap = await tx.get(mRef);
    if (mSnap.exists) return; // déjà membre

    tx.set(mRef, {
      groupId,
      uid,
      role: "member",
      active: true,
      status: "active",
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  });

  return { groupId };
});



const UA_HEADERS = {
  "User-Agent": "prophetik-daily/1.0 (contact: marcelbissoncrypto@gmail.com)",
  "Accept": "application/json",
};

async function safeFetchJson(
  url,
  { method = "GET", headers = {}, timeoutMs = 10000, retries = 3 } = {}
) {
  let lastErr;
  for (let attempt = 1; attempt <= retries; attempt++) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        method,
        headers: { ...UA_HEADERS, ...headers },
        signal: ctrl.signal,
      });
      const text = await res.text();
      clearTimeout(t);

      if (!res.ok) {
        logger.error("HTTP not OK", {
          url,
          status: res.status,
          statusText: res.statusText,
          bodySample: text.slice(0, 300),
        });
        throw new Error(`HTTP ${res.status}`);
      }

      try {
        return JSON.parse(text);
      } catch {
        logger.error("JSON parse error", { url, bodySample: text.slice(0, 300) });
        throw new Error("Invalid JSON");
      }
    } catch (e) {
      clearTimeout(t);
      lastErr = e;
      logger.warn("fetch attempt failed", {
        url,
        attempt,
        retries,
        error: e?.message || String(e),
        name: e?.name,
      });
      if (attempt < retries) await delay(400 * attempt);
    }
  }
  logger.error("fetch failed (final)", { error: lastErr?.message || String(lastErr) });
  throw lastErr || new Error("fetch failed");
}

// --- normalisation champs nom api-web (parfois { firstName: { default: "..." } }) ---
function pickNamePart(v) {
  if (!v) return "";
  if (typeof v === "string") return v;
  if (typeof v?.default === "string") return v.default;
  return "";
}
function buildFullName(p) {
  // variantes possibles selon endpoints
  const a = pickNamePart(p?.firstName.default) || p?.firstName || "";
  const b = pickNamePart(p?.lastName.default)  || p?.lastName  || "";
  const combo = `${a} ${b}`.trim();
  return combo || p?.name || p?.playerName || `#${p?.playerId ?? ""}`.trim();
}


/**
 * Programme: 07:05 America/Toronto (exemple). Adapte si besoin.
 * Récupère les équipes via standings/now, puis les rosters via roster/{ABBR}/current
 */
export const nightlyNhlPlayers = onSchedule(
  { schedule: "5 7 * * *", timeZone: "America/Toronto", region: "us-central1" },
  async () => {
    try {
      // 1) Équipes via stats REST (stable, all year)
        const TEAMS_URL = "https://api.nhle.com/stats/rest/fr/team"; // ou /en/team
        const teamsJson = await safeFetchJson(TEAMS_URL);

        const teams = [];
        for (const t of (teamsJson?.data || [])) {
        const teamId =
            t?.id;

        const abbr =
            t?.triCode;

        const name =
            t?.fullName;

        if (teamId && abbr) {
            teams.push({ id: teamId, abbr, name });
        }
        }

        if (!teams.length) {
        throw new Error("No teams from stats/rest team");
        }

        logger.info(`Teams loaded from stats/rest: ${teams.length}`);

      // 2) Pour chaque équipe: roster/{ABBR}/current
      const writer = db.bulkWriter();
      let written = 0, teamCount = 0;

      for (const team of teams) {
        teamCount++;
        
        let roster;
        try {
          roster = await safeFetchJson(`https://api-web.nhle.com/v1/roster/${encodeURIComponent(team.abbr)}/current`);
        } catch (e) {
          logger.warn(`roster fetch failed for ${team.abbr}: ${e?.message || e}`);
          continue;
        }

        // format typique : { forwards:[...], defensemen:[...], goalies:[...] }
        const allPlayers = [
          ...(roster?.forwards || []),
          ...(roster?.defensemen || []),
          ...(roster?.goalies || []),
          ...(Array.isArray(roster?.skaters) ? roster.skaters : []), // selon l'API, parfois présent
        ];

        if (!allPlayers.length) {
          logger.warn(`Empty roster for ${team.abbr}`);
          continue;
        }

        for (const p of allPlayers) {
          const playerId = p?.playerId ?? p?.id ?? null;
          const position = p?.positionCode ?? p?.position?.abbreviation ?? null;
          if (!playerId) continue;
          if (String(position).toUpperCase() === "G") continue; // exclut gardiens

          const fullName = buildFullName(p);
          const ref = db.collection("nhl_players").doc(String(playerId));
          writer.set(ref, {
            playerId,
            fullName,
            position,
            teamAbbr: team.abbr,
            teamName: team.name,
            search: String(fullName || "").toLowerCase(),
            updatedAt: FieldValue.serverTimestamp(),
          }, { merge: true });

          written++;
        }
      }

      await writer.close();
      logger.info(`✅ nightlyNhlPlayers done. teams=${teamCount} players_written=${written}`);
    } catch (e) {
      logger.error("nightlyNhlPlayers failed:", e?.message || e);
      throw e;
    }
  }
);