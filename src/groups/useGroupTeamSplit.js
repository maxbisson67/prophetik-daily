import { useEffect, useState } from "react";
import firestore from "@react-native-firebase/firestore";
import { snapshotData, snapshotExists } from "@src/lib/safeSnapshot";
import { getGroupTeamSplit } from "@src/groups/teamSplitUtils";

/**
 * Écoute groups/{groupId} pour teamSplit (évite liste groupes stale au Classement).
 */
export default function useGroupTeamSplit(groupId) {
  const [teamSplit, setTeamSplit] = useState(null);
  const [loading, setLoading] = useState(!!groupId);

  useEffect(() => {
    const gid = String(groupId || "").trim();
    if (!gid) {
      setTeamSplit(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    const un = firestore()
      .doc(`groups/${gid}`)
      .onSnapshot(
        (snap) => {
          if (!snapshotExists(snap)) {
            setTeamSplit(null);
            setLoading(false);
            return;
          }
          const data = snapshotData(snap) || {};
          setTeamSplit(getGroupTeamSplit(data));
          setLoading(false);
        },
        () => {
          setTeamSplit(null);
          setLoading(false);
        }
      );

    return () => un();
  }, [groupId]);

  return { teamSplit, loading };
}
