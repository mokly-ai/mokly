import fs from "node:fs/promises";
import path from "node:path";
import v8 from "node:v8";

import { chromium } from "@playwright/test";

import { browse } from "./browse.js";
import { inputProfile } from "./input_profile.js";
import { DEFAULT_MEMORY_STOP_KIB } from "./memory.js";
import { start, stop, waitFor } from "./process.js";
import { finishRun } from "./run_output.js";
import type { PreparedFixture } from "./setup.js";
import { startupBudget } from "./startup_budget.js";

export type Scenario = "build" | "serve" | "changes" | "watch";
export const scenarios: readonly Scenario[] = [
  "build",
  "serve",
  "changes",
  "watch",
];
export function deferred(scenario: Scenario) {
  if (scenario === "changes")
    return {
      scenario,
      status: "deferred",
      owner: "M9",
      reason: "Wait for Changes integration and delivered Browse evidence",
    };
  if (scenario === "watch")
    return {
      scenario,
      status: "deferred",
      owner: "M11",
      reason: "Wait for watcher integration and frame reload evidence",
    };
  return undefined;
}
export async function benchmark(
  fixture: PreparedFixture,
  selected: readonly Scenario[],
  sidecars: number,
  options: {
    memoryStopKiB?: number;
    sidecarTimeoutMs?: number;
    buildChanges?: boolean;
    buildDeadlineMs?: number;
  } = {},
) {
  const memoryStopKiB = options.memoryStopKiB ?? DEFAULT_MEMORY_STOP_KIB;
  const cli = path.join(
    fixture.root,
    "node_modules/@mokly/mokly/bin/mokly.mjs",
  );
  const common = [
    "--debug-timings",
    "--config",
    fixture.configPath,
    "--sidecars",
    String(sidecars),
  ];
  const results: object[] = [];
  const report = {
    schemaVersion: 1,
    fixture,
    sidecars,
    buildChanges: options.buildChanges ?? true,
    buildDeadlineMs: options.buildDeadlineMs ?? 300_000,
    memoryStopKiB,
    sidecarTimeoutMs: options.sidecarTimeoutMs ?? null,
    sidecarTimeoutEnvironment: process.env.MOKLY_SIDECAR_TIMEOUT_MS ?? null,
    nodeOptions: process.env.NODE_OPTIONS ?? null,
    goMemoryLimit: process.env.GOMEMLIMIT ?? null,
    goMaxProcs: Number(process.env.GOMAXPROCS) || null,
    nodeHeapLimitMiB: Math.round(
      v8.getHeapStatistics().heap_size_limit / 1024 / 1024,
    ),
    memory: "sampled aggregate RSS; CLI process tree and whole harness tree",
    results,
  };
  let active: Scenario | undefined;
  try {
    for (const scenario of selected) {
      active = scenario;
      process.stderr.write(`Benchmark ${scenario}: starting\n`);
      const pending = deferred(scenario);
      if (pending) {
        results.push(pending);
        continue;
      }
      if (scenario === "build") {
        const beginning = performance.now();
        const running = start(
          [
            cli,
            "build",
            ...common,
            "--strict",
            ...(options.buildChanges === false ? ["--no-changes"] : []),
          ],
          fixture.root,
          memoryStopKiB,
          options.sidecarTimeoutMs,
        );
        let expired = false;
        const timer = setTimeout(() => {
          expired = true;
          void stop(running).catch(() => {});
        }, options.buildDeadlineMs ?? 300_000);
        try {
          await running.done;
          if (expired || running.child.signalCode !== null)
            throw new Error("Build exceeded the harness liveness deadline");
          const memory = await running.finishMemory();
          results.push({
            scenario,
            status: "measured",
            elapsedMs: performance.now() - beginning,
            ...memory,
            inputProfile: inputProfile(running.timings, memory.observations),
          });
        } finally {
          clearTimeout(timer);
          await finishRun(fixture.root, "build", running);
        }
        continue;
      }
      const browser = await chromium.launch({
        args: ["--renderer-process-limit=2", "--disable-gpu"],
        channel: process.env.PLAYWRIGHT_CHANNEL ?? "chrome",
      });
      try {
        for (const state of ["cold", "warm"]) {
          const beginning = performance.now();
          const running = start(
            [cli, "serve", ...common, "--port", "0"],
            fixture.root,
            memoryStopKiB,
            options.sidecarTimeoutMs,
          );
          try {
            const match = await waitFor(
              running,
              /Mokly listening at (http:\/\/127\.0\.0\.1:\d+)/,
            );
            const readinessMs = performance.now() - beginning;
            const measured = await Promise.race([
              browse(browser, match[1]!, fixture, beginning),
              running.done.then(() => {
                throw new Error("Serve stopped before browser verification");
              }),
            ]);
            const elapsedMs = performance.now() - beginning;
            const reason = startupBudget(measured.usableMs);
            results.push({
              scenario,
              state,
              status: reason ? "failed" : "measured",
              ...(reason ? { reason } : {}),
              readinessMs,
              ...measured,
              elapsedMs,
              ...(await running.finishMemory()),
            });
            if (reason) throw new Error(reason);
          } finally {
            await finishRun(fixture.root, `serve-${state}`, running);
          }
        }
      } finally {
        await browser.close();
      }
    }
  } catch (error) {
    if (
      !results.some(
        (result) => "status" in result && result.status === "failed",
      )
    )
      results.push({
        scenario: active,
        status: "failed",
        reason: error instanceof Error ? error.message : String(error),
      });
    await fs.writeFile(
      path.join(fixture.root, ".context/measurements.json"),
      JSON.stringify(report, null, 2) + "\n",
    );
    throw error;
  }
  await fs.writeFile(
    path.join(fixture.root, ".context/measurements.json"),
    JSON.stringify(report, null, 2) + "\n",
  );
  return report;
}
