import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { TestContext } from "node:test";
import { pathToFileURL } from "node:url";

import { exportCatalogue } from "../../dist/export/run.js";
import { NodeGitCommandRunner } from "../../dist/review/git.js";

import { derivedFixture } from "./derived_fixture.js";
import { esbuildCancellationEnvironment } from "./esbuild_cancellation.js";
import { createExportFixture, directoryFiles } from "./export_fixture.js";
import { startFakeReceiver } from "./fake_receiver.js";
import { repositoryRoot } from "./fixture.js";

const cli = path.join(repositoryRoot, "dist/cli/bin.js");
const preload = pathToFileURL(
  path.join(
    repositoryRoot,
    "tests/helpers/pre_installation_cancellation_preload.ts",
  ),
).href;
const token = "pre-installation-cancellation-token";

/** Stable plain output for a cancelled publish command. */
export const CANCELLATION_LINE =
  "[mokly/upload-failed] Publication was cancelled. Run mokly publish again when you are ready.\n";

/** Pre-installation point selected by one cancellation scenario. */
export type CancellationPhase =
  "comparison" | "compile" | "configuration" | "input-recheck" | "staging";

/** Run one detached CLI cancellation scenario against an untouched prior export. */
export async function cancellationScenario(
  context: TestContext,
  storage: "blobs" | "rebuild",
  phase: CancellationPhase,
  outputMode: "plain" | "rich",
  diagnostic = false,
) {
  const fixture = await catalogueFixture(context, storage);
  await exportCatalogue(fixture.config, {
    outDir: "site",
    noChanges: true,
  });
  const previous = await directoryFiles(fixture.output);
  const phaseConfiguration = await configurePhase(context, fixture, phase);
  if (["comparison", "configuration", "input-recheck"].includes(phase)) {
    const git = new NodeGitCommandRunner(fixture.root);
    await git.run([
      "add",
      "--",
      phase === "comparison" ? ".test-bin" : "mokly.config.ts",
    ]);
    await git.run([
      "commit",
      "-qm",
      "test: commit publication cancellation hook",
    ]);
  }
  const receiver = await startFakeReceiver(context, { token });
  const result = await spawnPublish(fixture.root, receiver.endpoint, {
    ...phaseConfiguration.environment,
    MOKLY_DIAGNOSTIC: diagnostic ? "1" : "",
    MOKLY_OUTPUT: outputMode,
    MOKLY_TEST_PREINSTALL_PHASE: phase,
  });
  if (phaseConfiguration.marker)
    assert.equal(fs.existsSync(phaseConfiguration.marker), true);
  assert.equal((result.stdout + result.stderr).includes(token), false);
  return { fixture, previous, receiver, result };
}

/** Assert cancellation preserved local bytes and never reached the receiver. */
export async function assertCancelledScenario(
  scenario: Awaited<ReturnType<typeof cancellationScenario>>,
): Promise<void> {
  assert.deepEqual(
    await directoryFiles(scenario.fixture.output),
    scenario.previous,
  );
  assert.equal(scenario.receiver.requests.length, 0);
}

async function catalogueFixture(
  context: TestContext,
  storage: "blobs" | "rebuild",
) {
  if (storage === "blobs") {
    const fixture = await createExportFixture();
    context.after(() => fixture.close());
    return fixture;
  }
  const fixture = await derivedFixture(context);
  return { ...fixture, output: path.join(fixture.root, "site") };
}

