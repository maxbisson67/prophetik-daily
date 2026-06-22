import React from "react";
import i18n from "@src/i18n/i18n";
import ProgressionScreen from "@src/achievements/screens/ProgressionScreen";

export default function BadgesScreen() {
  return (
    <ProgressionScreen
      title={i18n.t("tabs.badges", { defaultValue: "Badges" })}
    />
  );
}
