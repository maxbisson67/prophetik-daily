// scripts/exportFirestoreDocument.js

import admin from "firebase-admin";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const [, , arg1, arg2] = process.argv;

admin.initializeApp({
  credential: admin.credential.cert("./scripts/serviceAccountKey.json"),
});

const db = admin.firestore();

function getType(value) {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  if (value instanceof admin.firestore.Timestamp) return "timestamp";
  if (value instanceof admin.firestore.GeoPoint) return "geopoint";
  if (value && typeof value === "object") return "map";
  return typeof value;
}

function serializeForMarkdown(value) {
  if (value instanceof admin.firestore.Timestamp) {
    return value.toDate().toISOString();
  }

  if (Array.isArray(value)) {
    return value.map(serializeForMarkdown);
  }

  if (value && typeof value === "object") {
    const result = {};
    for (const [key, nestedValue] of Object.entries(value)) {
      result[key] = serializeForMarkdown(nestedValue);
    }
    return result;
  }

  return value;
}

function summarizeFields(data, prefix = "") {
  const fields = [];

  for (const [key, value] of Object.entries(data || {})) {
    const fieldPath = prefix ? `${prefix}.${key}` : key;
    const type = getType(value);

    fields.push({
      path: fieldPath,
      type,
    });

    if (type === "map") {
      fields.push(...summarizeFields(value, fieldPath));
    }
  }

  return fields;
}

function safeFilename(input) {
  return input.replace(/[\/\\:*?"<>|]/g, "_");
}

function getCollectionAndDocumentId(docPath) {
  const parts = docPath.split("/");
  return {
    collection: parts[parts.length - 2] || "",
    documentId: parts[parts.length - 1] || "",
  };
}

async function main() {
  let docPath;

  if (arg1 && arg2) {
    docPath = `${arg1}/${arg2}`;
  } else if (arg1) {
    docPath = arg1;
  } else {
    console.error("Usage:");
    console.error("node scripts/exportFirestoreDocument.js groups GROUP_ID");
    console.error("node scripts/exportFirestoreDocument.js groups/GROUP_ID");
    process.exit(1);
  }

  const { collection, documentId } = getCollectionAndDocumentId(docPath);

  const docRef = db.doc(docPath);
  const docSnap = await docRef.get();

  let markdown = `# Firestore Document - Prophetik\n\n`;
  markdown += `Document: \`${docPath}\`\n`;
  markdown += `Collection: \`${collection}\`\n`;
  markdown += `DocumentId: \`${documentId}\`\n`;
  markdown += `Généré le: ${new Date().toISOString()}\n\n`;

  if (!docSnap.exists) {
    markdown += `⚠️ Document introuvable.\n`;

    const outputFile = path.join(
      __dirname,
      `../firestore-doc-${safeFilename(docPath)}.md`
    );

    fs.writeFileSync(outputFile, markdown, "utf8");
    console.log(`Document introuvable. Fichier généré: ${outputFile}`);
    return;
  }

  const data = docSnap.data();
  const fields = summarizeFields(data);
  const serializedData = serializeForMarkdown(data);

  markdown += `## Champs détectés\n\n`;
  markdown += `| Champ | Type |\n`;
  markdown += `|---|---|\n`;

  for (const field of fields) {
    markdown += `| \`${field.path}\` | ${field.type} |\n`;
  }

  markdown += `\n## Données complètes\n\n`;
  markdown += "```json\n";
  markdown += JSON.stringify(serializedData, null, 2);
  markdown += "\n```\n";

  const subcollections = await docRef.listCollections();

  markdown += `\n## Sous-collections\n\n`;

  if (subcollections.length === 0) {
    markdown += `_Aucune sous-collection détectée._\n`;
  } else {
    for (const subcollection of subcollections) {
      const snapshot = await subcollection.limit(1).get();

      markdown += `- \`${subcollection.path}\``;
      markdown += ` — au moins ${snapshot.size} document`;
      markdown += snapshot.size > 1 ? "s\n" : "\n";
    }
  }

  const outputFile = path.join(
    __dirname,
    `../firestore-doc-${safeFilename(docPath)}.md`
  );

  fs.writeFileSync(outputFile, markdown, "utf8");

  console.log("");
  console.log("====================================");
  console.log(`Fichier généré: ${outputFile}`);
  console.log("====================================");
}

main().catch((error) => {
  console.error("Erreur export Firestore document:", error);
  process.exit(1);
});