import { useEffect, useMemo, useState } from "react";
import firestore from "@react-native-firebase/firestore";
import {
  buildLeaderboard,
  emptyLiveStats,
  normPlayerId,
  normalizeLiveStatsDoc,
  resolveTsSport,
} from "./tsResultsUtils";

function normalizeParticipation(docSnap) {
  const v = docSnap.data() || {};
  return {
    uid: docSnap.id,
    livePoints: Number(v.livePoints ?? v.finalPoints ?? 0),
    finalPoints: Number(v.finalPoints ?? v.livePoints ?? 0),
    payout: Number(v.payout ?? 0),
    bonus: Number(v.bonus ?? 0),
    picks: Array.isArray(v.picks) ? v.picks : [],
    updatedAt: v.liveUpdatedAt || v.updatedAt || null,
    _raw: v,
  };
}

export default function useTsLiveResults(defiId, { sport: sportHint, enabled = true } = {}) {
  const [loading, setLoading] = useState(true);
  const [participations, setParticipations] = useState([]);
  const [liveStats, setLiveStats] = useState(emptyLiveStats);
  const [playerMap, setPlayerMap] = useState({});
  const [namesMap, setNamesMap] = useState({});
  const [participantInfoMap, setParticipantInfoMap] = useState({});

  const id = String(defiId || "").trim();
  const enabledOk = enabled && !!id;

  useEffect(() => {
    if (!enabledOk) {
      setLoading(false);
      setParticipations([]);
      setLiveStats(emptyLiveStats());
      return;
    }

    setLoading(true);
    const colRef = firestore().collection(`defis/${id}/participations`);
    const un = colRef.onSnapshot(
      (snap) => {
        const next = [];
        snap.forEach((docSnap) => next.push(normalizeParticipation(docSnap)));
        setParticipations(next);
        setLoading(false);
      },
      () => {
        setParticipations([]);
        setLoading(false);
      }
    );

    return () => un();
  }, [enabledOk, id]);

  useEffect(() => {
    if (!enabledOk) return;

    const ref = firestore().doc(`defis/${id}/live/stats`);
    const un = ref.onSnapshot((snap) => {
      setLiveStats(snap.exists ? normalizeLiveStatsDoc(snap.data() || {}) : emptyLiveStats());
    });

    return () => un();
  }, [enabledOk, id]);

  useEffect(() => {
    if (!enabledOk) return;

    const un = firestore()
      .collection(`defis/${id}/playerPool`)
      .onSnapshot((snap) => {
        const next = {};
        snap.forEach((docSnap) => {
          const v = docSnap.data() || {};
          const pid = normPlayerId(v?.playerId ?? docSnap.id);
          if (!pid) return;
          next[pid] = {
            fullName: v.fullName || v.skaterFullName || "—",
            teamAbbr: v.teamAbbr || "",
          };
        });
        setPlayerMap(next);
      });

    return () => un();
  }, [enabledOk, id]);

  const leaderboard = useMemo(() => buildLeaderboard(participations), [participations]);

  const neededUids = useMemo(
    () => Array.from(new Set(participations.map((p) => p.uid).filter(Boolean))),
    [participations]
  );

  useEffect(() => {
    if (!enabledOk || neededUids.length === 0) return;

    const unsubs = neededUids.map((uid) =>
      firestore()
        .doc(`profiles_public/${uid}`)
        .onSnapshot(
          (snap) => {
            const v = snap.exists ? snap.data() || {} : {};
            const name =
              v.displayName || v.name || v.username || v.email || uid;
            const photoURL = v.avatarUrl || v.photoURL || null;

            setNamesMap((prev) => (prev[uid] === name ? prev : { ...prev, [uid]: name }));
            setParticipantInfoMap((prev) => {
              const old = prev[uid] || {};
              if (old.photoURL === photoURL) return prev;
              return { ...prev, [uid]: { ...old, photoURL } };
            });
          },
          () => {}
        )
    );

    return () => {
      unsubs.forEach((u) => {
        try {
          u?.();
        } catch {}
      });
    };
  }, [enabledOk, neededUids.join(",")]);

  const sport = resolveTsSport({ sport: sportHint, poolSport: sportHint }, sportHint || "NHL");
  const isMlbTs = sport === "MLB";

  return {
    loading,
    participations,
    leaderboard,
    liveStats,
    playerMap,
    namesMap,
    participantInfoMap,
    isMlbTs,
    sport,
  };
}
