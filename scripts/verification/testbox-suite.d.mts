import type { VerificationShard } from "./evidence.mjs";

/** The independently executable repository suites. */
export type TestboxSuite =
  "repository" | "package" | "unit" | "browser" | "hydration";

/** One request validated before any runtime work starts. */
export interface TestboxArguments {
  expected: string;
  suite: TestboxSuite;
  shard?: VerificationShard;
  commandName: string;
}

/** A shell-free subprocess with captured discovery or streamed suite output. */
export interface TestboxCommand {
  file: string;
  args: string[];
  cwd: string;
  env: NodeJS.ProcessEnv;
  captureOutput: boolean;
}

/** A process exit with its optional termination and forwarded interrupt. */
export interface TestboxOutcome {
  exitCode: number | null;
  signal?: NodeJS.Signals | null;
  interrupted?: NodeJS.Signals | null;
  stdout: string;
  stderr: string;
}

/** Runtime configuration supplied by the composition root. */
export interface TestboxConfiguration {
  cwd: string;
  environment: NodeJS.ProcessEnv;
}

/** All commands and file operations used by the suite orchestrator. */
export interface TestboxDependencies extends TestboxConfiguration {
  readFingerprint(): Promise<string>;
  readFile(file: string): Promise<Uint8Array>;
  writeFile(file: string, contents: string): Promise<void>;
  runCommand(command: TestboxCommand): Promise<TestboxOutcome>;
}

/** Validate the suite request and derive its stable command name. */
export function parseTestboxArguments(
  args: readonly string[],
): TestboxArguments;

/** Run one suite with injected commands, environment and working-tree reads. */
export function runTestboxSuite(
  args: readonly string[],
  dependencies: TestboxDependencies,
): Promise<number>;

/** Construct the file and owned-process adapters used by the CLI. */
export function createTestboxDependencies(
  configuration: TestboxConfiguration,
): TestboxDependencies;
