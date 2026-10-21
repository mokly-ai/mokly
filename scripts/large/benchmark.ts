import fs from "node:fs/promises";
import path from "node:path";
import v8 from "node:v8";

import { chromium } from "@playwright/test";
import type { Browser } from "@playwright/test";

import { acceptanceForFixture } from "./acceptance_build.js";
import { browse } from "./browse.js";
import { browserMeasurement } from "./browser_measurement.js";
import { changes } from "./changes.js";
import { comparisonProfile } from "./comparison_profile.js";
import { inputProfile } from "./input_profile.js";
import { DEFAULT_MEMORY_STOP_KIB } from "./memory.js";
import { start, stop, waitFor } from "./process.js";
import { finishRun } from "./run_output.js";
import type { PreparedFixture } from "./setup.js";
import { startupBudget } from "./startup_budget.js";
import { WATCH_BROWSER_TIMEOUT_MS, watch } from "./watch.js";
import type { WatchMeasurement } from "./watch.js";

export type Scenario = "build" | "serve" | "changes" | "watch" | "startup";
export const scenarios: readonly Scenario[] = [
  "build",
  "serve",
  "changes",
  "watch",
];
export function parseScenario(value: string): Scenario | undefined {
  return value === "startup"
    ? value
    : scenarios.find((scenario) => scenario === value);
}
function comparisonArguments(baseline: string, enabled: boolean): string[] {
  return enabled ? ["--base", baseline] : ["--no-changes"];
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
    browser?: Browser;
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
  const completedEdits: WatchMeasurement[] = [];
  try {
    const acceptanceBuild = selected.some(
      (scenario) => scenario === "serve" || scenario === "startup",
    )
      ? await acceptanceForFixture(fixture)
      : undefined;
    for (const scenario of selected) {
      active = scenario;
      process.stderr.write(`Benchmark ${scenario}: starting\n`);
      if (scenario === "build") {
        const beginning = performance.now();
        const running = start(
          [
            cli,
            "build",
            ...common,
            "--strict",
            ...comparisonArguments(
              fixture.baseline,
              options.buildChanges !== false,
            ),
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
      const browser =
        options.browser ??
        (await chromium.launch({
          args: ["--renderer-process-limit=2", "--disable-gpu"],
          channel: process.env.PLAYWRIGHT_CHANNEL ?? "chrome",
        }));
      try {
        for (const state of scenario === "watch"
          ? ["live"]
          : ["cold", "warm"]) {
          const beginning = performance.now();
          const running = start(
            [
              cli,
              "serve",
              ...common,
              ...comparisonArguments(fixture.baseline, true),
              "--port",
              "0",
            ],
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
            const context = await browser.newContext({
              viewport: { width: 1440, height: 1000 },
            });
            const browserTimeout =
              scenario === "watch" ? WATCH_BROWSER_TIMEOUT_MS : 60_000;
            context.setDefaultTimeout(browserTimeout);
            context.setDefaultNavigationTimeout(browserTimeout);
            const measured = await browserMeasurement(
              context,
              running.done,
              scenario === "changes"
                ? changes(context, match[1]!, fixture, beginning)
                : scenario === "watch"
                  ? watch(context, match[1]!, fixture, completedEdits)
                  : browse(
                      context,
                      match[1]!,
                      fixture,
                      beginning,
                      scenario === "startup" ? "startup" : "serve",
                    ),
            );
            const elapsedMs = performance.now() - beginning;
            const reason =
              "usableMs" in measured
                ? startupBudget(measured.usableMs, fixture.variant)
                : undefined;
            results.push({
              scenario,
              state,
              status: reason ? "failed" : "measured",
              ...(reason ? { reason } : {}),
              ...(acceptanceBuild ? { acceptanceBuild } : {}),
              readinessMs,
              ...measured,
              elapsedMs,
              comparison: comparisonProfile(running.timings),
              basePreparation: {
                baseCommit: fixture.baseline,
                mode: "M9 Git sources and leased caches; retained across fresh processes",
                cacheDirectory:
                  running.output().match(/Mokly cache: ([^\r\n]+)/)?.[1] ??
                  null,
              },
              ...(await running.finishMemory()),
            });
            if (reason) throw new Error(reason);
          } finally {
            await finishRun(fixture.root, `${scenario}-${state}`, running);
          }
        }
      } finally {
        if (!options.browser) await browser.close();
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
        ...(active === "watch" ? { completedEdits } : {}),
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
