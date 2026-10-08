/** Execute isolated assertion-guard fixtures and read repository evidence. */
import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import type { TestContext } from "node:test";

import { repositoryRoot } from "./fixture.js";

interface GuardFailure {
  name: string;
  diagnostic: string;
}
interface GuardSummary {
  file: string;
  counts: {
    tests: number;
    passed: number;
    failed: number;
    skipped: number;
    todo: number;
  };
}
/** Evidence returned by one real Node fixture run. */
export interface GuardOutcome {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  report: {
    reporterComplete: boolean;
    summaries: GuardSummary[];
    failures: GuardFailure[];
  };
}

/** Run a fixture with clean process gates and an owned evidence file. */
export async function guardFixture(
  context: TestContext,
  fixture: string,
  guard = true,
  scenario?: string,
  tsx = true,
): Promise<GuardOutcome> {
  const root = await fs.mkdtemp(
    path.join(repositoryRoot, ".context/assertion-guard-"),
  );
  context.after(() => fs.rm(root, { recursive: true, force: true }));
  const events = path.join(root, "events.json");
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    MOKLY_NODE_EVENT_REPORT: events,
  };
  delete env.NODE_TEST_CONTEXT;
  delete env.MOKLY_ASSERTION_GUARD_PID;
  const args: string[] = tsx ? ["--import", "tsx"] : [];
  if (guard)
    args.push("--import", "./scripts/verification/assertion-guard.mjs");
  args.push(
    "--test",
    "--test-reporter=./scripts/verification/node-reporter.mjs",
    `scripts/verification/_fixtures_/assertion-guard/${fixture}.mjs`,
  );
  if (scenario) env.MOKLY_GUARD_SCENARIO = scenario;
  const result = spawnSync(process.execPath, args, {
    cwd: repositoryRoot,
    env,
    encoding: "utf8",
    timeout: 20_000,
  });
  if (result.error) throw result.error;
  const report = JSON.parse(
    await fs.readFile(events, "utf8"),
  ) as GuardOutcome["report"];
  return {
    exitCode: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
    report,
  };
}
