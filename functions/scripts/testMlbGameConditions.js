#!/usr/bin/env node
/**
 * Tests locaux — conditions offensives MLB (sans deploy obligatoire).
 *
 * Usage:
 *   node functions/scripts/testMlbGameConditions.js                    # scoring offline (3 stades)
 *   node functions/scripts/testMlbGameConditions.js --meteo          # Open-Meteo live (3 stades)
 *   node functions/scripts/testMlbGameConditions.js --schedule       # calendrier MLB API aujourd'hui
 *   node functions/scripts/testMlbGameConditions.js --firestore      # lit schedule Firestore + dry-run
 *   node functions/scripts/testMlbGameConditions.js --firestore --write  # écrit mlb_game_conditions
 *   node functions/scripts/testMlbGameConditions.js --date 2026-07-02 --firestore --write
 *   node functions/scripts/testMlbGameConditions.js --venue 3 --meteo  # un stade (Fenway)
 *   node functions/scripts/testMlbGameConditions.js --help
 */
import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { MLB_BALLPARK_SEED } from "../mlb/ballparkCatalogData.js";
import { getSeedBallparkByVenueId, buildBallparkDocFromSeed } from "../mlb/ballparkCatalog.js";
import {
  fetchOpenMeteoHourlyForecast,
  pickClosestForecastHour,
  windDirectionText,
} from "../mlb/openMeteoClient.js";
import {
  computeOffensiveEnvironmentScores,
  sanitizeWeatherRow,
} from "../mlb/gameConditionsScoring.js";
import {
  ensureMlbGameConditionsForDate,
  ensureMlbGameConditionsForGame,
} from "../mlb/ensureMlbGameConditions.js";
import { appYmd } from "../ProphetikDate.js";

const MLB_SCHEDULE_URL = "https://statsapi.mlb.com/api/v1/schedule";

async function httpFetch(url, options) {
  if (typeof globalThis.fetch === "function") return globalThis.fetch(url, options);
  const { default: nodeFetch } = await import("node-fetch");
  return nodeFetch(url, options);
}

const args = process.argv.slice(2);

function hasFlag(name) {
  return args.includes(`--${name}`);
}

function argValue(name, fallback = null) {
  const idx = args.indexOf(`--${name}`);
  if (idx === -1 || idx + 1 >= args.length) return fallback;
  return args[idx + 1];
}

function printHelp() {
  console.log(`
testMlbGameConditions.js — tests Phase 1 conditions MLB

Modes (combinables sauf --help):
  (default)     Scoring offline sur Fenway, Coors, Oracle Park
  --meteo       Appel Open-Meteo réel
  --schedule    Calendrier MLB Stats API pour --date (défaut: aujourd'hui Toronto)
  --firestore   Lit mlb_schedule_daily Firestore + simule ensure
  --write       Avec --firestore: écrit mlb_game_conditions (sinon dry-run)

Options:
  --date YYYY-MM-DD
  --venue ID      mlbVenueId (ex. 3=Fenway, 19=Coors)
  --game PK       Traiter un seul gamePk avec --firestore --write
  --force         Ignore TTL 6h
  --help

Exemples:
  node functions/scripts/testMlbGameConditions.js
  node functions/scripts/testMlbGameConditions.js --meteo --venue 19
  node functions/scripts/testMlbGameConditions.js --schedule --date 2026-07-02
  node functions/scripts/testMlbGameConditions.js --firestore --date 2026-07-02
  node functions/scripts/testMlbGameConditions.js --firestore --write --date 2026-07-02
`);
}

function tierEmoji(label) {
  if (label === "very_favorable") return "🔥";
  if (label === "favorable") return "✅";
  if (label === "unfavorable") return "❄️";
  return "➖";
}

