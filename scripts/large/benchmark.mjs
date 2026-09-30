/** Browser-visible startup and recorded worker evidence are independent acceptance boundaries. */
import os from "node:os";

import { chromium } from "@playwright/test";

import { loadConfig } from "../../dist/config/load.js";

import { resetFixtureBaseline } from "./baseline.mjs";
import { executeMatrix } from "./matrix.mjs";
import { benchmarkSample } from "./sample.mjs";
import {
  classificationScenarios,
  prepareClassificationScenario,
  restoreFixtureSetup,
} from "./scenarios.mjs";

export async function benchmark(
  repository,
  fixture,
  definitions = classificationScenarios,
) {
  const config = await loadConfig(fixture.root, fixture.configPath);
  let browser;
  let browserError;
  const cancelled = { value: false };
  try {
    browser = await chromium.launch({
      channel: process.env.PLAYWRIGHT_CHANNEL ?? "chrome",
    });
  } catch (error) {
    browserError = error;
  }
  const matrix = await executeMatrix(
    definitions,
    {
      prepare: async (scenario) => {
        if (browserError) throw browserError;
        if (cancelled.value) throw new Error("Benchmark interrupted");
        await prepareClassificationScenario(repository, fixture, scenario.name);
        if (config.generatedOutput === "derived")
          await resetFixtureBaseline(config);
      },
      sample: (scenario, state) => {
        if (cancelled.value) throw new Error("Benchmark interrupted");
        return benchmarkSample(
          browser,
          repository,
          fixture,
          scenario,
          state,
          cancelled,
        );
      },
      close: () => browser?.close(),
      restore: () => restoreFixtureSetup(repository, fixture),
    },
    fixture,
  );
  const result = {
    ...fixture,
    ...matrix,
    classificationComplete: matrix.runs.every((run) => run.outcome === "ok"),
    generatedOutput: config.generatedOutput,
    machine: machineDetails(),
    targetHeld: matrix.runs.every(
      (run) => Number.isFinite(run.usableMs) && run.usableMs < 5000,
    ),
  };
  process.stdout.write(`Benchmark ${JSON.stringify(result)}\n`);
  const failures = matrix.runs.flatMap((run) => [
    ...(run.outcome !== "ok"
      ? [
          `${run.scenario}/${run.state}: ${run.outcome}: ${run.error ?? "Changes membership mismatch"}`,
        ]
      : []),
    ...(run.usableMs >= 5000
      ? [
          `${run.scenario}/${run.state} usable startup exceeded 5 seconds: ${run.usableMs}ms`,
        ]
      : []),
  ]);
  if (matrix.restorationError)
    failures.push(`Fixture restoration failed: ${matrix.restorationError}`);
  if (failures.length)
    throw new Error(`Benchmark failed:\n${failures.join("\n")}`);
  return result;
}

function machineDetails() {
  const cpus = os.cpus();
  return {
    platform: process.platform,
    arch: process.arch,
    node: process.version,
    cpu: cpus[0]?.model ?? "unknown",
    logicalCpus: cpus.length,
    memoryGiB: Number((os.totalmem() / 1024 ** 3).toFixed(1)),
  };
}
