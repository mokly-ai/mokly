import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";

import { parse } from "yaml";

import { repositoryRoot } from "./helpers/fixture.js";

const execute = promisify(execFile);
const actionPath = path.join(
  repositoryRoot,
  ".github/actions/publish/action.yml",
);
type Step = {
  id?: string;
  run?: string;
  env?: Record<string, string>;
  uses?: string;
};

async function actionFixture(context: test.TestContext) {
  const root = await fs.promises.mkdtemp(
    path.join(repositoryRoot, ".context/action-"),
  );
  context.after(() => fs.promises.rm(root, { force: true, recursive: true }));
  await fs.promises.writeFile(
    path.join(root, "package.json"),
    '{"type":"commonjs"}\n',
  );
  const calls = path.join(root, "calls.json");
  const npm = path.join(root, "npm");
  await fs.promises.writeFile(
    npm,
    `#!${process.execPath}
const fs = require('node:fs'); const path = require('node:path');
const args = process.argv.slice(2); const root = args[args.indexOf('--prefix') + 1];
fs.writeFileSync(process.env.CALLS, JSON.stringify({ args, token: process.env.MOKLY_TOKEN }));
const cli = path.join(root, 'node_modules/@mokly/mokly'); fs.mkdirSync(cli, { recursive: true });
fs.writeFileSync(path.join(cli, 'package.json'), JSON.stringify({name: '@mokly/mokly', version: process.env.MOKLY_VERSION, dependencies: process.env.LEGACY_CLI ? {} : {'@mokly/viewer': '0.1.0'}}));
const viewer = path.join(root, 'node_modules/@mokly/viewer'); fs.mkdirSync(path.join(viewer, 'dist'), { recursive: true });
fs.writeFileSync(path.join(viewer, 'package.json'), JSON.stringify({name: '@mokly/viewer', version: process.env.VIEWER_VERSION || '0.1.0', exports: {'./server': {node: './dist/server.js'}}}));
fs.writeFileSync(path.join(viewer, 'dist/server.js'), '');
const bin = path.join(root, 'node_modules/.bin'); fs.mkdirSync(bin, { recursive: true });
fs.writeFileSync(path.join(bin, 'mokly'), '#!${process.execPath}\\n' +
  'require("node:fs").writeFileSync(process.env.CLI_CALLS, JSON.stringify({ args: process.argv.slice(2), token: process.env.MOKLY_TOKEN, endpoint: process.env.MOKLY_ENDPOINT }));\\n', { mode: 0o755 });
`,
    { mode: 0o755 },
  );
  const action = parse(await fs.promises.readFile(actionPath, "utf8")) as {
    inputs: Record<string, { required?: boolean; default?: string }>;
    runs: { using: string; steps: Step[] };
  };
  const env = {
    ...process.env,
    PATH: `${root}:${process.env.PATH}`,
    RUNNER_TEMP: root,
    GITHUB_ACTION_PATH: path.dirname(actionPath),
    GITHUB_OUTPUT: path.join(root, "output"),
    CALLS: calls,
    CLI_CALLS: path.join(root, "cli.json"),
    MOKLY_TOKEN: "",
  };
  return { root, action, env, calls };
}

