import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";

import { repositoryRoot } from "./helpers/fixture.js";
import { readTestboxWorkflow } from "./helpers/testbox_workflow.js";

const execute = promisify(execFile);
const workflowPath = ".github/workflows/blacksmith-testbox.yml";
const stepNames = [
  "Check out repository",
  "Begin Testbox",
  "Set up Node.js",
  "Set up npm",
  "Set up Rust",
  "Install dependencies",
  "Stamp installed lockfile",
  "Install Chromium",
  "Expose job environment to Testbox sessions",
  "Run Testbox",
];
const actionPins = [
  "useblacksmith/checkout@25227e61ff9dafe400e22fa487b673eac4e4409a # v1",
  "useblacksmith/begin-testbox@233448af4bfdc6fca509a7f0974411ac6d8a8043 # v2",
  "actions/setup-node@249970729cb0ef3589644e2896645e5dc5ba9c38 # v6.5.0",
  "useblacksmith/run-testbox@5ca05834db1d3813554d1dd109e5f2087a8d7cbc # v2",
];

test("Testbox dispatch and push triggers select only the preparation workflow", async () => {
  const { workflow } = await readTestboxWorkflow();
  assert.deepEqual(Object.keys(workflow.on).sort(), [
    "push",
    "workflow_dispatch",
  ]);
  assert.deepEqual(workflow.on.push, { paths: [workflowPath] });
  const inputs = workflow.on.workflow_dispatch.inputs;
  assert.deepEqual(Object.keys(inputs), ["testbox_id"]);
  assert.equal(inputs.testbox_id?.required, false);
  assert.equal(inputs.testbox_id?.default, "");
  assert.equal(inputs.testbox_id?.type ?? "string", "string");
});

test("Testbox has one read-only job with the minimum runner tier and timeout", async () => {
  const { source, workflow } = await readTestboxWorkflow();
  assert.deepEqual(workflow.permissions, { contents: "read" });
  assert.deepEqual(workflow.env, { PLAYWRIGHT_CHANNEL: "chromium" });
  assert.doesNotMatch(source, /\bsecrets\s*[.[]/iu);
  assert.doesNotMatch(source, /BLACKSMITH_ORG_TOKEN/u);
  assert.deepEqual(Object.keys(workflow.jobs), ["testbox"]);
  const job = workflow.jobs.testbox!;
  assert.equal(job["runs-on"], "blacksmith-2vcpu-ubuntu-2404");
  assert.equal(job["timeout-minutes"], 30);
  assert.equal(job.permissions, undefined);
  assert.equal(job.needs, undefined);
  const ci = (await readTestboxWorkflow("ci.yml")).workflow;
  assert.ok(!ci.jobs.required?.needs?.includes("testbox"));
});

test("Testbox steps use the exact order, action pins and version comments", async () => {
  const { source, workflow } = await readTestboxWorkflow();
  const steps = workflow.jobs.testbox!.steps;
  assert.deepEqual(
    steps.map(({ name }) => name),
    stepNames,
  );
  const pins = [...source.matchAll(/^\s+uses:\s*(.+)$/gmu)].map((match) =>
    match[1]!.trim(),
  );
  assert.deepEqual(pins, actionPins);
  assert.equal(steps[0]?.uses, actionPins[0]!.split(" # ")[0]);
  assert.equal(steps[1]?.uses, actionPins[1]!.split(" # ")[0]);
  assert.equal(steps[2]?.uses, actionPins[2]!.split(" # ")[0]);
  assert.equal(steps.at(-1)?.uses, actionPins[3]!.split(" # ")[0]);
  assert.deepEqual(steps[0]?.with, {
    "fetch-depth": 0,
    "persist-credentials": false,
  });
  assert.deepEqual(steps[1]?.with, { testbox_id: "${{ inputs.testbox_id }}" });
});

test("Testbox toolchains and npm cache match the CI minimum runtime", async () => {
  const manifest = JSON.parse(
    await fs.readFile(path.join(repositoryRoot, "package.json"), "utf8"),
  ) as { packageManager?: string };
  const npmVersion = /^npm@(\d+\.\d+\.\d+)$/u.exec(
    manifest.packageManager ?? "",
  )?.[1];
  assert.ok(npmVersion, "packageManager must pin an exact npm version");
  const { workflow } = await readTestboxWorkflow();
  const ci = (await readTestboxWorkflow("ci.yml")).workflow;
  const steps = workflow.jobs.testbox!.steps;
  const nativeNode = ci.jobs.native!.steps.find(
    ({ name }) => name === "Set up Node.js",
  );
  const nodeVersion = String(nativeNode?.with?.["node-version"]);
  assert.equal(nodeVersion, "22.14.0");
  assert.deepEqual(steps[2]?.with, {
    "node-version": nodeVersion,
    "package-manager-cache": false,
    cache: "npm",
    "cache-dependency-path": "package-lock.json",
  });
  const repository = ci.jobs.repository!.steps;
  assert.equal(
    steps[3]?.run,
    repository.find(({ name }) => name === "Set up npm")?.run,
  );
  assert.equal(steps[3]?.run, `npm install --global npm@${npmVersion}`);
  assert.equal(
    steps[4]?.run,
    repository.find(({ name }) => name === "Set up Rust")?.run,
  );
  assert.equal(
    steps[4]?.run,
    "rustup toolchain install 1.95.0 --profile minimal --component rustfmt --component clippy\nrustup default 1.95.0\n",
  );
  assert.equal(steps[5]?.run, "npm ci");
  assert.equal(steps[7]?.run, "npx playwright install --with-deps chromium");
});

test("Testbox lockfile stamp contains only the lowercase digest and one newline", async (context) => {
  const { workflow } = await readTestboxWorkflow();
  const script = workflow.jobs.testbox!.steps[6]!.run!;
  assert.ok(script.includes('"$HOME/.mokly-testbox/package-lock.sha256"'));
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "mokly-testbox-stamp-"));
  context.after(() => fs.rm(root, { recursive: true, force: true }));
  const lockfile = Buffer.from('{"lockfileVersion":3,"packages":{}}\n');
  await fs.writeFile(path.join(root, "package-lock.json"), lockfile);
  const output = await execute(
    "bash",
    ["--noprofile", "--norc", "-e", "-o", "pipefail", "-c", script],
    {
      cwd: root,
      env: { PATH: process.env.PATH, HOME: root },
    },
  );
  assert.equal(output.stdout, "");
  assert.equal(output.stderr, "");
  const actual = await fs.readFile(
    path.join(root, ".mokly-testbox/package-lock.sha256"),
    "utf8",
  );
  assert.equal(
    actual,
    `${createHash("sha256").update(lockfile).digest("hex")}\n`,
  );
  assert.match(actual, /^[0-9a-f]{64}\n$/u);
});

