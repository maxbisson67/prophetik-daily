import React, { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useLocalSearchParams } from "expo-router";
import { useMyGroups } from "@src/groups/MyGroupsProvider";
import {
  useLiveTabTitle,
  useSelectedGroup,
} from "@src/groups/SelectedGroupProvider";
import { useTheme } from "@src/theme/ThemeProvider";
import GroupsToggleRow from "@src/home/components/GroupsToggleRow";
import LiveChallengesLegend from "@src/live/LiveChallengesLegend";
import LivePointsOverviewPanel from "@src/live/LivePointsOverviewPanel";
import LiveViewModeToggle from "@src/live/LiveViewModeToggle";
import MatchLiveScreen from "../sports/MatchLiveScreen";
import MlbMatchLiveScreen from "../sports/MlbMatchLiveScreen";

export default function LiveScreen() {
  const navigation = useNavigation();
  const params = useLocalSearchParams();
  const { colors } = useTheme();
  const { loading, readableGroupIds, groupsMeta } = useMyGroups();
  const { selectedGroupId, setSelectedGroupId, selectedSport } = useSelectedGroup();

  const paramGroupId = String(params?.groupId || "").trim();

  useEffect(() => {
    if (!paramGroupId || !readableGroupIds.includes(paramGroupId)) return;
    if (String(selectedGroupId) !== paramGroupId) {
      setSelectedGroupId(paramGroupId);
    }
  }, [paramGroupId, readableGroupIds.join("|"), selectedGroupId, setSelectedGroupId]);

  const sport = selectedSport === "MLB" ? "MLB" : "NHL";
  const [viewMode, setViewMode] = useState("games");

  useEffect(() => {
    setViewMode("games");
  }, [selectedGroupId]);

  const userGroups = useMemo(
    () =>
      (readableGroupIds || []).map((gid) => {
        const g = groupsMeta[gid] || {};
        return {
          id: gid,
          name: g.name || gid,
          avatarUrl: g.avatarUrl || null,
          sport: String(g.sport || g.league || "NHL").toUpperCase(),
        };
      }),
    [readableGroupIds, groupsMeta]
  );

  const liveTitle = useLiveTabTitle();

  useLayoutEffect(() => {
    navigation.setOptions({ title: liveTitle, tabBarLabel: liveTitle });
  }, [navigation, liveTitle]);

  if (loading && !selectedGroupId) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
        <GroupsToggleRow
          colors={colors}
          groups={userGroups}
          value={selectedGroupId}
          onChange={setSelectedGroupId}
          hintKey="live.selectGroupLabel"
          compact
        />
        <LiveViewModeToggle value={viewMode} onChange={setViewMode} colors={colors} />
        {viewMode === "games" ? <LiveChallengesLegend colors={colors} /> : null}
      </View>

      <View style={{ flex: 1 }}>
        {viewMode === "points" ? (
          <LivePointsOverviewPanel groupId={selectedGroupId} sport={sport} colors={colors} />
        ) : sport === "MLB" ? (
          <MlbMatchLiveScreen />
        ) : (
          <MatchLiveScreen />
        )}
      </View>
    </View>
  );
}
