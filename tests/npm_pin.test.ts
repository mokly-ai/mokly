import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";

import { parse } from "yaml";

import { repositoryRoot } from "./helpers/fixture.js";

const execute = promisify(execFile);

/** The first npm release that writes lockfile `libc` fields (npm/cli#9025). */
const FIRST_NPM_WITH_LOCKFILE_LIBC = "11.11.0";
const LOCKFILE_CHECK_STEP = "Verify lockfile matches pinned npm";
const LOCKFILE_CHECK_INSTALL =
  "npm install --ignore-scripts --no-audit --no-fund";
const LOCKFILE_CHECK_ERROR =
  /::error title=Lockfile does not match pinned npm::npm 0\.0\.0-stub changed package\.json or package-lock\.json\. Run npm install with npm 0\.0\.0-stub, then commit the changed files\./u;
/** Workflows whose dependency installs must use the pinned npm. */
const PINNED_WORKFLOWS = ["ci.yml", "release.yml"] as const;
const NPM_PIN = /npm (?:install|i) (?:--global|-g) npm@(\S+)/gu;
const STUB_NPM = `#!/bin/sh
if [ "$*" = "--version" ]; then
  echo "0.0.0-stub"
  exit 0
fi
if [ "$*" != "${LOCKFILE_CHECK_INSTALL.slice("npm ".length)}" ]; then
  echo "unexpected npm arguments: $*" >&2
  exit 2
fi
case "$STUB_NPM_MODE" in
  lockfile) echo '{"lockfileVersion":3,"rewritten":true}' > package-lock.json ;;
  manifest) echo '{"name":"fixture","rewritten":true}' > package.json ;;
  failure) exit 1 ;;
esac
`;

type StubMode = "unchanged" | "lockfile" | "manifest" | "failure";

interface WorkflowStep {
  name?: string;
  run?: string;
}

interface WorkflowJob {
  steps?: readonly WorkflowStep[];
}

interface Workflow {
  jobs: Readonly<Record<string, WorkflowJob>>;
}

test("every automation npm pin matches the packageManager version", async () => {
  const pinned = await pinnedNpmVersion();
  const pins = (await automationSources()).flatMap(({ file, source }) =>
    [...source.matchAll(NPM_PIN)].map((match) => ({ file, version: match[1] })),
  );
  assert.ok(pins.length > 0, "workflows must pin npm");
  for (const pin of pins) assert.equal(pin.version, pinned, pin.file);
});

test("CI and release jobs set up the pinned npm before npm ci", async () => {
  const pinned = await pinnedNpmVersion();
  let installs = 0;
  for (const file of PINNED_WORKFLOWS) {
    const workflow = await readWorkflow(file);
    for (const [name, job] of Object.entries(workflow.jobs)) {
      const steps = job.steps ?? [];
      const install = steps.findIndex((step) => step.run === "npm ci");
      if (install < 0) continue;
      installs += 1;
      const setup = steps.findIndex(
        (step) => step.run === `npm install --global npm@${pinned}`,
      );
      assert.ok(
        setup >= 0 && setup < install,
        `${file}:${name} must set up npm ${pinned} before npm ci`,
      );
    }
  }
  assert.ok(installs > 0, "CI and release workflows must install dependencies");
});

test("the pinned npm writes the lockfile's libc platform fields", async () => {
  const pinned = await pinnedNpmVersion();
  assert.ok(
    compareVersions(pinned, FIRST_NPM_WITH_LOCKFILE_LIBC) >= 0,
    `npm ${pinned} drops lockfile libc fields; pin npm ${FIRST_NPM_WITH_LOCKFILE_LIBC} or newer`,
  );
});

test("the repository job verifies the lockfile after npm ci", async () => {
  const steps = (await readWorkflow("ci.yml")).jobs.repository?.steps ?? [];
  const install = steps.findIndex((step) => step.run === "npm ci");
  const check = steps.findIndex((step) => step.name === LOCKFILE_CHECK_STEP);
  const verification = steps.findIndex((step) =>
    step.run?.includes("cargo xtask check --suite repository"),
  );
  assert.ok(install >= 0 && install < check && check < verification);
  assert.ok(steps[check]?.run?.includes(LOCKFILE_CHECK_INSTALL));
});

