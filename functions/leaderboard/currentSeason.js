import { getFirestore } from "firebase-admin/firestore";

const FALLBACK = {
  seasonId: "20252026",
  fromYmd: "2025-10-01",
  toYmd: "2026-06-30",
};

let cachedSeason = null;
let cachedAt = 0;
const CACHE_MS = 60_000;

export async function getCurrentSeasonConfig(db = getFirestore()) {
  const now = Date.now();
  if (cachedSeason && now - cachedAt < CACHE_MS) {
    return cachedSeason;
  }

  try {
    const snap = await db.doc("app_config/currentSeason").get();
    if (snap.exists) {
      const d = snap.data() || {};
      cachedSeason = {
        seasonId: String(d.seasonId || FALLBACK.seasonId),
        fromYmd: String(d.fromYmd || FALLBACK.fromYmd).slice(0, 10),
        toYmd: String(d.toYmd || FALLBACK.toYmd).slice(0, 10),
      };
      cachedAt = now;
      return cachedSeason;
    }
  } catch {}

  cachedSeason = { ...FALLBACK };
  cachedAt = now;
  return cachedSeason;
}
