/**
 * Crée ou met à jour un document dans `catalog_jerseys`.
 *
 * Usage (depuis functions/) :
 *
 *   # Nouveau style — couleur + nom (sport dans --name, absent de l'id Firestore)
 *   node scripts/createCatalogJersey.js --id blue --name blue_hockey_1
 *     → catalog_jerseys/blue_1
 *   node scripts/createCatalogJersey.js --id white --name white_baseball_1
 *     → catalog_jerseys/white_1
 *   node scripts/createCatalogJersey.js --id white --name white_baseball_b_1
 *     → catalog_jerseys/white_b_1
 *
 *   # Sport explicite si le nom ne le contient pas
 *   node scripts/createCatalogJersey.js --id blue --name custom_jersey --sport hockey
 *
 *   # Libellé affiché dans l'app (optionnel, défaut Bleu/Blanc)
 *   node scripts/createCatalogJersey.js --id white --name white_baseball_1 --label "Blanc MLB"
 *
 *   # Reproduire les docs de référence existants
 *   node scripts/createCatalogJersey.js --id blue_1
 *   node scripts/createCatalogJersey.js --id white_1
 *
 *   # JSON complet
 *   node scripts/createCatalogJersey.js --json ./scripts/examples/catalog-jersey-white_1.example.json
 *
 *   # Aperçu sans écriture
 *   node scripts/createCatalogJersey.js --id blue --name blue_hockey_1 --dry-run
 *
 * Credentials : GOOGLE_APPLICATION_CREDENTIALS ou scripts/serviceAccountKey.json
 */

import admin from "firebase-admin";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { FieldValue } = admin.firestore;

/** Modèle de référence — catalog_jerseys/blue_1 */
export const BLUE_1_REFERENCE = {
  active: true,
  sort: 1,
  sport: "hockey",
  name: "Bleu",
  previewFrontUrl:
    "https://firebasestorage.googleapis.com/v0/b/capitaine.firebasestorage.app/o/jerseys%2Fhockey%2Fblue_1_front.png?alt=media&token=0e1ff381-603f-48af-ba90-bd72902742e5",
  previewBackUrl:
    "https://firebasestorage.googleapis.com/v0/b/capitaine.firebasestorage.app/o/jerseys%2Fhockey%2Fblue_1_back.png?alt=media&token=ddf42fe6-bd12-47a2-b79f-7a80abd3c64e",
  templateFrontPath: "jerseys/hockey/blue_1_front.png",
  templateBackPath: "jerseys/hockey/blue_1_back.png",
  templateProfilePath: "jerseys/hockey/blue_1_front.png",
  colors: {
    primary: "#1e3a8a",
    accent: "#ef4444",
    text: "#ffffff",
  },
  frontZones: {
    logo: {
      x: 325,
      y: 300,
      width: 196,
      height: 196,
      variant: "light",
    },
    captainLetter: {
      x: 500,
      y: 155,
      fontSize: 58,
      color: "#ffffff",
    },
    assistantLetter: {
      x: 500,
      y: 155,
      fontSize: 58,
      color: "#ffffff",
    },
    badges: {
      x: 150,
      y: 185,
      lineHeight: 36,
      fontSize: 24,
      color: "#ffffff",
    },
  },
  textZones: {
    backName: {
      x: 325,
      y: 210,
      maxWidth: 260,
      fontSize: 46,
      color: "#ffffff",
      strokeColor: "#111111",
      strokeWidth: 4,
    },
    backNumber: {
      x: 325,
      y: 330,
      fontSize: 140,
      color: "#ffffff",
      strokeColor: "#111111",
      strokeWidth: 8,
    },
  },
};

