// src/home/hooks/useMeDoc.js
import { useEffect, useRef, useState } from "react";
import { snapshotExists, snapshotData, snapshotId } from "@src/lib/safeSnapshot";
import firestore from "@react-native-firebase/firestore";
import { listenRNFB } from "../firestoreListen";

export default function useMeDoc({ authReady, uid, dayTick, enabled = true }) {
  const [meDoc, setMeDoc] = useState(null);
  const [loadingMe, setLoadingMe] = useState(true);
  const [error, setError] = useState(null);

  const subRef = useRef(null);

  useEffect(() => {
    setError(null);

    if (!enabled || !authReady || !uid) {
      setLoadingMe(false);
      try {
        subRef.current?.();
      } catch {}
      subRef.current = null;
      if (!authReady || !uid) {
        setMeDoc(null);
      }
      return;
    }

    setLoadingMe(true);

    const ref = firestore().collection("participants").doc(uid);
    subRef.current = listenRNFB(
      ref,
      (snap) => {
        setMeDoc(snapshotExists(snap) ? { uid: snapshotId(snap), ...snapshotData(snap) } : null);
        setLoadingMe(false);
      },
      "participants/self",
      (e) => {
        setError(e);
        setLoadingMe(false);
      },
      { screen: "useMeDoc" }
    );

    return () => {
      try {
        subRef.current?.();
      } catch {}
      subRef.current = null;
    };
  }, [enabled, authReady, uid, dayTick]);

  return { meDoc, loadingMe, error };
}
