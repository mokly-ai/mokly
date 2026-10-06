import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import type {
  CoverageFileRecord,
  CoverageTotals,
} from "../../scripts/verification/coverage.mjs";

import { repositoryRoot } from "./fixture.js";

const execute = promisify(execFile);

/** Exit status and output of one coverage command in a harness. */
export interface CoverageCommandResult {
  code: number;
  stderr: string;
  stdout: string;
}

/** Output and parsed `coverage/summary.json` of one harness run. */
export interface CoverageRun {
  stdout: string;
  stderr: string;
  summary: {
    complete: boolean;
    failures: readonly { name: string }[];
    files: readonly CoverageFileRecord[];
    findings: readonly string[];
    outcome: { exitCode: number | null; status: string };
    testFiles: readonly string[];
    thresholdsChecked: boolean;
    totals: CoverageTotals;
    unmapped: readonly CoverageFileRecord[];
  };
}

/**
 * Create an isolated repository under the ignored test context.
 *
 * The harness copies the verification scripts, links `node_modules`, writes
 * the prepared-output markers, and adds one source with one unit test that
 * calls one of its two functions.
 */
export async function createCoverageHarness(): Promise<string> {
  const root = await fs.mkdtemp(
    path.join(repositoryRoot, ".context/coverage-runner-"),
  );
  await fs.cp(
    path.join(repositoryRoot, "scripts/verification"),
    path.join(root, "scripts/verification"),
    { recursive: true },
  );
  await fs.symlink(
    path.join(repositoryRoot, "node_modules"),
    path.join(root, "node_modules"),
    process.platform === "win32" ? "junction" : "dir",
  );
  const files = new Map([
    ["dist/cli/bin.js", ""],
    ["packages/viewer/dist/browser/inspector.js", ""],
    ["examples/basic/generated/mokly-manifest.json", "{}\n"],
    [
      "src/subject.ts",
      `export function covered(value: number): string {
  if (value > 0) return "positive";
  return "other";
}

export function uncovered(): string {
  return "never executed by the coverage harness";
}
`,
    ],
    [
      "tests/subject.test.ts",
      `import assert from "node:assert/strict";
import test from "node:test";

import { covered } from "../src/subject.js";

test("covered subject", () => {
  assert.equal(covered(1), "positive");
});
`,
    ],
  ]);
  for (const [name, contents] of files)
    await writeHarnessFile(root, name, contents);
  await fs.mkdir(path.join(root, "packages/viewer/tests"), { recursive: true });
  return root;
}

/** Write one harness file, creating its parent directories. */
export async function writeHarnessFile(
  root: string,
  name: string,
  contents: string,
): Promise<void> {
  const target = path.join(root, name);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, contents);
}

/** Replace the harness's reviewed coverage thresholds. */
export async function writeCoverageThresholds(
  root: string,
  thresholds: Readonly<Record<string, number>>,
): Promise<void> {
  await writeHarnessFile(
    root,
    "scripts/verification/coverage-thresholds.json",
    `${JSON.stringify(thresholds)}\n`,
  );
}

/** Run the coverage command, require its exit code, and parse its summary. */
export async function runCoverage(
  root: string,
  args: readonly string[],
  expectedExitCode = 0,
  overrides: Readonly<Record<string, string>> = {},
): Promise<CoverageRun> {
  const result = await runCoverageCommand(root, args, overrides);
  assert.equal(result.code, expectedExitCode, result.stderr);
  const summary = JSON.parse(
    await fs.readFile(path.join(root, "coverage/summary.json"), "utf8"),
  );
  return { stdout: result.stdout, stderr: result.stderr, summary };
}

/** Run the coverage command in a harness without judging its result. */
export async function runCoverageCommand(
  root: string,
  args: readonly string[],
  overrides: Readonly<Record<string, string>> = {},
): Promise<CoverageCommandResult> {
  const environment = { ...process.env, ...overrides };
  delete environment.NODE_TEST_CONTEXT;
  return await execute(
    process.execPath,
    [path.join(root, "scripts/verification/run-coverage.mjs"), ...args],
    { cwd: root, env: environment, maxBuffer: 64 * 1024 * 1024 },
  ).then(
    (output) => ({ ...output, code: 0 }),
    (error: { code?: unknown; stderr?: string; stdout?: string }) => {
      if (typeof error.code !== "number") throw error;
      return {
        code: error.code,
        stderr: error.stderr ?? "",
        stdout: error.stdout ?? "",
      };
    },
  );
}