function printConditionSummary({ ballpark, weather, scores, gameLabel = null }) {
  const label = gameLabel || ballpark.name;
  console.log(`\n${"─".repeat(60)}`);
  console.log(`${tierEmoji(scores.offensiveEnvironmentLabel)} ${label}`);
  console.log(`   Stade: ${ballpark.name} (${ballpark.teamAbbreviation}) — venueId ${ballpark.mlbVenueId}`);
  if (weather) {
    console.log(
      `   Météo: ${weather.temperatureCelsius ?? "?"}°C · vent ${weather.windSpeedKmh ?? "?"} km/h ${windDirectionText(weather.windDirectionDegrees) || ""} · humidité ${weather.humidityPercent ?? "?"}%`
    );
    console.log(`   Heure prévision: ${weather.forecastHourLocal || weather.time || "—"}`);
  }
  console.log(`   Scores: park=${scores.parkOffenseScore} · weather=${scores.weatherOffenseScore} · special=${scores.specialContextScore} · global=${scores.offensiveEnvironmentScore}/100 (${scores.offensiveEnvironmentLabel})`);
  console.log(`   offensiveEnvironment:`, JSON.stringify(scores.offensiveEnvironment, null, 2));
  console.log(`   Vent CF: ${scores.windOutToCenterScore} · toit: ${scores.roofState}`);
  console.log(`   FR: ${scores.explanationFr}`);
  console.log(`   EN: ${scores.explanationEn}`);
}

/** Scénarios météo fictifs pour test offline. */
const FIXTURE_WEATHER = {
  hot_wind_out: {
    temperatureCelsius: 32,
    humidityPercent: 45,
    windSpeedKmh: 22,
    windDirectionDegrees: 310,
    precipitationProbability: 5,
    time: "2026-07-02T19:00",
  },
  cold_wind_in: {
    temperatureCelsius: 8,
    humidityPercent: 70,
    windSpeedKmh: 25,
    windDirectionDegrees: 130,
    precipitationProbability: 20,
    time: "2026-04-15T13:00",
  },
  neutral: {
    temperatureCelsius: 20,
    humidityPercent: 55,
    windSpeedKmh: 8,
    windDirectionDegrees: 90,
    precipitationProbability: 10,
    time: "2026-06-01T19:00",
  },
};

async function runOfflineScoring(venueIds) {
  console.log("\n=== TEST OFFLINE — scoring (sans réseau) ===\n");

  const scenarios = [
    { venueId: 3, weather: FIXTURE_WEATHER.hot_wind_out, note: "Fenway — chaud, vent sortant" },
    { venueId: 19, weather: FIXTURE_WEATHER.hot_wind_out, note: "Coors — chaud, vent sortant (altitude)" },
    { venueId: 2395, weather: FIXTURE_WEATHER.cold_wind_in, note: "Oracle Park — froid, vent entrant" },
  ];

  const filtered = venueIds?.length
    ? scenarios.filter((s) => venueIds.includes(String(s.venueId)))
    : scenarios;

  for (const sc of filtered) {
    const seed = getSeedBallparkByVenueId(sc.venueId);
    if (!seed) {
      console.warn(`Venue ${sc.venueId} inconnu dans le seed`);
      continue;
    }
    const ballpark = { ...buildBallparkDocFromSeed(seed), id: String(seed.mlbVenueId) };
    delete ballpark.updatedAt;

    const scores = computeOffensiveEnvironmentScores({
      ballpark,
      forecastHour: sc.weather,
    });

    console.log(`[${sc.note}]`);
    printConditionSummary({ ballpark, weather: sc.weather, scores });
  }
}

async function runMeteoTest(venueIds) {
  console.log("\n=== TEST OPEN-METEO (réseau) ===\n");

  const ids = venueIds?.length ? venueIds.map(Number) : [3, 19, 2395];
  const pitchUtc = new Date();

  for (const venueId of ids) {
    const seed = getSeedBallparkByVenueId(venueId);
    if (!seed) {
      console.warn(`Venue ${venueId} inconnu`);
      continue;
    }

    const ballpark = { ...buildBallparkDocFromSeed(seed), id: String(seed.mlbVenueId) };
    delete ballpark.updatedAt;

    console.log(`Fetching Open-Meteo for ${ballpark.name}…`);
    const hours = await fetchOpenMeteoHourlyForecast({
      latitude: seed.latitude,
      longitude: seed.longitude,
      timezone: seed.timezone,
      forecastDays: 2,
    });

    const hour = pickClosestForecastHour(hours, pitchUtc, seed.timezone);
    const weather = sanitizeWeatherRow(hour || {});

    const scores = computeOffensiveEnvironmentScores({ ballpark, forecastHour: hour || {} });
    printConditionSummary({ ballpark, weather, scores });
  }
}