test("composite action installs an exact package separately and forwards hostile inputs literally", async (context) => {
  const fixture = await actionFixture(context);
  assert.equal(fixture.action.runs.using, "composite");
  assert.equal(fixture.action.inputs["version"]?.required, true);
  const install = fixture.action.runs.steps.find(
    (step) => step.id === "install",
  )!;
  const publish = fixture.action.runs.steps.find(
    (step) => step.id === "publish",
  )!;
  assert.ok(install.run && publish.run);
  assert.equal(install.run.includes("${{"), false);
  assert.equal(publish.run.includes("${{"), false);
  assert.equal(install.env?.["MOKLY_TOKEN"], undefined);
  assert.equal(publish.env?.["MOKLY_TOKEN"], "${{ inputs.token }}");
  await execute("bash", ["-e", "-o", "pipefail", "-c", install.run], {
    env: { ...fixture.env, MOKLY_VERSION: "1.2.3-beta.1" },
  });
  const installed = JSON.parse(
    await fs.promises.readFile(fixture.calls, "utf8"),
  );
  assert.ok(installed.args.includes("@mokly/mokly@1.2.3-beta.1"));
  assert.equal(installed.token, "");
  const output = await fs.promises.readFile(fixture.env.GITHUB_OUTPUT, "utf8");
  const bin = output.trim().slice("mokly_bin=".length);
  const config = `config space/$(touch ${fixture.root}/injected).ts`;
  const base = "branch; echo unexpected";
  await execute("bash", ["-e", "-o", "pipefail", "-c", publish.run], {
    env: {
      ...fixture.env,
      MOKLY_BIN: bin,
      MOKLY_CONFIG: config,
      MOKLY_BASE: base,
      MOKLY_NO_CHANGES: "false",
      MOKLY_ENDPOINT: "https://example.com/upload",
      MOKLY_TOKEN: "secret-token",
    },
  });
  assert.deepEqual(
    JSON.parse(await fs.promises.readFile(fixture.env.CLI_CALLS, "utf8")),
    {
      args: ["publish", "--config", config, "--base", base],
      token: "secret-token",
      endpoint: "https://example.com/upload",
    },
  );
  assert.equal(fs.existsSync(path.join(fixture.root, "injected")), false);
  await execute("bash", ["-e", "-o", "pipefail", "-c", publish.run], {
    env: {
      ...fixture.env,
      MOKLY_BIN: bin,
      MOKLY_CONFIG: "",
      MOKLY_BASE: "",
      MOKLY_NO_CHANGES: "true",
    },
  });
  assert.deepEqual(
    JSON.parse(await fs.promises.readFile(fixture.env.CLI_CALLS, "utf8")).args,
    ["publish", "--no-changes"],
  );
});

test("action rejects mismatched viewer installs and supports older standalone CLI releases", async (context) => {
  const fixture = await actionFixture(context);
  const install = fixture.action.runs.steps.find(
    (step) => step.id === "install",
  );
  assert.ok(install?.run);
  await assert.rejects(
    execute("bash", ["-e", "-o", "pipefail", "-c", install.run], {
      env: { ...fixture.env, MOKLY_VERSION: "0.10.0", VIEWER_VERSION: "0.2.0" },
    }),
    /AssertionError/,
  );
  await execute("bash", ["-e", "-o", "pipefail", "-c", install.run], {
    env: { ...fixture.env, MOKLY_VERSION: "0.9.0", LEGACY_CLI: "true" },
  });
});

test("action rejects floating package versions and invalid boolean options before execution", async (context) => {
  const fixture = await actionFixture(context);
  const install = fixture.action.runs.steps.find(
    (step) => step.id === "install",
  )!;
  const publish = fixture.action.runs.steps.find(
    (step) => step.id === "publish",
  )!;
  for (const version of [
    "",
    "latest",
    "^1.2.3",
    "file:/tmp/evil",
    "1.2.3; touch bad",
    "1.2.3-01",
  ])
    await assert.rejects(
      execute("bash", ["-e", "-c", install.run!], {
        env: { ...fixture.env, MOKLY_VERSION: version },
      }),
      /exact SemVer/,
    );
  assert.equal(fs.existsSync(fixture.calls), false);
  for (const [noChanges, base] of [
    ["maybe", ""],
    ["true", "main"],
  ])
    await assert.rejects(
      execute("bash", ["-e", "-c", publish.run!], {
        env: {
          ...fixture.env,
          MOKLY_BIN: "/nonexistent",
          MOKLY_CONFIG: "",
          MOKLY_BASE: base!,
          MOKLY_NO_CHANGES: noChanges!,
        },
      }),
      /no-changes/,
    );
});