async function configurePhase(
  context: TestContext,
  fixture: { configPath: string; root: string },
  phase: CancellationPhase,
): Promise<{ environment: NodeJS.ProcessEnv; marker?: string }> {
  if (phase === "compile") return esbuildCancellationEnvironment(context);
  if (phase === "comparison") {
    const directory = path.join(fixture.root, ".test-bin");
    await fs.promises.mkdir(directory);
    await fs.promises.writeFile(
      path.join(directory, "git"),
      gitWrapper(realGitPath()),
      { mode: 0o755 },
    );
    return {
      environment: {
        PATH: `${directory}${path.delimiter}${process.env["PATH"]}`,
      },
    };
  }
  if (phase === "configuration" || phase === "input-recheck") {
    const temporary = await fs.promises.mkdtemp(
      path.join(os.tmpdir(), "mokly-publish-cancel-"),
    );
    context.after(() =>
      fs.promises.rm(temporary, { force: true, recursive: true }),
    );
    const marker = path.join(temporary, "input-recheck");
    const source = await fs.promises.readFile(fixture.configPath, "utf8");
    await fs.promises.writeFile(
      fixture.configPath,
      `${configurationHook()}\n${source}`,
    );
    return { environment: { MOKLY_TEST_PREINSTALL_MARKER: marker } };
  }
  return { environment: {} };
}

function configurationHook(): string {
  return `import { spawn } from "node:child_process";
import fs from "node:fs";
const phase = process.env["MOKLY_TEST_PREINSTALL_PHASE"];
const marker = process.env["MOKLY_TEST_PREINSTALL_MARKER"];
const cancel = async () => {
  await new Promise((resolve, reject) => {
    const helper = spawn(process.execPath, ["-e", 'process.kill(-process.ppid, "SIGINT")'], { stdio: "ignore" });
    helper.once("error", reject);
    helper.once("close", resolve);
  });
  throw new Error("Injected failure after process-group cancellation");
};
if (phase === "configuration") await cancel();
if (phase === "input-recheck" && marker) {
  if (fs.existsSync(marker)) await cancel();
  fs.writeFileSync(marker, "ready");
}`;
}

function gitWrapper(git: string): string {
  return `#!/usr/bin/env node
import { spawnSync } from "node:child_process";
const args = process.argv.slice(2);
if (args[0] === "merge-base") {
  process.kill(-process.ppid, "SIGINT");
  process.stdin.resume();
} else {
  const result = spawnSync(${JSON.stringify(git)}, args, { stdio: "inherit" });
  if (result.error) throw result.error;
  process.exit(result.status ?? 1);
}
`;
}

function realGitPath(): string {
  for (const candidate of ["/usr/bin/git", "/bin/git"])
    if (fs.existsSync(candidate)) return candidate;
  for (const directory of (process.env["PATH"] ?? "").split(path.delimiter)) {
    const candidate = path.join(
      directory,
      process.platform === "win32" ? "git.exe" : "git",
    );
    if (fs.existsSync(candidate)) return candidate;
  }
  throw new Error("Git executable is unavailable");
}

async function spawnPublish(
  cwd: string,
  endpoint: string,
  environment: NodeJS.ProcessEnv,
): Promise<{
  code: number | null;
  signal: NodeJS.Signals | null;
  stderr: string;
  stdout: string;
}> {
  const child = spawn(
    process.execPath,
    [
      "--import",
      "tsx",
      "--import",
      preload,
      cli,
      "publish",
      "--endpoint",
      endpoint,
      "--token",
      token,
      "--repository",
      "github.com/sample/catalogue",
      "--out",
      "site",
    ],
    {
      cwd,
      detached: true,
      env: {
        ...process.env,
        ...environment,
        COLUMNS: "240",
        NO_COLOR: "1",
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  let stdout = "";
  let stderr = "";
  child.stdout.setEncoding("utf8").on("data", (chunk) => (stdout += chunk));
  child.stderr.setEncoding("utf8").on("data", (chunk) => (stderr += chunk));
  return await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      if (child.pid !== undefined) process.kill(-child.pid, "SIGKILL");
      reject(new Error("publish cancellation scenario timed out"));
    }, 60_000);
    child.once("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.once("close", (code, signal) => {
      clearTimeout(timeout);
      resolve({ code, signal, stderr, stdout });
    });
  });
}
