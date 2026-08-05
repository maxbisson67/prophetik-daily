import { useEffect, useMemo, useState } from "react";
import firestore from "@react-native-firebase/firestore";
import useLiveGameScores from "@src/defis/results/useLiveGameScores";
import {
  isTsType,
  normalizeFgcDoc,
  normalizeTpBundleDoc,
  normalizeTsDoc,
  normalizeYmdString,
} from "@src/live/liveChallengeModels";
import { mergeParticipantRows } from "@src/live/livePointsOverviewUtils";

function ymdMatches(rawYmd, targetYmd) {
  const a = normalizeYmdString(rawYmd);
  const b = normalizeYmdString(targetYmd);
  if (!a || !b) return false;
  return a === b;
}

export default function useLiveGroupPointsOverview({
  groupId,
  league,
  gameYmd,
  enabled = true,
  inferDailyBonus = false,
}) {
  const gid = String(groupId || "").trim();
  const lg = String(league || "NHL").toUpperCase();
  const ymd = normalizeYmdString(gameYmd);
  const active = enabled && !!gid && !!ymd;

  const [fgcChallengeId, setFgcChallengeId] = useState("");
  const [tpBundleId, setTpBundleId] = useState("");
  const [tsDefiId, setTsDefiId] = useState("");

  const [fgcEntries, setFgcEntries] = useState([]);
  const [tpEntries, setTpEntries] = useState([]);
  const [tsEntries, setTsEntries] = useState([]);
  const [tpBundle, setTpBundle] = useState(null);
  const [tsDefi, setTsDefi] = useState(null);
  const [fgcChallenge, setFgcChallenge] = useState(null);
  const [dailyBonusAward, setDailyBonusAward] = useState(null);
  const [dailyTopScorerPush, setDailyTopScorerPush] = useState(null);
  const [loadingChallenges, setLoadingChallenges] = useState(!!active);

  useEffect(() => {
    if (!active) {
      setFgcChallengeId("");
      setTpBundleId("");
      setTsDefiId("");
      setLoadingChallenges(false);
      return undefined;
    }

    setLoadingChallenges(true);
    const unsubs = [];

    unsubs.push(
      firestore()
        .collection("first_goal_challenges")
        .where("groupId", "==", gid)
        .where("gameYmd", "==", ymd)
        .where("league", "==", lg)
        .where("type", "==", "first_goal")
        .limit(1)
        .onSnapshot(
          (snap) => {
            const doc = snap?.docs?.[0] || null;
            setFgcChallengeId(doc ? doc.id : "");
            setLoadingChallenges(false);
          },
          () => {
            setFgcChallengeId("");
            setLoadingChallenges(false);
          }
        )
    );

    unsubs.push(
      firestore()
        .collection("team_prediction_bundles")
        .where("groupId", "==", gid)
        .onSnapshot(
          (snap) => {
            const row =
              (snap?.docs ?? [])
                .map(normalizeTpBundleDoc)
                .filter((item) => ymdMatches(item.dateKey, ymd))
                .filter((item) => String(item?.raw?.league || lg).toUpperCase() === lg)
                .sort((a, b) => String(b.dateKey).localeCompare(String(a.dateKey)))[0] || null;
            setTpBundleId(row?.id ? String(row.id) : "");
          },
          () => setTpBundleId("")
        )
    );

    unsubs.push(
      firestore()
        .collection("defis")
        .where("groupId", "==", gid)
        .onSnapshot(
          (snap) => {
            const row =
              (snap?.docs ?? [])
                .map(normalizeTsDoc)
                .filter((item) => ymdMatches(item.dateKey, ymd))
                .filter((item) => isTsType(item.raw))
                .sort((a, b) => String(b.dateKey).localeCompare(String(a.dateKey)))[0] || null;
            setTsDefiId(row?.id ? String(row.id) : "");
          },
          () => setTsDefiId("")
        )
    );

    return () => {
      unsubs.forEach((un) => {
        try {
          un?.();
        } catch {}
      });
    };
  }, [active, gid, lg, ymd]);

  useEffect(() => {
    if (!active) {
      setDailyBonusAward(null);
      setDailyTopScorerPush(null);
      return undefined;
    }

    const unsubs = [];

    unsubs.push(
      firestore()
        .doc(`groups/${gid}/daily_bonus_awards/${ymd}`)
        .onSnapshot(
          (snap) => setDailyBonusAward(snap?.exists ? snap.data() || null : null),
          () => setDailyBonusAward(null)
        )
    );

    unsubs.push(
      firestore()
        .doc(`groups/${gid}/daily_top_scorer_pushes/${ymd}`)
        .onSnapshot(
          (snap) => setDailyTopScorerPush(snap?.exists ? snap.data() || null : null),
          () => setDailyTopScorerPush(null)
        )
    );

    return () => {
      unsubs.forEach((un) => {
        try {
          un?.();
        } catch {}
      });
    };
  }, [active, gid, ymd]);

  useEffect(() => {
    if (!active) {
      setFgcEntries([]);
      setTpEntries([]);
      setTsEntries([]);
      setTpBundle(null);
      setTsDefi(null);
      setFgcChallenge(null);
      return undefined;
    }

    const unsubs = [];

    if (fgcChallengeId) {
      unsubs.push(
        firestore()
          .collection(`first_goal_challenges/${fgcChallengeId}/entries`)
          .onSnapshot(
            (snap) => {
              setFgcEntries(
                (snap?.docs ?? []).map((doc) => ({
                  id: doc.id,
                  uid: doc.id,
                  ...(doc.data() || {}),
                }))
              );
            },
            () => setFgcEntries([])
          )
      );

      unsubs.push(
        firestore()
          .collection("first_goal_challenges")
          .doc(fgcChallengeId)
          .onSnapshot(
            (snap) =>
              setFgcChallenge(
                snap?.exists ? { id: fgcChallengeId, ...(snap.data() || {}) } : null
              ),
            () => setFgcChallenge(null)
          )
      );
    } else {
      setFgcEntries([]);
      setFgcChallenge(null);
    }

    if (tpBundleId) {
      unsubs.push(
        firestore()
          .collection(`team_prediction_bundles/${tpBundleId}/entries`)
          .onSnapshot(
            (snap) => {
              setTpEntries(
                (snap?.docs ?? []).map((doc) => ({
                  id: doc.id,
                  uid: doc.id,
                  ...(doc.data() || {}),
                }))
              );
            },
            () => setTpEntries([])
          )
      );

      unsubs.push(
        firestore()
          .collection("team_prediction_bundles")
          .doc(tpBundleId)
          .onSnapshot(
            (snap) => setTpBundle(snap?.exists ? snap.data() || null : null),
            () => setTpBundle(null)
          )
      );
    } else {
      setTpEntries([]);
      setTpBundle(null);
    }

    if (tsDefiId) {
      unsubs.push(
        firestore()
          .collection(`defis/${tsDefiId}/participations`)
          .onSnapshot(
            (snap) => {
              setTsEntries(
                (snap?.docs ?? []).map((doc) => ({
                  id: doc.id,
                  uid: doc.id,
                  ...(doc.data() || {}),
                }))
              );
            },
            () => setTsEntries([])
          )
      );

      unsubs.push(
        firestore()
          .collection("defis")
          .doc(tsDefiId)
          .onSnapshot(
            (snap) => setTsDefi(snap?.exists ? snap.data() || null : null),
            () => setTsDefi(null)
          )
      );
    } else {
      setTsEntries([]);
      setTsDefi(null);
    }

    return () => {
      unsubs.forEach((un) => {
        try {
          un?.();
        } catch {}
      });
    };
  }, [active, fgcChallengeId, tpBundleId, tsDefiId]);

  const tpGameIds = useMemo(() => {
    const games = Array.isArray(tpBundle?.games) ? tpBundle.games : [];
    return games.map((slot) => String(slot?.gameId || "")).filter(Boolean);
  }, [tpBundle]);

  const liveScoresByGameId = useLiveGameScores(tpGameIds, lg, ymd);

  const rows = useMemo(
    () =>
      mergeParticipantRows({
        fgcEntries,
        tpEntries,
        tsEntries,
        tpBundle,
        liveScoresByGameId,
        tsDefi,
        dailyBonusAward,
        dailyTopScorerPush,
        inferDailyBonus,
      }),
    [
      fgcEntries,
      tpEntries,
      tsEntries,
      tpBundle,
      liveScoresByGameId,
      tsDefi,
      dailyBonusAward,
      dailyTopScorerPush,
      inferDailyBonus,
    ]
  );

  const hasAnyChallenge = !!(fgcChallengeId || tpBundleId || tsDefiId);
  const tsPot = Number(tsDefi?.pot ?? 0) || 0;

  return {
    rows,
    loading: loadingChallenges,
    hasAnyChallenge,
    tsPot,
    fgcChallenge,
    tpBundle,
    tsDefi,
    fgcEntries,
    tpEntries,
    tsEntries,
    challengeIds: {
      fgcChallengeId,
      tpBundleId,
      tsDefiId,
    },
  };
}
