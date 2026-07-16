import { useEffect, useMemo, useState } from "react";
import { snapshotExists, snapshotData, snapshotId } from "@src/lib/safeSnapshot";
import firestore from "@react-native-firebase/firestore";
import { lookupPickByGameId } from "@src/defis/tpBundleDisplayHelpers";
import { isCompleteTpPick } from "@src/defis/TpHomePredictionRow";
import { useProphetikBusinessYmd } from "@src/hooks/useProphetikBusinessDate";
import {
  challengeGameId,
  isTsType,
  normalizeFgcDoc,
  normalizeTpBundleDoc,
  normalizeTsDoc,
  normalizeYmdString,
} from "@src/live/liveChallengeModels";

function tpBundleLeague(item, fallbackLeague) {
  const lg = String(item?.raw?.league || fallbackLeague || "NHL").toUpperCase();
  return lg;
}

function hasUsableTpPick(pick) {
  if (!pick || typeof pick !== "object") return false;
  if (isCompleteTpPick(pick)) return true;
  return !!String(pick.winnerAbbr || "").trim();
}

function pickPrimaryTpBundle(items = [], businessYmd) {
  if (!items.length) return null;

  const businessCompact = String(businessYmd || "").replace(/-/g, "");
  const preferred = items.find((item) => {
    const compact = String(item?.raw?.gameYmd || item?.dateKey || "").replace(/-/g, "");
    return compact === businessCompact || item.dateKey === businessYmd;
  });

  return preferred || items[0];
}

function mergeTpBundlesByGameId(items = []) {
  const out = {};

  items.forEach((item) => {
    const games = Array.isArray(item?.raw?.games) ? item.raw.games : [];
    games.forEach((slot) => {
      const gameId = String(slot?.gameId || "").trim();
      if (!gameId) return;
      out[gameId] = { item, slot, bundleId: item.id };
    });
  });

  return out;
}

