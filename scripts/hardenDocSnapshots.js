#!/usr/bin/env node
/**
 * Harden Firestore doc snapshot access in mobile code (src/, app/).
 * Replaces bare snap.exists / snap.data() / snap.id with safeSnapshot helpers.
 */
const fs = require("fs");
const path = require("path");

const ROOTS = ["src", "app"];
const VARS = ["snap", "gSnap", "docSnap", "readSnap", "dSnap"];
const IMPORT_LINE =
  'import { snapshotExists, snapshotData, snapshotId } from "@src/lib/safeSnapshot";';

function walk(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.name === "node_modules") continue;
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, out);
    else if (ent.isFile() && p.endsWith(".js")) out.push(p);
  }
  return out;
}

function helperForVar(varName, helper) {
  if (varName === "snap") return helper;
  return helper.replace(/\(snap\)/g, `(${varName})`);
}

function transform(content) {
  if (file.includes(`${path.sep}safeSnapshot.js`)) return content;

  let out = content;
  let changed = false;

  for (const v of VARS) {
    const existsRe = new RegExp(`(?<!typeof )(?<!snapshotExists\\()\\b${v}\\.exists(?:\\(\\))?`, "g");
    const dataRe = new RegExp(`(?<!snapshotData\\()\\b${v}\\.data\\(\\)`, "g");
    const idRe = new RegExp(`(?<!snapshotId\\()\\b${v}\\.id\\b`, "g");

    const nextExists = out.replace(existsRe, helperForVar(v, "snapshotExists(snap)"));
    const nextData = nextExists.replace(dataRe, helperForVar(v, "snapshotData(snap)"));
    const nextId = nextData.replace(idRe, helperForVar(v, "snapshotId(snap)"));

    if (nextId !== out) {
      changed = true;
      out = nextId;
    }
  }

  if (!changed) return content;

  if (out.includes('@src/lib/safeSnapshot')) return out;

  const importRe = /^import .+;$/m;
  if (importRe.test(out)) {
    out = out.replace(importRe, (m) => `${m}\n${IMPORT_LINE}`);
  } else {
    out = `${IMPORT_LINE}\n${out}`;
  }

  return out;
}

for (const root of ROOTS) {
  const abs = path.join(process.cwd(), root);
  if (!fs.existsSync(abs)) continue;

  for (const file of walk(abs)) {
    const before = fs.readFileSync(file, "utf8");
    const after = transform(before);
    if (after !== before) {
      fs.writeFileSync(file, after);
      console.log("updated", path.relative(process.cwd(), file));
    }
  }
}
