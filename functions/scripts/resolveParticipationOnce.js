/**
 * Corrige manuellement la participation active d'un participant (admin).
 *
 * Usage (depuis functions/) :
 *
 *   # Lister les groupes d'un participant (par uid)
 *   node scripts/resolveParticipationOnce.js --uid ABC123 --list
 *
 *   # Trouver un participant par displayName (approx.)
 *   node scripts/resolveParticipationOnce.js --find "Marcello Android"
 *
 *   # Dry-run : garder Beaudry MLB actif, rétrograder le reste
 *   node scripts/resolveParticipationOnce.js --uid ABC123 --keep-name "Beaudry MLB" --dry-run
 *
 *   # Appliquer (par nom ou id de groupe)
 *   node scripts/resolveParticipationOnce.js --uid ABC123 --keep-name "Beaudry MLB"
 *   node scripts/resolveParticipationOnce.js --uid ABC123 --keep GROUP_ID_1 --keep GROUP_ID_2
 */
import admin from "firebase-admin";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { resolveParticipation, listUserMembershipsComprehensive } from "../groups/participationUtils.js";
import {
  applyResolveActiveGroupsChanges,
  resolveActiveGroupsForUser,
} from "../groups/resolveActiveGroupsCore.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function parseArgs(argv) {
  const out = {
    dryRun: false,
    uid: null,
    find: null,
    keepIds: [],
    keepNames: [],
    list: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--dry-run") out.dryRun = true;
    if (token === "--list") out.list = true;
    if (token === "--uid" && argv[i + 1]) {
      out.uid = argv[i + 1];
      i += 1;
    }
    if (token === "--find" && argv[i + 1]) {
      out.find = argv[i + 1];
      i += 1;
    }
    if (token === "--keep" && argv[i + 1]) {
      out.keepIds.push(argv[i + 1]);
      i += 1;
    }
    if (token === "--keep-name" && argv[i + 1]) {
      out.keepNames.push(argv[i + 1]);
      i += 1;
    }
  }

  return out;
}

function resolveServiceAccountPath() {
  const candidates = [
    process.env.GOOGLE_APPLICATION_CREDENTIALS,
    path.join(__dirname, "serviceAccountKey.json"),
    path.join(__dirname, "../jerseys/capitaine-firebase-adminsdk-fbsvc-0581e0ee25.json"),
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }

  throw new Error("Service account introuvable.");
}

function normalizeName(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

async function findParticipantsByName(db, query) {
  const needle = normalizeName(query);
  const snap = await db.collection("participants").get();
  const matches = [];

  snap.forEach((doc) => {
    const d = doc.data() || {};
    const candidates = [d.displayName, d.name, d.firstName, d.prenom, d.email]
      .map(normalizeName)
      .filter(Boolean);
    if (candidates.some((c) => c.includes(needle) || needle.includes(c))) {
      matches.push({
        uid: doc.id,
        displayName: d.displayName || d.name || d.email || doc.id,
        tier: d.tier || null,
      });
    }
  });

  return matches;
}

async function loadUserGroupsOverview(db, uid) {
  const memberships = await listUserMembershipsComprehensive(db, uid);
  const ownedSnap = await db.collection("groups").where("ownerId", "==", String(uid)).get();

  const byGroupId = new Map();

  memberships.forEach((row) => {
    byGroupId.set(row.groupId, {
      groupId: row.groupId,
      membershipId: row.id,
      role: row.data.role || "member",
      participation: resolveParticipation(row.data),
      source: "membership",
    });
  });

  ownedSnap.forEach((doc) => {
    if (!byGroupId.has(doc.id)) {
      byGroupId.set(doc.id, {
        groupId: doc.id,
        membershipId: null,
        role: "owner",
        participation: "(no membership doc)",
        source: "owner_only",
      });
    }
  });

  const rows = Array.from(byGroupId.values());
  const groupSnaps = await Promise.all(
    rows.map((row) => db.doc(`groups/${row.groupId}`).get())
  );

  return rows.map((row, idx) => {
    const g = groupSnaps[idx].exists ? groupSnaps[idx].data() || {} : {};
    return {
      ...row,
      name: String(g.name || g.title || row.groupId).trim(),
      sport: String(g.sport || g.league || "NHL").toUpperCase(),
    };
  });
}

async function resolveKeepIdsByName(db, uid, keepNames) {
  const overview = await loadUserGroupsOverview(db, uid);
  const resolved = [];

  for (const rawName of keepNames) {
    const needle = normalizeName(rawName);
    const exact = overview.filter((row) => normalizeName(row.name) === needle);
    const partial = overview.filter((row) => normalizeName(row.name).includes(needle));
    const found = exact.length ? exact : partial;

    if (found.length === 0) {
      throw new Error(`Groupe introuvable pour --keep-name "${rawName}"`);
    }
    if (found.length > 1) {
      throw new Error(
        `Nom ambigu pour "${rawName}": ${found.map((f) => `${f.name} (${f.groupId})`).join(", ")}`
      );
    }

    resolved.push(found[0].groupId);
  }

  return resolved;
}

function printOverview(uid, rows) {
  console.log(`\nParticipant uid=${uid}`);
  console.log("groupId | name | sport | role | participation | source");
  rows.forEach((row) => {
    console.log(
      `${row.groupId} | ${row.name} | ${row.sport} | ${row.role} | ${row.participation} | ${row.source}`
    );
  });
  console.log("");
}

const args = parseArgs(process.argv.slice(2));
const saPath = resolveServiceAccountPath();

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(saPath) });
}

