const projectId = "capitaine";
const gameId = process.argv[2] || "2025021048";

const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 10000);

try {
  console.log("[repairFGC] starting...");
  console.log("[repairFGC] projectId =", projectId);
  console.log("[repairFGC] gameId =", gameId);

  const res = await fetch(
    `http://127.0.0.1:5001/${projectId}/us-central1/repairFirstGoalGameCallable`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        data: {
          gameId,
        },
      }),
      signal: controller.signal,
    }
  );

  const text = await res.text();

  console.log("[repairFGC] status =", res.status);
  console.log("[repairFGC] raw response =", text);

  try {
    const json = JSON.parse(text);
    console.dir(json, { depth: null });
  } catch {
    // laisse le raw response affiché
  }
} catch (e) {
  console.error("[repairFGC] error =", e?.message || e);
} finally {
  clearTimeout(timeout);
}