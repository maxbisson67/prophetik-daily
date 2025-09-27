import { Stack, useRouter } from "expo-router";
import { HeaderProfileButton } from "@src/profile/HeaderProfileButton";

export default function RootLayout() {
  const r = useRouter();
  return (
    <Stack
      screenOptions={{
        headerRight: () => <HeaderProfileButton onPress={() => r.push("/profile")} />
      }}
    />
  );
}