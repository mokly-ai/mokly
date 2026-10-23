import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import test from "node:test";

import type { Browser } from "@playwright/test";

import { monitorBrowser } from "./browser/error_monitor.js";

test("one context clock settles later pages and restores the original methods", async () => {
  const calls: string[] = [];
  const clock = {
    pauseAt: async () => {
      calls.push("pause");
    },
    resume: async () => {
      calls.push("resume");
    },
    runFor: async (time: number) => {
      calls.push(`advance ${time}`);
    },
  };
  const originals = { ...clock };
  const page = () => ({ clock, isClosed: () => false });
  const pages = [page(), page()];
  const context = Object.assign(new EventEmitter(), {
    clock,
    pages: () => pages,
    close: async () => {},
  });
  const browser = {
    contexts: () => [context],
    newContext: async () => context,
    newPage: async () => pages[0]!,
  };
  const monitor = monitorBrowser(browser as unknown as Browser);
  await pages[0]!.clock.pauseAt();
  pages.push(page());
  await monitor.finish();
  assert.deepEqual(calls, ["pause", "advance 32"]);
  for (const target of pages) {
    assert.equal(target.clock.pauseAt, originals.pauseAt);
    assert.equal(target.clock.resume, originals.resume);
  }
  assert.equal(context.listenerCount("console"), 0);
  assert.equal(context.listenerCount("weberror"), 0);
});