/** Modèle de référence — catalog_jerseys/white_1 */
export const WHITE_1_REFERENCE = {
  active: true,
  sort: 2,
  sport: "hockey",
  name: "Blanc",
  previewFrontUrl:
    "https://firebasestorage.googleapis.com/v0/b/capitaine.firebasestorage.app/o/jerseys%2Fhockey%2Fwhite_1_front.png?alt=media&token=24382af3-9ed9-47a5-9092-96984e75ee8a",
  previewBackUrl:
    "https://firebasestorage.googleapis.com/v0/b/capitaine.firebasestorage.app/o/jerseys%2Fhockey%2Fwhite_1_back.png?alt=media&token=73f05b8b-c849-4663-8b01-88431daf6871",
  templateFrontPath: "jerseys/hockey/white_1_front.png",
  templateBackPath: "jerseys/hockey/white_1_back.png",
  templateProfilePath: "jerseys/hockey/white_1_front.png",
  colors: {
    primary: "#f3f4f6",
    accent: "#ef4444",
    text: "#111111",
  },
  frontZones: {
    logo: {
      x: 325,
      y: 300,
      width: 196,
      height: 196,
      variant: "dark",
    },
    captainLetter: {
      x: 500,
      y: 155,
      fontSize: 58,
      color: "#111111",
    },
    assistantLetter: {
      x: 500,
      y: 155,
      fontSize: 58,
      color: "#111111",
    },
    badges: {
      x: 150,
      y: 185,
      lineHeight: 36,
      fontSize: 24,
      color: "#111111",
    },
  },
  textZones: {
    backName: {
      x: 325,
      y: 210,
      maxWidth: 260,
      fontSize: 46,
      color: "#111111",
      strokeColor: "#ffffff",
      strokeWidth: 4,
    },
    backNumber: {
      x: 325,
      y: 330,
      fontSize: 140,
      color: "#111111",
      strokeColor: "#ffffff",
      strokeWidth: 10,
    },
  },
};

export const CATALOG_JERSEY_TEMPLATES = {
  blue: BLUE_1_REFERENCE,
  white: WHITE_1_REFERENCE,
  blue_1: BLUE_1_REFERENCE,
  white_1: WHITE_1_REFERENCE,
};

const COLOR_SHORTCUTS = new Set(["blue", "white"]);

function resolveReferenceTemplate({ templateKey }) {
  const key = String(templateKey || "blue").trim().toLowerCase();
  return CATALOG_JERSEY_TEMPLATES[key] || BLUE_1_REFERENCE;
}

const KNOWN_JERSEY_SPORTS = ["baseball", "hockey"];

function inferSportFromName(name) {
  const s = String(name || "").trim().toLowerCase();
  for (const sport of KNOWN_JERSEY_SPORTS) {
    if (s.includes(`_${sport}_`) || s.endsWith(`_${sport}`) || s.includes(`_${sport}`)) {
      return sport;
    }
  }
  return null;
}

/** Retire le segment `_hockey` / `_baseball` du nom pour l'id Firestore. */
function deriveDocIdFromName(name, sport) {
  const raw = String(name || "").trim();
  const normalizedSport = String(sport || "").trim().toLowerCase();
  if (!raw || !normalizedSport) return raw;

  const escaped = normalizedSport.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return raw.replace(new RegExp(`_${escaped}(?=_|$)`, "i"), "");
}

function defaultLabelForTemplate(templateKey) {
  return String(templateKey || "").toLowerCase() === "white" ? "Blanc" : "Bleu";
}

/**
 * --id blue|white + --name avec sport  → id Firestore sans le sport
 * --id blue_1|white_1|red_1           → id Firestore = --id
 */
