import React from "react";
import { useTheme } from "@src/theme/ThemeProvider";
import useAppUpdateCheck from "@src/hooks/useAppUpdateCheck";
import AppUpdateRequiredScreen from "@src/home/components/AppUpdateRequiredScreen";

export default function AppUpdateGate({ children }) {
  const { colors } = useTheme();
  const {
    updateRequired,
    message,
    currentVersion,
    minSupportedVersion,
    storeUrl,
  } = useAppUpdateCheck();

  if (updateRequired) {
    return (
      <AppUpdateRequiredScreen
        colors={colors}
        message={message}
        currentVersion={currentVersion}
        minSupportedVersion={minSupportedVersion}
        storeUrl={storeUrl}
      />
    );
  }

  return children;
}
