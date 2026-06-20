// scripts/exportFirestoreSchema.js

import admin from "firebase-admin";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MAIN_COLLECTIONS = [
  "_jobs",
  "app_config",
  "catalog_avatars",
  "catalog_group_avatars",
  "catalog_jerseys",
  "credit_grants",
  "defis",
  "entitlements",
  "first_goal_challenges",
  "group_memberships",
  "groups",
  "mlb_player_stats_current",
  "mlb_schedule_daily",
  "mlb_standings",
  "nhl_first_goal_games",
  "nhl_live_games",
  "nhl_matchups_daily",
  "nhl_player_stats_current",
  "nhl_players",
  "nhl_schedule_daily",
  "nhl_standings",
  "nhl_team_daily",
  "participants",
  "profiles_public",
  "revenuecat_events",
  "team_prediction_challenges",
  "usage_weekly",
];

const MAX_DOCS_PER_COLLECTION = 3;
const MAX_DEPTH = 2;

admin.initializeApp();

const db = admin.firestore();

const OUTPUT_FILE = path.join(
  __dirname,
  "../firestore-schema-prophetik.md"
);

function getType(value) {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  if (value instanceof admin.firestore.Timestamp) return "timestamp";
  if (value instanceof admin.firestore.GeoPoint) return "geopoint";
  if (value && typeof value === "object") return "map";
  return typeof value;
}

function summarizeFields(data, prefix = "") {
  const fields = [];

  for (const [key, value] of Object.entries(data || {})) {
    const fieldPath = prefix ? `${prefix}.${key}` : key;
    const type = getType(value);

    fields.push({
      path: fieldPath,
      type,
      sample:
        type === "map"
          ? "{...}"
          : JSON.stringify(value)?.substring(0, 100),
    });

    if (type === "map") {
      fields.push(...summarizeFields(value, fieldPath));
    }
  }

  return fields;
}

async function exportCollection(collectionRef, depth = 0) {
  const indent = "#".repeat(depth + 2);
  let markdown = "";

  const collectionPath = collectionRef.path;

  markdown += `\n${indent} Collection: \`${collectionPath}\`\n\n`;

  const snapshot = await collectionRef
    .limit(MAX_DOCS_PER_COLLECTION)
    .get();

  markdown += `- Documents analysés: ${snapshot.size}\n`;
  markdown += `- Limite appliquée: ${MAX_DOCS_PER_COLLECTION}\n\n`;

  if (snapshot.empty) {
    markdown += `_Aucun document trouvé._\n\n`;
    return markdown;
  }

  const mergedFields = new Map();

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const fields = summarizeFields(data);

    for (const field of fields) {
      if (!mergedFields.has(field.path)) {
        mergedFields.set(field.path, {
          types: new Set(),
          samples: [],
        });
      }

      const entry = mergedFields.get(field.path);

      entry.types.add(field.type);

      if (
        entry.samples.length < 2 &&
        field.sample !== undefined
      ) {
        entry.samples.push(field.sample);
      }
    }
  }

  markdown += `### Champs détectés\n\n`;
  markdown += `| Champ | Type(s) | Exemple |\n`;
  markdown += `|---|---|---|\n`;

  for (const [fieldPath, info] of mergedFields.entries()) {
    markdown += `| \`${fieldPath}\` | ${Array.from(
      info.types
    ).join(", ")} | ${info.samples.join(" / ")} |\n`;
  }

  markdown += `\n### Documents exemples\n\n`;

  for (const doc of snapshot.docs) {
    markdown += `<details>\n`;
    markdown += `<summary>${doc.ref.path}</summary>\n\n`;
    markdown += "```json\n";
    markdown += JSON.stringify(doc.data(), null, 2);
    markdown += "\n```\n";
    markdown += "</details>\n\n";

    if (depth < MAX_DEPTH) {
      const subcollections =
        await doc.ref.listCollections();

      for (const subcollection of subcollections) {
        markdown += await exportCollection(
          subcollection,
          depth + 1
        );
      }
    }
  }

  return markdown;
}

async function main() {
  let markdown = "# Documentation Firestore - Prophetik\n\n";

  markdown += `Généré le: ${new Date().toISOString()}\n\n`;

  markdown +=
    "Objectif: documentation automatique du modèle Firestore DEV pour NotebookLM.\n\n";

  markdown += "## Collections analysées\n\n";

  for (const collectionName of MAIN_COLLECTIONS) {
    markdown += `- ${collectionName}\n`;
  }

  markdown += "\n---\n";

  for (const collectionName of MAIN_COLLECTIONS) {
    console.log(`Analyse ${collectionName}...`);

    const collectionRef = db.collection(collectionName);

    markdown += await exportCollection(
      collectionRef,
      0
    );
  }

  fs.writeFileSync(
    OUTPUT_FILE,
    markdown,
    "utf8"
  );

  console.log("");
  console.log("====================================");
  console.log(`Fichier généré : ${OUTPUT_FILE}`);
  console.log("====================================");
}

main().catch((error) => {
  console.error("Erreur export Firestore:", error);
  process.exit(1);
});