import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test, { type TestContext } from "node:test";
import { pathToFileURL } from "node:url";

import { exportCatalogue } from "../dist/export/run.js";

import { derivedFixture } from "./helpers/derived_fixture.js";
import {
  createExportFixture,
  directoryFiles,
} from "./helpers/export_fixture.js";
import { startFakeReceiver } from "./helpers/fake_receiver.js";
import { repositoryRoot } from "./helpers/fixture.js";

const cli = path.join(repositoryRoot, "dist/cli/bin.js");
const preload = pathToFileURL(
  path.join(
    repositoryRoot,
    "tests/helpers/pre_installation_cancellation_preload.ts",
  ),
).href;
const token = "pre-installation-cancellation-token";
const cancellationLine =
  "[mokly/upload-failed] Publication was cancelled. Run mokly publish again when you are ready.\n";

for (const mode of ["committed", "derived"] as const) {
  for (const phase of ["comparison", "staging", "input-recheck"] as const) {
    test(
      `${mode} publish cancels during ${phase}`,
      { skip: process.platform === "win32" },
      async (context) => {
        const scenario = await cancellationScenario(
          context,
          mode,
          phase,
          "plain",
        );
        assert.deepEqual(scenario.result, {
          code: 1,
          signal: null,
          stderr: cancellationLine,
          stdout: "",
        });
        await assertCancelledScenario(scenario);
      },
    );
  }
}

test(
  "publish cancels during configuration loading",
  { skip: process.platform === "win32" },
  async (context) => {
    const scenario = await cancellationScenario(
      context,
      "committed",
      "configuration",
      "plain",
    );
    assert.deepEqual(scenario.result, {
      code: 1,
      signal: null,
      stderr: cancellationLine,
      stdout: "",
    });
    await assertCancelledScenario(scenario);
  },
);

test(
  "rich publish cancels during staging",
  { skip: process.platform === "win32" },
  async (context) => {
    const scenario = await cancellationScenario(
      context,
      "committed",
      "staging",
      "rich",
    );
    assert.equal(scenario.result.code, 1);
    assert.equal(scenario.result.signal, null);
    assert.match(scenario.result.stdout, /Exporting catalogue/u);
    assert.equal(
      scenario.result.stderr,
      "  ✖ Publication was cancelled.  [mokly/upload-failed]\n" +
        "    Run mokly publish again when you are ready.\n",
    );
    await assertCancelledScenario(scenario);
  },
);

type CancellationPhase =
  "comparison" | "configuration" | "input-recheck" | "staging";

async function cancellationScenario(
  context: TestContext,
  mode: "committed" | "derived",
  phase: CancellationPhase,
  outputMode: "plain" | "rich",
) {
  const fixture = await catalogueFixture(context, mode);
  await exportCatalogue(fixture.config, {
    outDir: "site",
    noChanges: true,
  });
  const previous = await directoryFiles(fixture.output);
  const phaseEnvironment = await configurePhase(context, fixture, phase);
  const receiver = await startFakeReceiver(context, { token });
  const result = await spawnPublish(fixture.root, receiver.endpoint, {
    ...phaseEnvironment,
    MOKLY_OUTPUT: outputMode,
    MOKLY_TEST_PREINSTALL_PHASE: phase,
  });
  assert.equal((result.stdout + result.stderr).includes(token), false);
  return { fixture, previous, receiver, result };
}

async function catalogueFixture(
  context: TestContext,
  mode: "committed" | "derived",
) {
  if (mode === "committed") {
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
): Promise<NodeJS.ProcessEnv> {
  if (phase === "comparison") {
    const directory = path.join(fixture.root, ".test-bin");
    await fs.promises.mkdir(directory);
    await fs.promises.writeFile(
      path.join(directory, "git"),
      gitWrapper(realGitPath()),
      { mode: 0o755 },
    );
    return { PATH: `${directory}${path.delimiter}${process.env["PATH"]}` };
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
    return { MOKLY_TEST_PREINSTALL_MARKER: marker };
  }
  return {};
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
        MOKLY_DIAGNOSTIC: "",
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

async function assertCancelledScenario(
  scenario: Awaited<ReturnType<typeof cancellationScenario>>,
): Promise<void> {
  assert.deepEqual(
    await directoryFiles(scenario.fixture.output),
    scenario.previous,
  );
  assert.equal(scenario.receiver.requests.length, 0);
}
