// app/(drawer)/sports/nhl-live.js
import React from "react";
import SportsHubScreen from "./index";

export default function NhlLiveRoute() {
  return <SportsHubScreen initialLeague="NHL" hideSportTabs />;
}