import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { repositoryRoot } from "./helpers/fixture.js";

const coverageCommandPattern =
  /run-coverage\.mjs|coverage:prepared|npm run coverage|coverage-runner/u;

test("the coverage checker is a public developer command", async () => {
  const packageJson = JSON.parse(
    await fs.readFile(path.join(repositoryRoot, "package.json"), "utf8"),
  );
  const scripts = packageJson.scripts as Readonly<Record<string, string>>;
  assert.equal(
    scripts.coverage,
    "npm run prepare:verification && node scripts/verification/run-coverage.mjs",
  );
  assert.equal(
    scripts["coverage:prepared"],
    "node scripts/verification/run-coverage.mjs",
  );
  const entry = await fs.readFile(
    path.join(repositoryRoot, "scripts/verification/run-coverage.mjs"),
    "utf8",
  );
  assert.match(entry, /from "\.\/coverage-runner\.mjs"/u);
});

test("hosted CI never runs the coverage checker", async () => {
  const workflows = path.join(repositoryRoot, ".github/workflows");
  const names = (await fs.readdir(workflows)).filter((name) =>
    /\.ya?ml$/u.test(name),
  );
  assert.ok(names.includes("ci.yml"));
  for (const name of names) {
    const source = await fs.readFile(path.join(workflows, name), "utf8");
    assert.doesNotMatch(
      source,
      coverageCommandPattern,
      `${name} must not run the local coverage checker`,
    );
    assert.doesNotMatch(source, /test-coverage/u, name);
  }
});

test("the complete local gate never runs the coverage checker", async () => {
  const check = await fs.readFile(
    path.join(repositoryRoot, "xtask/src/check.rs"),
    "utf8",
  );
  assert.doesNotMatch(check, coverageCommandPattern);
  assert.doesNotMatch(check, /"coverage"/u);
});

test("the coverage output directory stays ignored", async () => {
  const ignore = await fs.readFile(
    path.join(repositoryRoot, ".gitignore"),
    "utf8",
  );
  assert.ok(ignore.split(/\r?\n/u).includes("coverage/"));
});
