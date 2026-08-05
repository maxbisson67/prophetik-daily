import { useEffect, useState } from "react";
import { snapshotExists, snapshotData, snapshotId } from "@src/lib/safeSnapshot";
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
            if (!snapshotExists(snap)) return;
            const d = snapshotData(snap) || {};
            mergeForUid({
              publicDisplayName:
                d.displayName || i18n.t("common.guest", { defaultValue: "Invité" }),
              publicAvatarUrl: d.avatarUrl || null,
              publicJerseyFrontUrl: d.jerseyFrontUrl || null,
              publicJerseyBackUrl: d.jerseyBackUrl || null,
              publicAvatarKind: d.avatarKind || null,
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
            if (!snapshotExists(snap)) return;
            const d = snapshotData(snap) || {};
            mergeForUid({
              participantDisplayName: d.displayName || null,
              participantAvatarUrl: d.avatarUrl || null,
              participantJerseyFrontUrl: d.jerseyFrontUrl || null,
              participantJerseyBackUrl: d.jerseyBackUrl || null,
              participantAvatarKind: d.avatarKind || null,
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
  const memberId = String(row?.uid || row?.id || "").trim();
  const prof = profiles[memberId] || {};

  const displayName =
    prof.participantDisplayName ||
    prof.publicDisplayName ||
    row?.displayName ||
    memberId ||
    i18n.t("common.guest", { defaultValue: "Invité" });

  const avatarUrl =
    prof.participantAvatarUrl ||
    prof.publicAvatarUrl ||
    row?.avatarUrl ||
    null;

  const jerseyFrontUrl =
    prof.participantJerseyFrontUrl ||
    prof.publicJerseyFrontUrl ||
    row?.jerseyFrontUrl ||
    null;

  const jerseyBackUrl =
    prof.participantJerseyBackUrl ||
    prof.publicJerseyBackUrl ||
    row?.jerseyBackUrl ||
    null;

  const avatarKind =
    prof.participantAvatarKind || prof.publicAvatarKind || row?.avatarKind || null;

  const updatedAt =
    prof.participantUpdatedAt ||
    prof.publicUpdatedAt ||
    null;

  return {
    displayName,
    avatarUrl,
    jerseyFrontUrl,
    jerseyBackUrl,
    avatarKind,
    updatedAt,
  };
}
