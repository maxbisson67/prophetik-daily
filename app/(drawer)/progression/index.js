import { Redirect } from "expo-router";
import { BADGES_TAB_HREF } from "@src/achievements/screens/ProgressionScreen";

export default function ProgressionRedirect() {
  return <Redirect href={BADGES_TAB_HREF} />;
}