async function fetchMlbScheduleForDate(gameDateYmd) {
  const url = `${MLB_SCHEDULE_URL}?sportId=1&date=${encodeURIComponent(gameDateYmd)}&gameType=R&hydrate=team,venue`;
  const res = await httpFetch(url, {
    headers: { Accept: "application/json", "User-Agent": "prophetik-test/1.0" },
  });
  if (!res.ok) throw new Error(`MLB schedule HTTP ${res.status}`);

  const json = await res.json();
  const dates = Array.isArray(json?.dates) ? json.dates : [];
  const games = dates.flatMap((d) => d?.games || []);

  return games.map((g) => ({
    gamePk: String(g.gamePk),
    gameDateYmd,
    startTimeUTC: g.gameDate ? new Date(g.gameDate) : null,
    venue: { id: g.venue?.id, name: g.venue?.name },
    homeTeam: {
      id: g.teams?.home?.team?.id,
      abbreviation: g.teams?.home?.team?.abbreviation,
      name: g.teams?.home?.team?.name,
    },
    awayTeam: {
      id: g.teams?.away?.team?.id,
      abbreviation: g.teams?.away?.team?.abbreviation,
      name: g.teams?.away?.team?.name,
    },
    status: { abstractGameState: g.status?.abstractGameState },
  }));
}

async function runScheduleTest(gameDateYmd) {
  console.log(`\n=== TEST CALENDRIER MLB API — ${gameDateYmd} ===\n`);

  const games = await fetchMlbScheduleForDate(gameDateYmd);
  console.log(`Matchs trouvés: ${games.length}\n`);

  if (!games.length) {
    console.log("Aucun match régulier ce jour-là.");
    return;
  }

  for (const g of games.slice(0, 15)) {
    const seed = getSeedBallparkByVenueId(g.venue?.id);
    const catalog = seed ? "✓ catalogue" : "✗ hors catalogue";
    const time = g.startTimeUTC
      ? g.startTimeUTC.toISOString().slice(11, 16) + " UTC"
      : "?";
    console.log(
      `  ${g.gamePk}  ${g.awayTeam?.abbreviation}@${g.homeTeam?.abbreviation}  ${time}  ${g.venue?.name || "?"} (id=${g.venue?.id})  ${catalog}`
    );
  }

  if (games.length > 15) {
    console.log(`  … +${games.length - 15} autres matchs`);
  }

  const missing = games.filter((g) => !getSeedBallparkByVenueId(g.venue?.id));
  if (missing.length) {
    console.log(`\n⚠ ${missing.length} match(s) sans stade catalogue:`);
    for (const g of missing) {
      console.log(`   gamePk=${g.gamePk} venueId=${g.venue?.id} ${g.venue?.name}`);
    }
  }
}