function parseCreateIntent(args) {
  const rawId = String(args.id || "").trim();
  const rawName = String(args.name || "").trim();
  const rawLabel = String(args.label || "").trim();

  if (!rawId) {
    throw new Error("--id requis (blue, white, blue_1, white_1, …).");
  }

  const idLower = rawId.toLowerCase();

  if (COLOR_SHORTCUTS.has(idLower)) {
    if (!rawName) {
      throw new Error(
        "Avec --id blue|white, fournis --name avec le sport (ex. --name blue_hockey_1)."
      );
    }
    const templateKey = idLower;
    const sport = String(args.sport || inferSportFromName(rawName) || "hockey").toLowerCase();
    const docId = deriveDocIdFromName(rawName, sport);
    if (!docId) {
      throw new Error("Impossible de dériver l'id Firestore depuis --name.");
    }
    return {
      docId,
      templateKey,
      sport,
      displayName: rawLabel || defaultLabelForTemplate(templateKey),
      allowReferencePreviews: false,
    };
  }

  const sport = String(args.sport || inferSportFromName(rawId) || inferSportFromName(rawName) || "hockey").toLowerCase();
  const docId = deriveDocIdFromName(rawId, sport) || rawId;
  const templateKey = String(args.template || docId).trim().toLowerCase();
  const isReferenceRepro = Boolean(CATALOG_JERSEY_TEMPLATES[rawId.toLowerCase()] && rawId === docId);

  return {
    docId,
    templateKey: CATALOG_JERSEY_TEMPLATES[templateKey] ? templateKey : idLower.startsWith("white") ? "white" : "blue",
    sport,
    displayName: rawLabel || rawName || defaultLabelForTemplate(templateKey),
    allowReferencePreviews: isReferenceRepro,
  };
}

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) {
      out._.push(token);
      continue;
    }
    const key = token.slice(2);
    const next = argv[i + 1];
    if (next != null && !next.startsWith("--")) {
      out[key] = next;
      i += 1;
    } else {
      out[key] = true;
    }
  }
  return out;
}

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
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

  throw new Error(
    "Service account introuvable. Définis GOOGLE_APPLICATION_CREDENTIALS ou place serviceAccountKey.json dans functions/scripts/."
  );
}

function storagePath(sport, id, side) {
  return `jerseys/${sport}/${id}_${side}.png`;
}

function applyTextColorToFrontZones(frontZones, textColor) {
  const next = deepClone(frontZones);
  for (const zone of ["captainLetter", "assistantLetter", "badges"]) {
    if (next[zone]) next[zone].color = textColor;
  }
  return next;
}

export function buildCatalogJerseyDoc(options = {}) {
  const docId = String(options.docId || options.id || "").trim();
  if (!docId) throw new Error("docId requis (ex. blue_hockey_1).");

  const sport = String(options.sport || inferSportFromName(docId) || "hockey").trim().toLowerCase();
  const templateKey = String(options.templateKey || "blue").trim().toLowerCase();
  const base = deepClone(options.base || resolveReferenceTemplate({ templateKey }));
  const knownTemplate = CATALOG_JERSEY_TEMPLATES[docId] || null;
  const textColor = String(
    options.text ?? options.colors?.text ?? base.colors?.text ?? "#ffffff"
  );

  const doc = {
    ...base,
    active: options.active !== false && options.active !== "false",
    sort: Number(options.sort ?? base.sort ?? 99),
    sport,
    name: String(options.displayName ?? options.label ?? options.name ?? base.name ?? docId),
    templateFrontPath: options.templateFrontPath || storagePath(sport, docId, "front"),
    templateBackPath: options.templateBackPath || storagePath(sport, docId, "back"),
    templateProfilePath:
      options.templateProfilePath || options.templateFrontPath || storagePath(sport, docId, "front"),
    colors: {
      primary: String(options.primary ?? base.colors?.primary ?? "#1e3a8a"),
      accent: String(options.accent ?? base.colors?.accent ?? "#ef4444"),
      text: textColor,
    },
    frontZones: options.frontZones
      ? deepClone(options.frontZones)
      : options.text != null
        ? applyTextColorToFrontZones(base.frontZones, textColor)
        : deepClone(base.frontZones),
    textZones: options.textZones ? deepClone(options.textZones) : deepClone(base.textZones),
  };

  if (options.logoVariant) {
    doc.frontZones.logo = { ...doc.frontZones.logo, variant: String(options.logoVariant) };
  }

  if (options.previewFrontUrl !== undefined) {
    doc.previewFrontUrl = options.previewFrontUrl || null;
  } else if (options.noPreview) {
    doc.previewFrontUrl = null;
  } else if (options.allowReferencePreviews && knownTemplate && options.base === knownTemplate) {
    doc.previewFrontUrl = knownTemplate.previewFrontUrl;
  } else {
    doc.previewFrontUrl = null;
  }

  if (options.previewBackUrl !== undefined) {
    doc.previewBackUrl = options.previewBackUrl || null;
  } else if (options.noPreview) {
    doc.previewBackUrl = null;
  } else if (options.allowReferencePreviews && knownTemplate && options.base === knownTemplate) {
    doc.previewBackUrl = knownTemplate.previewBackUrl;
  } else {
    doc.previewBackUrl = null;
  }

  return doc;
}