test("the lockfile check fails when the pinned npm rewrites a manifest", async (context) => {
  const script = await lockfileCheckScript();
  await context.test(
    "passes when npm leaves both files unchanged",
    async () => {
      await assert.doesNotReject(runLockfileCheck(script, "unchanged"));
    },
  );
  for (const mode of ["lockfile", "manifest"] as const) {
    await context.test(`fails when npm rewrites the ${mode}`, async () => {
      await assert.rejects(runLockfileCheck(script, mode), (error) => {
        assert.match(String(outputOf(error)), LOCKFILE_CHECK_ERROR);
        return true;
      });
    });
  }
  await context.test("fails when npm install fails", async () => {
    await assert.rejects(runLockfileCheck(script, "failure"), (error) => {
      assert.doesNotMatch(String(outputOf(error)), LOCKFILE_CHECK_ERROR);
      return true;
    });
  });
});

test("developer and protocol docs name the pinned npm version", async () => {
  const pinned = await pinnedNpmVersion();
  for (const file of [
    "README.md",
    "docs/protocol/ci-workflow.md",
    "docs/protocol/npm-release-management.md",
  ]) {
    const source = (await read(file)).replace(/\s+/gu, " ");
    assert.ok(
      source.includes(`npm ${pinned}`),
      `${file} must name npm ${pinned}`,
    );
  }
});

async function runLockfileCheck(script: string, mode: StubMode): Promise<void> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "mokly-npm-pin-"));
  const repository = path.join(root, "repository");
  const bin = path.join(root, "bin");
  try {
    await fs.mkdir(repository);
    await fs.mkdir(bin);
    await fs.writeFile(path.join(bin, "npm"), STUB_NPM, { mode: 0o755 });
    await fs.writeFile(
      path.join(repository, "package.json"),
      '{"name":"fixture"}\n',
    );
    await fs.writeFile(
      path.join(repository, "package-lock.json"),
      '{"lockfileVersion":3}\n',
    );
    const git = (...args: string[]) =>
      execute("git", args, { cwd: repository });
    await git("init", "--quiet");
    await git("config", "user.name", "Mokly");
    await git("config", "user.email", "mokly@example.invalid");
    await git("config", "commit.gpgsign", "false");
    await git("add", "package.json", "package-lock.json");
    await git("commit", "--quiet", "--message", "fixture");
    await execute(
      "bash",
      ["--noprofile", "--norc", "-e", "-o", "pipefail", "-c", script],
      {
        cwd: repository,
        env: {
          ...process.env,
          PATH: `${bin}${path.delimiter}${process.env.PATH ?? ""}`,
          STUB_NPM_MODE: mode,
        },
      },
    );
  } finally {
    await fs.rm(root, { force: true, recursive: true });
  }
}

async function lockfileCheckScript(): Promise<string> {
  const steps = (await readWorkflow("ci.yml")).jobs.repository?.steps ?? [];
  const script = steps.find((step) => step.name === LOCKFILE_CHECK_STEP)?.run;
  assert.ok(script, `the repository job must run "${LOCKFILE_CHECK_STEP}"`);
  return script;
}

async function pinnedNpmVersion(): Promise<string> {
  const manifest = JSON.parse(await read("package.json")) as {
    packageManager?: string;
  };
  const version = /^npm@(\d+\.\d+\.\d+)$/u.exec(
    manifest.packageManager ?? "",
  )?.[1];
  assert.ok(version, "packageManager must pin an exact npm version");
  return version;
}

async function automationSources(): Promise<
  readonly { file: string; source: string }[]
> {
  const workflows = (
    await fs.readdir(path.join(repositoryRoot, ".github/workflows"))
  )
    .filter((name) => /\.ya?ml$/u.test(name))
    .map((name) => `.github/workflows/${name}`);
  const actionEntries = await fs.readdir(
    path.join(repositoryRoot, ".github/actions"),
    { withFileTypes: true },
  );
  const actions = actionEntries
    .filter((entry) => entry.isDirectory())
    .map((entry) => `.github/actions/${entry.name}/action.yml`);
  return await Promise.all(
    [...workflows, ...actions].map(async (file) => ({
      file,
      source: await read(file),
    })),
  );
}

async function readWorkflow(file: string): Promise<Workflow> {
  return parse(await read(`.github/workflows/${file}`)) as Workflow;
}

async function read(file: string): Promise<string> {
  return await fs.readFile(path.join(repositoryRoot, file), "utf8");
}

function outputOf(error: unknown): unknown {
  return (error as { stdout?: unknown }).stdout;
}

function compareVersions(left: string, right: string): number {
  const leftParts = left.split(".").map(Number);
  const rightParts = right.split(".").map(Number);
  for (let index = 0; index < 3; index += 1) {
    const difference = (leftParts[index] ?? 0) - (rightParts[index] ?? 0);
    if (difference !== 0) return difference;
  }
  return 0;
}
