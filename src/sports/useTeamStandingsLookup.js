import { useEffect, useMemo, useState } from "react";
import { subscribeFirestoreDoc } from "@src/lib/firestoreCompat";
import { lookupTeamByAbbr } from "@src/groups/data/fallbackTeams";

const MLB_AL_ID = "103";
const MLB_NL_ID = "104";

const MLB_ABBR_ALIASES = {
  ARI: ["AZ"],
  AZ: ["ARI"],
  ATH: ["OAK"],
  OAK: ["ATH"],
  CHW: ["CWS"],
  CWS: ["CHW"],
  KC: ["KCR"],
  KCR: ["KC"],
  SD: ["SDP"],
  SDP: ["SD"],
  SF: ["SFG"],
  SFG: ["SF"],
  TB: ["TBR"],
  TBR: ["TB"],
  WSH: ["WSN", "WAS"],
  WSN: ["WSH", "WAS"],
  WAS: ["WSH", "WSN"],
};

function pickStr(v, fallback = "") {
  if (typeof v === "string") return v;
  if (v && typeof v === "object" && typeof v.default === "string") return v.default;
  return fallback;
}

function normalizeAbbr(v) {
  return String(v || "").trim().toUpperCase();
}

function normalizeSport(league) {
  if (!league) return null;
  return String(league).toUpperCase() === "MLB" ? "MLB" : "NHL";
}

function pickAbbrFromMlbTeam(team = {}) {
  return normalizeAbbr(
    team?.abbreviation || team?.teamCode || team?.fileCode || team?.clubName
  );
}

function pickAbbrFromNhlRow(row = {}) {
  return normalizeAbbr(
    row?.teamAbbrev?.default ||
      pickStr(row?.teamAbbrev, "") ||
      row?.teamAbbreviation ||
      row?.team?.abbrev ||
      row?.abbrev
  );
}

function extractMlbTeamRecords(leagueDoc) {
  const divisions = Array.isArray(leagueDoc?.divisions) ? leagueDoc.divisions : [];
  return divisions.flatMap((div) =>
    Array.isArray(div?.teamRecords) ? div.teamRecords : []
  );
}

function parseMlbRecord(row) {
  const abbr = pickAbbrFromMlbTeam(row?.team || {});
  const teamId = row?.team?.id != null ? String(row.team.id) : "";
  if (!abbr && !teamId) return null;

  const wins = Number(row?.wins);
  const losses = Number(row?.losses);
  const pctRaw = String(row?.winningPercentage ?? row?.leagueRecord?.pct ?? "").trim();

  return {
    abbr,
    teamId,
    wins: Number.isFinite(wins) ? wins : null,
    losses: Number.isFinite(losses) ? losses : null,
    pctLabel: formatMlbPctLabel(pctRaw),
  };
}

function formatMlbPctLabel(pctRaw) {
  const raw = String(pctRaw || "").trim();
  if (!raw) return null;
  if (raw.startsWith(".")) return raw;
  if (raw.includes(".")) {
    const n = Number(raw);
    if (Number.isFinite(n) && n > 0 && n < 1) {
      return `.${String(Math.round(n * 1000)).padStart(3, "0")}`;
    }
  }
  const stripped = raw.replace(/^0+/, "");
  return stripped ? `.${stripped}` : ".000";
}

function parseNhlRecord(row) {
  const abbr = pickAbbrFromNhlRow(row);
  if (!abbr) return null;

  const wins = Number(row?.wins);
  const losses = Number(row?.losses);
  const otLosses = Number(row?.otLosses ?? row?.ot ?? row?.overtimeLosses);
  const gp = Number(row?.gamesPlayed ?? row?.gp);
  const pts = Number(row?.points);
  const pointPctg = Number(row?.pointPctg);

  let pctLabel = null;
  if (Number.isFinite(pointPctg) && pointPctg > 0) {
    pctLabel = `${(pointPctg * 100).toFixed(1)}%`;
  } else if (Number.isFinite(gp) && gp > 0 && Number.isFinite(pts)) {
    pctLabel = `${((pts / (gp * 2)) * 100).toFixed(1)}%`;
  }

  return {
    abbr,
    wins: Number.isFinite(wins) ? wins : null,
    losses: Number.isFinite(losses) ? losses : null,
    otLosses: Number.isFinite(otLosses) ? otLosses : 0,
    pctLabel,
  };
}

export function formatTeamStandingsLine(record, league = "NHL") {
  if (!record) return null;

  const lg = String(league || "NHL").toUpperCase();
  const { wins, losses, pctLabel, otLosses } = record;

  if (wins === null || losses === null) return null;

  if (lg === "MLB") {
    return pctLabel ? `${wins}-${losses} · ${pctLabel}` : `${wins}-${losses}`;
  }

  const ot = otLosses ?? 0;
  return pctLabel ? `${wins}-${losses}-${ot} · ${pctLabel}` : `${wins}-${losses}-${ot}`;
}

