/** Browser-visible startup and recorded worker evidence are independent acceptance boundaries. */
import os from "node:os";

import { chromium } from "@playwright/test";

import { loadConfig } from "../../dist/config/load.js";

import { resetFixtureBaseline } from "./baseline.mjs";
import { BenchmarkCancellation } from "./cancellation.mjs";
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
  const cancellation = new BenchmarkCancellation();
  try {
    return await runBenchmark(repository, fixture, definitions, cancellation);
  } finally {
    cancellation.dispose();
  }
}

async function runBenchmark(repository, fixture, definitions, cancellation) {
  const config = await loadConfig(fixture.root, fixture.configPath);
  let browser;
  let browserError;
  try {
    browser = await chromium.launch({
      channel: process.env.PLAYWRIGHT_CHANNEL ?? "chrome",
      handleSIGINT: false,
      handleSIGTERM: false,
      handleSIGHUP: false,
    });
  } catch (error) {
    browserError = error;
  }
  const matrix = await executeMatrix(
    definitions,
    {
      prepare: async (scenario) => {
        if (browserError) throw browserError;
        await prepareClassificationScenario(
          repository,
          fixture,
          scenario.name,
          cancellation.signal,
        );
        if (config.generatedOutput === "derived")
          await resetFixtureBaseline(config);
      },
      sample: (scenario, state) => {
        return benchmarkSample(
          browser,
          repository,
          fixture,
          scenario,
          state,
          cancellation,
        );
      },
      close: () => browser?.close(),
      restore: () => restoreFixtureSetup(repository, fixture),
      cancelled: () => cancellation.signal.aborted,
    },
    fixture,
  );
  const result = {
    ...fixture,
    ...matrix,
    classificationComplete:
      !cancellation.signal.aborted &&
      matrix.runs.every((run) => run.outcome === "ok"),
    ...(cancellation.signal.aborted ? { cancelled: true } : {}),
    generatedOutput: config.generatedOutput,
    machine: machineDetails(),
    targetHeld:
      !cancellation.signal.aborted &&
      matrix.runs.every(
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
  if (cancellation.signal.aborted) failures.push("Benchmark interrupted");
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
