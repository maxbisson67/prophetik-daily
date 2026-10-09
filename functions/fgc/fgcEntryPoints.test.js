import test from "node:test";
import assert from "node:assert/strict";
import { resolveFgcEntryPoints, isFgcEntryWinner } from "./fgcEntryPoints.js";
import { FGC_WIN_POINTS } from "../challengeScoringConstants.js";

test("resolveFgcEntryPoints — plancher SOLO = FGC_WIN_POINTS", () => {
  assert.equal(FGC_WIN_POINTS, 5);
});

test("resolveFgcEntryPoints — gagnant sans payout utilise le plancher", () => {
  const pts = resolveFgcEntryPoints(
    { uid: "u1", won: true },
    { winnersPreviewUids: ["u1"] }
  );
  assert.equal(pts, 5);
});

test("resolveFgcEntryPoints — conserve un vieux crédit à 10 pts", () => {
  const pts = resolveFgcEntryPoints(
    { uid: "ai", won: true, payout: 10, points: 10 },
    { winnersPreviewUids: [] }
  );
  assert.equal(pts, 10);
});

test("resolveFgcEntryPoints — non gagnant → 0", () => {
  const pts = resolveFgcEntryPoints({ uid: "u1", payout: 0, won: false }, {});
  assert.equal(pts, 0);
});

test("isFgcEntryWinner — winnersPreviewUids", () => {
  assert.equal(isFgcEntryWinner({ uid: "ai" }, { winnersPreviewUids: ["ai"] }), true);
});