function formatNhlMatchupSide(team = {}) {
  const wins = Number(team?.wins);
  const losses = Number(team?.losses);
  const otLosses = Number(team?.otLosses);
  const gp = Number(team?.gamesPlayed);
  const pts = Number(team?.points);

  if (!Number.isFinite(wins) || !Number.isFinite(losses)) return null;

  let pctLabel = null;
  if (Number.isFinite(gp) && gp > 0 && Number.isFinite(pts)) {
    pctLabel = `${((pts / (gp * 2)) * 100).toFixed(1)}%`;
  }

  const ot = Number.isFinite(otLosses) ? otLosses : 0;
  return pctLabel ? `${wins}-${losses}-${ot} · ${pctLabel}` : `${wins}-${losses}-${ot}`;
}

function resolveMlbAbbrCandidates(abbr) {
  const base = normalizeAbbr(abbr);
  if (!base) return [];
  const aliases = MLB_ABBR_ALIASES[base] || [];
  return [base, ...aliases];
}

function resolveRecordFromMaps({ sport, abbr, byAbbr, byTeamId }) {
  if (!abbr) return null;

  for (const candidate of resolveMlbAbbrCandidates(abbr)) {
    if (byAbbr[candidate]) return byAbbr[candidate];
  }

  if (sport === "MLB") {
    const team = lookupTeamByAbbr("MLB", abbr);
    if (team?.teamId && byTeamId[String(team.teamId)]) {
      return byTeamId[String(team.teamId)];
    }
  }

  return null;
}

