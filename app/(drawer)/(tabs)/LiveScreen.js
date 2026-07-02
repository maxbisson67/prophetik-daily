import React, { useLayoutEffect, useMemo } from "react";
import { ActivityIndicator, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useMyGroups } from "@src/groups/MyGroupsProvider";
import {
  resolveLiveTabTitle,
  useSelectedGroup,
} from "@src/groups/SelectedGroupProvider";
import { useTheme } from "@src/theme/ThemeProvider";
import MatchLiveScreen from "../sports/MatchLiveScreen";
import MlbMatchLiveScreen from "../sports/MlbMatchLiveScreen";

export default function LiveScreen() {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const { loading } = useMyGroups();
  const { selectedGroupId, selectedSport } = useSelectedGroup();

  const sport = selectedSport === "MLB" ? "MLB" : "NHL";

  const liveTitle = useMemo(
    () => resolveLiveTabTitle(selectedGroupId, selectedSport),
    [selectedGroupId, selectedSport]
  );

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

  return sport === "MLB" ? <MlbMatchLiveScreen /> : <MatchLiveScreen />;
}
