/** Git-backed tests for the separate test helper export baseline. */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  captureRatchets,
  createDivergedRepository,
  git,
} from "./helpers/repository_ratchets.js";

const baselineFile = "xtask/unused-test-helper-exports.txt";
const key = "tests/helpers/value.ts#value";
const sourcePass =
  "Unused internal export ratchet passed (1 JavaScript/TypeScript module(s), 1 baseline exception(s)).";

test("the source candidate count retains existing linked-file behavior", async (context) => {
  const fixture = await createDivergedRepository();
  context.after(() =>
    fs.promises.rm(fixture.root, { recursive: true, force: true }),
  );
  await fs.promises.writeFile(
    path.join(fixture.root, "scripts/value.mjs"),
    "void 0;\n",
  );
  await fs.promises.symlink(
    "value.mjs",
    path.join(fixture.root, "scripts/alias.mjs"),
  );
  const result = captureRatchets(fixture.root);
  assert.equal(result.passed, true, result.output);
  assert.ok(
    result.output
      .split("\n")
      .includes(
        "Unused internal export ratchet passed (3 JavaScript/TypeScript module(s), 1 baseline exception(s)).",
      ),
  );
});

test("a new unused helper fails while the source-root audit stays unchanged", async (context) => {
  const fixture = await createDivergedRepository();
  context.after(() =>
    fs.promises.rm(fixture.root, { recursive: true, force: true }),
  );
  await fs.promises.writeFile(
    path.join(fixture.root, "tests/helpers/value.ts"),
    "export const value = 1;\n",
  );
  const result = captureRatchets(fixture.root);
  assert.equal(result.passed, false, result.output);
  assert.ok(result.output.split("\n").includes(sourcePass));
  assert.ok(
    result.output
      .split("\n")
      .includes(`- new unused test helper export: ${key}`),
  );
});

test("runner-discovered files and path fixtures do not produce helper findings", async (context) => {
  const fixture = await createDivergedRepository();
  context.after(() =>
    fs.promises.rm(fixture.root, { recursive: true, force: true }),
  );
  for (const relative of [
    "tests/unused.test.ts",
    "tests/unused.test.tsx",
    "tests/browser/unused.spec.ts",
    "tests/fixtures/unused.ts",
  ]) {
    await fs.promises.mkdir(path.dirname(path.join(fixture.root, relative)), {
      recursive: true,
    });
    await fs.promises.writeFile(
      path.join(fixture.root, relative),
      "export const value = 1;\n",
    );
  }
  const result = captureRatchets(fixture.root);
  assert.equal(result.passed, true, result.output);
  assert.ok(result.output.split("\n").includes(sourcePass));
  assert.ok(
    result.output.includes(
      "Unused test helper export ratchet passed (0 test helper module(s), 0 baseline exception(s)).",
    ),
  );
});

test("a comparison commit before the helper baseline permits bootstrap", async (context) => {
  const fixture = await createDivergedRepository({
    bootstrapTestHelpers: true,
  });
  context.after(() =>
    fs.promises.rm(fixture.root, { recursive: true, force: true }),
  );
  await fs.promises.writeFile(
    path.join(fixture.root, "tests/helpers/value.ts"),
    "export const value = 1;\n",
  );
  await fs.promises.writeFile(
    path.join(fixture.root, baselineFile),
    `${key}\r\n`,
  );
  const result = captureRatchets(fixture.root);
  assert.equal(result.passed, true, result.output);
  assert.ok(result.output.split("\n").includes(sourcePass));
  assert.ok(
    result.output.includes(
      "Unused test helper export ratchet passed (1 test helper module(s), 1 baseline exception(s)).",
    ),
  );
});