export function useTeamStandingsLookup(league) {
  const sport = normalizeSport(league);
  const [byAbbr, setByAbbr] = useState({});
  const [byTeamId, setByTeamId] = useState({});

  useEffect(() => {
    if (!sport) {
      setByAbbr({});
      setByTeamId({});
      return undefined;
    }

    const unsubs = [];

    if (sport === "NHL") {
      const unsub = subscribeFirestoreDoc(
        "nhl_standings/current",
        ({ data }) => {
          const rows = Array.isArray(data?.standings) ? data.standings : [];
          const next = {};

          for (const row of rows) {
            const parsed = parseNhlRecord(row);
            if (parsed?.abbr) next[parsed.abbr] = parsed;
          }

          setByAbbr(next);
          setByTeamId({});
        },
        () => {
          setByAbbr({});
          setByTeamId({});
        }
      );
      unsubs.push(unsub);
    } else {
      let leagueUnsubs = [];

      const seasonUnsub = subscribeFirestoreDoc(
        "mlb_standings/current",
        ({ data }) => {
          leagueUnsubs.forEach((u) => {
            try {
              u();
            } catch {}
          });
          leagueUnsubs = [];

          const season = String(data?.season || "").trim();
          if (!season) {
            setByAbbr({});
            setByTeamId({});
            return;
          }

          let alRows = [];
          let nlRows = [];

          const merge = () => {
            const nextAbbr = {};
            const nextTeamId = {};

            for (const row of [...alRows, ...nlRows]) {
              const parsed = parseMlbRecord(row);
              if (!parsed) continue;
              if (parsed.abbr) nextAbbr[parsed.abbr] = parsed;
              if (parsed.teamId) nextTeamId[parsed.teamId] = parsed;
            }

            setByAbbr(nextAbbr);
            setByTeamId(nextTeamId);
          };

          const alUnsub = subscribeFirestoreDoc(
            `mlb_standings/${season}/leagues/${MLB_AL_ID}`,
            ({ data: leagueData }) => {
              alRows = extractMlbTeamRecords(leagueData);
              merge();
            },
            () => {
              alRows = [];
              merge();
            }
          );

          const nlUnsub = subscribeFirestoreDoc(
            `mlb_standings/${season}/leagues/${MLB_NL_ID}`,
            ({ data: leagueData }) => {
              nlRows = extractMlbTeamRecords(leagueData);
              merge();
            },
            () => {
              nlRows = [];
              merge();
            }
          );

          leagueUnsubs.push(alUnsub, nlUnsub);
        },
        () => {
          setByAbbr({});
          setByTeamId({});
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
      unsubs.forEach((u) => {
        try {
          u();
        } catch {}
      });
    };
  }, [sport]);

  const getRecord = useMemo(
    () => (abbr) =>
      sport
        ? resolveRecordFromMaps({ sport, abbr, byAbbr, byTeamId })
        : null,
    [byAbbr, byTeamId, sport]
  );

  const formatLine = useMemo(
    () => (abbr) => formatTeamStandingsLine(getRecord(abbr), sport),
    [getRecord, sport]
  );

  return { getRecord, formatLine, byAbbr, byTeamId };
}

function useMlbScheduleTeamIds({ gameYmd, games, league }) {
  const sport = normalizeSport(league);
  const [byGameId, setByGameId] = useState({});

  useEffect(() => {
    if (sport !== "MLB") {
      setByGameId({});
      return undefined;
    }

    const ymd = String(gameYmd || "").trim();
    const slots = Array.isArray(games) ? games : [];
    if (!ymd || !slots.length) {
      setByGameId({});
      return undefined;
    }

    const unsubs = slots
      .map((slot) => {
        const gameId = String(slot?.gameId || "");
        if (!gameId) return null;

        return subscribeFirestoreDoc(
          `mlb_schedule_daily/${ymd}/games/${gameId}`,
          ({ data }) => {
            const awayTeamId =
              data?.awayTeam?.id != null ? String(data.awayTeam.id) : "";
            const homeTeamId =
              data?.homeTeam?.id != null ? String(data.homeTeam.id) : "";

            if (!awayTeamId && !homeTeamId) return;

            setByGameId((prev) => ({
              ...prev,
              [gameId]: { awayTeamId, homeTeamId },
            }));
          },
          () => {
            setByGameId((prev) => {
              if (!prev[gameId]) return prev;
              const next = { ...prev };
              delete next[gameId];
              return next;
            });
          }
        );
      })
      .filter(Boolean);

    return () => {
      unsubs.forEach((u) => {
        try {
          u();
        } catch {}
      });
    };
  }, [sport, gameYmd, games]);

  return byGameId;
}

export function useTpMatchupTeamRecords({ gameYmd, games, league }) {
  const sport = normalizeSport(league);
  const [byGameId, setByGameId] = useState({});

  useEffect(() => {
    if (sport !== "NHL") {
      setByGameId({});
      return undefined;
    }

    const ymd = String(gameYmd || "").trim();
    const slots = Array.isArray(games) ? games : [];
    if (!ymd || !slots.length) {
      setByGameId({});
      return undefined;
    }

    const unsubs = slots.map((slot) => {
      const gameId = String(slot?.gameId || "");
      if (!gameId) return null;

      return subscribeFirestoreDoc(
        `nhl_matchups_daily/${ymd}/games/${gameId}`,
        ({ data }) => {
          const awayLine = formatNhlMatchupSide(data?.away);
          const homeLine = formatNhlMatchupSide(data?.home);

          if (!awayLine && !homeLine) return;

          setByGameId((prev) => ({
            ...prev,
            [gameId]: {
              away: awayLine,
              home: homeLine,
            },
          }));
        },
        () => {
          setByGameId((prev) => {
            if (!prev[gameId]) return prev;
            const next = { ...prev };
            delete next[gameId];
            return next;
          });
        }
      );
    }).filter(Boolean);

    return () => {
      unsubs.forEach((u) => {
        try {
          u();
        } catch {}
      });
    };
  }, [sport, gameYmd, games]);

  const getLine = useMemo(
    () => (gameId, side) => {
      const entry = byGameId[String(gameId || "")];
      if (!entry) return null;
      return side === "home" ? entry.home : entry.away;
    },
    [byGameId]
  );

  return { getLine, byGameId };
}

export function useTpBundleTeamRecords({ bundle, games, league }) {
  const sport = normalizeSport(league);
  const { formatLine: formatStandingsLine, byTeamId } = useTeamStandingsLookup(sport);
  const { getLine: getMatchupLine } = useTpMatchupTeamRecords({
    gameYmd: bundle?.gameYmd,
    games,
    league: sport,
  });
  const mlbTeamIdsByGame = useMlbScheduleTeamIds({
    gameYmd: bundle?.gameYmd,
    games,
    league: sport,
  });

  const formatLine = useMemo(
    () => (gameId, side, abbr) => {
      if (sport === "NHL") {
        const matchupLine = getMatchupLine(gameId, side);
        if (matchupLine) return matchupLine;
      }

      if (sport === "MLB") {
        const ids = mlbTeamIdsByGame[String(gameId || "")];
        const teamId =
          side === "home" ? ids?.homeTeamId : ids?.awayTeamId;
        if (teamId && byTeamId[teamId]) {
          return formatTeamStandingsLine(byTeamId[teamId], "MLB");
        }
      }

      return formatStandingsLine(abbr);
    },
    [sport, getMatchupLine, formatStandingsLine, mlbTeamIdsByGame, byTeamId]
  );

  return { formatLine };
}
