import assert from "node:assert/strict";
import test from "node:test";

import { previewBytes } from "../scripts/large/http.js";
import { warnUnignored } from "../scripts/large/ignored_root.js";
import { lifetime, stopChild } from "../scripts/large/lifetime.js";
import type { ChildState, LifetimeSystem } from "../scripts/large/lifetime.js";
import { options } from "../scripts/large/options.js";
import { startupBudget } from "../scripts/large/startup_budget.js";

test("child lifetime kills its live group on exit and never signals a finished child", () => {
  const signals: [number, NodeJS.Signals][] = [];
  let onExit = () => {},
    removed = false;
  const boundary: LifetimeSystem = {
    pid: 10,
    kill: (pid, signal) => signals.push([pid, signal]),
    onExit: (callback) => {
      onExit = callback;
      return () => {
        removed = true;
      };
    },
  };
  const child: ChildState = { pid: 20, exitCode: null, signalCode: null };
  const owned = lifetime(child, boundary);
  onExit();
  assert.deepEqual(signals, [[-20, "SIGKILL"]]);
  child.exitCode = 0;
  owned.kill("SIGTERM");
  onExit();
  assert.equal(signals.length, 1);
  owned.finish();
  assert.equal(removed, true);
});

test("missing and reserved child PIDs never reach a group signal", () => {
  for (const pid of [-1, 0, 1, 10, 1.5, NaN]) {
    let exit = () => {};
    const owned = lifetime(
      { pid, exitCode: null, signalCode: null },
      {
        pid: 10,
        kill: () => assert.fail("unsafe PID"),
        onExit: (callback) => {
          exit = callback;
          return () => {};
        },
      },
    );
    owned.kill("SIGTERM");
    exit();
    owned.finish();
  }
});

test("build deadline shutdown escalates and cancels its scheduled force step", async () => {
  const signals: string[] = [];
  let resolve = () => {};
  const done = new Promise<void>((complete) => {
    resolve = complete;
  });
  let force = () => {},
    cancelled = false;
  const stopping = stopChild(
    {
      done,
      kill: (signal) => {
        signals.push(signal);
      },
    },
    (callback) => {
      force = callback;
      return () => {
        cancelled = true;
      };
    },
  );
  assert.deepEqual(signals, ["SIGTERM"]);
  force();
  assert.deepEqual(signals, ["SIGTERM", "SIGKILL"]);
  resolve();
  await stopping;
  assert.equal(cancelled, true);
});

test("benchmark options reject unused generation flags and record opt-in limits", () => {
  for (const flag of [
    "--variant",
    "--toolchain",
    "--areas",
    "--screens",
    "--rows",
    "--stylesheets",
    "--stylesheet-share",
  ])
    assert.throws(() => options(["benchmark", flag, "1"]), /is not used/);
  const input = options([
    "benchmark",
    "--root",
    ".context/example",
    "--memory-stop-kib",
    "0",
    "--sidecar-timeout-ms",
    "300000",
  ]);
  assert.equal(input.memoryStopKiB, 0);
  assert.equal(input.sidecarTimeoutMs, 300000);
  assert.equal(options(["benchmark"]).memoryStopKiB, 1_750_000);
  assert.equal(options(["benchmark"]).sidecarTimeoutMs, undefined);
  for (const value of ["-1", "1.5", "NaN"])
    assert.throws(
      () => options(["benchmark", "--memory-stop-kib", value]),
      /non-negative/,
    );
});

test("startup budgets classify synthetic observations for each variant", () => {
  for (const [variant, limit] of [
    ["html", 5000],
    ["react", 15000],
  ] as const) {
    assert.equal(startupBudget(limit - 1, variant), undefined);
    assert.match(
      startupBudget(limit, variant)!,
      new RegExp(`under ${limit} ms`),
    );
    assert.match(startupBudget(limit + 1, variant)!, /observed/);
    for (const invalid of [-1, NaN, Infinity])
      assert.match(startupBudget(invalid, variant)!, /Usable startup/);
  }
  assert.equal(startupBudget(5000, "react"), undefined);
});

test("failed cached preview HTTP cannot become a successful measurement", async () => {
  let requests = 0;
  await assert.rejects(
    previewBytes(new URL("http://fixture.invalid/preview"), async () => {
      requests++;
      return new Response("failed", { status: 500 });
    }),
    /HTTP 500/,
  );
  assert.equal(requests, 1);
});

test("unignored fixture roots emit a warning through the injected git check", async () => {
  const warnings: string[] = [];
  await warnUnignored(
    "/repo",
    "/repo/fixture",
    async (file, args) => {
      assert.equal(file, "git");
      assert.deepEqual(args, [
        "check-ignore",
        "--quiet",
        "--no-index",
        "/repo/fixture",
      ]);
      throw new Error("not ignored");
    },
    (message) => {
      warnings.push(message);
    },
  );
  assert.match(warnings[0]!, /not confirmed ignored/);
});
