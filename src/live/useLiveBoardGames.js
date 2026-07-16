import { useEffect, useRef, useState } from "react";
import { snapshotExists, snapshotData, snapshotId } from "@src/lib/safeSnapshot";
import firestore from "@react-native-firebase/firestore";
import { mapMlbScheduleGameToLiveGame } from "@src/mlb/mapMlbScheduleToLiveGame";
import { fetchMlbScheduleGamesForYmd } from "@src/mlb/fetchMlbScheduleFromApi";
import { isMlbGameDelayed } from "@src/mlb/mlbGameStatusUtils";

function normalizeBoardGame(row = {}, league = "nhl") {
  const id = String(row.id || row.gameId || row.gamePk || "");
  return {
    ...row,
    id,
    gameId: row.gameId || id,
    gamePk: row.gamePk || id,
    league,
  };
}

function gameMergeKey(row = {}) {
  return String(row.gamePk || row.gameId || row.id || "").trim();
}

function isMlbRowLive(row = {}) {
  if (row?.isPostponed) return false;
  if (row?.isLive) return true;
  return String(row?.abstractGameState || "").toLowerCase() === "live";
}

function isMlbRowFinal(row = {}) {
  if (row?.isPostponed) return false;
  if (isMlbRowLive(row)) return false;
  if (row?.isFinal) return true;
  return String(row?.abstractGameState || "").toLowerCase() === "final";
}

function pickMlbFeedRow(rows = []) {
  return (
    rows.find((r) => isMlbRowLive(r) && !isMlbGameDelayed(r)) ||
    rows.find(isMlbRowLive) ||
    rows.find((r) => isMlbGameDelayed(r)) ||
    rows.find((r) => r?.balls != null || r?.strikes != null || r?.outs != null) ||
    rows[rows.length - 1] ||
    null
  );
}

function mergeMlbGameRows(schedule, legacy, board) {
  const rows = [schedule, legacy, board].filter(Boolean);
  if (!rows.length) return null;

  const key = gameMergeKey(schedule || legacy || board);
  if (!key) return null;

  const meta = schedule || legacy || board;
  const feed = pickMlbFeedRow([board, legacy, schedule].filter(Boolean)) || meta;
  const live = rows.some(isMlbRowLive);
  const fin = !live && rows.some(isMlbRowFinal);

  return {
    ...meta,
    ...feed,
    id: key,
    gamePk: key,
    awayAbbr: feed?.awayAbbr || meta?.awayAbbr || null,
    homeAbbr: feed?.homeAbbr || meta?.homeAbbr || null,
    awayScore: feed?.awayScore ?? meta?.awayScore ?? null,
    homeScore: feed?.homeScore ?? meta?.homeScore ?? null,
    isLive: live,
    isFinal: fin,
    isPostponed: rows.some((r) => r?.isPostponed),
    currentInning: feed?.currentInning ?? meta?.currentInning ?? null,
    currentInningOrdinal: feed?.currentInningOrdinal || meta?.currentInningOrdinal || "",
    inningState: feed?.inningState || meta?.inningState || "",
    inningHalf: feed?.inningHalf || meta?.inningHalf || "",
    abstractGameState: live ? "Live" : fin ? "Final" : meta?.abstractGameState || feed?.abstractGameState || "",
    detailedState: feed?.detailedState || meta?.detailedState || "",
    startTimeUTC: meta?.startTimeUTC || feed?.startTimeUTC || null,
    venue: meta?.venue || feed?.venue || null,
    balls: feed?.balls ?? meta?.balls ?? null,
    strikes: feed?.strikes ?? meta?.strikes ?? null,
    outs: feed?.outs ?? meta?.outs ?? null,
    onFirst: feed?.onFirst ?? meta?.onFirst ?? false,
    onSecond: feed?.onSecond ?? meta?.onSecond ?? false,
    onThird: feed?.onThird ?? meta?.onThird ?? false,
    runnersOnBase: feed?.runnersOnBase ?? meta?.runnersOnBase ?? null,
  };
}