test("Testbox SSH environment replaces only PATH and PLAYWRIGHT_CHANNEL entries", async (context) => {
  const { workflow } = await readTestboxWorkflow();
  const original = workflow.jobs.testbox!.steps[8]!.run!;
  assert.match(
    original,
    /sudo sed -i '\/\^PATH=\/d;\/\^PLAYWRIGHT_CHANNEL=\/d' \/etc\/environment/u,
  );
  assert.match(original, /sudo tee -a \/etc\/environment >\/dev\/null/u);
  assert.doesNotMatch(original, /\$\{\{/u);
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "mokly-testbox-env-"));
  context.after(() => fs.rm(root, { recursive: true, force: true }));
  const file = path.join(root, "environment");
  await fs.writeFile(
    file,
    "LANG=en_US.UTF-8\nPATH=old\nPLAYWRIGHT_CHANNEL=old\nKEEP=value\nPATH=duplicate\n",
  );
  const script = original.replaceAll(
    "/etc/environment",
    '"$MOKLY_TESTBOX_ENVIRONMENT"',
  );
  const output = await execute(
    "bash",
    [
      "--noprofile",
      "--norc",
      "-e",
      "-o",
      "pipefail",
      "-c",
      `sudo() { "$@"; }\n${script}`,
    ],
    {
      cwd: root,
      env: {
        PATH: process.env.PATH,
        PLAYWRIGHT_CHANNEL: "chromium",
        MOKLY_TESTBOX_ENVIRONMENT: file,
      },
    },
  );
  assert.equal(output.stdout, "");
  assert.equal(output.stderr, "");
  assert.equal(
    await fs.readFile(file, "utf8"),
    `LANG=en_US.UTF-8\nKEEP=value\nPATH=${process.env.PATH}\nPLAYWRIGHT_CHANNEL=chromium\n`,
  );
});
