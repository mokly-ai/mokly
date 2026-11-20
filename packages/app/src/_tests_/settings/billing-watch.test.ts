import assert from "node:assert/strict";
import { test } from "node:test";

import type { Billing } from "../../api/types";
import { withWindowAsync } from "../page-window";

import { pane, settle } from "./billing-watch-harness";

test("a plain focus reads once", async (t) => {
  const subject = pane(t, ["free"]);
  await withWindowAsync(subject.page, async () => {
    subject.mount();
    subject.focus();
    await settle();
    assert.deepEqual(subject.log, ["reload"]);
    subject.unmount();
  });
});

test("the first focus after Checkout reads until Team, then focus reads once", async (t) => {
  const subject = pane(t, ["free", "free", "team"]);
  await withWindowAsync(subject.page, async () => {
    subject.mount();
    subject.opened();
    subject.focus();
    await settle();
    assert.deepEqual(subject.log, ["read", "accept free"]);

    // Focus while the wait runs starts nothing else.
    subject.focus();
    await settle();
    assert.equal(subject.log.length, 2);

    t.mock.timers.tick(2_000);
    await settle();
    t.mock.timers.tick(2_000);
    await settle();
    assert.deepEqual(subject.log.slice(2), [
      "read",
      "accept free",
      "read",
      "accept team",
    ]);

    t.mock.timers.tick(2_000);
    await settle();
    assert.equal(subject.reads(), 3, "no read follows Team");
    subject.focus();
    await settle();
    assert.equal(subject.log.at(-1), "reload");
    subject.unmount();
  });
});

test("the wait after Checkout ends after thirty seconds of Free", async (t) => {
  const subject = pane(t, ["free"]);
  await withWindowAsync(subject.page, async () => {
    subject.mount();
    subject.opened();
    subject.focus();
    await settle();
    for (let second = 0; second < 40; second += 2) {
      t.mock.timers.tick(2_000);
      await settle();
    }
    // One read at the start and one every two seconds before the deadline.
    assert.equal(subject.reads(), 15);
    assert.ok(!subject.log.includes("reload"));
    subject.focus();
    await settle();
    assert.equal(subject.log.at(-1), "reload");
    subject.unmount();
  });
});

test("a failed read in the wait hands over to the pane's own read", async (t) => {
  const subject = pane(t, ["free", "fail"]);
  await withWindowAsync(subject.page, async () => {
    subject.mount();
    subject.opened();
    subject.focus();
    await settle();
    t.mock.timers.tick(2_000);
    await settle();
    assert.deepEqual(subject.log, ["read", "accept free", "read", "reload"]);
    subject.unmount();
  });
});

test("leaving the pane ends the wait", async (t) => {
  const subject = pane(t, ["free"]);
  await withWindowAsync(subject.page, async () => {
    subject.mount();
    subject.opened();
    subject.focus();
    await settle();
    subject.unmount();
    t.mock.timers.tick(10_000);
    await settle();
    assert.deepEqual(subject.log, ["read", "accept free"]);
  });
});

test("a pending Checkout read frees focus at the deadline and ignores its late failure", async (t) => {
  const stalled = Promise.withResolvers<Billing>();
  const subject = pane(t, [stalled.promise]);
  await withWindowAsync(subject.page, async () => {
    subject.mount();
    try {
      subject.opened();
      subject.focus();
      await settle();
      t.mock.timers.tick(29_999);
      await settle();
      subject.focus();
      await settle();
      assert.deepEqual(subject.log, ["read"]);

      t.mock.timers.tick(1);
      await settle();
      subject.focus();
      await settle();
      assert.deepEqual(subject.log, ["read", "reload"]);

      stalled.reject(new Error("unavailable"));
      await settle();
      assert.deepEqual(subject.log, ["read", "reload"]);
    } finally {
      subject.unmount();
    }
  });
});
