import test from "node:test";
import assert from "node:assert/strict";
import {
  resolveDefiSignupDeadline,
  shouldSendTsSignupReminder60,
} from "./tsSignupReminder60.js";

test("shouldSendTsSignupReminder60 — entre deadline-60min et deadline", () => {
  const deadlineMs = Date.parse("2026-10-09T23:00:00.000Z");
  const notifyAt = deadlineMs - 60 * 60 * 1000;

  assert.equal(
    shouldSendTsSignupReminder60({
      nowMs: notifyAt + 2 * 60 * 1000,
      deadlineMs,
      alreadySent: false,
    }),
    true
  );

  assert.equal(
    shouldSendTsSignupReminder60({
      nowMs: notifyAt + 55 * 60 * 1000,
      deadlineMs,
      alreadySent: false,
    }),
    true
  );

  assert.equal(
    shouldSendTsSignupReminder60({
      nowMs: notifyAt - 60 * 1000,
      deadlineMs,
      alreadySent: false,
    }),
    false
  );

  assert.equal(
    shouldSendTsSignupReminder60({
      nowMs: deadlineMs + 1000,
      deadlineMs,
      alreadySent: false,
    }),
    false
  );

  assert.equal(
    shouldSendTsSignupReminder60({
      nowMs: notifyAt + 1000,
      deadlineMs,
      alreadySent: true,
    }),
    false
  );
});

test("resolveDefiSignupDeadline — fallback firstGameUTC - 15 min", () => {
  const first = new Date("2026-10-09T23:00:00.000Z");
  const dl = resolveDefiSignupDeadline({ firstGameUTC: first });
  assert.equal(dl.getTime(), first.getTime() - 15 * 60 * 1000);
});
