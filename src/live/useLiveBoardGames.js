import { useEffect, useRef, useState } from "react";
import firestore from "@react-native-firebase/firestore";
import { mapMlbScheduleGameToLiveGame } from "@src/mlb/mapMlbScheduleToLiveGame";

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

/**
 * L2 — Liste Match Live via live_board_{nhl|mlb}/{ymd}, fallback query legacy.
 */
export default function useLiveBoardGames({ league = "nhl", ymd, enabled = true }) {
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [usingBoard, setUsingBoard] = useState(false);

  const legacyUnsubRef = useRef(null);
  const scheduleUnsubRef = useRef(null);

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

    let boardRows = null;
    let legacyRows = null;
    let scheduleRows = null;

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

    const startSchedule = () => {
      if (scheduleUnsubRef.current || lg !== "mlb" || !ymdCompact) return;

      scheduleUnsubRef.current = firestore()
        .collection("mlb_schedule_daily")
        .doc(ymdCompact)
        .collection("games")
        .onSnapshot(
          (snap) => {
            scheduleRows = snap.docs.map((d) =>
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
            legacyRows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
            apply();
          },
          (err) => {
            console.log("[useLiveBoardGames] legacy error", lg, err?.message || err);
            legacyRows = [];
            apply();
          }
        );
    };

    const apply = () => {
      if (Array.isArray(boardRows) && boardRows.length) {
        stopLegacy();
        stopSchedule();
        setGames(boardRows.map((r) => normalizeBoardGame(r, lg)));
        setUsingBoard(true);
      } else if (Array.isArray(legacyRows) && legacyRows.length) {
        stopSchedule();
        setGames(legacyRows.map((r) => normalizeBoardGame(r, lg)));
        setUsingBoard(false);
      } else if (Array.isArray(scheduleRows) && scheduleRows.length) {
        setGames(scheduleRows.map((r) => normalizeBoardGame(r, lg)));
        setUsingBoard(false);
      } else if (boardRows !== null && legacyRows !== null) {
        if (lg === "mlb" && scheduleRows === null) {
          startSchedule();
          return;
        }
        setGames([]);
        setUsingBoard(false);
      } else {
        setGames([]);
        setUsingBoard(false);
      }
      setLoading(false);
    };

    const unsubBoard = firestore()
      .collection(boardCol)
      .doc(String(ymd))
      .onSnapshot(
        (snap) => {
          boardRows = snap.exists ? snap.data()?.games || [] : [];
          if (boardRows.length) {
            apply();
          } else {
            startLegacy();
            apply();
          }
        },
        (err) => {
          console.log("[useLiveBoardGames] board error", lg, err?.message || err);
          boardRows = [];
          startLegacy();
          apply();
        }
      );

    startLegacy();

    return () => {
      try {
        unsubBoard?.();
      } catch {}
      stopLegacy();
      stopSchedule();
    };
  }, [league, ymd, enabled]);

  return { games, loading, usingBoard };
}
