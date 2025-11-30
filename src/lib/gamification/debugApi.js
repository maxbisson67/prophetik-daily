// src/lib/gamification/debugApi.js
import { Platform } from "react-native";

export async function debugSimulateGamification(type, { uid, groupId, count } = {}) {
  const payload = { type, uid, groupId, count };

  if (Platform.OS === "web") {
    const { getFunctions, httpsCallable } = require("firebase/functions");
    const { app } = require("@src/lib/firebase");
    const functions = getFunctions(app);
    const fn = httpsCallable(functions, "debugSimulateGamification");
    const res = await fn(payload);
    return res.data;
  }

  const functions = require("@react-native-firebase/functions").default();
  const fn = functions.httpsCallable("debugSimulateGamification");
  const res = await fn(payload);
  return res.data;
}