import { useEffect, useState } from "react";
import firestore from "@react-native-firebase/firestore";
import i18n from "@src/i18n/i18n";

export default function useLeaderboardProfiles(uids) {
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

      const mergeForUid = (patch) => {
        setMap((prev) => ({
          ...prev,
          [uid]: {
            ...(prev[uid] || {}),
            ...patch,
          },
        }));
      };

      const unPub = firestore()
        .collection("profiles_public")
        .doc(uid)
        .onSnapshot(
          (snap) => {
            if (!snap.exists) return;
            const d = snap.data() || {};
            mergeForUid({
              publicDisplayName:
                d.displayName || i18n.t("common.guest", { defaultValue: "Invité" }),
              publicAvatarUrl: d.avatarUrl || null,
              publicUpdatedAt: d.updatedAt || null,
            });
          },
          () => {}
        );

      unsubsForUid.push(unPub);

      const unParticipant = firestore()
        .collection("participants")
        .doc(uid)
        .onSnapshot(
          (snap) => {
            if (!snap.exists) return;
            const d = snap.data() || {};
            mergeForUid({
              participantDisplayName: d.displayName || null,
              participantAvatarUrl: d.avatarUrl || null,
              participantUpdatedAt: d.updatedAt || null,
            });
          },
          () => {}
        );

      unsubsForUid.push(unParticipant);

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

export function resolveLeaderboardMember(row, profiles) {
  const prof = profiles[String(row?.id)] || {};

  const displayName =
    prof.participantDisplayName ||
    prof.publicDisplayName ||
    row?.displayName ||
    row?.id;

  const avatarUrl =
    prof.participantAvatarUrl ||
    prof.publicAvatarUrl ||
    row?.avatarUrl ||
    null;

  const updatedAt =
    prof.participantUpdatedAt ||
    prof.publicUpdatedAt ||
    null;

  return { displayName, avatarUrl, updatedAt };
}
