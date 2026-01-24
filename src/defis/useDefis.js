// src/defis/useDefis.js (RNFB)
import { useEffect, useState } from "react";
import firestore from "@react-native-firebase/firestore";

export function useGroupDefis(groupId, { status } = {}) {
  const [defis, setDefis] = useState([]);
  const [loading, setLoading] = useState(!!groupId);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!groupId) {
      setDefis([]);
      setLoading(false);
      setError(null);
      return;
    }

    let q = firestore()
      .collection("defis")
      .where("groupId", "==", String(groupId));

    if (status) q = q.where("status", "==", String(status));
    q = q.orderBy("createdAt", "desc");

    const unsub = q.onSnapshot(
      (snap) => {
        setDefis(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      (e) => {
        setError(e);
        setLoading(false);
      }
    );

    return () => {
      try {
        unsub();
      } catch {}
    };
  }, [groupId, status]);

  return { defis, loading, error };
}

/**
 * Lecture de MA participation (sub)
 * defis/{defiId}/participations/{uid}
 *
 * reloadKey: change sa valeur pour forcer une resubscription (optionnel)
 */
export function useMyDefiParticipation(defiId, uid, { reloadKey = 0 } = {}) {
  const [participation, setParticipation] = useState(null);
  const [loading, setLoading] = useState(!!(defiId && uid));
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!defiId || !uid) {
      setParticipation(null);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);

    const ref = firestore().doc(
      `defis/${String(defiId)}/participations/${String(uid)}`
    );

    const unsub = ref.onSnapshot(
      (snap) => {
        setParticipation(snap.exists ? { id: snap.id, ...snap.data() } : null);
        setLoading(false);
      },
      (e) => {
        setError(e);
        setLoading(false);
      }
    );

    return () => {
      try {
        unsub();
      } catch {}
    };
  }, [defiId, uid, reloadKey]);

  return { participation, loading, error };
}