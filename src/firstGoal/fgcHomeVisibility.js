import {
  addDaysToYmd,
  getProphetikBusinessYmd,
} from "@src/lib/prophetikBusinessDate";

export function normalizeFgcGameYmd(v) {
  const s = String(v || "").trim();
  if (/^\d{8}$/.test(s)) {
    return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
  }
  return s.length >= 10 ? s.slice(0, 10) : s;
}

/** Jours Prophetik pertinents pour l'accueil (aligné Mes résultats + autopilot). */
export function fgcHomeYmdCandidates(now = new Date()) {
  const today = getProphetikBusinessYmd(now);
  return [today, addDaysToYmd(today, -1)];
}

function isFgcTerminalStatus(status) {
  const st = String(status || "").toLowerCase();
  return ["decided", "closed", "completed", "cancelled_ghost"].includes(st);
}

function isFgcStillActive(status) {
  const st = String(status || "").toLowerCase();
  return ["open", "locked", "live", "pending", "awaiting_result"].includes(st);
}

/**
 * Visibilité FGC sur l'accueil :
 * - match du jour Prophetik : toujours visible (même decided/closed)
 * - hier : seulement si encore en cours (report, résolution en attente)
 */
export function shouldShowFgcOnHome(ch, businessYmd, ymdCandidates) {
  const ymd = normalizeFgcGameYmd(ch?.gameYmd);
  const candidateSet =
    ymdCandidates instanceof Set ? ymdCandidates : new Set(ymdCandidates || []);

  if (!ymd || !candidateSet.has(ymd)) return false;

  const todayYmd = businessYmd || getProphetikBusinessYmd();
  if (ymd === todayYmd) return true;

  const st = String(ch?.status || "").toLowerCase();
  if (isFgcTerminalStatus(st)) return false;
  return isFgcStillActive(st);
}

export function hasFgcForBusinessToday(ch, businessYmd, ymdCandidates, sportLeague) {
  const ymd = normalizeFgcGameYmd(ch?.gameYmd);
  const candidateSet =
    ymdCandidates instanceof Set ? ymdCandidates : new Set(ymdCandidates || []);

  if (!ymd || !candidateSet.has(ymd)) return false;
  if (String(ch?.league || sportLeague).toUpperCase() !== sportLeague) return false;
  return ymd === (businessYmd || getProphetikBusinessYmd());
}
