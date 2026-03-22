// functions/testHttp.js
import { onRequest } from "firebase-functions/v2/https";

export const repairFirstGoalGameHttpTest = onRequest(
  { region: "us-central1" },
  async (req, res) => {
    res.json({
      ok: true,
      body: req.body || null,
    });
  }
);