import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { minimatch } from "minimatch";

import browserConfig from "../playwright.config.js";
import { discoverUnitFiles } from "../scripts/verification/evidence.mjs";

import { repositoryRoot } from "./helpers/fixture.js";
import { runNpm } from "./helpers/npm.js";

test("every unit run loads the assertion guard after tsx", async () => {
  const read = (file: string) =>
    fs.readFile(
      path.join(repositoryRoot, "scripts/verification", file),
      "utf8",
    );
  assert.match(
    await read("unit-execution.mjs"),
    /"--import",\s*"tsx",\s*"--import",\s*"\.\/scripts\/verification\/assertion-guard\.mjs"/u,
  );
  for (const runner of ["unit-runner.mjs", "unit-selected-run.mjs"])
    assert.match(
      await read(runner),
      /from "\.\/unit-execution\.mjs"[\s\S]*executeUnitTests\(/u,
      `${runner} must run tests through executeUnitTests`,
    );
});

test("public browser test command retains the Playwright entrypoint", async () => {
  const packageJson = JSON.parse(
    await fs.readFile(path.join(repositoryRoot, "package.json"), "utf8"),
  );
  const scripts = packageJson.scripts as Readonly<Record<string, string>>;
  const browser = scripts["test:browser"];
  assert.ok(browser);
  assert.match(browser, /&& playwright test$/);
  assert.equal(browser.includes("test:browser:prepared"), false);
});

test("npm test and the strict gate share recursive unit discovery", async () => {
  const packageJson = JSON.parse(
    await fs.readFile(path.join(repositoryRoot, "package.json"), "utf8"),
  );
  assert.equal(
    packageJson.scripts.test,
    "npm run test:unit --",
    "npm test must forward every argument to the developer unit command",
  );
  assert.equal(
    packageJson.scripts["test:unit"],
    "npm run prepare:unit && node scripts/verification/run-unit-dev.mjs",
    "npm test must use the developer runner, not shell globs that silently skip root-level unit files",
  );
  assert.equal(
    packageJson.scripts["prepare:unit"],
    "npm run prepare:verification && node scripts/verification/example-snapshot.mjs",
    "unit preparation must add the example compilation snapshot to the ordinary preparation",
  );
  assert.equal(
    packageJson.scripts["prepare:verification"],
    "npm run build && npm run example:build",
    "package, browser, and hydration suites never read the snapshot",
  );
  assert.equal(
    packageJson.scripts["test:prepared"],
    "node scripts/verification/run-unit.mjs",
  );
  for (const [entrypoint, policy] of [
    ["run-unit.mjs", "strict"],
    ["run-unit-dev.mjs", "developer"],
  ] as const) {
    const source = await fs.readFile(
      path.join(repositoryRoot, "scripts/verification", entrypoint),
      "utf8",
    );
    assert.match(
      source,
      /from "\.\/unit-runner\.mjs"/u,
      `${entrypoint} must use shared discovery and execution; unquoted shell globs and Playwright's matcher cannot cover the Node inventory`,
    );
    assert.ok(
      source.includes(`runUnitVerification("${policy}",`),
      `${entrypoint} must keep the ${policy} skip policy; test:prepared rejects skipped tests`,
    );
  }
  const runner = await fs.readFile(
    path.join(repositoryRoot, "scripts/verification/unit-runner.mjs"),
    "utf8",
  );
  assert.ok(
    runner.includes('await requirePrepared(repositoryRoot, "unit");'),
    "both unit runners must require the example compilation snapshot",
  );
  assert.doesNotMatch(
    runner,
    /example-snapshot\.mjs|dist\//u,
    "the unit runner checks that the snapshot exists and never imports the compiler",
  );
});

test("unit discovery never loads a file from Playwright's testDir", async () => {
  assert.ok(browserConfig.testDir);
  const browserDirectory = path
    .relative(
      repositoryRoot,
      path.resolve(repositoryRoot, browserConfig.testDir),
    )
    .split(path.sep)
    .join("/");
  const files = await discoverUnitFiles(repositoryRoot);
  assert.deepEqual(
    files.filter((file) => file.startsWith(`${browserDirectory}/`)),
    [],
    "Node tests inside Playwright's testDir can be loaded by Playwright's matcher as browser tests",
  );
});

test("Playwright projects partition specs by the hydration filename rule", async () => {
  const projects = browserConfig.projects ?? [];
  assert.deepEqual(
    projects.map((project) => project.name),
    ["chromium", "hydration"],
  );
  const chromium = projects.find((project) => project.name === "chromium");
  const hydration = projects.find((project) => project.name === "hydration");
  assert.ok(chromium);
  assert.ok(hydration);
  assert.deepEqual(chromium.use, hydration.use);
  if (typeof chromium.testIgnore !== "string")
    assert.fail("chromium must ignore one hydration filename glob");
  assert.equal(hydration.testMatch, chromium.testIgnore);

  const testDirectory = path.resolve(repositoryRoot, browserConfig.testDir!);
  const files = await specFiles(testDirectory, testDirectory);
  const pattern = chromium.testIgnore;
  const hydrationFiles = files.filter((file) => minimatch(file, pattern));
  const browserFiles = files.filter((file) => !minimatch(file, pattern));
  assert.ok(hydrationFiles.length > 0);
  assert.ok(browserFiles.length > 0);
  assert.deepEqual(
    hydrationFiles,
    files.filter((file) => path.basename(file).includes("hydration")),
  );
  assert.deepEqual([...browserFiles, ...hydrationFiles].sort(), files);
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
  assert.equal(
    scripts["test:hydration:prepared"],
    "node scripts/verification/run-browser.mjs --suite hydration",
  );
});

test("public package and test wrappers preserve caller arguments through nested npm", async (context) => {
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
  await fs.mkdir(path.join(root, "scripts/verification"), { recursive: true });
  await Promise.all([
    fs.writeFile(
      path.join(root, "package.json"),
      JSON.stringify({
        name: "mokly-package-entrypoint-probe",
        private: true,
        scripts: {
          build: 'node -e ""',
          "prepare:verification": 'node -e ""',
          "prepare:unit": 'node -e ""',
          test: scripts.test,
          "test:unit": scripts["test:unit"],
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
  await fs.copyFile(
    path.join(root, "arguments.mjs"),
    path.join(root, "scripts/verification/run-unit-dev.mjs"),
  );
  for (const script of ["package:check", "package:smoke"]) {
    const environment = { ...process.env, MOKLY_ARGUMENT_OUTPUT: output };
    await runNpm(["run", script], { cwd: root, env: environment });
    assert.deepEqual(JSON.parse(await fs.readFile(output, "utf8")), []);
    await runNpm(["run", script, "--", "--artifacts", artifacts], {
      cwd: root,
      env: environment,
    });
    assert.deepEqual(JSON.parse(await fs.readFile(output, "utf8")), [
      "--artifacts",
      artifacts,
    ]);
  }
  const args = [
    "tests/one file.test.ts",
    "--test-name-pattern",
    "^(one name|two name).*end$",
    "--test-name-pattern=three (four|five)$",
  ];
  for (const command of [["test"], ["run", "test:unit"]]) {
    await runNpm([...command, "--", ...args], {
      cwd: root,
      env: { ...process.env, MOKLY_ARGUMENT_OUTPUT: output },
    });
    assert.deepEqual(JSON.parse(await fs.readFile(output, "utf8")), args);
  }
});

async function specFiles(directory: string, root: string): Promise<string[]> {
  const files: string[] = [];
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await specFiles(target, root)));
    else if (entry.isFile() && entry.name.endsWith(".spec.ts"))
      files.push(path.relative(root, target).split(path.sep).join("/"));
  }
  return files.sort();
}
