import { performance } from "node:perf_hooks";

import {
  runWithTimings,
  timeAsync,
  type TimingEvent,
} from "../../dist/diagnostics/timings.js";

const FIXTURE_TIMING_PREFIX = "[mokly:fixture-timing] ";

/** One measured setup phase, including whether the test asserts that operation. */
export interface FixturePhaseTiming {
  readonly schemaVersion: 1;
  readonly fixture: string;
  readonly phase: string;
  readonly durationMs: number | null;
  readonly status: "error" | "not-observed" | "ok";
  readonly operationUnderTest: boolean;
}

interface FixtureTimingOptions {
  readonly clock?: () => number;
  readonly write?: (timing: FixturePhaseTiming) => void;
}

/** Measure a fixture-owned phase that sits outside Mokly timing spans. */
export async function timeFixturePhase<T>(
  fixture: string,
  phase: string,
  operationUnderTest: boolean,
  operation: () => Promise<T>,
  options: FixtureTimingOptions = {},
): Promise<T> {
  const clock = options.clock ?? (() => performance.now());
  const started = clock();
  let status: "error" | "ok" = "error";
  try {
    const result = await operation();
    status = "ok";
    return result;
  } finally {
    writeTiming(options, {
      durationMs: milliseconds(clock() - started),
      fixture,
      operationUnderTest,
      phase,
      schemaVersion: 1,
      status,
    });
  }
}

/** Measure derived baseline install/build and export spans for a real export setup. */
export async function timeExportPreparation<T>(
  fixture: string,
  operation: () => Promise<T>,
  options: FixtureTimingOptions = {},
): Promise<T> {
  const events: TimingEvent[] = [];
  try {
    return await runWithTimings(
      true,
      `browser-fixture:${fixture}`,
      () => timeAsync("export", operation),
      {
        ...(options.clock ? { clock: options.clock } : {}),
        write: (event) => events.push(event),
      },
    );
  } finally {
    const commands = ended(events, /^baseline\.command\[\d+\]$/);
    const install = commands.filter(
      (event) => event.stage === "baseline.command[0]",
    );
    const builds = commands.filter(
      (event) => event.stage !== "baseline.command[0]",
    );
    for (const [phase, selected] of [
      ["install", install],
      ["build", builds],
      ["baseline", ended(events, /^baseline$/)],
      ["export", ended(events, /^export$/)],
    ] as const)
      writeTiming(options, summarize(fixture, phase, selected));
  }
}

function ended(events: readonly TimingEvent[], stage: RegExp): TimingEvent[] {
  return events.filter(
    (event) => event.event === "end" && stage.test(event.stage),
  );
}

function summarize(
  fixture: string,
  phase: string,
  events: readonly TimingEvent[],
): FixturePhaseTiming {
  return {
    durationMs:
      events.length === 0
        ? null
        : milliseconds(
            events.reduce((total, event) => total + (event.durationMs ?? 0), 0),
          ),
    fixture,
    operationUnderTest: true,
    phase,
    schemaVersion: 1,
    status:
      events.length === 0
        ? "not-observed"
        : events.every((event) => event.status === "ok")
          ? "ok"
          : "error",
  };
}

function writeTiming(
  options: FixtureTimingOptions,
  timing: FixturePhaseTiming,
): void {
  if (options.write) options.write(timing);
  else
    process.stderr.write(`${FIXTURE_TIMING_PREFIX}${JSON.stringify(timing)}\n`);
}

function milliseconds(value: number): number {
  return Math.round(value * 100) / 100;
}
