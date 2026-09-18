import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { repositoryRoot } from "./helpers/fixture.js";

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
