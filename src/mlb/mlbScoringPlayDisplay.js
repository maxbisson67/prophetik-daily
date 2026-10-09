import i18n from "@src/i18n/i18n";

const BATTER_DESC_RE =
  /^([A-Za-zÀ-ÿ'.\- ]+?)\s+(?:homers|singles|doubles|triples|out on|hits|reaches|struck|walks|grounds|flies|lines|pops|bunts|struck out)/i;

export function compareScoringPlaysChronologically(a, b) {
  const ai = Number(a?.inning) || 0;
  const bi = Number(b?.inning) || 0;
  if (ai !== bi) return ai - bi;

  const halfOrder = { top: 0, bottom: 1 };
  const ha = halfOrder[String(a?.halfInning || "").toLowerCase()] ?? 0;
  const hb = halfOrder[String(b?.halfInning || "").toLowerCase()] ?? 0;
  if (ha !== hb) return ha - hb;

  const atA = Number(a?.atBatIndex ?? a?.playId ?? NaN);
  const atB = Number(b?.atBatIndex ?? b?.playId ?? NaN);
  if (Number.isFinite(atA) && Number.isFinite(atB) && atA !== atB) return atA - atB;

  const runsA = (Number(a?.awayScore) || 0) + (Number(a?.homeScore) || 0);
  const runsB = (Number(b?.awayScore) || 0) + (Number(b?.homeScore) || 0);
  if (runsA !== runsB) return runsA - runsB;

  return String(a?.id || a?.playId || "").localeCompare(String(b?.id || b?.playId || ""));
}

export function sortScoringPlaysChronologically(plays = []) {
  return [...(Array.isArray(plays) ? plays : [])].sort(compareScoringPlaysChronologically);
}

export function groupScoringPlaysByInning(plays = []) {
  const map = new Map();

  for (const play of plays) {
    const inning = play?.inning ?? "?";
    const half = String(play?.halfInning || "");
    const key = `${inning}-${half}`;

    if (!map.has(key)) {
      map.set(key, { inning, halfInning: half, plays: [] });
    }
    map.get(key).plays.push(play);
  }

  return [...map.values()]
    .sort((a, b) => {
      const ai = Number(a.inning) || 0;
      const bi = Number(b.inning) || 0;
      if (ai !== bi) return ai - bi;
      const order = { top: 0, bottom: 1 };
      return (order[String(a.halfInning).toLowerCase()] ?? 0) - (order[String(b.halfInning).toLowerCase()] ?? 0);
    })
    .map((group) => ({
      ...group,
      plays: sortScoringPlaysChronologically(group.plays),
    }));
}

export function battingTeamAbbrForPlay(play, game) {
  const explicit = String(play?.battingTeamAbbr || "").trim();
  if (explicit) return explicit;
  const half = String(play?.halfInning || "").toLowerCase();
  if (half === "top") return game?.awayAbbr;
  if (half === "bottom") return game?.homeAbbr;
  return null;
}

export function parseBatterNameFromDescription(description = "") {
  const d = String(description || "").trim();
  if (!d) return null;
  const match = d.match(BATTER_DESC_RE);
  return match?.[1]?.trim() || null;
}

export function resolveScoringPlayBatter(play = {}) {
  const name = String(play?.batterName || "").trim() || parseBatterNameFromDescription(play?.description);
  const id = play?.batterId != null ? String(play.batterId) : null;
  return { batterId: id, batterName: name || null };
}

function parseSeasonCountFromDescription(description = "") {
  const match = String(description || "").match(/\((\d+)\)/);
  if (!match) return null;
  const n = Number(match[1]);
  return Number.isFinite(n) ? n : null;
}

function normalizedEventType(play = {}) {
  return String(play?.eventType || play?.event || "").toLowerCase();
}

/** Titre court de l'action (ex. « 18e circuit », « Double · 2 RBI »). */
export function scoringPlayHeadline(play = {}) {
  const eventType = normalizedEventType(play);
  const eventLabel = String(play?.event || "").trim();
  const rbi = Number(play?.rbi) || 0;
  const seasonCount = parseSeasonCountFromDescription(play?.description);

  if (eventType.includes("home_run") || eventLabel.toLowerCase().includes("home run")) {
    if (seasonCount != null) {
      return i18n.t("live.mlb.scoringHomeRunNth", {
        defaultValue: "{{count}}e circuit",
        count: seasonCount,
      });
    }
    return i18n.t("live.mlb.homeRun", "HR");
  }

  if (eventType.includes("triple") || eventLabel === "Triple") {
    return seasonCount != null
      ? i18n.t("live.mlb.scoringTripleNth", { defaultValue: "{{count}}e triple", count: seasonCount })
      : i18n.t("live.mlb.triple", "3B");
  }

  if (eventType.includes("double") || eventLabel === "Double") {
    return seasonCount != null
      ? i18n.t("live.mlb.scoringDoubleNth", { defaultValue: "{{count}}e double", count: seasonCount })
      : i18n.t("live.mlb.double", "2B");
  }

  if (eventType.includes("single") || eventLabel === "Single") {
    return seasonCount != null
      ? i18n.t("live.mlb.scoringSingleNth", { defaultValue: "{{count}}e simple", count: seasonCount })
      : i18n.t("live.mlb.single", "1B");
  }

  if (eventType.includes("sac_fly") || eventLabel.toLowerCase().includes("sac fly")) {
    return i18n.t("live.mlb.sacFly", "Sacrifice sur volée");
  }

  if (eventType.includes("sac_bunt") || eventType.includes("sacrifice_bunt")) {
    return i18n.t("live.mlb.sacBunt", "Sacrifice");
  }

  if (eventType.includes("field_error") || eventType.includes("error")) {
    return i18n.t("live.mlb.fieldError", "Erreur défensive");
  }

  if (eventType.includes("wild_pitch")) {
    return i18n.t("live.mlb.wildPitch", "Lance sauvage");
  }

  if (eventType.includes("passed_ball")) {
    return i18n.t("live.mlb.passedBall", "Passed ball");
  }

  if (eventType.includes("balk")) {
    return i18n.t("live.mlb.balk", "Balk");
  }

  if (eventType.includes("hit_by_pitch")) {
    return i18n.t("live.mlb.hitByPitch", "Frappé par lancer");
  }

  if (eventType.includes("ground_rule")) {
    return i18n.t("live.mlb.groundRuleDouble", "Double automatique");
  }

  const parts = [];
  if (eventLabel) parts.push(eventLabel);
  if (rbi > 0) {
    parts.push(
      i18n.t("live.mlb.rbi", {
        defaultValue: "{{count}} RBI",
        count: rbi,
      })
    );
  }

  if (parts.length) return parts.join(" · ");
  return i18n.t("live.mlb.eventFallback", "Action marquante");
}

export function isScoringPlayHighlight(play = {}) {
  const eventType = normalizedEventType(play);
  return eventType.includes("home_run");
}

const SCORER_DESC_RE = /([A-Za-zÀ-ÿ'.\- ]+?) scores(?:\.|,|$)/gi;

export function parseRunScorersFromDescription(description = "") {
  const d = String(description || "").trim();
  if (!d) return [];

  const byKey = new Map();
  let match;
  while ((match = SCORER_DESC_RE.exec(d)) !== null) {
    const name = match[1]?.trim();
    if (!name) continue;
    byKey.set(name.toLowerCase(), { playerId: null, name });
  }

  return [...byKey.values()];
}

export function resolveScoringPlayRunScorers(play = {}) {
  if (Array.isArray(play?.runScorers) && play.runScorers.length) {
    return play.runScorers.filter((s) => String(s?.name || "").trim());
  }
  return parseRunScorersFromDescription(play?.description);
}

export function resolveScoringPlayRbiCredit(play = {}) {
  const count = Number(play?.rbi) || 0;
  if (count <= 0) return null;

  const { batterId, batterName } = resolveScoringPlayBatter(play);
  if (!batterName) return { playerId: batterId, name: null, count };

  return { playerId: batterId, name: batterName, count };
}

export function formatScoringParticipantNames(scorers = [], formatName = (n) => n) {
  return scorers
    .map((s) => formatName(String(s?.name || "").trim()))
    .filter(Boolean)
    .join(", ");
}
