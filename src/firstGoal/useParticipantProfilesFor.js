import { useEffect, useState } from "react";
import firestore from "@react-native-firebase/firestore";

function mergeParticipantProfile(prev = {}, participant = {}, pub = {}) {
  const displayName =
    participant.displayName ||
    participant.name ||
    pub.displayName ||
    pub.name ||
    null;

  const jerseyFrontUrl = participant.jerseyFrontUrl || pub.jerseyFrontUrl || null;
  const jerseyBackUrl = participant.jerseyBackUrl || pub.jerseyBackUrl || null;
  const avatarKind = participant.avatarKind || pub.avatarKind || null;

  const avatarUrl =
    participant.jerseyFrontUrl ||
    participant.avatarUrl ||
    participant.photoURL ||
    participant.photoUrl ||
    pub.jerseyFrontUrl ||
    pub.avatarUrl ||
    pub.photoURL ||
    null;

  return {
    ...prev,
    displayName,
    avatarUrl,
    jerseyFrontUrl,
    jerseyBackUrl,
    avatarKind,
  };
}

export default function useParticipantProfilesFor(uids) {
  const [map, setMap] = useState({});

  useEffect(() => {
    const ids = Array.from(new Set((uids || []).filter(Boolean).map(String)));

    if (!ids.length) {
      setMap({});
      return;
    }

    const unsubs = new Map();

    ids.forEach((uid) => {
      const unsubsForUid = [];
      let participant = {};
      let pub = {};

      const mergeForUid = () => {
        setMap((prev) => ({
          ...prev,
          [uid]: mergeParticipantProfile(prev[uid], participant, pub),
        }));
      };

      const unParticipant = firestore()
        .collection("participants")
        .doc(uid)
        .onSnapshot(
          (snap) => {
            participant = snap.exists ? snap.data() || {} : {};
            mergeForUid();
          },
          () => {}
        );

      unsubsForUid.push(unParticipant);

      const unPub = firestore()
        .collection("profiles_public")
        .doc(uid)
        .onSnapshot(
          (snap) => {
            pub = snap.exists ? snap.data() || {} : {};
            mergeForUid();
          },
          () => {}
        );

      unsubsForUid.push(unPub);

      unsubs.set(uid, () => {
        unsubsForUid.forEach((u) => {
          try {
            u?.();
          } catch {}
        });
      });
    });

    return () => {
      for (const [, un] of unsubs) {
        try {
          un?.();
        } catch {}
      }
    };
  }, [JSON.stringify(uids || [])]);

  return map;
}

export function resolveParticipantIdentity(entry, profile) {
  const who =
    entry?.displayName ||
    entry?.name ||
    entry?.playerOwnerName ||
    profile?.displayName ||
    String(entry?.uid || "").slice(0, 6);

  const jerseyFrontUrl = profile?.jerseyFrontUrl || null;
  const jerseyBackUrl = profile?.jerseyBackUrl || null;
  const avatarKind = profile?.avatarKind || null;

  const avatarUrl =
    entry?.photoURL ||
    entry?.avatarUrl ||
    profile?.avatarUrl ||
    jerseyFrontUrl ||
    null;

  const useJersey = !!jerseyFrontUrl;

  return { who, avatarUrl, jerseyFrontUrl, jerseyBackUrl, useJersey };
}