function mergeScheduleAndApi(firestoreRows = [], apiRows = []) {
  const byKey = new Map();

  for (const row of apiRows) {
    const key = gameMergeKey(row);
    if (key) byKey.set(key, row);
  }

  for (const row of firestoreRows) {
    const key = gameMergeKey(row);
    if (!key) continue;
    const api = byKey.get(key);
    if (!api) {
      byKey.set(key, row);
      continue;
    }
    byKey.set(key, mergeMlbGameRows(row, api, null) || row);
  }

  return [...byKey.values()];
}

/** Unionne calendrier + legacy + board (priorité live au statut, feed pour la situation). */
function mergeMlbLiveGameSources(boardRows = [], legacyRows = [], scheduleRows = []) {
  const keys = new Set();

  for (const list of [scheduleRows, legacyRows, boardRows]) {
    for (const row of list || []) {
      const key = gameMergeKey(row);
      if (key) keys.add(key);
    }
  }

  const merged = [];
  for (const key of keys) {
    const schedule = (scheduleRows || []).find((r) => gameMergeKey(r) === key);
    const legacyMatches = (legacyRows || []).filter((r) => gameMergeKey(r) === key);
    const legacy = legacyMatches.length
      ? legacyMatches.reduce((acc, row) => mergeMlbGameRows(acc, row, null) || acc, legacyMatches[0])
      : null;
    const board = (boardRows || []).find((r) => gameMergeKey(r) === key);
    const row = mergeMlbGameRows(schedule, legacy, board);
    if (row) merged.push(row);
  }

  return merged;
}

const MLB_API_POLL_MS = 30_000;

/**
 * L2 — Liste Match Live via live_board_{nhl|mlb}/{ymd}, fallback query legacy.
 * MLB: fallback API statsapi + docs mlb_live_games/{gamePk} individuels.
 */
