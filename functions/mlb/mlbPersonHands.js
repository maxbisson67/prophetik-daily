const MLB_PEOPLE_URL = (personId) =>
  `https://statsapi.mlb.com/api/v1/people/${encodeURIComponent(String(personId))}`;

function str(v) {
  return String(v ?? "").trim();
}

export function normalizeHand(code) {
  const c = str(code).toUpperCase();
  if (c === "L" || c === "R" || c === "S") return c;
  return null;
}

export function normalizePitcherId(raw) {
  if (raw == null) return "";
  if (typeof raw === "number" && Number.isFinite(raw)) {
    const n = Math.trunc(raw);
    return n > 0 ? String(n) : "";
  }
  const id = str(raw);
  return /^\d+$/.test(id) ? id : "";
}

export function resolvePitcherPersonId(pitcher) {
  if (!pitcher || typeof pitcher !== "object") return "";
  for (const key of ["id", "playerId", "personId", "pitcherId"]) {
    const pid = normalizePitcherId(pitcher[key]);
    if (pid) return pid;
  }
  return "";
}

export async function fetchPersonHands(personId) {
  const pid = normalizePitcherId(personId);
  if (!pid) return { batSide: null, pitchHand: null };

  try {
    const res = await fetch(MLB_PEOPLE_URL(pid), {
      headers: { Accept: "application/json", "User-Agent": "prophetik/1.0" },
    });
    if (!res.ok) return { batSide: null, pitchHand: null };

    const json = await res.json();
    const person = Array.isArray(json?.people) ? json.people[0] : null;
    if (!person) return { batSide: null, pitchHand: null };

    return {
      batSide: normalizeHand(person?.batSide?.code),
      pitchHand: normalizeHand(person?.pitchHand?.code),
    };
  } catch {
    return { batSide: null, pitchHand: null };
  }
}

export async function enrichPitcherThrowHand(pitcher) {
  if (!pitcher || typeof pitcher !== "object") return pitcher;

  const existing = normalizeHand(pitcher.throwHand || pitcher.pitchHand);
  if (existing) {
    return { ...pitcher, throwHand: existing };
  }

  const pid = resolvePitcherPersonId(pitcher);
  if (!pid) return pitcher;

  const hands = await fetchPersonHands(pid);
  if (!hands.pitchHand) return pitcher;

  return { ...pitcher, throwHand: hands.pitchHand };
}

export async function enrichProbablePitchersHands({ away, home } = {}) {
  const [awayEnriched, homeEnriched] = await Promise.all([
    enrichPitcherThrowHand(away),
    enrichPitcherThrowHand(home),
  ]);

  return { away: awayEnriched, home: homeEnriched };
}

export function formatThrowHandLabel(code, lang = "fr") {
  const hand = normalizeHand(code);
  if (!hand) return null;
  const isFr = lang !== "en";
  if (hand === "L") return isFr ? "gaucher" : "left-handed";
  if (hand === "R") return isFr ? "droitier" : "right-handed";
  return hand;
}
