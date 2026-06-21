export function navigateToMesResultats(router, { groupId, challengeId, kind }) {
  const gid = String(groupId || "").trim();
  const cid = String(challengeId || "").trim();
  const k = String(kind || "").trim().toLowerCase();

  if (!cid) return;

  router.push({
    pathname: "/(drawer)/(tabs)/ChallengesScreen",
    params: {
      ...(gid ? { groupId: gid } : {}),
      openChallengeId: cid,
      ...(k ? { kind: k } : {}),
    },
  });
}

export function isTpResultsViewStatus(status) {
  const st = String(status || "").toLowerCase();
  return ["locked", "live", "partial", "pending", "decided", "closed"].includes(st);
}
