import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";

import { repositoryRoot } from "./helpers/fixture.js";

const execute = promisify(execFile);

test("public test commands retain native runner entrypoints", async () => {
  const packageJson = JSON.parse(
    await fs.readFile(path.join(repositoryRoot, "package.json"), "utf8"),
  );
  const scripts = packageJson.scripts as Readonly<Record<string, string>>;
  const unit = scripts.test;
  const browser = scripts["test:browser"];
  assert.ok(unit);
  assert.ok(browser);

  assert.match(
    unit,
    /&& tsx --test --test-concurrency=2 tests\/\*\*\/\*\.test\.ts /,
  );
  assert.equal(unit.includes("test:prepared"), false);
  assert.match(browser, /&& playwright test$/);
  assert.equal(browser.includes("test:browser:prepared"), false);
});

test("prepared verification commands remain shard-only wrappers", async () => {
  const packageJson = JSON.parse(
    await fs.readFile(path.join(repositoryRoot, "package.json"), "utf8"),
  );
  const scripts = packageJson.scripts as Readonly<Record<string, string>>;

  assert.equal(
    scripts["test:prepared"],
    "node scripts/verification/run-unit.mjs",
  );
  assert.equal(
    scripts["test:browser:prepared"],
    "node scripts/verification/run-browser.mjs",
  );
});

test("public package wrappers preserve caller arguments through npm", async (context) => {
  const root = await fs.mkdtemp(
    path.join(os.tmpdir(), "mokly-package-entrypoints-"),
  );
  const output = path.join(root, "arguments.json");
  const artifacts = path.join(root, "artifact pair");
  context.after(() => fs.rm(root, { force: true, recursive: true }));
  const packageJson = JSON.parse(
    await fs.readFile(path.join(repositoryRoot, "package.json"), "utf8"),
  );
  const scripts = packageJson.scripts as Readonly<Record<string, string>>;
  await Promise.all([
    fs.writeFile(
      path.join(root, "package.json"),
      JSON.stringify({
        name: "mokly-package-entrypoint-probe",
        private: true,
        scripts: {
          build: 'node -e ""',
          "package:check": scripts["package:check"],
          "package:check:prepared": "node arguments.mjs",
          "package:smoke": scripts["package:smoke"],
          "package:smoke:prepared": "node arguments.mjs",
        },
      }),
    ),
    fs.writeFile(
      path.join(root, "arguments.mjs"),
      'import fs from "node:fs"; fs.writeFileSync(process.env.MOKLY_ARGUMENT_OUTPUT, JSON.stringify(process.argv.slice(2)));\n',
    ),
  ]);
  const npm = process.platform === "win32" ? "npm.cmd" : "npm";
  for (const script of ["package:check", "package:smoke"]) {
    const environment = { ...process.env, MOKLY_ARGUMENT_OUTPUT: output };
    await execute(npm, ["run", script], { cwd: root, env: environment });
    assert.deepEqual(JSON.parse(await fs.readFile(output, "utf8")), []);
    await execute(npm, ["run", script, "--", "--artifacts", artifacts], {
      cwd: root,
      env: environment,
    });
    assert.deepEqual(JSON.parse(await fs.readFile(output, "utf8")), [
      "--artifacts",
      artifacts,
    ]);
  }
});
