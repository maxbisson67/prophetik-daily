import i18n from "@src/i18n/i18n";

function inningNumberFromValue(inning, ordinal) {
  const n = Number(inning);
  if (Number.isFinite(n) && n > 0) return n;
  const m = String(ordinal || "").match(/^(\d+)/);
  return m ? Number(m[1]) : null;
}

export function parseMlbHalfFromGame(game = {}) {
  const half = String(game.inningHalf || "").toLowerCase();
  if (half === "top" || half === "bottom") return half;

  const state = String(game.inningState || "").toLowerCase();
  if (state.includes("top")) return "top";
  if (state.includes("bottom")) return "bottom";
  return null;
}

export function frenchInningOrdinal(inning) {
  const n = Number(inning);
  if (!Number.isFinite(n) || n <= 0) return String(inning ?? "");
  if (n === 1) return "1ère";
  return `${n}ième`;
}

export function englishInningOrdinal(inning) {
  const n = Number(inning);
  if (!Number.isFinite(n) || n <= 0) return String(inning ?? "");
  const mod100 = n % 100;
  const mod10 = n % 10;
  if (mod10 === 1 && mod100 !== 11) return `${n}st`;
  if (mod10 === 2 && mod100 !== 12) return `${n}nd`;
  if (mod10 === 3 && mod100 !== 13) return `${n}rd`;
  return `${n}th`;
}

export function formatInningOrdinal(inning) {
  const locale = String(i18n.locale || "fr").toLowerCase();
  return locale.startsWith("fr") ? frenchInningOrdinal(inning) : englishInningOrdinal(inning);
}

export function formatMlbHalfInningLabel(half, inning) {
  const h = String(half || "").toLowerCase();
  const n = Number(inning);
  if (!Number.isFinite(n) || n <= 0) return "";

  const inningText = formatInningOrdinal(n);

  if (h === "top") {
    return i18n.t("live.mlb.inningTop", {
      defaultValue: "Début de {{inning}} manche",
      inning: inningText,
    });
  }
  if (h === "bottom") {
    return i18n.t("live.mlb.inningBottom", {
      defaultValue: "Fin de {{inning}} manche",
      inning: inningText,
    });
  }
  return inningText;
}

function inningRowForGame(game = {}, inning) {
  const rows = Array.isArray(game?.inningLinescore) ? game.inningLinescore : [];
  return rows.find((row) => Number(row?.n) === Number(inning)) || null;
}

/** Mi-manche (après le début) vs manche complète terminée. */
function middleBreakKind(game = {}, inning) {
  if (!Number.isFinite(Number(inning)) || Number(inning) <= 0) return "unknown";
  const row = inningRowForGame(game, inning);
  if (!row) return "unknown";

  const awayDone = row.away != null;
  const homeDone = row.home != null;
  if (awayDone && !homeDone) return "mid";
  if (awayDone && homeDone) return "full";
  return "unknown";
}

function formatInningBreakLabel(game = {}) {
  const state = String(game.inningState || "").toLowerCase();
  const inning = inningNumberFromValue(game.currentInning, game.currentInningOrdinal);
  const inningText = inning ? formatInningOrdinal(inning) : null;

  if (state === "middle") {
    if (!inningText) {
      return i18n.t("live.mlb.inningMiddle", { defaultValue: "Entre les manches" });
    }

    const kind = middleBreakKind(game, inning);
    if (kind === "mid") {
      return i18n.t("live.mlb.inningMiddleMid", {
        defaultValue: "Mi-{{inning}} manche",
        inning: inningText,
      });
    }

    return i18n.t("live.mlb.inningMiddleWithInning", {
      defaultValue: "Fin de {{inning}} manche",
      inning: inningText,
    });
  }

  if (state === "end") {
    if (inningText) {
      return i18n.t("live.mlb.inningEndWithInning", {
        defaultValue: "Fin de {{inning}} manche",
        inning: inningText,
      });
    }
    return i18n.t("live.mlb.inningEnd", { defaultValue: "Fin de match" });
  }

  return null;
}

export function formatMlbLiveInningLabel(game = {}) {
  const breakLabel = formatInningBreakLabel(game);
  if (breakLabel) return breakLabel;

  const half = parseMlbHalfFromGame(game);
  const inning = inningNumberFromValue(game.currentInning, game.currentInningOrdinal);

  if (half && inning) {
    return formatMlbHalfInningLabel(half, inning);
  }

  const fallback = [game.inningState, game.currentInningOrdinal]
    .map((v) => String(v || "").trim())
    .filter(Boolean)
    .join(" ");

  return fallback || null;
}
