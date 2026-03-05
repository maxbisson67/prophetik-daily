// src/ascensions/useAscensionGlobalState.js
import { useEffect, useMemo, useRef, useState } from "react";
import firestore from "@react-native-firebase/firestore";
import { listenRNFB } from "@src/dev/fsListen";

function safeArr(v) {
  return Array.isArray(v) ? v : [];
}

function isExpectedFsError(e) {
  const code = String(e?.code || "");
  return (
    code.includes("permission-denied") ||
    code.includes("unauthenticated") ||
    code.includes("cancelled")
  );
}

function devLog(tag, payload) {
  if (!__DEV__) return;
  // eslint-disable-next-line no-console
  console.log(`[ASC:${tag}]`, payload);
}

function devWarn(tag, payload) {
  if (!__DEV__) return;
  // eslint-disable-next-line no-console
  console.warn(`[ASC:${tag}]`, payload);
}

/**
 * Retourne un objet "state" stable pour l'UI:
 * {
 *   enabled, status, activeRunId, jackpotTotal,
 *   completed, completedDefiId, lastTickNote, ...
 * }
 */
export default function useAscensionGlobalState({ groupId, ascKey }) {
  const [loading, setLoading] = useState(true);
  const [root, setRoot] = useState(null);
  const [run, setRun] = useState(null);
  const [error, setError] = useState(null);

  // Important: garde un ref pour fermer le listener run quand root change
  const unRunRef = useRef(null);

  const key = useMemo(
    () => `${String(groupId || "")}:${String(ascKey || "")}`,
    [groupId, ascKey]
  );

  // state “UI-friendly”
  const state = useMemo(() => {
    if (!root) return null;

    const enabled = root.enabled !== false;
    const runStatus = String(run?.status || "");
    const completed = runStatus.toLowerCase() === "completed";

    return {
      ascKey: root.ascKey,
      enabled,
      status: String(root.status || "active"),
      activeRunId: root.activeRunId || null,

      // jackpot total (ici: jackpot du run actif)
      jackpotTotal: Number(run?.jackpot || 0),

      // run
      runId: run?.runId || root.activeRunId || null,
      startYmd: run?.startYmd || null,
      completed,
      completedAt: run?.completedAt || null,
      completedDefiId: run?.completedDefiId || null,

      // debug/tick
      lastTickAt: root.lastTickAt || null,
      lastTickNote: root.lastTickNote || null,

      updatedAt: root.updatedAt || null,
    };
  }, [root, run]);

  useEffect(() => {
    setRoot(null);
    setRun(null);
    setError(null);

    // stop run listener
    try { unRunRef.current?.(); } catch {}
    unRunRef.current = null;

    if (!groupId || !ascKey) {
      setLoading(false);
      return;
    }

    setLoading(true);

    const rootRef = firestore()
      .collection("groups")
      .doc(String(groupId))
      .collection("ascensions")
      .doc(String(ascKey));

    const rootTag = `ascensions:root:${groupId}:${ascKey}`;

    devLog("attachRoot", { groupId, ascKey, path: rootRef.path });

    const unRoot = listenRNFB(
      rootRef,
      (snap) => {
        if (!snap?.exists) {
          devLog("rootMissing", { path: rootRef.path });

          setRoot(null);
          setRun(null);

          // stop run listener si root disparaît
          try { unRunRef.current?.(); } catch {}
          unRunRef.current = null;

          setLoading(false);
          return;
        }

        const d = snap.data?.() || {};
        const activeRunId = d.activeRunId ? String(d.activeRunId) : null;

        setRoot({
          id: snap.id,
          ascKey: String(ascKey),
          enabled: d.enabled !== false,
          status: String(d.status || "active"),
          activeRunId,
          lastCompletedRunId: d.lastCompletedRunId || null,
          lastWinners: safeArr(d.lastWinners),
          lastWinnerAt: d.lastWinnerAt || null,
          updatedAt: d.updatedAt || null,
          lastTickAt: d.lastTickAt || null,
          lastTickNote: d.lastTickNote || null,
        });

        // (re)subscribe run
        try { unRunRef.current?.(); } catch {}
        unRunRef.current = null;

        if (!activeRunId) {
          setRun(null);
          setLoading(false);
          return;
        }

        const runRef = rootRef.collection("runs").doc(activeRunId);
        const runTag = `ascensions:run:${groupId}:${ascKey}:${activeRunId}`;

        devLog("attachRun", { path: runRef.path });

        unRunRef.current = listenRNFB(
          runRef,
          (rSnap) => {
            if (!rSnap?.exists) {
              devLog("runMissing", { path: runRef.path });
              setRun(null);
              setLoading(false);
              return;
            }

            const r = rSnap.data?.() || {};
            setRun({
              id: rSnap.id,
              runId: r.runId || rSnap.id,
              status: String(r.status || "active"),
              startYmd: r.startYmd || rSnap.id,
              jackpot: Number(r.jackpot || 0),
              winnerUids: safeArr(r.winnerUids),
              completedAt: r.completedAt || null,
              completedDefiId: r.completedDefiId || null,
              updatedAt: r.updatedAt || null,
            });

            setLoading(false);
          },
          runTag,
          (e) => {
            // ✅ important: ne pas propager les erreurs attendues vers Home
            if (isExpectedFsError(e)) {
              devWarn("runExpectedError", {
                code: e?.code,
                message: e?.message,
                tag: runTag,
                path: runRef.path,
              });
              setRun(null);
              setLoading(false);
              return;
            }

            devWarn("runError", {
              code: e?.code,
              message: e?.message,
              tag: runTag,
              path: runRef.path,
            });
            setError(e);
            setLoading(false);
          }
        );
      },
      rootTag,
      (e) => {
        // ✅ important: ne pas propager les erreurs attendues vers Home
        if (isExpectedFsError(e)) {
          devWarn("rootExpectedError", {
            code: e?.code,
            message: e?.message,
            tag: rootTag,
            path: rootRef.path,
          });
          setRoot(null);
          setRun(null);

          try { unRunRef.current?.(); } catch {}
          unRunRef.current = null;

          setLoading(false);
          return;
        }

        devWarn("rootError", {
          code: e?.code,
          message: e?.message,
          tag: rootTag,
          path: rootRef.path,
        });
        setError(e);
        setLoading(false);
      }
    );

    return () => {
      devLog("detachAll", { groupId, ascKey });

      try { unRoot?.(); } catch {}
      try { unRunRef.current?.(); } catch {}
      unRunRef.current = null;
    };
  }, [key]);

  return { loading, state, root, run, error };
}