/**
 * Parité internal/live_index vs legacy (FGC / TP / TS) pour un ou plusieurs groupes.
 *
 *   cd functions
 *   node scripts/compareLiveIndexParity.js \
 *     --ymd 2026-11-05 \
 *     --groupIds ovkcdDpAAKRwWSQQFUh7,LcfHpQemisD0JXy5scuo
 */
import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

if (!getApps().length) initializeApp();
const db = getFirestore();

function parseArgs(argv) {
  const out = { ymds: [], groupIds: [] };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--ymd" && argv[i + 1]) {
      out.ymds.push(String(argv[++i]).slice(0, 10));
    } else if ((a === "--groupIds" || a === "--groupId") && argv[i + 1]) {
      const raw = String(argv[++i]);
      raw.split(",").forEach((id) => {
        const g = id.trim();
        if (g) out.groupIds.push(g);
      });
    }
  }
  return out;
}

function ymdFromDefi(data = {}) {
  const v =
    data.gameDate ||
    data.gameYmd ||
    data.poolGameDate ||
    data.dateYmd ||
    data.ymd ||
    "";
  const s = String(v).slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const compact = String(v).replace(/\D/g, "").slice(0, 8);
  if (compact.length === 8) {
    return `${compact.slice(0, 4)}-${compact.slice(4, 6)}-${compact.slice(6, 8)}`;
  }
  return "";
}

function isTsDefi(data = {}) {
  const t = Number(data.type);
  return Number.isFinite(t) && t >= 3;
}

async function fetchIndexByGroup(ymd, groupIds) {
  const snap = await db.collection(`internal/live_index/days/${ymd}/entries`).get();
  const byGroup = Object.fromEntries(groupIds.map((g) => [g, { fgc: [], tp: [], ts: [] }]));

  snap.forEach((doc) => {
    const d = doc.data() || {};
    const gid = String(d.groupId || "").trim();
    if (!byGroup[gid]) return;
    const kind = String(d.kind || "").toLowerCase();
    const docId = String(d.docId || "").trim();
    const row = { entryId: doc.id, docId, status: d.status || null, sport: d.sport || null };
    if (kind === "fgc") byGroup[gid].fgc.push(row);
    else if (kind === "tp") byGroup[gid].tp.push(row);
    else if (kind === "ts") byGroup[gid].ts.push(row);
  });

  return byGroup;
}

async function fetchLegacyFgc(groupId, ymd) {
  const snap = await db
    .collection("first_goal_challenges")
    .where("groupId", "==", groupId)
    .where("gameYmd", "==", ymd)
    .get();
  return snap.docs.map((doc) => ({
    id: doc.id,
    league: doc.data()?.league || null,
    type: doc.data()?.type || null,
  }));
}

async function fetchLegacyTp(groupId, ymd) {
  const snap = await db.collection("team_prediction_bundles").where("groupId", "==", groupId).get();
  const ymdCompact = ymd.replace(/-/g, "");
  return snap.docs
    .map((doc) => ({ id: doc.id, data: doc.data() || {} }))
    .filter(({ data }) => {
      const gy = String(data.gameYmd || data.gameYMD || "").slice(0, 10);
      const gc = String(data.gameYmd || data.gameYMD || "").replace(/\D/g, "").slice(0, 8);
      return gy === ymd || gc === ymdCompact;
    })
    .map(({ id, data }) => ({ id, league: data.league || null, gameYmd: data.gameYmd || null }));
}

async function fetchLegacyTs(groupId, ymd) {
  const snap = await db.collection("defis").where("groupId", "==", groupId).get();
  return snap.docs
    .map((doc) => ({ id: doc.id, data: doc.data() || {} }))
    .filter(({ data }) => isTsDefi(data) && ymdFromDefi(data) === ymd)
    .map(({ id, data }) => ({ id, type: data.type, gameDate: ymdFromDefi(data) }));
}

function compareKind(kind, legacyIds, indexRows) {
  const legacySet = new Set(legacyIds.map(String));
  const indexSet = new Set(indexRows.map((r) => String(r.docId)));
  const missingInIndex = [...legacySet].filter((id) => !indexSet.has(id));
  const extraInIndex = [...indexSet].filter((id) => !legacySet.has(id));
  return {
    legacyCount: legacySet.size,
    indexCount: indexSet.size,
    ok: missingInIndex.length === 0 && extraInIndex.length === 0,
    missingInIndex,
    extraInIndex,
    indexRows,
    legacyIds: [...legacySet],
  };
}

async function main() {
  const { ymds, groupIds } = parseArgs(process.argv);
  if (!ymds.length || !groupIds.length) {
    console.error(
      "Usage: node scripts/compareLiveIndexParity.js --ymd 2026-11-05 --groupIds id1,id2"
    );
    process.exit(1);
  }

  for (const ymd of ymds) {
    console.log(`\n========== ${ymd} ==========\n`);
    const indexByGroup = await fetchIndexByGroup(ymd, groupIds);

    for (const groupId of groupIds) {
      const [fgcL, tpL, tsL] = await Promise.all([
        fetchLegacyFgc(groupId, ymd),
        fetchLegacyTp(groupId, ymd),
        fetchLegacyTs(groupId, ymd),
      ]);

      const idx = indexByGroup[groupId] || { fgc: [], tp: [], ts: [] };
      const fgc = compareKind(
        "fgc",
        fgcL.map((x) => x.id),
        idx.fgc
      );
      const tp = compareKind(
        "tp",
        tpL.map((x) => x.id),
        idx.tp
      );
      const ts = compareKind(
        "ts",
        tsL.map((x) => x.id),
        idx.ts
      );

      const allOk = fgc.ok && tp.ok && ts.ok;
      console.log(`Group ${groupId}  ${allOk ? "✅ PARITY OK" : "❌ MISMATCH"}`);
      for (const [label, c] of [
        ["FGC", fgc],
        ["TP ", tp],
        ["TS ", ts],
      ]) {
        const flag = c.ok ? "ok" : "!!";
        console.log(
          `  ${label} [${flag}] legacy=${c.legacyCount} index=${c.indexCount} legacyIds=${JSON.stringify(c.legacyIds)}`
        );
        if (c.missingInIndex.length) console.log(`       missing in index: ${c.missingInIndex.join(", ")}`);
        if (c.extraInIndex.length) console.log(`       extra in index:     ${c.extraInIndex.join(", ")}`);
      }
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