async function runFirestoreTest({ gameDateYmd, write, force, gamePkFilter }) {
  if (!getApps().length) initializeApp();

  console.log(`\n=== TEST FIRESTORE — ${gameDateYmd} ${write ? "(WRITE)" : "(DRY-RUN)"} ===\n`);

  const ymdCompact = gameDateYmd.replaceAll("-", "");
  const db = getFirestore();

  const daySnap = await db.doc(`mlb_schedule_daily/${ymdCompact}`).get();
  if (!daySnap.exists) {
    console.log(`❌ Pas de doc mlb_schedule_daily/${ymdCompact}`);
    console.log("   Lance d'abord refreshMlbScheduleWindow ou attends l'ingest.");
    console.log("   Alternative: node … --schedule --date", gameDateYmd);
    return;
  }

  console.log(`Jour Firestore: gameCount=${daySnap.data()?.gameCount ?? "?"}`);

  const gamesSnap = await db.collection(`mlb_schedule_daily/${ymdCompact}/games`).get();
  let games = gamesSnap.docs.map((d) => ({ id: d.id, ...(d.data() || {}) }));

  if (gamePkFilter) {
    games = games.filter((g) => String(g.gamePk || g.id) === String(gamePkFilter));
    if (!games.length) {
      console.log(`❌ gamePk ${gamePkFilter} introuvable dans le schedule`);
      return;
    }
  }

  console.log(`Matchs à traiter: ${games.length}\n`);

  if (!write) {
    for (const g of games) {
      const venueId = g?.venue?.id;
      const seed = getSeedBallparkByVenueId(venueId);
      const condRef = db.doc(`mlb_game_conditions/${g.gamePk || g.id}`);
      const condSnap = await condRef.get();
      const status = condSnap.exists ? condSnap.data()?.status || "exists" : "absent";

      console.log(
        `  ${g.gamePk || g.id}  ${g.awayTeam?.abbreviation}@${g.homeTeam?.abbreviation}  venue=${venueId}  catalog=${seed ? "ok" : "MISSING"}  conditions=${status}`
      );
    }
    console.log("\nAjoute --write pour écrire mlb_game_conditions.");
    return;
  }

  if (gamePkFilter && games.length === 1) {
    const result = await ensureMlbGameConditionsForGame({
      game: games[0],
      gameDateYmd,
      force,
    });
    console.log("Résultat:", JSON.stringify(result, null, 2));

    const condSnap = await db.doc(`mlb_game_conditions/${gamePkFilter}`).get();
    if (condSnap.exists) {
      const d = condSnap.data();
      console.log("\nDoc écrit:");
      console.log(JSON.stringify({
        offensiveEnvironment: d.offensiveEnvironment,
        offensiveEnvironmentLabel: d.offensiveEnvironmentLabel,
        offensiveEnvironmentScore: d.offensiveEnvironmentScore,
        status: d.status,
      }, null, 2));
    }
    return;
  }

  const result = await ensureMlbGameConditionsForDate(gameDateYmd, { force });
  console.log("\nRésumé ensureMlbGameConditionsForDate:");
  console.log(JSON.stringify({
    gameCount: result.gameCount,
    written: result.written,
    skipped: result.skipped,
    errors: result.errors,
  }, null, 2));

  if (result.details?.length) {
    console.log("\nDétails (max 10):");
    for (const row of result.details.slice(0, 10)) {
      console.log(`  ${row.gamePk}: ${row.skipped ? "skipped" : row.written ? "written" : row.reason || row.ok}`);
    }
  }
}

async function main() {
  if (hasFlag("help") || hasFlag("h")) {
    printHelp();
    return;
  }

  const gameDateYmd = argValue("date", appYmd(new Date()));
  const venueArg = argValue("venue");
  const venueIds = venueArg ? [String(Number(venueArg))] : null;
  const gamePk = argValue("game");
  const force = hasFlag("force");
  const write = hasFlag("write");

  const runDefault = !hasFlag("meteo") && !hasFlag("schedule") && !hasFlag("firestore");

  if (runDefault) {
    await runOfflineScoring(venueIds);
  }

  if (hasFlag("meteo")) {
    await runMeteoTest(venueIds);
  }

  if (hasFlag("schedule")) {
    await runScheduleTest(gameDateYmd);
  }

  if (hasFlag("firestore")) {
    await runFirestoreTest({ gameDateYmd, write, force, gamePkFilter: gamePk });
  }

  console.log("\n✓ Tests terminés.\n");
}

main().catch((e) => {
  console.error("\n❌ Erreur:", e?.message || e);
  if (e?.stack) console.error(e.stack);
  process.exit(1);
});
