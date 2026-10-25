import assert from "node:assert/strict";
import test from "node:test";

import type { FullConfig } from "@playwright/test";

import { requireCurrentOnlyIndex } from "./browser/copied_static_setup.js";
import setup from "./browser/setup.js";

function held<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

for (const fails of [false, true]) {
  test(`setup starts Serve and both copied builds together and drains late hosts: ${fails}`, async () => {
    const before = Object.fromEntries(
      [
        "MOKLY_PLAYWRIGHT_URLS",
        "MOKLY_PLAYWRIGHT_COPIED_URL",
        "MOKLY_PLAYWRIGHT_COPIED_DIR",
        "MOKLY_PLAYWRIGHT_COMPARISON_URL",
        "MOKLY_PLAYWRIGHT_COMPARISON_DIR",
      ].map((key) => [key, process.env[key]]),
    );
    const signals: AbortSignal[] = [];
    const started: string[] = [];
    const closed: string[] = [];
    const serve = held<void>();
    const copy = held<void>();
    const comparison = held<void>();
    const late = held<void>();
    const host = (name: string) => ({
      url: `http://${name}`,
      directory: `/${name}`,
      close: async () => {
        closed.push(name);
      },
    });
    const result = setup({ workers: 1 } as FullConfig, {
      start: async (_count, signal) => {
        signals.push(signal);
        started.push("serve");
        await serve.promise;
        await late.promise;
        return [host("serve")];
      },
      staticHost: async (signal) => {
        signals.push(signal!);
        started.push("copy");
        await copy.promise;
        return host("copy");
      },
      comparisonHost: async (signal) => {
        signals.push(signal!);
        started.push("comparison");
        await comparison.promise;
        return host("comparison");
      },
      host: async () => {
        throw new Error("Unexpected manual host");
      },
    });
    // Attach rejection handling before releasing the deliberately failing task.
    const failure = new Error("fixture copy failed");
    const observed = fails
      ? assert.rejects(result, (error) => error === failure)
      : result;
    assert.deepEqual(started, ["serve", "copy", "comparison"]);
    assert.equal(new Set(signals).size, 1);
    serve.resolve();
    comparison.resolve();
    if (fails) {
      const aborted = new Promise<void>((resolve) =>
        signals[0]!.addEventListener("abort", () => resolve(), { once: true }),
      );
      copy.reject(failure);
      await aborted;
      assert.equal(signals[0]!.reason, failure);
      assert.deepEqual(closed, []);
    } else copy.resolve();
    late.resolve();
    const close = await observed;
    if (typeof close === "function") await close();
    assert.deepEqual(
      closed.sort(),
      fails ? ["comparison", "serve"] : ["comparison", "copy", "serve"],
    );
    for (const [key, value] of Object.entries(before))
      assert.equal(process.env[key], value, key);
  });
}

test("a supplied static copy requires disabled Changes and explains the build flag", () => {
  requireCurrentOnlyIndex({ changesStatus: "disabled" }, "/site");
  for (const index of [
    null,
    {},
    { changesStatus: "ready" },
    { changesStatus: "pending" },
  ]) {
    assert.throws(() => requireCurrentOnlyIndex(index, "/site"), {
      message:
        'Static browser catalogue /site must have changesStatus "disabled"; build it with --no-changes',
    });
  }
});