async function loadBaseFromFirestore(db, fromId) {
  const snap = await db.collection("catalog_jerseys").doc(fromId).get();
  if (!snap.exists) {
    throw new Error(`Document source introuvable: catalog_jerseys/${fromId}`);
  }
  return snap.data() || {};
}

function loadJsonFile(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  return JSON.parse(raw);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help || args.h) {
    console.log(fs.readFileSync(__filename, "utf8").split("\n").slice(0, 25).join("\n"));
    process.exit(0);
  }

  const serviceAccountPath = resolveServiceAccountPath();
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccountPath),
    });
  }

  const db = admin.firestore();

  let docId = String(args.id || "").trim();
  let doc;

  if (args.json) {
    const jsonPath = path.resolve(process.cwd(), args.json);
    const json = loadJsonFile(jsonPath);
    docId = docId || String(json._id || json.id || "").trim();
    if (!docId) {
      console.error("Erreur: _id ou --id requis dans le JSON.");
      process.exit(1);
    }
    doc = { ...json };
    delete doc._id;
    delete doc.id;
    delete doc.createdAt;
    delete doc.updatedAt;
  } else {
    const intent = parseCreateIntent(args);

    let base = resolveReferenceTemplate({ templateKey: intent.templateKey });
    if (args.from) {
      base = await loadBaseFromFirestore(db, String(args.from).trim());
    }

    doc = buildCatalogJerseyDoc({
      docId: intent.docId,
      templateKey: intent.templateKey,
      base,
      displayName: intent.displayName,
      allowReferencePreviews: intent.allowReferencePreviews,
      sort: args.sort,
      sport: intent.sport,
      active: args.active,
      primary: args.primary,
      accent: args.accent,
      text: args.text,
      logoVariant: args.logoVariant,
      previewFrontUrl: args.previewFrontUrl,
      previewBackUrl: args.previewBackUrl,
      noPreview: args["no-preview"] === true || args["no-preview"] === "true",
      templateFrontPath: args.templateFrontPath,
      templateBackPath: args.templateBackPath,
      templateProfilePath: args.templateProfilePath,
    });

    const fromId = String(args.from || "").trim();
    if (fromId && fromId !== intent.docId && !args.previewFrontUrl && !args.previewBackUrl) {
      doc.previewFrontUrl = null;
      doc.previewBackUrl = null;
    }

    docId = intent.docId;
  }

  doc.createdAt = FieldValue.serverTimestamp();
  doc.updatedAt = FieldValue.serverTimestamp();

  const ref = db.collection("catalog_jerseys").doc(docId);

  if (args["dry-run"]) {
    console.log(JSON.stringify({ id: docId, ...doc, createdAt: "<serverTimestamp>", updatedAt: "<serverTimestamp>" }, null, 2));
    return;
  }

  const merge = args.merge === true || args.merge === "true";
  await ref.set(doc, merge ? { merge: true } : undefined);

  console.log(`✅ catalog_jerseys/${docId} ${merge ? "mis à jour (merge)" : "créé"}.`);
  console.log(JSON.stringify(doc, null, 2));
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === __filename;

if (isDirectRun) {
  main().catch((err) => {
    console.error("Erreur createCatalogJersey:", err?.message || err);
    process.exit(1);
  });
}
