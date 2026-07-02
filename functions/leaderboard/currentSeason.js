import { getFirestore } from "firebase-admin/firestore";
import { appYmd } from "../ProphetikDate.js";
import { resolveCompetition } from "./seasonCompetitions.js";

const FALLBACK = {
  seasonId: "20252026",
  competitionKey: "nhl_20252026_regular",
  fromYmd: "2025-10-01",
  toYmd: "2026-06-30",
  phase: "regular",
  label: "Saison NHL 2025-26 — Saison régulière",
  sport: "nhl",
};

let cachedSeason = null;
let cachedAt = 0;
const CACHE_MS = 60_000;

export async function getCurrentSeasonConfig(db = getFirestore(), options = {}) {
  const sport = options.sport || "NHL";
  const gameYmd = String(options.gameYmd || appYmd(new Date())).slice(0, 10);
  const cacheKey = `${normalizeSportKey(sport)}:${gameYmd}`;
  const now = Date.now();

  if (cachedSeason?.cacheKey === cacheKey && now - cachedAt < CACHE_MS) {
    return cachedSeason.data;
  }

  try {
    const comp = await resolveCompetition({ db, sport, gameYmd });
    if (comp?.competitionKey) {
      const data = {
        seasonId: String(comp.seasonId || FALLBACK.seasonId),
        competitionKey: String(comp.competitionKey),
        fromYmd: String(comp.fromYmd || FALLBACK.fromYmd).slice(0, 10),
        toYmd: String(comp.toYmd || FALLBACK.toYmd).slice(0, 10),
        phase: String(comp.phase || "regular"),
        label: String(comp.label || comp.competitionKey),
        sport: String(comp.sport || "nhl"),
      };
      cachedSeason = { cacheKey, data };
      cachedAt = now;
      return data;
    }
  } catch {
    // fallback below
  }

  cachedSeason = { cacheKey, data: { ...FALLBACK } };
  cachedAt = now;
  return cachedSeason.data;
}

function normalizeSportKey(sport) {
  return String(sport || "NHL").trim().toUpperCase() === "MLB" ? "mlb" : "nhl";
}

export { resolveCompetition, resolveCompetitionForGroup, resolveCompetitionForCredit, resolveCompetitionForGroupCredit, listCompetitionsReadyToFinalize } from "./seasonCompetitions.js";
