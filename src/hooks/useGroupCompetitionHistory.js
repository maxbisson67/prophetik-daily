import { useEffect, useMemo, useState } from "react";
import { snapshotExists, snapshotData, snapshotId } from "@src/lib/safeSnapshot";
import firestore from "@react-native-firebase/firestore";
import { normalizeSport } from "@src/season/seasonCompetitionCore";

function tsMillis(v) {
  try {
    if (!v) return 0;
    if (typeof v?.toDate === "function") return v.toDate().getTime();
    const d = new Date(v);
    return Number.isFinite(d.getTime()) ? d.getTime() : 0;
  } catch {
    return 0;
  }
}

function normalizeHistoryDoc(id, data = {}) {
  const winnerUids = Array.isArray(data.winnerUids)
    ? data.winnerUids.map(String).filter(Boolean)
    : [];

  return {
    competitionKey: String(data.competitionKey || id || ""),
    label: String(data.label || data.competitionKey || id || ""),
    phase: String(data.phase || ""),
    sport: String(data.sport || ""),
    fromYmd: String(data.fromYmd || "").slice(0, 10),
    toYmd: String(data.toYmd || "").slice(0, 10),
    winnerUids,
    winnerPoints: Number(data.winnerPoints ?? 0) || 0,
    winnerDeclaredAt: data.winnerDeclaredAt || null,
    status: String(data.status || ""),
  };
}

export default function useGroupCompetitionHistory({ groupId, sport, enabled = true, limit = 20 } = {}) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(!!enabled);

  const sportNorm = normalizeSport(sport);

  useEffect(() => {
    if (!enabled || !groupId) {
      setRows([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const un = firestore()
      .collection(`groups/${String(groupId)}/leaderboards`)
      .onSnapshot(
        (snap) => {
          const items = (snap?.docs ?? [])
            .map((d) => normalizeHistoryDoc(d.id, d.data() || {}))
            .filter((row) => {
              if (!row.winnerUids.length) return false;
              if (!row.winnerDeclaredAt && row.status !== "finalized") return false;
              if (sportNorm && row.sport && normalizeSport(row.sport) !== sportNorm) return false;
              return true;
            });

          items.sort((a, b) => {
            const tb = tsMillis(b.winnerDeclaredAt);
            const ta = tsMillis(a.winnerDeclaredAt);
            if (tb !== ta) return tb - ta;
            return String(b.toYmd || "").localeCompare(String(a.toYmd || ""));
          });

          setRows(items.slice(0, limit));
          setLoading(false);
        },
        () => {
          setRows([]);
          setLoading(false);
        }
      );

    return () => {
      try {
        un?.();
      } catch {}
    };
  }, [enabled, groupId, sportNorm, limit]);

  return useMemo(() => ({ rows, loading }), [rows, loading]);
}

export function useLeaderboardCompetitionMeta({ groupId, competitionKey, enabled = true } = {}) {
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(!!enabled);

  useEffect(() => {
    const gid = String(groupId || "").trim();
    const key = String(competitionKey || "").trim();

    if (!enabled || !gid || !key) {
      setMeta(null);
      setLoading(false);
      return;
    }

    setLoading(true);

    const un = firestore()
      .doc(`groups/${gid}/leaderboards/${key}`)
      .onSnapshot(
        (snap) => {
          setMeta(snapshotExists(snap) ? normalizeHistoryDoc(snapshotId(snap), snapshotData(snap) || {}) : null);
          setLoading(false);
        },
        () => {
          setMeta(null);
          setLoading(false);
        }
      );

    return () => {
      try {
        un?.();
      } catch {}
    };
  }, [enabled, groupId, competitionKey]);

  return { meta, loading };
}
