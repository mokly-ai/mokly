import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import type { TestContext } from "node:test";

import { discoverUnitFiles } from "../scripts/verification/evidence.mjs";
import {
  parseUnitSelection,
  selectUnitFiles,
} from "../scripts/verification/unit-selection.mjs";

const inventory = [
  "packages/viewer/tests/viewer.test.tsx",
  "tests/alpha.test.ts",
  "tests/nested/beta.test.ts",
];

async function fixture(context: TestContext): Promise<string> {
  const root = await fs.mkdtemp(
    path.join(os.tmpdir(), "mokly-unit-selection-"),
  );
  context.after(() => fs.rm(root, { recursive: true, force: true }));
  for (const file of [
    ...inventory,
    "helper.test.ts",
    "tests/browser/view.spec.ts",
  ]) {
    await fs.mkdir(path.dirname(path.join(root, file)), { recursive: true });
    await fs.writeFile(path.join(root, file), "");
  }
  return root;
}

test("developer selection discovers fixture files and keeps no-argument runs complete", async (context) => {
  const root = await fixture(context);
  const selection = await parseUnitSelection(root, []);
  assert.equal(selection.selected, false);
  assert.deepEqual(selection.patterns, []);
  assert.deepEqual(await discoverUnitFiles(root), inventory);
  assert.deepEqual(selectUnitFiles(selection, inventory), inventory);
});

test("developer selection accepts normalized and absolute file arguments once", async (context) => {
  const root = await fixture(context);
  const argumentsForAlpha = [
    "tests/alpha.test.ts",
    "./tests/alpha.test.ts",
    "tests//alpha.test.ts",
    "tests/nested/../alpha.test.ts",
    "./tests/../tests/alpha.test.ts",
    path.join("tests", "alpha.test.ts"),
    path.join(root, "tests/alpha.test.ts"),
    "tests\\alpha.test.ts",
  ];
  const selection = await parseUnitSelection(root, [
    ...argumentsForAlpha,
    "packages/viewer/tests/viewer.test.tsx",
  ]);
  assert.equal(selection.selected, true);
  assert.deepEqual(selectUnitFiles(selection, inventory), [
    "tests/alpha.test.ts",
    "packages/viewer/tests/viewer.test.tsx",
  ]);
});

test("developer selection accepts absolute paths through a linked repository alias", async (context) => {
  const root = await fixture(context);
  const aliases = await fs.mkdtemp(
    path.join(os.tmpdir(), "mokly-unit-selection-alias-"),
  );
  context.after(() => fs.rm(aliases, { recursive: true, force: true }));
  const alias = path.join(aliases, "checkout");
  await fs.symlink(
    root,
    alias,
    process.platform === "win32" ? "junction" : "dir",
  );
  const file = "tests/alpha.test.ts";
  const argumentsForFile = [path.join(alias, file), path.join(root, file)];
  for (const repositoryRoot of [root, alias]) {
    const selection = await parseUnitSelection(
      repositoryRoot,
      argumentsForFile,
    );
    assert.deepEqual(selectUnitFiles(selection, inventory), [file]);
  }
});

for (const argument of [
  "../outside.test.ts",
  "tests",
  "tests/missing.test.ts",
  "tests/browser/view.spec.ts",
]) {
  test(
    "developer selection rejects file argument: " + argument,
    async (context) => {
      const root = await fixture(context);
      await assert.rejects(
        parseUnitSelection(root, [argument]),
        (error: Error) => {
          assert.ok(error.message.includes(argument));
          if (argument.endsWith(".spec.ts"))
            assert.ok(
              error.message.includes("npm run test:browser -- " + argument),
            );
          return true;
        },
      );
    },
  );
}

test("developer selection rejects absolute paths outside the repository", async (context) => {
  const root = await fixture(context);
  const argument = path.join(path.dirname(root), "outside.test.ts");
  await assert.rejects(parseUnitSelection(root, [argument]), (error: Error) => {
    assert.ok(error.message.includes(argument));
    return true;
  });
});

test("developer selection rejects inventory misses and names the original argument", async (context) => {
  const root = await fixture(context);
  const argument = "./tests/../helper.test.ts";
  const selection = await parseUnitSelection(root, [argument]);
  assert.throws(
    () => selectUnitFiles(selection, inventory),
    (error: Error) => {
      assert.ok(error.message.includes(argument));
      return true;
    },
  );
});

test("developer selection retains both pattern forms and repeats in order", async (context) => {
  const root = await fixture(context);
  const patterns = ["one (two|three)$", "four.*", "/^FIVE$/i"];
  const selection = await parseUnitSelection(root, [
    "--test-name-pattern=" + patterns[0],
    "tests/alpha.test.ts",
    "--test-name-pattern",
    patterns[1]!,
    "--test-name-pattern=" + patterns[2],
  ]);
  assert.equal(selection.selected, true);
  assert.deepEqual(selection.patterns, patterns);
  assert.deepEqual(selectUnitFiles(selection, inventory), [
    "tests/alpha.test.ts",
  ]);
});

test("a pattern alone selects the complete inventory under the selected policy", async (context) => {
  const root = await fixture(context);
  const selection = await parseUnitSelection(root, [
    "--test-name-pattern=alpha",
  ]);
  assert.equal(selection.selected, true);
  assert.deepEqual(selection.files, []);
  assert.deepEqual(selectUnitFiles(selection, inventory), inventory);
});

test("non-empty pattern values are forwarded literally in either form", async (context) => {
  const root = await fixture(context);
  const selection = await parseUnitSelection(root, [
    "--test-name-pattern",
    "-literal pattern",
    "--test-name-pattern=--literal",
  ]);
  assert.deepEqual(selection.patterns, ["-literal pattern", "--literal"]);
});

for (const args of [
  ["--test-name-pattern"],
  ["--test-name-pattern="],
  ["--test-name-pattern", ""],
  ["--test-name-pattern", "["],
  ["--test-name-pattern=["],
  ["--test-name-pattern", "/alpha/ii"],
  ["--test-name-pattern=/alpha/ii"],
  ["--unknown"],
  ["-g", "alpha"],
]) {
  test(
    "developer selection prints usage for " + JSON.stringify(args),
    async (context) => {
      const root = await fixture(context);
      await assert.rejects(parseUnitSelection(root, args), (error: Error) => {
        assert.match(error.message, /usage: npm test --/u);
        assert.match(error.message, /npm run test:unit --/u);
        assert.match(error.message, /--test-name-pattern=<regex>/u);
        assert.match(error.message, /--test-name-pattern <regex>/u);
        return true;
      });
    },
  );
}

for (const args of [["--shard"], ["--shard", "1/4"], ["--shard=1/4"]]) {
  test(
    "developer selection rejects shards: " + JSON.stringify(args),
    async (context) => {
      const root = await fixture(context);
      await assert.rejects(parseUnitSelection(root, args), (error: Error) => {
        assert.match(error.message, /npm run test:prepared/u);
        assert.match(error.message, /cargo xtask check --suite unit --shard/u);
        return true;
      });
    },
  );
}

test("developer selection fails when discovery is empty", async (context) => {
  const root = await fixture(context);
  const selection = await parseUnitSelection(root, []);
  assert.throws(() => selectUnitFiles(selection, []), /discovery was empty/u);
});
