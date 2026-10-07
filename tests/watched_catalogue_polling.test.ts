import assert from "node:assert/strict";
import test from "node:test";

import {
  waitForChangedCount,
  waitForUpdate,
} from "./helpers/watched_catalogue.js";

const url = "http://127.0.0.1:1234";

function shell(version: number, changes?: number, pending = false): string {
  const filter =
    changes === undefined
      ? '<span class="mbk-nav-filter-count"></span>'
      : `<span class="mbk-nav-filter-count">${changes}</span>`;
  const status = pending
    ? "pending"
    : changes === undefined
      ? "unavailable"
      : "ready";
  return `<html data-mokly-update-version="${version}" data-changes-status="${status}">${filter}</html>`;
}

for (const { name, states, changes } of [
  {
    name: "waits for the intended Changes state after intermediate publications",
    states: [shell(1, 0), shell(2, 2), shell(3, undefined, true), shell(4, 0)],
    changes: 0,
  },
  {
    name: "keeps unavailable Changes distinct from a successful empty result",
    states: [shell(2, 0), shell(3, undefined, true), shell(4)],
    changes: undefined,
  },
]) {
  test(name, async (context) => {
    const responses = [...states];
    const fetch = context.mock.method(globalThis, "fetch", async () => {
      const html = responses.shift();
      assert.notEqual(html, undefined);
      return new Response(html);
    });
    const html = await waitForChangedCount(url, 1, changes);
    assert.equal(html, states.at(-1));
    assert.equal(fetch.mock.callCount(), states.length);
  });
}

test("an unconstrained update still requires a strictly higher version", async (context) => {
  const responses = [shell(1, 0), shell(2, 2)];
  context.mock.method(
    globalThis,
    "fetch",
    async () => new Response(responses.shift()),
  );
  assert.equal(await waitForUpdate(url, 1), shell(2, 2));
});

test("a newer but wrong Changes state fails within the original deadline", async (context) => {
  context.mock.timers.enable({ apis: ["Date", "setTimeout"] });
  context.mock.method(
    globalThis,
    "fetch",
    async () => new Response(shell(2, 2)),
  );
  const rejected = assert.rejects(
    waitForChangedCount(url, 1, 0),
    /did not publish 0 changed screens.*last version 2, Changes 2/,
  );
  await new Promise(setImmediate);
  context.mock.timers.tick(20_000);
  await rejected;
});

test("transient child transport errors retry without relaxing the expected state", async (context) => {
  let attempts = 0;
  context.mock.method(globalThis, "fetch", async () => {
    if (attempts++ === 0)
      throw new TypeError("fetch failed", {
        cause: { code: "ECONNREFUSED" },
      });
    return new Response(shell(2, 0));
  });
  assert.equal(await waitForChangedCount(url, 1, 0), shell(2, 0));
  assert.equal(attempts, 2);
});

test("non-transient HTTP failures are not hidden by state polling", async (context) => {
  const fetch = context.mock.method(
    globalThis,
    "fetch",
    async () => new Response("broken", { status: 500 }),
  );
  await assert.rejects(waitForChangedCount(url, 1, 0), {
    name: "AssertionError",
  });
  assert.equal(fetch.mock.callCount(), 1);
});
