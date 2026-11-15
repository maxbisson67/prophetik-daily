import functions from "@react-native-firebase/functions";

export async function setGroupTeamSplitService({
  groupId,
  teamAName,
  teamBName,
  roster,
}) {
  const gid = String(groupId || "").trim();
  if (!gid) {
    const err = new Error("GROUP_ID_MISSING");
    err.code = "invalid-argument";
    throw err;
  }

  try {
    const callable = functions().httpsCallable("setGroupTeamSplit");
    const res = await callable({
      groupId: gid,
      teamAName: String(teamAName || "").trim(),
      teamBName: String(teamBName || "").trim(),
      roster: roster || {},
    });
    return res?.data || {};
  } catch (e) {
    const err = new Error(String(e?.message || e));
    err.code = String(e?.code || "");
    err.details = e?.details ?? null;
    throw err;
  }
}
