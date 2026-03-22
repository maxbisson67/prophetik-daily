import { onRequest } from "firebase-functions/v2/https";

export const pingHttpTest = onRequest(
  { region: "us-central1" },
  async (req, res) => {
    try {
      console.log("[PING] invoked");
      res.status(200).json({
        ok: true,
        body: req.body || null,
      });
    } catch (e) {
      console.error("[PING] error:", e);
      res.status(500).json({
        ok: false,
        error: e?.message || String(e),
      });
    }
  }
);