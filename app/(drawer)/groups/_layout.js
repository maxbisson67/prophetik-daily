// app/(drawer)/groups/_layout.js
import React from 'react';
import { Stack } from 'expo-router';
import { DrawerToggleButton } from '@react-navigation/drawer';
import { useTheme } from '@src/theme/ThemeProvider';
import i18n from '@src/i18n/i18n';

export default function GroupsLayout() {
  const { colors, isDark } = useTheme();

  return (
    <Stack
      screenOptions={{
        headerLeft: (props) => <DrawerToggleButton {...props} />,
        headerStyle: { backgroundColor: colors.header },
        headerTintColor: colors.headerTint,
        headerTitleStyle: { color: colors.headerTint },
        contentStyle: { backgroundColor: colors.background },
        headerShadowVisible: !isDark,
      }}
    >
      <Stack.Screen
        name="index"
        options={{ title: i18n.t("groups.title") }}
      />

      <Stack.Screen
        name="[groupId]"
        options={{ title: i18n.t("groups.detailTitle") }}
      />
    </Stack>
  );
}