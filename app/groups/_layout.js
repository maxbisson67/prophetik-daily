import { Stack } from "expo-router";

export default function GroupsLayout() {
  // Cache le header du parent pour /groups/**
  return <Stack screenOptions={{ headerShown:true }} />;
}