/**
 * Réinitialise un compte testeur (Auth SMS, email link ou email/password + Firestore)
 * pour retester l'inscription.
 *
 * Prérequis : compte créé seulement (pas de participations à des défis).
 *
 * Usage:
 *   cd functions
 *   node scripts/resetTestParticipant.js --phone=5145551234
 *   node scripts/resetTestParticipant.js --email=testeur@example.com
 *   node scripts/resetTestParticipant.js --email=testeur@example.com --dry-run
 *   node scripts/resetTestParticipant.js --uid=abc123 --execute
 *   node scripts/resetTestParticipant.js --email=test@example.com --execute --include-groups
 *
 * Credentials : GOOGLE_APPLICATION_CREDENTIALS, scripts/serviceAccountKey.json,
 *   ou ../capitaine-firebase-adminsdk-*.json à la racine du projet.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_COUNTRY = "+1";
const E164 = /^\+\d{8,15}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeEmail(input) {
  return String(input || "").trim().toLowerCase();
}

function readArg(name) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split("=").slice(1).join("=") : null;
}

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

function normalizePhone(input) {
  if (!input) return "";
  const raw = String(input).trim();
  if (raw.startsWith("+")) {
    return raw.replace(/[^\d+]/g, "").replace(/\+(?=\+)/g, "");
  }
  const digitsOnly = raw.replace(/\D+/g, "");
  if (digitsOnly.length === 10) return `${DEFAULT_COUNTRY}${digitsOnly}`;
  if (digitsOnly.length > 0) return `+${digitsOnly}`;
  return "";
}

function resolveServiceAccountPath() {
  const candidates = [
    process.env.GOOGLE_APPLICATION_CREDENTIALS,
    path.join(__dirname, "serviceAccountKey.json"),
    path.join(__dirname, "../../capitaine-firebase-adminsdk-fbsvc-a0066fa0df.json"),
    path.join(__dirname, "../jerseys/capitaine-firebase-adminsdk-fbsvc-0581e0ee25.json"),
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (candidate && fs.existsSync(candidate)) return candidate;
  }
  return null;
}

function initAdmin() {
  if (getApps().length) return;

  const saPath = resolveServiceAccountPath();
  if (saPath) {
    initializeApp({
      credential: cert(JSON.parse(fs.readFileSync(saPath, "utf8"))),
    });
    return;
  }

  initializeApp();
}

async function deleteQueryDocs(query, { dryRun, label }) {
  const snap = await query.get();
  if (snap.empty) return [];

  const ids = snap.docs.map((d) => d.ref.path);
  if (!dryRun) {
    const batch = getFirestore().batch();
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }

  return ids.map((p) => ({ path: p, label }));
}

async function deleteSubcollections(docRef, { dryRun }) {
  const deleted = [];
  const subcols = await docRef.listCollections();

  for (const sub of subcols) {
    let snap = await sub.limit(200).get();
    while (!snap.empty) {
      if (!dryRun) {
        const batch = getFirestore().batch();
        snap.docs.forEach((d) => batch.delete(d.ref));
        await batch.commit();
      }
      deleted.push(...snap.docs.map((d) => d.ref.path));
      snap = await sub.limit(200).get();
    }
  }

  return deleted;
}

async function findAuthUser({ uid, phoneE164, email }) {
  const auth = getAuth();

  if (uid) {
    try {
      const user = await auth.getUser(uid);
      return user;
    } catch (e) {
      if (e?.code !== "auth/user-not-found") throw e;
    }
  }

  if (email) {
    try {
      const user = await auth.getUserByEmail(email);
      return user;
    } catch (e) {
      if (e?.code !== "auth/user-not-found") throw e;
    }
  }

  if (phoneE164) {
    try {
      const user = await auth.getUserByPhoneNumber(phoneE164);
      return user;
    } catch (e) {
      if (e?.code !== "auth/user-not-found") throw e;
    }
  }

  return null;
}

async function findParticipantByEmail(email) {
  const db = getFirestore();
  const normalized = normalizeEmail(email);
  if (!normalized) return null;

  const snap = await db.collection("participants").where("email", "==", normalized).limit(5).get();
  if (!snap.empty) return snap.docs[0];

  return null;
}

async function findParticipantByPhone(phoneE164) {
  const db = getFirestore();
  const variants = Array.from(
    new Set([phoneE164, phoneE164.replace(/^\+1/, ""), phoneE164.replace(/\D/g, "")].filter(Boolean))
  );

  for (const value of variants) {
    const snap = await db.collection("participants").where("phoneNumber", "==", value).limit(5).get();
    if (!snap.empty) return snap.docs[0];
  }

  return null;
}

async function collectSafetyIssues(uid) {
  const db = getFirestore();
  const issues = [];

  const [participationsSnap, entriesSnap, membershipsSnap, ownedGroupsSnap] = await Promise.all([
    db.collectionGroup("participations").get(),
    db.collectionGroup("entries").get(),
    db.collection("group_memberships").where("uid", "==", uid).get(),
    db.collection("groups").where("ownerId", "==", uid).get(),
  ]);

  const participations = participationsSnap.docs.filter((d) => d.id === uid);
  if (participations.length) {
    issues.push({
      type: "defi-participations",
      count: participations.length,
      samples: participations.slice(0, 5).map((d) => d.ref.path),
    });
  }

  const entries = entriesSnap.docs.filter((d) => d.id === uid);
  if (entries.length) {
    issues.push({
      type: "challenge-entries",
      count: entries.length,
      samples: entries.slice(0, 5).map((d) => d.ref.path),
    });
  }

  if (!membershipsSnap.empty) {
    issues.push({
      type: "group-memberships",
      count: membershipsSnap.size,
      samples: membershipsSnap.docs.map((d) => d.ref.path),
    });
  }

  if (!ownedGroupsSnap.empty) {
    issues.push({
      type: "owned-groups",
      count: ownedGroupsSnap.size,
      samples: ownedGroupsSnap.docs.map((d) => d.id),
    });
  }

  return issues;
}

async function collectCreditGrants(uid) {
  const db = getFirestore();
  const snap = await db.collection("credit_grants").where("uid", "==", uid).get();
  return snap.docs.map((d) => d.ref.path);
}

async function resetParticipant({
  uid,
  dryRun,
  includeGroups,
  force,
}) {
  const db = getFirestore();
  const auth = getAuth();
  const plan = {
    uid,
    dryRun,
    firestoreDeletes: [],
    authDelete: null,
    safetyIssues: [],
    skipped: [],
  };

  const issues = await collectSafetyIssues(uid);
  plan.safetyIssues = issues;

  const blocking = issues.filter((i) => {
    if (i.type === "group-memberships" || i.type === "owned-groups") {
      return !includeGroups;
    }
    return true;
  });

  if (blocking.length && !force) {
    plan.blocked = true;
    plan.blockReason =
      "Participations ou données liées détectées. Utilisez --include-groups pour les adhésions groupe, ou --force pour ignorer (dangereux).";
    return plan;
  }

  const participantRef = db.doc(`participants/${uid}`);
  const participantSnap = await participantRef.get();

  if (participantSnap.exists) {
    const subPaths = await deleteSubcollections(participantRef, { dryRun });
    plan.firestoreDeletes.push(...subPaths.map((p) => ({ path: p, kind: "participants-subcollection" })));
    plan.firestoreDeletes.push({ path: participantRef.path, kind: "participants" });
    if (!dryRun) await participantRef.delete();
  } else {
    plan.skipped.push("participants/{uid} absent");
  }

  for (const docPath of [`profiles_public/${uid}`, `entitlements/${uid}`]) {
    const ref = db.doc(docPath);
    const snap = await ref.get();
    if (snap.exists) {
      plan.firestoreDeletes.push({ path: ref.path, kind: "top-level" });
      if (!dryRun) await ref.delete();
    }
  }

  const grantPaths = await collectCreditGrants(uid);
  for (const grantPath of grantPaths) {
    plan.firestoreDeletes.push({ path: grantPath, kind: "credit_grant" });
    if (!dryRun) await db.doc(grantPath).delete();
  }

  const signupGrantRef = db.doc(`credit_grants/signup_${uid}`);
  const signupGrantSnap = await signupGrantRef.get();
  if (signupGrantSnap.exists) {
    plan.firestoreDeletes.push({ path: signupGrantRef.path, kind: "credit_grant" });
    if (!dryRun) await signupGrantRef.delete();
  }

  if (includeGroups || force) {
    const membershipDeletes = await deleteQueryDocs(
      db.collection("group_memberships").where("uid", "==", uid),
      { dryRun, label: "group_memberships" }
    );
    plan.firestoreDeletes.push(...membershipDeletes.map((d) => ({ ...d, kind: "group_membership" })));

    if (force || includeGroups) {
      const owned = await db.collection("groups").where("ownerId", "==", uid).get();
      for (const groupDoc of owned.docs) {
        const membersSnap = await db
          .collection("group_memberships")
          .where("groupId", "==", groupDoc.id)
          .where("active", "==", true)
          .get();

        const otherMembers = membersSnap.docs.filter((d) => {
          const data = d.data() || {};
          return String(data.uid || "") !== uid;
        });

        if (otherMembers.length && !force) {
          plan.skipped.push(`group ${groupDoc.id} conservé (${otherMembers.length} autre(s) membre(s))`);
          continue;
        }

        plan.firestoreDeletes.push({ path: groupDoc.ref.path, kind: "owned-group" });
        if (!dryRun) await groupDoc.ref.delete();
      }
    }
  }

  try {
    const userRecord = await auth.getUser(uid);
    plan.authDelete = {
      uid,
      email: userRecord.email || null,
      phoneNumber: userRecord.phoneNumber || null,
      providers: (userRecord.providerData || []).map((p) => p.providerId).filter(Boolean),
    };
    if (!dryRun) await auth.deleteUser(uid);
  } catch (e) {
    if (e?.code === "auth/user-not-found") {
      plan.skipped.push("Firebase Auth user absent");
    } else {
      throw e;
    }
  }

  return plan;
}

async function main() {
  initAdmin();

  const phoneArg = readArg("phone");
  const emailArg = readArg("email");
  const uidArg = readArg("uid");
  const dryRun = !hasFlag("execute");
  const includeGroups = hasFlag("include-groups");
  const force = hasFlag("force");

  const phoneE164 = phoneArg ? normalizePhone(phoneArg) : "";
  const email = emailArg ? normalizeEmail(emailArg) : "";

  if (phoneArg && !E164.test(phoneE164)) {
    console.error(JSON.stringify({ ok: false, error: "invalid-phone", phone: phoneArg }, null, 2));
    process.exit(1);
  }

  if (emailArg && !EMAIL.test(email)) {
    console.error(JSON.stringify({ ok: false, error: "invalid-email", email: emailArg }, null, 2));
    process.exit(1);
  }

  if (!uidArg && !phoneE164 && !email) {
    console.error(
      JSON.stringify(
        {
          ok: false,
          error: "missing-target",
          hint: "Provide --phone=5145551234, --email=test@example.com, or --uid=FIREBASE_UID. Add --execute to apply.",
        },
        null,
        2
      )
    );
    process.exit(1);
  }

  let uid = uidArg ? String(uidArg).trim() : null;
  let authUser = await findAuthUser({ uid, phoneE164, email });

  if (!uid && authUser?.uid) uid = authUser.uid;

  if (!uid && phoneE164) {
    const participantDoc = await findParticipantByPhone(phoneE164);
    if (participantDoc) uid = participantDoc.id;
  }

  if (!uid && email) {
    const participantDoc = await findParticipantByEmail(email);
    if (participantDoc) uid = participantDoc.id;
  }

  if (!uid) {
    console.log(
      JSON.stringify(
        {
          ok: true,
          dryRun,
          nothingToDo: true,
          message: "Aucun compte Auth ou participant trouvé pour ce numéro, courriel ou uid.",
          phone: phoneE164 || null,
          email: email || null,
        },
        null,
        2
      )
    );
    return;
  }

  if (!authUser) {
    authUser = await findAuthUser({ uid, phoneE164: null, email: null });
  }

  const participantSnap = await getFirestore().doc(`participants/${uid}`).get();
  const participant = participantSnap.exists ? participantSnap.data() : null;

  const plan = await resetParticipant({
    uid,
    dryRun,
    includeGroups,
    force,
  });

  console.log(
    JSON.stringify(
      {
        ok: !plan.blocked,
        dryRun,
        execute: !dryRun,
        target: {
          uid,
          email: authUser?.email || participant?.email || email || null,
          phone: authUser?.phoneNumber || participant?.phoneNumber || phoneE164 || null,
          displayName: participant?.displayName || authUser?.displayName || null,
          authProviders: (authUser?.providerData || []).map((p) => p.providerId).filter(Boolean),
        },
        blocked: plan.blocked || false,
        blockReason: plan.blockReason || null,
        safetyIssues: plan.safetyIssues,
        skipped: plan.skipped,
        authDelete: plan.authDelete,
        firestoreDeleteCount: plan.firestoreDeletes?.length || 0,
        firestoreDeletes: plan.firestoreDeletes,
        nextStep: plan.blocked
          ? "Corrigez les blocages ou relancez avec --include-groups / --force."
            : dryRun
              ? "Relancez avec --execute pour appliquer la suppression."
              : email
                ? "Compte réinitialisé. Vous pouvez vous réinscrire avec le même courriel."
                : "Compte réinitialisé. Vous pouvez vous réinscrire avec le même numéro.",
      },
      null,
      2
    )
  );

  if (plan.blocked) process.exit(2);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