test("a baseline entry absent at the comparison commit fails after bootstrap", async (context) => {
  const fixture = await createDivergedRepository();
  context.after(() =>
    fs.promises.rm(fixture.root, { recursive: true, force: true }),
  );
  await fs.promises.writeFile(
    path.join(fixture.root, "tests/helpers/value.ts"),
    "export const value = 1;\n",
  );
  await fs.promises.writeFile(
    path.join(fixture.root, baselineFile),
    `${key}\n`,
  );
  const result = captureRatchets(fixture.root);
  assert.equal(result.passed, false, result.output);
  assert.ok(
    result.output
      .split("\n")
      .includes(
        `- baseline entry was not present at the comparison commit: ${key}`,
      ),
  );
  assert.ok(result.output.split("\n").includes(sourcePass));
});

test("a missing current helper baseline fails even during bootstrap", async (context) => {
  const fixture = await createDivergedRepository({
    bootstrapTestHelpers: true,
  });
  context.after(() =>
    fs.promises.rm(fixture.root, { recursive: true, force: true }),
  );
  await fs.promises.rm(path.join(fixture.root, baselineFile));
  const result = captureRatchets(fixture.root);
  assert.equal(result.passed, false, result.output);
  assert.ok(
    result.output.includes("Unused test helper export ratchet could not run:"),
  );
  assert.ok(result.output.includes(baselineFile));
  assert.ok(result.output.split("\n").includes(sourcePass));
});

test("a shared graph read error fails both export audits without retrying", async (context) => {
  const fixture = await createDivergedRepository();
  context.after(() =>
    fs.promises.rm(fixture.root, { recursive: true, force: true }),
  );
  const target = path.join(fixture.root, "scripts/legacy.mjs");
  const original = fs.readFileSync;
  const read = context.mock.method(
    fs,
    "readFileSync",
    (...args: Parameters<typeof original>) => {
      if (String(args[0]) === target)
        throw new Error("shared graph read failed");
      return original(...args);
    },
  );
  const result = captureRatchets(fixture.root);
  assert.equal(result.passed, false, result.output);
  for (const label of ["Unused internal export", "Unused test helper export"])
    assert.ok(
      result.output
        .split("\n")
        .includes(`${label} ratchet could not run: shared graph read failed`),
    );
  assert.equal(
    read.mock.calls.filter((call) => String(call.arguments[0]) === target)
      .length,
    1,
  );
});

test("a ratchet run reads each module once for both export scopes", async (context) => {
  const fixture = await createDivergedRepository();
  context.after(() =>
    fs.promises.rm(fixture.root, { recursive: true, force: true }),
  );
  const read = context.mock.method(fs, "readFileSync");
  for (const count of [1, 4]) {
    const helpers = Array.from(
      { length: count },
      (_, index) => `tests/helpers/value${index}.ts`,
    );
    for (const helper of helpers)
      await fs.promises.writeFile(
        path.join(fixture.root, helper),
        "export const value = 1;\n",
      );
    await fs.promises.writeFile(
      path.join(fixture.root, "playwright.config.ts"),
      helpers
        .map(
          (helper, index) =>
            `import { value as value${index} } from "./${helper.replace(/\.ts$/u, ".js")}"; void value${index};`,
        )
        .join("\n"),
    );
    read.mock.resetCalls();
    const result = captureRatchets(fixture.root);
    assert.equal(result.passed, true, result.output);
    for (const relative of [
      "scripts/legacy.mjs",
      ...helpers,
      "playwright.config.ts",
    ])
      assert.equal(
        read.mock.calls.filter(
          (call) =>
            String(call.arguments[0]) === path.join(fixture.root, relative),
        ).length,
        1,
        relative,
      );
    const lines = result.output.split("\n");
    assert.ok(lines.includes(sourcePass));
    const helperPass = `Unused test helper export ratchet passed (${count} test helper module(s), 0 baseline exception(s)).`;
    assert.ok(lines.includes(helperPass));
    assert.equal(lines.indexOf(helperPass), lines.indexOf(sourcePass) + 1);
    assert.ok(
      lines[lines.indexOf(helperPass) + 1]?.startsWith(
        "Public package export ratchet passed",
      ),
    );
    assert.equal(
      git(fixture.root, "merge-base", "HEAD", "origin/main").trim(),
      fixture.branchPoint,
    );
  }
});
