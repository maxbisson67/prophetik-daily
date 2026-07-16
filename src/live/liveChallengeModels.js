import i18n from "@src/i18n/i18n";
import { getFgcTitle } from "@src/firstGoal/fgcChallengeUtils";
import { getTpBundleFirstDeadline } from "@src/defis/results/challengeResultsModel";
import { toDateAny } from "@src/defis/tpDeadlineHelpers";

export function normalizeStatus(st) {
  return String(st || "").toLowerCase().trim();
}

export function normalizeYmdString(v) {
  const s = String(v || "").trim();
  if (!s) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  if (/^\d{8}$/.test(s)) {
    return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
  }
  return "";
}

export function isTsType(raw) {
  const t = Number(raw?.type);
  return Number.isFinite(t) && t >= 1 && t <= 7;
}

export function normalizeFgcDoc(doc) {
  const d = doc.data() || {};

  const explicitDeadline =
    d?.signupDeadline ??
    d?.signupDeadlineUTC ??
    d?.signupDeadlineAt ??
    d?.signupDeadlineAtUTC ??
    d?.lockedAt ??
    d?.lockAtUTC ??
    d?.lockAt ??
    null;

  let computedDeadline = explicitDeadline || null;

  if (!computedDeadline && d?.gameStartTimeUTC) {
    const start = toDateAny(d.gameStartTimeUTC);
    if (start) {
      computedDeadline = new Date(start.getTime() - 5 * 60 * 1000);
    }
  }

  return {
    id: doc.id,
    kind: "fgc",
    groupId: String(d?.groupId || ""),
    dateKey: normalizeYmdString(d?.gameYmd),
    title: getFgcTitle(d, i18n.t.bind(i18n)),
    status: normalizeStatus(d?.status),
    createdAt: d?.createdAt || null,
    signupDeadline: computedDeadline,
    firstGameUTC: d?.gameStartTimeUTC || null,
    raw: { id: doc.id, ...d },
  };
}

export function normalizeTpBundleDoc(doc) {
  const d = doc.data() || {};
  const bundle = { id: doc.id, ...d };

  return {
    id: doc.id,
    kind: "tp",
    subtype: "bundle",
    groupId: String(d?.groupId || ""),
    dateKey: normalizeYmdString(d?.gameYmd),
    title: i18n.t("tp.home.title", { defaultValue: "Prédire l'issue des matchs" }),
    status: normalizeStatus(d?.status),
    createdAt: d?.createdAt || null,
    signupDeadline: getTpBundleFirstDeadline(bundle),
    firstGameUTC: d?.games?.[0]?.gameStartTimeUTC || null,
    raw: bundle,
  };
}

export function normalizeTsDoc(doc) {
  const d = doc.data() || {};
  const dateKey =
    normalizeYmdString(d?.gameDate) ||
    normalizeYmdString(
      typeof d?.gameDate?.toDate === "function"
        ? d.gameDate.toDate().toISOString().slice(0, 10)
        : ""
    );

  return {
    id: doc.id,
    kind: "ts",
    groupId: String(d?.groupId || ""),
    dateKey,
    title: i18n.t("home.todayChallenge", { defaultValue: "Le trio du jour" }),
    status: normalizeStatus(d?.status),
    createdAt: d?.createdAt || null,
    signupDeadline: d?.signupDeadline || null,
    firstGameUTC: d?.firstGameUTC || null,
    raw: { id: doc.id, ...d },
  };
}

export function challengeGameId(raw = {}) {
  return String(raw?.gameId || raw?.gamePk || "").trim();
}

export function liveBoardGameId(game = {}) {
  return String(game?.gamePk || game?.id || game?.gameId || "").trim();
}

export function lookupByGameId(map = {}, gameId) {
  if (!map || gameId == null) return null;
  const key = String(gameId).trim();
  if (!key) return null;
  if (map[key] != null) return map[key];

  const numeric = Number(key);
  if (Number.isFinite(numeric)) {
    const numericKey = String(numeric);
    if (map[numericKey] != null) return map[numericKey];
  }

  const foundKey = Object.keys(map).find((candidate) => String(candidate) === key);
  return foundKey != null ? map[foundKey] : null;
}
