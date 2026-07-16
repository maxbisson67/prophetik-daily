import { formatNameList } from "./notificationUtils.js";
import { formatWinnerScoreLine, resolveTeamShortName } from "./teamDisplayUtils.js";

function normalizeLang(lang) {
  return String(lang || "fr").toLowerCase().startsWith("en") ? "en" : "fr";
}

function normalizeLeague(league) {
  return String(league || "NHL").toUpperCase() === "MLB" ? "MLB" : "NHL";
}

function titleWithGroup(baseTitle, groupName) {
  const base = String(baseTitle || "").trim();
  const group = String(groupName || "").trim();
  if (!base) return group || "";
  return group ? `${base} — ${group}` : base;
}

export function buildFgcWinPush({
  lang = "fr",
  league = "NHL",
  groupName,
  winnerNames = [],
  playerName,
} = {}) {
  const lg = normalizeLang(lang);
  const sport = normalizeLeague(league);
  const names = formatNameList(winnerNames, lg);
  const player = String(playerName || "").trim();

  const titleBase =
    sport === "MLB"
      ? lg === "en"
        ? "First run scored"
        : "Premier point produit"
      : lg === "en"
      ? "First goal scored"
      : "Premier but marqué";

  const title = titleWithGroup(titleBase, groupName);

  if (lg === "en") {
    const body = player
      ? `Congrats to ${names} for picking ${player}.`
      : `Congrats to ${names} for the correct pick!`;
    return { title, body };
  }

  const body = player
    ? `Bravo à ${names} pour le choix de ${player}.`
    : `Bravo à ${names} pour le bon choix !`;

  return { title, body };
}

export function buildTpExactScorePush({
  lang = "fr",
  league = "NHL",
  groupName,
  winnerNames = [],
  winnerAbbr,
  awayAbbr,
  homeAbbr,
  awayScore,
  homeScore,
} = {}) {
  const lg = normalizeLang(lang);
  const names = formatNameList(winnerNames, lg);
  const teamName = resolveTeamShortName({ league, abbr: winnerAbbr });
  const scoreLine = formatWinnerScoreLine({
    winnerAbbr,
    awayAbbr,
    homeAbbr,
    awayScore,
    homeScore,
  });

  const title = titleWithGroup(lg === "en" ? "Exact score" : "Score exact", groupName);

  if (lg === "en") {
    const matchPart = scoreLine ? `${teamName} ${scoreLine}` : teamName;
    const body = `Congrats to ${names} for predicting the win and exact score of the ${matchPart}.`;
    return { title, body };
  }

  const matchPart = scoreLine ? `${teamName} ${scoreLine}` : teamName;
  const body = `Bravo à ${names} pour avoir prédit la victoire et le score exact des ${matchPart}.`;
  return { title, body };
}

export function buildTsWinPush({
  lang = "fr",
  groupName,
  winnerNames = [],
  potTotal,
  sharePerWinner = null,
  shareMax = null,
  shareUniform = true,
} = {}) {
  const lg = normalizeLang(lang);
  const names = formatNameList(winnerNames, lg);
  const pot = Number(potTotal);
  const share = Number(sharePerWinner);
  const shareHigh = Number(shareMax);
  const hasPot = Number.isFinite(pot) && pot > 0;
  const hasShare = Number.isFinite(share) && share > 0;
  const isTie = winnerNames.length > 1;

  const title = titleWithGroup(lg === "en" ? "Trio of the day" : "Trio du jour", groupName);

  function shareSuffixFr() {
    if (!hasShare) return "";
    if (isTie && !shareUniform && Number.isFinite(shareHigh) && shareHigh > share) {
      return ` (${share}-${shareHigh} points chacun)`;
    }
    if (isTie) {
      return ` (${share} points chacun)`;
    }
    return "";
  }

  function shareSuffixEn() {
    if (!hasShare) return "";
    if (isTie && !shareUniform && Number.isFinite(shareHigh) && shareHigh > share) {
      return ` (${share}-${shareHigh} points each)`;
    }
    if (isTie) {
      return ` (${share} points each)`;
    }
    return "";
  }

  if (lg === "en") {
    if (isTie && hasPot) {
      return {
        title,
        body: `Congrats to ${names}! They split the ${pot}-point jackpot${shareSuffixEn()}.`,
      };
    }

    if (hasPot) {
      return {
        title,
        body: `Congrats to ${names} for winning today's Trio challenge! Jackpot: ${pot} points.`,
      };
    }

    return {
      title,
      body: `Congrats to ${names} for winning today's Trio challenge!`,
    };
  }

  if (isTie && hasPot) {
    return {
      title,
      body: `Bravo à ${names} ! Ils se partagent la cagnotte de ${pot} points${shareSuffixFr()}.`,
    };
  }

  if (hasPot) {
    return {
      title,
      body: `Bravo à ${names} pour sa victoire au Trio du jour ! Cagnotte : ${pot} points.`,
    };
  }

  return {
    title,
    body: `Bravo à ${names} pour sa victoire au Trio du jour !`,
  };
}
