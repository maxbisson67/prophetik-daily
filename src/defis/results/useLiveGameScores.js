import { useEffect, useState } from "react";
import firestore from "@react-native-firebase/firestore";

function normalizeYmdCompact(v) {
  const s = String(v || "").trim();
  if (/^\d{8}$/.test(s)) return s;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s.replaceAll("-", "");
  return "";
}

function normalizeNhlLiveGame(data) {
  if (!data) return null;

  const awayScore = data.awayScore;
  const homeScore = data.homeScore;

  return {
    id: String(data.id || data.gameId || ""),
    awayScore: awayScore != null ? Number(awayScore) : null,
    homeScore: homeScore != null ? Number(homeScore) : null,
    statusText: buildNhlStatusText(data),
    isLive: !!data.isLive,
    isFinal: !!data.isFinal,
  };
}

function buildNhlStatusText(game) {
  if (game?.isFinal) return null;

  const period = game?.period;
  const pt = String(game?.periodType || "").toUpperCase();

  if (pt === "OT" || period === 4) return "Prolongation";
  if (pt === "SO" || period === 5) return "TB";
  if (period != null) return `P${period}`;

  const state = String(game?.state || "").trim();
  return state || null;
}

/** Aligne un doc `mlb_schedule_daily/{ymd}/games/{gamePk}` sur le format live TP. */
export function normalizeMlbScheduleGameForLive(data) {
  if (!data) return null;

  const away = data.awayTeam || data.away || {};
  const home = data.homeTeam || data.home || {};

  const awayScoreRaw = away.score;
  const homeScoreRaw = home.score;
  const hasAway = awayScoreRaw !== undefined && awayScoreRaw !== null;
  const hasHome = homeScoreRaw !== undefined && homeScoreRaw !== null;

  const abstractState = String(data?.status?.abstractGameState || "").toLowerCase();

  let statusText = null;
  if (abstractState === "live") {
    statusText =
      [data.inningState, data.currentInningOrdinal || (data.currentInning > 0 ? String(data.currentInning) : "")]
        .filter(Boolean)
        .join(" ") || "Live";
  } else if (abstractState === "final") {
    statusText = data?.status?.detailedState || "Final";
  }

  return {
    id: String(data.gamePk || data.id || ""),
    awayScore: hasAway ? Number(awayScoreRaw) : null,
    homeScore: hasHome ? Number(homeScoreRaw) : null,
    statusText,
    isLive: abstractState === "live",
    isFinal: abstractState === "final",
  };
}

export default function useLiveGameScores(gameIds, league, gameYmd = null) {
  const [map, setMap] = useState({});

  useEffect(() => {
    const lg = String(league || "NHL").toUpperCase();
    const ids = Array.from(new Set((gameIds || []).map(String).filter(Boolean)));

    if (!ids.length) {
      setMap({});
      return undefined;
    }

    if (lg === "NHL") {
      const unsubs = ids.map((gameId) =>
        firestore()
          .collection("nhl_live_games")
          .doc(gameId)
          .onSnapshot(
            (snap) => {
              setMap((prev) => ({
                ...prev,
                [gameId]: snap.exists
                  ? normalizeNhlLiveGame({ id: snap.id, ...snap.data() })
                  : null,
              }));
            },
            () => {
              setMap((prev) => {
                const next = { ...prev };
                delete next[gameId];
                return next;
              });
            }
          )
      );

      return () => {
        unsubs.forEach((un) => {
          try {
            un?.();
          } catch {}
        });
      };
    }

    if (lg === "MLB") {
      const ymd = normalizeYmdCompact(gameYmd);
      if (!ymd) {
        setMap({});
        return undefined;
      }

      const unsubs = ids.map((gameId) =>
        firestore()
          .collection("mlb_schedule_daily")
          .doc(ymd)
          .collection("games")
          .doc(gameId)
          .onSnapshot(
            (snap) => {
              setMap((prev) => ({
                ...prev,
                [gameId]: snap.exists
                  ? normalizeMlbScheduleGameForLive({ id: snap.id, ...snap.data() })
                  : null,
              }));
            },
            () => {
              setMap((prev) => {
                const next = { ...prev };
                delete next[gameId];
                return next;
              });
            }
          )
      );

      return () => {
        unsubs.forEach((un) => {
          try {
            un?.();
          } catch {}
        });
      };
    }

    setMap({});
    return undefined;
  }, [league, gameYmd, JSON.stringify(gameIds || [])]);

  return map;
}