const db = admin.firestore();

async function main() {
  if (args.find && !args.uid) {
    const matches = await findParticipantsByName(db, args.find);
    if (!matches.length) {
      console.log(`Aucun participant trouvé pour "${args.find}"`);
      process.exit(1);
    }
    console.log("Participants trouvés:");
    matches.forEach((m) => {
      console.log(`- ${m.displayName} → uid=${m.uid}${m.tier ? ` (tier=${m.tier})` : ""}`);
    });
    if (matches.length === 1) {
      args.uid = matches[0].uid;
      console.log(`\nUtilisation automatique de uid=${args.uid}`);
    } else {
      console.log("\nRelance avec --uid <id> --list ou --keep-name ...");
      process.exit(0);
    }
  }

  if (!args.uid) {
    console.error("Usage: node scripts/resolveParticipationOnce.js --uid <uid> [--list | --keep-name ...]");
    process.exit(1);
  }

  const overview = await loadUserGroupsOverview(db, args.uid);

  if (args.list) {
    printOverview(args.uid, overview);
    process.exit(0);
  }

  const keepIds = [...args.keepIds];
  if (args.keepNames.length) {
    keepIds.push(...(await resolveKeepIdsByName(db, args.uid, args.keepNames)));
  }

  if (!keepIds.length) {
    printOverview(args.uid, overview);
    console.error("Indique --keep <groupId> ou --keep-name \"Nom du groupe\"");
    process.exit(1);
  }

  const plan = await resolveActiveGroupsForUser(db, args.uid, keepIds, {
    now: admin.firestore.FieldValue.serverTimestamp(),
  });

  console.log("Plan de résolution:");
  console.log({
    uid: plan.uid,
    tier: plan.tier,
    maxActive: plan.max,
    keepIds: plan.keepIds,
    participatingBefore: plan.participatingBefore,
    docsToUpdate: plan.changes.length,
  });

  plan.changes.forEach((change) => {
    console.log(
      `- ${change.groupId} (${change.role}) ${change.before ?? "∅"} → ${change.after} [${change.kind}]`
    );
  });

  const result = await applyResolveActiveGroupsChanges(db, plan.changes, {
    dryRun: args.dryRun,
  });

  console.log(args.dryRun ? "\n(dry-run, aucune écriture)" : "\n✅ Participation mise à jour.");
  console.log(result);

  const after = await loadUserGroupsOverview(db, args.uid);
  printOverview(args.uid, after);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