export default function useLiveBoardGames({ league = "nhl", ymd, enabled = true }) {
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [usingBoard, setUsingBoard] = useState(false);

  const legacyUnsubRef = useRef(null);
  const scheduleUnsubRef = useRef(null);
  const perGameUnsubsRef = useRef([]);
  const subscribedLivePksRef = useRef("");

  useEffect(() => {
    if (!enabled || !ymd) {
      setGames([]);
      setLoading(false);
      setUsingBoard(false);
      return;
    }

    const lg = String(league || "nhl").toLowerCase();
    const boardCol = lg === "mlb" ? "live_board_mlb" : "live_board_nhl";
    const legacyCol = lg === "mlb" ? "mlb_live_games" : "nhl_live_games";
    const ymdCompact = String(ymd).replace(/-/g, "");

    setLoading(true);

    let boardRows = [];
    let legacyRows = [];
    let scheduleRows = null;
    let apiRows = [];
    let perGameRows = [];
    let apiAttempted = false;

    const stopLegacy = () => {
      try {
        legacyUnsubRef.current?.();
      } catch {}
      legacyUnsubRef.current = null;
    };

    const stopSchedule = () => {
      try {
        scheduleUnsubRef.current?.();
      } catch {}
      scheduleUnsubRef.current = null;
    };

    const stopPerGame = () => {
      for (const unsub of perGameUnsubsRef.current) {
        try {
          unsub?.();
        } catch {}
      }
      perGameUnsubsRef.current = [];
    };

    const resubscribePerGameLiveDocs = (pks = []) => {
      stopPerGame();
      perGameRows = [];

      const unique = [...new Set(pks.map((pk) => String(pk || "").trim()).filter(Boolean))];
      if (!unique.length) {
        apply();
        return;
      }

      for (const pk of unique) {
        const unsub = firestore()
          .collection("mlb_live_games")
          .doc(pk)
          .onSnapshot(
            (snap) => {
              perGameRows = perGameRows.filter((r) => gameMergeKey(r) !== pk);
              if (snapshotExists(snap)) {
                perGameRows.push({ id: snapshotId(snap), gamePk: snapshotId(snap), ...snapshotData(snap) });
              }
              apply();
            },
            () => apply()
          );
        perGameUnsubsRef.current.push(unsub);
      }
    };

    const apply = () => {
      if (lg === "mlb") {
        const fsSchedule = Array.isArray(scheduleRows) ? scheduleRows : [];
        const effectiveSchedule = mergeScheduleAndApi(fsSchedule, apiRows);
        const allLegacy = [...legacyRows, ...perGameRows];
        const merged = mergeMlbLiveGameSources(boardRows, allLegacy, effectiveSchedule);

        const livePks = [...new Set(effectiveSchedule.filter(isMlbRowLive).map((g) => gameMergeKey(g)).filter(Boolean))];
        const livePksKey = livePks.join(",");
        if (livePksKey !== subscribedLivePksRef.current) {
          subscribedLivePksRef.current = livePksKey;
          resubscribePerGameLiveDocs(livePks);
        }

        setGames(merged.map((r) => normalizeBoardGame(r, lg)));
        setUsingBoard(boardRows.length > 0);
        setLoading(lg === "mlb" && !apiAttempted && merged.length === 0);
        return;
      }

      if (boardRows.length) {
        stopLegacy();
        stopSchedule();
        setGames(boardRows.map((r) => normalizeBoardGame(r, lg)));
        setUsingBoard(true);
      } else if (legacyRows.length) {
        stopSchedule();
        setGames(legacyRows.map((r) => normalizeBoardGame(r, lg)));
        setUsingBoard(false);
      } else if (Array.isArray(scheduleRows) && scheduleRows.length) {
        setGames(scheduleRows.map((r) => normalizeBoardGame(r, lg)));
        setUsingBoard(false);
      } else {
        setGames([]);
        setUsingBoard(false);
      }
      setLoading(false);
    };

    const startSchedule = () => {
      if (scheduleUnsubRef.current || lg !== "mlb" || !ymdCompact) return;

      scheduleUnsubRef.current = firestore()
        .collection("mlb_schedule_daily")
        .doc(ymdCompact)
        .collection("games")
        .onSnapshot(
          (snap) => {
            scheduleRows = (snap?.docs ?? []).map((d) =>
              mapMlbScheduleGameToLiveGame({ ...d.data(), gamePk: d.id }, String(ymd))
            );
            apply();
          },
          (err) => {
            console.log("[useLiveBoardGames] schedule error", lg, err?.message || err);
            scheduleRows = [];
            apply();
          }
        );
    };

    const startLegacy = () => {
      if (legacyUnsubRef.current) return;

      legacyUnsubRef.current = firestore()
        .collection(legacyCol)
        .where("ymd", "==", String(ymd))
        .onSnapshot(
          (snap) => {
            legacyRows = (snap?.docs ?? []).map((d) => ({ id: d.id, ...d.data() }));
            apply();
          },
          (err) => {
            console.log("[useLiveBoardGames] legacy error", lg, err?.message || err);
            legacyRows = [];
            apply();
          }
        );
    };

    let apiPollCancelled = false;

    const pollMlbApi = async () => {
      if (lg !== "mlb") return;
      try {
        const rows = await fetchMlbScheduleGamesForYmd(ymd);
        if (!apiPollCancelled) {
          apiRows = rows;
        }
      } catch (err) {
        console.log("[useLiveBoardGames] MLB API fallback error", err?.message || err);
      } finally {
        if (!apiPollCancelled) {
          apiAttempted = true;
          apply();
        }
      }
    };

    const unsubBoard = firestore()
      .collection(boardCol)
      .doc(String(ymd))
      .onSnapshot(
        (snap) => {
          boardRows = snapshotExists(snap) ? snapshotData(snap)?.games || [] : [];
          apply();
        },
        (err) => {
          console.log("[useLiveBoardGames] board error", lg, err?.message || err);
          boardRows = [];
          apply();
        }
      );

    startLegacy();
    if (lg === "mlb") {
      startSchedule();
      pollMlbApi();
    }

    const apiInterval =
      lg === "mlb" ? setInterval(pollMlbApi, MLB_API_POLL_MS) : null;

    return () => {
      apiPollCancelled = true;
      subscribedLivePksRef.current = "";
      if (apiInterval) clearInterval(apiInterval);
      try {
        unsubBoard?.();
      } catch {}
      stopLegacy();
      stopSchedule();
      stopPerGame();
    };
  }, [league, ymd, enabled]);

  return { games, loading, usingBoard };
}