export default function useTodayLiveChallenges({
  groupId,
  league,
  extraYmds = [],
  userId,
  enabled = true,
}) {
  const businessYmd = useProphetikBusinessYmd();
  const businessYmdCompact = useMemo(() => businessYmd.replace(/-/g, ""), [businessYmd]);

  const ymdSet = useMemo(() => {
    const set = new Set([businessYmd]);
    (extraYmds || []).forEach((ymd) => {
      const v = normalizeYmdString(ymd);
      if (v) set.add(v);
    });
    return set;
  }, [businessYmd, extraYmds.join("|")]);

  const gid = String(groupId || "").trim();
  const lg = String(league || "NHL").toUpperCase();
  const uid = String(userId || "").trim();
  const active = enabled && !!gid;

  const [fgcByGameId, setFgcByGameId] = useState({});
  const [fgcItems, setFgcItems] = useState([]);
  const [fgcEntryByChallengeId, setFgcEntryByChallengeId] = useState({});
  const [tpByGameId, setTpByGameId] = useState({});
  const [tpBundleItems, setTpBundleItems] = useState([]);
  const [tpBundleItem, setTpBundleItem] = useState(null);
  const [tpEntryByBundleId, setTpEntryByBundleId] = useState({});
  const [tsItem, setTsItem] = useState(null);
  const [tsPoolByPlayerId, setTsPoolByPlayerId] = useState({});
  const [tsByGameId, setTsByGameId] = useState({});
  const [tsEntry, setTsEntry] = useState(null);

  useEffect(() => {
    if (!active) {
      setFgcByGameId({});
      setFgcItems([]);
      return undefined;
    }

    const mapByDocId = new Map();
    const unsubs = [];

    const rebuild = () => {
      const byGame = {};
      const list = [];

      mapByDocId.forEach((item) => {
        list.push(item);
        const gameId = challengeGameId(item?.raw);
        if (!gameId) return;
        byGame[gameId] = item;
      });

      setFgcItems(list);
      setFgcByGameId(byGame);
    };

    ymdSet.forEach((ymd) => {
      const un = firestore()
        .collection("first_goal_challenges")
        .where("groupId", "==", gid)
        .where("gameYmd", "==", ymd)
        .where("league", "==", lg)
        .where("type", "==", "first_goal")
        .onSnapshot(
          (snap) => {
            [...mapByDocId.entries()].forEach(([id, item]) => {
              if (item?.dateKey === ymd) mapByDocId.delete(id);
            });

            (snap?.docs ?? []).forEach((doc) => {
              mapByDocId.set(doc.id, normalizeFgcDoc(doc));
            });

            rebuild();
          },
          () => {
            [...mapByDocId.entries()].forEach(([id, item]) => {
              if (item?.dateKey === ymd) mapByDocId.delete(id);
            });
            rebuild();
          }
        );

      unsubs.push(un);
    });

    return () => {
      unsubs.forEach((u) => {
        try {
          u();
        } catch {}
      });
    };
  }, [active, gid, lg, [...ymdSet].join("|")]);

  useEffect(() => {
    if (!active || !uid || !fgcItems.length) {
      setFgcEntryByChallengeId({});
      return undefined;
    }

    const challengeIds = fgcItems
      .map((item) => String(item?.id || "").trim())
      .filter(Boolean);

    const unsubs = challengeIds.map((challengeId) =>
      firestore()
        .collection("first_goal_challenges")
        .doc(challengeId)
        .collection("entries")
        .doc(uid)
        .onSnapshot(
          (snap) => {
            setFgcEntryByChallengeId((prev) => ({
              ...prev,
              [challengeId]: snapshotExists(snap) ? snapshotData(snap) || null : null,
            }));
          },
          () => {
            setFgcEntryByChallengeId((prev) => {
              const next = { ...prev };
              delete next[challengeId];
              return next;
            });
          }
        )
    );

    return () => {
      unsubs.forEach((un) => {
        try {
          un();
        } catch {}
      });
    };
  }, [active, uid, fgcItems.map((item) => item?.id).join("|")]);

  const fgcPickByGameId = useMemo(() => {
    const out = {};

    fgcItems.forEach((item) => {
      const challengeId = String(item?.id || "").trim();
      const gameId = challengeGameId(item?.raw);
      const entry = fgcEntryByChallengeId[challengeId];
      const playerId = String(entry?.playerId || "").trim();

      if (!gameId || !playerId) return;

      out[gameId] = {
        playerId,
        fullName: String(entry?.playerName || entry?.playerFullName || "").trim(),
        teamAbbr: String(entry?.teamAbbr || "").trim(),
        headshotUrl: String(entry?.headshotUrl || "").trim() || null,
        payout: entry?.payout,
        won: entry?.won,
        points: entry?.points,
      };
    });

    return out;
  }, [fgcItems, fgcEntryByChallengeId]);

  useEffect(() => {
    if (!active) {
      setTpByGameId({});
      setTpBundleItems([]);
      setTpBundleItem(null);
      return undefined;
    }

    const un = firestore()
      .collection("team_prediction_bundles")
      .where("groupId", "==", gid)
      .onSnapshot(
        (snap) => {
          const rows = (snap?.docs ?? [])
            .map(normalizeTpBundleDoc)
            .filter((item) => ymdSet.has(item.dateKey))
            .filter((item) => tpBundleLeague(item, lg) === lg)
            .sort((a, b) => String(b.dateKey).localeCompare(String(a.dateKey)));

          setTpBundleItems(rows);
          setTpBundleItem(pickPrimaryTpBundle(rows, businessYmd));
          setTpByGameId(mergeTpBundlesByGameId(rows));
        },
        () => {
          setTpBundleItems([]);
          setTpBundleItem(null);
          setTpByGameId({});
        }
      );

    return () => {
      try {
        un();
      } catch {}
    };
  }, [active, gid, lg, businessYmd, [...ymdSet].join("|")]);

  useEffect(() => {
    if (!active) {
      setTsItem(null);
      setTsByGameId({});
      return undefined;
    }

    const un = firestore()
      .collection("defis")
      .where("groupId", "==", gid)
      .onSnapshot(
        (snap) => {
          const row =
            (snap?.docs ?? [])
              .map(normalizeTsDoc)
              .filter((item) => ymdSet.has(item.dateKey))
              .filter((item) => isTsType(item.raw))
              .sort((a, b) => String(b.dateKey).localeCompare(String(a.dateKey)))[0] || null;

          setTsItem(row);
          if (!row) setTsByGameId({});
        },
        () => {
          setTsItem(null);
          setTsByGameId({});
        }
      );

    return () => {
      try {
        un();
      } catch {}
    };
  }, [active, gid, [...ymdSet].join("|")]);

  useEffect(() => {
    if (!active || !tsItem?.id) {
      setTsPoolByPlayerId({});
      return undefined;
    }

    const un = firestore()
      .collection(`defis/${tsItem.id}/playerPool`)
      .onSnapshot(
        (snap) => {
          const byPlayerId = {};
          snap.forEach((docSnap) => {
            const data = snapshotData(docSnap) || {};
            const playerId = String(snapshotId(docSnap) || data.playerId || "").trim();
            const gamePk = String(data?.gamePk || data?.matchup?.gameId || "").trim();
            if (!playerId) return;
            byPlayerId[playerId] = {
              gamePk,
              fullName: data.fullName || data.name || "",
              teamAbbr: data.teamAbbr || "",
            };
          });
          setTsPoolByPlayerId(byPlayerId);
        },
        () => setTsPoolByPlayerId({})
      );

    return () => {
      try {
        un();
      } catch {}
    };
  }, [active, tsItem?.id]);

  useEffect(() => {
    if (!active || !tsItem?.id) {
      setTsByGameId({});
      return;
    }

    const picks = Array.isArray(tsEntry?.picks) ? tsEntry.picks : [];
    if (!picks.length) {
      setTsByGameId({});
      return;
    }

    const byGame = {};
    picks.forEach((pick) => {
      const playerId = String(pick?.playerId || "").trim();
      if (!playerId) return;

      const poolRow = tsPoolByPlayerId[playerId] || {};
      const gamePk = String(poolRow?.gamePk || pick?.gamePk || pick?.matchup?.gameId || "").trim();
      if (!gamePk) return;

      const player = {
        playerId,
        fullName: String(poolRow?.fullName || pick?.fullName || pick?.name || "").trim(),
        teamAbbr: String(poolRow?.teamAbbr || pick?.teamAbbr || "").trim(),
      };

      if (!byGame[gamePk]) byGame[gamePk] = [];
      byGame[gamePk].push(player);
    });

    setTsByGameId(byGame);
  }, [active, tsItem?.id, tsEntry, tsPoolByPlayerId]);

  useEffect(() => {
    if (!active || !uid || !tpBundleItems.length) {
      setTpEntryByBundleId({});
      return undefined;
    }

    const bundleIds = tpBundleItems
      .map((item) => String(item?.id || "").trim())
      .filter(Boolean);

    const unsubs = bundleIds.map((bundleId) =>
      firestore()
        .collection("team_prediction_bundles")
        .doc(bundleId)
        .collection("entries")
        .doc(uid)
        .onSnapshot(
          (snap) => {
            setTpEntryByBundleId((prev) => ({
              ...prev,
              [bundleId]: snapshotExists(snap) ? snapshotData(snap) || null : null,
            }));
          },
          () => {
            setTpEntryByBundleId((prev) => {
              const next = { ...prev };
              delete next[bundleId];
              return next;
            });
          }
        )
    );

    return () => {
      unsubs.forEach((un) => {
        try {
          un();
        } catch {}
      });
    };
  }, [active, uid, tpBundleItems.map((item) => item?.id).join("|")]);

  const tpEntry = useMemo(() => {
    const primaryId = String(tpBundleItem?.id || "").trim();
    if (primaryId && tpEntryByBundleId[primaryId]) {
      return tpEntryByBundleId[primaryId];
    }
    return null;
  }, [tpBundleItem?.id, tpEntryByBundleId]);

  const tpPickByGameId = useMemo(() => {
    const out = {};

    Object.entries(tpByGameId).forEach(([gameId, slotInfo]) => {
      const bundleId = String(slotInfo?.bundleId || slotInfo?.item?.id || "").trim();
      const entry = bundleId ? tpEntryByBundleId[bundleId] : null;
      const pick = lookupPickByGameId(entry?.picks, gameId);
      if (!hasUsableTpPick(pick)) return;
      out[gameId] = pick;
    });

    return out;
  }, [tpByGameId, tpEntryByBundleId]);

  const tpPickResultByGameId = useMemo(() => {
    const out = {};

    Object.entries(tpByGameId).forEach(([gameId, slotInfo]) => {
      const bundleId = String(slotInfo?.bundleId || slotInfo?.item?.id || "").trim();
      const entry = bundleId ? tpEntryByBundleId[bundleId] : null;
      const stored = lookupPickByGameId(entry?.pickResults, gameId);
      if (stored) out[gameId] = stored;
    });

    return out;
  }, [tpByGameId, tpEntryByBundleId]);

  useEffect(() => {
    if (!active || !uid || !tsItem?.id) {
      setTsEntry(null);
      return undefined;
    }

    const un = firestore()
      .collection("defis")
      .doc(String(tsItem.id))
      .collection("participations")
      .doc(uid)
      .onSnapshot(
        (snap) => setTsEntry(snapshotExists(snap) ? snapshotData(snap) || null : null),
        () => setTsEntry(null)
      );

    return () => {
      try {
        un();
      } catch {}
    };
  }, [active, uid, tsItem?.id]);

  return {
    businessYmd,
    businessYmdCompact,
    fgcByGameId,
    fgcItems,
    fgcPickByGameId,
    tpByGameId,
    tpBundleItems,
    tpBundleItem,
    tpEntry,
    tpEntryByBundleId,
    tpPickByGameId,
    tpPickResultByGameId,
    tsItem,
    tsByGameId,
    tsEntry,
  };
}
