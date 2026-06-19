import { HttpsError } from "firebase-functions/v2/https";
import { resolveNhlTeamId } from "./nhlTeamIds.js";

export function normalizeConfigSport(value) {
  const sport = String(value || "").trim().toUpperCase();
  if (sport === "NHL") return "NHL";
  if (sport === "MLB") return "MLB";
  return null;
}

export function parseFavoriteTeam(raw) {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== "object" || Array.isArray(raw)) {
    throw new HttpsError("invalid-argument", "favoriteTeam must be null or an object");
  }

  const sport = normalizeConfigSport(raw.sport);
  if (!sport) {
    throw new HttpsError("invalid-argument", "favoriteTeam.sport must be NHL or MLB");
  }

  const teamIdRaw = String(raw.teamId || "").trim();
  const abbreviation = String(raw.abbreviation || "").trim();
  const name = String(raw.name || "").trim();

  if (!abbreviation || !name) {
    throw new HttpsError(
      "invalid-argument",
      "favoriteTeam requires non-empty teamId, abbreviation, and name"
    );
  }

  const teamId =
    sport === "NHL" ? resolveNhlTeamId(abbreviation, teamIdRaw) : teamIdRaw;

  if (!teamId) {
    throw new HttpsError(
      "invalid-argument",
      "favoriteTeam requires non-empty teamId, abbreviation, and name"
    );
  }

  return { sport, teamId, abbreviation, name };
}

export function parseAutopilotEnabled(raw, { defaultValue = false } = {}) {
  if (raw === undefined || raw === null) return defaultValue;
  if (typeof raw !== "boolean") {
    throw new HttpsError("invalid-argument", "autopilotEnabled must be a boolean");
  }
  return raw;
}
