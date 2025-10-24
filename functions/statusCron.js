// functions/statusCron.js
import { onSchedule } from "firebase-functions/v2/scheduler";
import { db, readTS } from "./utils.js";

export const cronIngestToday = onSchedule(
  { schedule: "*/5 * * * *", timeZone: "America/Toronto", region: "us-central1" },
  async () => {
    const snap = await db.collection("defis").get();
    const now = new Date();
    for (const docSnap of snap.docs) {
      const d = { id: docSnap.id, ...(docSnap.data() || {}) };
      const startAt = readTS(d.startAt);
      const endAt   = readTS(d.endAt);
      let status = String(d.status || "").toLowerCase();
      if (status === "completed") continue;
      if (startAt && now < startAt) status = "open";
      else if (startAt && endAt && now >= startAt && now <= endAt) status = "live";
      else if (endAt && now > endAt) status = "awaiting_result";
      await docSnap.ref.set({ status }, { merge: true });
    }
  }
);

// alias historique
export const cronDefiStatus = cronIngestToday;