import { useEffect, useMemo, useState } from "react";
import firestore from "@react-native-firebase/firestore";
import useLeaderboardProfiles, {
  resolveLeaderboardMember,
} from "@src/leaderboard/useLeaderboardProfiles";
import {
  buildLeaderboard,
  emptyLiveStats,
  normPlayerId,
  normalizeLiveStatsDoc,
  resolveTsSport,
} from "./tsResultsUtils";
import { snapshotExists, snapshotData, snapshotId } from "@src/lib/safeSnapshot";

function normalizeParticipation(docSnap) {
  const v = snapshotData(docSnap) || {};
  return {
    uid: snapshotId(docSnap),
    livePoints: Number(v.livePoints ?? v.finalPoints ?? 0),
    finalPoints: Number(v.finalPoints ?? v.livePoints ?? 0),
    payout: Number(v.payout ?? 0),
    bonus: Number(v.bonus ?? 0),
    picks: Array.isArray(v.picks) ? v.picks : [],
    updatedAt: v.liveUpdatedAt || v.updatedAt || null,
    _raw: v,
  };
}

function profileToParticipantInfo(member) {
  const version = member.updatedAt?.toMillis?.() ? member.updatedAt.toMillis() : undefined;
  const photoURL = member.avatarUrl || member.jerseyFrontUrl || null;

  return {
    photoURL,
    avatarUrl: member.avatarUrl || null,
    jerseyFrontUrl: member.jerseyFrontUrl || null,
    jerseyBackUrl: member.jerseyBackUrl || null,
    avatarKind: member.avatarKind || null,
    version,
  };
}

export default function useTsLiveResults(defiId, { sport: sportHint, enabled = true } = {}) {
  const [loading, setLoading] = useState(true);
  const [participations, setParticipations] = useState([]);
  const [liveStats, setLiveStats] = useState(emptyLiveStats);
  const [playerMap, setPlayerMap] = useState({});

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
      setLiveStats(snapshotExists(snap) ? normalizeLiveStatsDoc(snapshotData(snap) || {}) : emptyLiveStats());
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
          const v = snapshotData(docSnap) || {};
          const pid = normPlayerId(v?.playerId ?? snapshotId(docSnap));
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

  const profiles = useLeaderboardProfiles(neededUids);

  const namesMap = useMemo(() => {
    const out = {};
    for (const uid of neededUids) {
      out[uid] = resolveLeaderboardMember({ id: uid }, profiles).displayName;
    }
    return out;
  }, [neededUids, profiles]);

  const participantInfoMap = useMemo(() => {
    const out = {};
    for (const uid of neededUids) {
      const member = resolveLeaderboardMember({ id: uid }, profiles);
      out[uid] = profileToParticipantInfo(member);
    }
    return out;
  }, [neededUids, profiles]);

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
