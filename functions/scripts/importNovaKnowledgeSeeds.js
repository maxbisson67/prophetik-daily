#!/usr/bin/env node
/**
 * Import batch des fiches Nova Knowledge Base vers Firestore.
 *
 * Chemin cible: nova_knowledge/_meta/articles/{key}
 *
 * Prérequis:
 *   - firebase login (ou GOOGLE_APPLICATION_CREDENTIALS)
 *   - Projet Firebase actif: firebase use capitaine
 *
 * Usage:
 *   cd functions
 *   node scripts/importNovaKnowledgeSeeds.js
 *   node scripts/importNovaKnowledgeSeeds.js --dry-run
 *   node scripts/importNovaKnowledgeSeeds.js --file nova/knowledge/seeds/first_goal.json
 *   node scripts/importNovaKnowledgeSeeds.js --dir nova/knowledge/seeds
 *
 *   node scripts/importNovaKnowledgeSeeds.js --unpublish hits,home_runs
 *
 * Options:
 *   --dry-run       Affiche sans écrire
 *   --file <path>   Un seul JSON
 *   --dir <path>    Dossier de seeds (défaut: nova/knowledge/seeds)
 *   --force         Écrase même si version distante >= locale
 *   --unpublish <keys>  Archive des fiches (status=archived), clés séparées par des virgules
 */

import admin from "firebase-admin";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { novaArticlesCollection } from "../nova/knowledge/paths.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FUNCTIONS_ROOT = path.join(__dirname, "..");

const USER_TEXT_ACRONYMS = /\b(FGC|TP|TS)\b/;

function parseArgs(argv) {
  const args = {
    dryRun: false,
    force: false,
    file: null,
    dir: path.join(FUNCTIONS_ROOT, "nova/knowledge/seeds"),
    unpublish: [],
  };

  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--dry-run") args.dryRun = true;
    else if (a === "--force") args.force = true;
    else if (a === "--file") {
      args.file = argv[i + 1];
      i += 1;
    } else if (a === "--dir") {
      args.dir = path.resolve(FUNCTIONS_ROOT, argv[i + 1] || "");
      i += 1;
    } else if (a === "--unpublish") {
      const raw = String(argv[i + 1] || "").trim();
      args.unpublish = raw
        .split(",")
        .map((k) => k.trim().toLowerCase())
        .filter(Boolean);
      i += 1;
    }
  }

  return args;
}

function listSeedFiles({ file, dir }) {
  if (file) {
    const abs = path.isAbsolute(file) ? file : path.resolve(FUNCTIONS_ROOT, file);
    if (!fs.existsSync(abs)) throw new Error(`Fichier introuvable: ${abs}`);
    return [abs];
  }

  if (!fs.existsSync(dir)) throw new Error(`Dossier seeds introuvable: ${dir}`);

  return fs
    .readdirSync(dir)
    .filter((name) => name.endsWith(".json"))
    .map((name) => path.join(dir, name))
    .sort();
}

function readSeed(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  const data = JSON.parse(raw);
  return { filePath, data };
}

function validateSeed(data, filePath) {
  const errors = [];
  const warnings = [];

  const key = String(data?.key || "").trim();
  if (!key) errors.push("key manquant");
  if (key && key !== key.toLowerCase()) warnings.push("key devrait être en minuscules");

  if (!data?.sport) errors.push("sport manquant");
  if (!data?.type) errors.push("type manquant");
  if (!data?.status) errors.push("status manquant");

  const tr = data?.translations || {};
  if (!tr.fr) errors.push("translations.fr manquant");
  if (!tr.en) errors.push("translations.en manquant");

  for (const lang of ["fr", "en"]) {
    const block = tr[lang];
    if (!block) continue;
    if (!block.title) errors.push(`translations.${lang}.title manquant`);
    if (!block.shortAnswer) errors.push(`translations.${lang}.shortAnswer manquant`);
    if (!block.beginnerExplanation) warnings.push(`translations.${lang}.beginnerExplanation absent`);

    const blob = JSON.stringify(block);
    if (USER_TEXT_ACRONYMS.test(blob)) {
      warnings.push(
        `${lang}: acronymes FGC/TP/TS détectés dans le texte utilisateur — utiliser les noms produit`
      );
    }
  }

  return { key, errors, warnings, filePath };
}

