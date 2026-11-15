import { useCallback, useEffect, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import {
  DEFAULT_TEAM_SPLIT,
  loadTeamSplitConfig,
  saveTeamSplitConfig,
} from "@src/groups/teamSplitStorage";

export default function useTeamSplitConfig(groupId, { enabled = true } = {}) {
  const [config, setConfig] = useState({ ...DEFAULT_TEAM_SPLIT, roster: {} });
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    const gid = String(groupId || "").trim();
    if (!gid || !enabled) {
      setConfig({ ...DEFAULT_TEAM_SPLIT, roster: {} });
      return;
    }
    setLoading(true);
    try {
      const next = await loadTeamSplitConfig(gid);
      setConfig(next);
    } finally {
      setLoading(false);
    }
  }, [groupId, enabled]);

  useEffect(() => {
    reload();
  }, [reload]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload])
  );

  const persist = useCallback(
    async (patch) => {
      const gid = String(groupId || "").trim();
      if (!gid) return;
      const merged = {
        teamAName: patch.teamAName ?? config.teamAName,
        teamBName: patch.teamBName ?? config.teamBName,
        roster: patch.roster ?? config.roster,
      };
      const saved = await saveTeamSplitConfig(gid, merged);
      setConfig(saved);
      return saved;
    },
    [groupId, config]
  );

  const setMemberTeam = useCallback(
    async (uid, team) => {
      const id = String(uid || "").trim();
      if (!id) return;
      const roster = { ...config.roster };
      if (team === "a" || team === "b") roster[id] = team;
      else delete roster[id];
      await persist({ roster });
    },
    [config.roster, persist]
  );

  const setTeamNames = useCallback(
    async (teamAName, teamBName) => {
      await persist({ teamAName, teamBName });
    },
    [persist]
  );

  return {
    config,
    loading,
    reload,
    persist,
    setMemberTeam,
    setTeamNames,
  };
}
