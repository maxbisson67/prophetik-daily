// src/home/hooks/useMeDoc.js
import { useEffect, useRef, useState } from "react";
import firestore from "@react-native-firebase/firestore";
import { listenRNFB } from "../firestoreListen";

export default function useMeDoc({ authReady, uid, dayTick }) {
  const [meDoc, setMeDoc] = useState(null);
  const [loadingMe, setLoadingMe] = useState(true);
  const [error, setError] = useState(null);

  const subRef = useRef(null);

  useEffect(() => {
    setError(null);

    if (!authReady || !uid) {
      setMeDoc(null);
      setLoadingMe(false);
      try { subRef.current?.(); } catch {}
      subRef.current = null;
      return;
    }

    // déjà attaché
    if (subRef.current) {
      setLoadingMe(false);
      return;
    }

    setLoadingMe(true);

    const ref = firestore().collection("participants").doc(uid);
    subRef.current = listenRNFB(
      ref,
      (snap) => {
        setMeDoc(snap.exists ? { uid: snap.id, ...snap.data() } : null);
        setLoadingMe(false);
      },
      "participants/self",
      (e) => {
        setError(e);
        setLoadingMe(false);
      }
    );

    return () => {
      try { subRef.current?.(); } catch {}
      subRef.current = null;
    };
  }, [authReady, uid, dayTick]);

  return { meDoc, loadingMe, error };
}