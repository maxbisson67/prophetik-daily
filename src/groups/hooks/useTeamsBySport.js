import { useEffect, useMemo, useState } from "react";
import { subscribeFirestoreDoc } from "@src/lib/firestoreCompat";
import { getFallbackTeams } from "@src/groups/data/fallbackTeams";
import { resolveNhlTeamId } from "@src/nhl/nhlTeamIds";

const MLB_AL_ID = "103";
const MLB_NL_ID = "104";

function pickStr(v, fallback = "") {
  if (typeof v === "string") return v;
  if (v && typeof v === "object" && typeof v.default === "string") return v.default;
  return fallback;
}

export function normalizeConfigSport(value) {
  const sport = String(value || "").trim().toUpperCase();
  if (sport === "NHL") return "NHL";
  if (sport === "MLB") return "MLB";
  return null;
}

export function normalizeNhlStandingRow(row) {
  const abbr = pickStr(row?.teamAbbrev, "");
  if (!abbr) return null;
  const name =
    pickStr(row?.teamName, "") ||
    pickStr(row?.teamCommonName, "") ||
    abbr;
  const teamId = resolveNhlTeamId(abbr, row?.teamId != null ? String(row.teamId) : "");
  return { sport: "NHL", teamId, abbreviation: abbr, name };
}

export function normalizeMlbTeamRecord(row) {
  const team = row?.team || {};
  const teamId = team?.id != null ? String(team.id) : "";
  const abbreviation = pickStr(
    team?.abbreviation || team?.teamCode || team?.fileCode || team?.clubName,
    ""
  );
  const name = pickStr(team?.name, abbreviation);
  if (!teamId || !abbreviation || !name) return null;
  const logo = pickStr(team?.logo, "") || `https://www.mlbstatic.com/team-logos/${teamId}.svg`;
  return { sport: "MLB", teamId, abbreviation, name, logo };
}

function extractMlbTeamRecords(leagueDoc) {
  const divisions = Array.isArray(leagueDoc?.divisions) ? leagueDoc.divisions : [];
  return divisions.flatMap((div) =>
    Array.isArray(div?.teamRecords) ? div.teamRecords : []
  );
}

function sortTeams(teams) {
  return [...teams].sort((a, b) => a.abbreviation.localeCompare(b.abbreviation));
}

function dedupeTeams(teams) {
  const seen = new Map();
  for (const team of teams) {
    const key = `${team.sport}:${team.teamId}`;
    if (!seen.has(key)) seen.set(key, team);
  }
  return sortTeams([...seen.values()]);
}

const LOG_PREFIX = "[useTeamsBySport]";

function logTeamsDebug(message, payload = {}) {
  if (!__DEV__) return;
  console.log(LOG_PREFIX, message, payload);
}

export function useTeamsBySport(sport) {
  const normalizedSport = normalizeConfigSport(sport);
  const [liveTeams, setLiveTeams] = useState([]);
  const [loading, setLoading] = useState(!!normalizedSport);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!normalizedSport) {
      setLiveTeams([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    setLiveTeams([]);
    logTeamsDebug("subscribe", { sport: normalizedSport });
    const unsubs = [];

    if (normalizedSport === "NHL") {
      const unsub = subscribeFirestoreDoc(
        "nhl_standings/current",
        ({ exists, data }) => {
          const rows = Array.isArray(data?.standings) ? data.standings : [];
          const parsed = dedupeTeams(rows.map(normalizeNhlStandingRow).filter(Boolean));
          logTeamsDebug("nhl_standings/current snapshot", {
            exists,
            rawRows: rows.length,
            parsedTeams: parsed.length,
            sample: parsed.slice(0, 3).map((t) => t.abbreviation),
            source: data?.source || null,
          });
          setLiveTeams(parsed);
          setLoading(false);
        },
        (err) => {
          logTeamsDebug("nhl_standings/current error", {
            message: err?.message || String(err),
          });
          setError(err);
          setLiveTeams([]);
          setLoading(false);
        }
      );
      unsubs.push(unsub);
    } else {
      let leagueUnsubs = [];

      const seasonUnsub = subscribeFirestoreDoc(
        "mlb_standings/current",
        ({ exists, data }) => {
          leagueUnsubs.forEach((u) => {
            try {
              u();
            } catch {}
          });
          leagueUnsubs = [];

          const season = String(data?.season || "");
          logTeamsDebug("mlb_standings/current snapshot", {
            exists,
            season: season || null,
            source: data?.source || null,
          });
          if (!season) {
            logTeamsDebug("mlb season missing — no league docs subscribed");
            setLiveTeams([]);
            setLoading(false);
            return;
          }

          let alRows = [];
          let nlRows = [];

          const mergeLeagues = () => {
            const combined = [...alRows, ...nlRows];
            const parsed = dedupeTeams(combined.map(normalizeMlbTeamRecord).filter(Boolean));
            logTeamsDebug("mlb leagues merged", {
              season,
              alRawRows: alRows.length,
              nlRawRows: nlRows.length,
              parsedTeams: parsed.length,
              sample: parsed.slice(0, 3).map((t) => t.abbreviation),
            });
            setLiveTeams(parsed);
            setLoading(false);
          };

          const alUnsub = subscribeFirestoreDoc(
            `mlb_standings/${season}/leagues/${MLB_AL_ID}`,
            ({ data: leagueData }) => {
              alRows = extractMlbTeamRecords(leagueData);
              mergeLeagues();
            },
            (err) => {
              logTeamsDebug("mlb AL league error", {
                season,
                message: err?.message || String(err),
              });
              setError(err);
              alRows = [];
              mergeLeagues();
            }
          );

          const nlUnsub = subscribeFirestoreDoc(
            `mlb_standings/${season}/leagues/${MLB_NL_ID}`,
            ({ data: leagueData }) => {
              nlRows = extractMlbTeamRecords(leagueData);
              mergeLeagues();
            },
            (err) => {
              logTeamsDebug("mlb NL league error", {
                season,
                message: err?.message || String(err),
              });
              setError(err);
              nlRows = [];
              mergeLeagues();
            }
          );

          leagueUnsubs.push(alUnsub, nlUnsub);
        },
        (err) => {
          logTeamsDebug("mlb_standings/current error", {
            message: err?.message || String(err),
          });
          setError(err);
          setLiveTeams([]);
          setLoading(false);
        }
      );

      unsubs.push(seasonUnsub);
      unsubs.push(() => {
        leagueUnsubs.forEach((u) => {
          try {
            u();
          } catch {}
        });
      });
    }

    return () => {
      unsubs.forEach((unsub) => {
        try {
          unsub();
        } catch {}
      });
    };
  }, [normalizedSport]);

  const teams = useMemo(() => {
    if (liveTeams.length) return liveTeams;
    return getFallbackTeams(normalizedSport);
  }, [liveTeams, normalizedSport]);

  const usingFallback = !loading && liveTeams.length === 0;

  useEffect(() => {
    if (!normalizedSport) return;
    logTeamsDebug("state", {
      sport: normalizedSport,
      loading,
      liveTeams: liveTeams.length,
      displayTeams: teams.length,
      usingFallback,
      hasError: !!error,
      error: error?.message || null,
    });
  }, [normalizedSport, loading, liveTeams.length, teams.length, usingFallback, error]);

  return { teams, loading, error, sport: normalizedSport, usingFallback };
}