function buildPayload(data) {
  const payload = { ...data };
  delete payload.createdAt;
  delete payload.updatedAt;
  payload.key = String(payload.key).trim().toLowerCase();
  payload.version = Number(payload.version) || 1;
  return payload;
}

async function upsertArticle(db, { key, payload, dryRun, force }) {
  const ref = novaArticlesCollection(db).doc(key);

  if (dryRun) {
    return { action: "would_upsert", key };
  }

  const snap = await ref.get();

  if (snap.exists && !force) {
    const remoteVersion = Number(snap.data()?.version) || 0;
    const localVersion = Number(payload.version) || 0;
    if (remoteVersion > localVersion) {
      return { action: "skipped", reason: "remote_version_newer", key };
    }
  }

  const writeData = {
    ...payload,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  if (!snap.exists) {
    writeData.createdAt = admin.firestore.FieldValue.serverTimestamp();
  }

  await ref.set(writeData, { merge: true });
  return { action: snap.exists ? "updated" : "created", key };
}

async function unpublishArticles(db, keys = [], { dryRun = false } = {}) {
  const results = [];
  for (const key of keys) {
    const k = String(key || "").trim().toLowerCase();
    if (!k) continue;

    if (dryRun) {
      results.push({ action: "would_unpublish", key: k });
      continue;
    }

    const ref = novaArticlesCollection(db).doc(k);
    const snap = await ref.get();
    if (!snap.exists) {
      results.push({ action: "missing", key: k });
      continue;
    }

    await ref.set(
      {
        status: "archived",
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    results.push({ action: "archived", key: k });
  }
  return results;
}

function loadProjectId() {
  try {
    const rcPath = path.join(FUNCTIONS_ROOT, "../.firebaserc");
    const rc = JSON.parse(fs.readFileSync(rcPath, "utf8"));
    return rc?.projects?.default || null;
  } catch {
    return null;
  }
}

async function main() {
  const args = parseArgs(process.argv);
  const files = listSeedFiles(args);

  if (files.length === 0) {
    console.log("Aucun fichier .json trouvé.");
    process.exit(0);
  }

  const projectId =
    process.env.GCLOUD_PROJECT ||
    process.env.GOOGLE_CLOUD_PROJECT ||
    loadProjectId() ||
    undefined;

  admin.initializeApp(projectId ? { projectId } : undefined);
  const db = admin.firestore();

  console.log(`Projet: ${admin.app().options.projectId || "(default)"}`);
  console.log(`Seeds: ${files.length} fichier(s)${args.dryRun ? " [DRY-RUN]" : ""}`);
  console.log(`Cible: nova_knowledge/_meta/articles/{key}`);
  console.log("");

  let hadError = false;
  const results = [];

  if (args.unpublish.length) {
    console.log(`Unpublish: ${args.unpublish.join(", ")}`);
    try {
      const unpublishResults = await unpublishArticles(db, args.unpublish, { dryRun: args.dryRun });
      for (const r of unpublishResults) {
        results.push(r);
        console.log(`  ✓ ${r.key}: ${r.action}`);
      }
    } catch (e) {
      hadError = true;
      console.log(`  ✗ Unpublish error: ${e?.message || e}`);
    }
    console.log("");
  }

  for (const filePath of files) {
    const { data } = readSeed(filePath);
    const { key, errors, warnings } = validateSeed(data, filePath);

    console.log(`— ${path.basename(filePath)} (key=${key || "?"})`);

    if (warnings.length) {
      for (const w of warnings) console.log(`  ⚠ ${w}`);
    }

    if (errors.length) {
      hadError = true;
      for (const e of errors) console.log(`  ✗ ${e}`);
      console.log("");
      continue;
    }

    const payload = buildPayload(data);

    try {
      const result = await upsertArticle(db, {
        key,
        payload,
        dryRun: args.dryRun,
        force: args.force,
      });
      results.push(result);
      console.log(`  ✓ ${result.action}${result.reason ? ` (${result.reason})` : ""}`);
    } catch (e) {
      hadError = true;
      console.log(`  ✗ Erreur Firestore: ${e?.message || e}`);
    }

    console.log("");
  }

  const summary = results.reduce(
    (acc, r) => {
      acc[r.action] = (acc[r.action] || 0) + 1;
      return acc;
    },
    {}
  );

  console.log("Résumé:", summary);

  if (hadError) process.exit(1);
}

main().catch((err) => {
  console.error("Import KB échoué:", err?.message || err);
  process.exit(1);
});
