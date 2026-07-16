import { useEffect, useMemo, useState } from "react";
import firestore from "@react-native-firebase/firestore";
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
      setFgcEntries([]);
      setTpEntries([]);
      setTsEntries([]);
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
    } else {
      setFgcEntries([]);
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
    } else {
      setTpEntries([]);
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
    } else {
      setTsEntries([]);
    }

    return () => {
      unsubs.forEach((un) => {
        try {
          un?.();
        } catch {}
      });
    };
  }, [active, fgcChallengeId, tpBundleId, tsDefiId]);

  const rows = useMemo(
    () =>
      mergeParticipantRows({
        fgcEntries,
        tpEntries,
        tsEntries,
      }),
    [fgcEntries, tpEntries, tsEntries]
  );

  const hasAnyChallenge = !!(fgcChallengeId || tpBundleId || tsDefiId);

  return {
    rows,
    loading: loadingChallenges,
    hasAnyChallenge,
    challengeIds: {
      fgcChallengeId,
      tpBundleId,
      tsDefiId,
    },
  };
}
